/**
 * Transactions Routes
 * 
 * Handles all transaction-related API endpoints:
 * - GET /api/transactions - List transactions with optional filters
 * - POST /api/transactions/manual - Create a manual transaction
 * - PATCH /api/transactions/:id/splits - Update transaction splits
 * - DELETE /api/transactions/:id - Delete a transaction
 */

import { Router } from 'express';
import { transactionStore, userStore, getExchangeRate, getTransactions, apiConfigStore, walletConfigStore } from '../models/store.js';
import { Transaction, ManualTransactionInput, SplitDetail, Currency, SourceType, SplitStatus, TransactionShareLog, UserSplit } from '../models/types.js';
import { shareLogStore } from '../models/shareLogs.js';
import { createScopedLogger } from '../utils/logger.js';

const router = Router();
const log = createScopedLogger('Transactions');

/**
 * Helper function: Generate default splits for a transaction
 * This ensures all transactions use the current default user ratios
 */
function generateDefaultSplits(transaction: Transaction, users: UserSplit[], exchangeRate: number): SplitDetail[] {
  // Calculate total amount in CNY
  const totalAmount = transaction.currency === 'USDT' 
    ? transaction.originalAmount * exchangeRate 
    : transaction.originalAmount;
  
  // Generate splits based on current user ratios
  const splits = users.map(u => ({
    userId: u.id,
    userName: u.name,
    ratio: u.ratio,
    amount: Math.round(totalAmount * u.ratio * 100) / 100
  }));
  
  // Verify total ratio is approximately 1.0
  const totalRatio = splits.reduce((sum, s) => sum + s.ratio, 0);
  if (Math.abs(totalRatio - 1.0) > 0.01) {
    log.warn(`Total ratio is ${totalRatio}, not 1.0`);
  }
  
  return splits;
}

/**
 * GET /api/transactions
 * 
 * Query parameters:
 * - source?: SourceType - Filter by source
 * - currency?: Currency - Filter by currency
 * - status?: SplitStatus - Filter by status
 * - settled?: 'true' | 'false' - Filter by settlement status
 * 
 * Returns: Transaction[]
 * 
 * Note: Automatically fixes transactions without splits by applying default user ratios
 */
router.get('/', (req, res) => {
  try {
    log.debug('Request received');
    // Use unified getTransactions() function to ensure consistency
    let transactions = getTransactions();
    
    // Migrate old 'SafePerim' source to use API config name
    // This ensures all transactions use the correct source name from API configs
    const apiConfigs = apiConfigStore.getAll();
    const safeperimConfig = apiConfigs.find(c => c.provider === 'safeperim' && c.isActive);
    if (safeperimConfig) {
      const oldSourceName = 'SafePerim'; // Old hardcoded name
      const newSourceName = safeperimConfig.name; // Current API config name
      
      if (oldSourceName !== newSourceName) {
        const oldSourceTransactions = transactions.filter(t => t.source === oldSourceName);
        if (oldSourceTransactions.length > 0) {
          log.info(`Migrating ${oldSourceTransactions.length} transactions from '${oldSourceName}' to '${newSourceName}'`);
          oldSourceTransactions.forEach(tx => {
            const updated = transactionStore.update(tx.id, { source: newSourceName });
            if (updated) {
              log.debug(`Migrated transaction ${tx.id} source: '${oldSourceName}' -> '${newSourceName}'`);
            }
          });
          // Refresh transactions after migration
          transactions = getTransactions();
        }
      }
    }
    
    // FORCE ALL transactions to use current default user ratios and fee configurations
    // This ensures ALL transactions in the ledger use the current default split ratios and fees
    // We ALWAYS update ALL transactions to ensure consistency
    const users = userStore.getAll();
    const exchangeRate = getExchangeRate();
    const allApiConfigs = apiConfigStore.getAll();
    const allWalletConfigs = walletConfigStore.getAll();
    let updatedCount = 0;
    
    if (users.length > 0) {
      log.debug(`FORCING all transactions to use default split ratios and fees`);
      log.debug(`Current default ratios: ${Array.from(users.map(u => `${u.name}:${(u.ratio * 100).toFixed(2)}%`)).join(', ')}`);
      log.debug(`Total transactions to process: ${transactions.length}`);
      
      // FORCE update ALL transactions - no checking, just update
      transactions = transactions.map((tx, index) => {
        // Find matching API config or wallet config for fee calculation
        const apiConfig = allApiConfigs.find(c => c.name === tx.source && c.isActive);
        const walletConfig = tx.source === 'USDT Wallet' && tx.id.includes('wallet-') 
          ? allWalletConfigs.find(c => tx.id.includes(c.id))
          : undefined;
        
        // Recalculate fees based on current configs
        let feeAmount = 0;
        let feeAmountCNY = 0;
        let netAmount = tx.originalAmount;
        let netAmountCNY = tx.cnyAmount;
        
        if (apiConfig && apiConfig.feePercentage) {
          // Payment API: percentage-based fee
          feeAmount = Math.round(tx.originalAmount * apiConfig.feePercentage * 100) / 100;
          feeAmountCNY = tx.currency === 'CNY' 
            ? feeAmount 
            : Math.round(feeAmount * exchangeRate * 100) / 100;
          netAmount = tx.originalAmount - feeAmount;
          netAmountCNY = tx.cnyAmount - feeAmountCNY;
        } else if (walletConfig && walletConfig.feeAmount) {
          // Wallet: fixed amount fee
          feeAmount = walletConfig.feeAmount;
          feeAmountCNY = Math.round(feeAmount * exchangeRate * 100) / 100;
          netAmount = Math.max(0, tx.originalAmount - feeAmount);
          netAmountCNY = Math.round(netAmount * exchangeRate * 100) / 100;
        }
        
        // Generate default splits based on current user ratios (using net amount)
        const defaultSplits = users.map(u => ({
          userId: u.id,
          userName: u.name,
          ratio: u.ratio,
          amount: Math.round(netAmountCNY * u.ratio * 100) / 100
        }));
        
        // Get current splits for logging
        const currentSplits = tx.splits || [];
        
        // Always update the transaction in store with new fees and splits
        const updated = transactionStore.update(tx.id, {
          splits: defaultSplits,
          feeAmount: feeAmount > 0 ? feeAmount : undefined,
          feeAmountCNY: feeAmountCNY > 0 ? feeAmountCNY : undefined,
          netAmount: netAmount,
          netAmountCNY: netAmountCNY
        });
        
        if (updated) {
          updatedCount++;
          if (index < 5 || updatedCount <= 10) {
            // Log first 5 transactions or first 10 updates (debug level only)
            const oldRatios = currentSplits.length > 0 
              ? currentSplits.map(s => `${s.userName || s.userId}:${(s.ratio * 100).toFixed(2)}%`).join(', ')
              : 'none';
            const newRatios = defaultSplits.map(s => `${s.userName}:${(s.ratio * 100).toFixed(2)}%`).join(', ');
            log.debug(`Updated tx ${tx.id} (${tx.timestamp}): [${oldRatios}] -> [${newRatios}], fee: ${feeAmount > 0 ? feeAmount : 'none'}`);
          }
          // Return the updated transaction from store
          return updated;
        } else {
          log.error(`Failed to update transaction ${tx.id} - not found in store`);
          // Return transaction with default splits and fees even if update failed
          return { 
            ...tx, 
            splits: defaultSplits,
            feeAmount: feeAmount > 0 ? feeAmount : undefined,
            feeAmountCNY: feeAmountCNY > 0 ? feeAmountCNY : undefined,
            netAmount: netAmount,
            netAmountCNY: netAmountCNY
          };
        }
      });
      
      log.debug(`Successfully updated ${updatedCount} out of ${transactions.length} transactions to use default split ratios and fees`);
    } else {
      log.warn(`No users configured. Cannot apply default split ratios.`);
    }
    
    // Apply filters
    const { source, currency, status } = req.query;
    
    if (source) {
      transactions = transactions.filter(t => t.source === source);
    }
    
    if (currency) {
      transactions = transactions.filter(t => t.currency === currency);
    }
    
    if (status) {
      transactions = transactions.filter(t => t.status === status);
    }
    
    log.debug(`Returning ${transactions.length} transactions`);
    res.json(transactions);
  } catch (error) {
    log.error('Error:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

/**
 * POST /api/transactions/manual
 * 
 * Body: ManualTransactionInput
 * 
 * Creates a new manual transaction with auto-calculated splits based on user ratios.
 * Returns: Transaction (created)
 */
router.post('/manual', (req, res) => {
  try {
    const input: ManualTransactionInput = req.body;
    
    // Validate required fields
    if (!input.amount || !input.currency || !input.timestamp) {
      return res.status(400).json({ error: 'Missing required fields: amount, currency, timestamp' });
    }
    
    if (input.amount <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0' });
    }
    
    // Get current users
    const users = userStore.getAll();
    if (users.length === 0) {
      return res.status(400).json({ error: 'No users configured. Please configure users first.' });
    }
    
    // Generate unique ID
    const id = `manual-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    // Format timestamp
    let formattedTimestamp = input.timestamp;
    if (formattedTimestamp.includes('T')) {
      formattedTimestamp = formattedTimestamp.replace('T', ' ').substring(0, 16);
    }
    
    // Calculate CNY amount
    const exchangeRate = getExchangeRate();
    const cnyAmount = input.currency === 'USDT' 
      ? Math.round(input.amount * exchangeRate * 100) / 100
      : input.amount;
    
    // Calculate splits based on splitMode
    let splits: SplitDetail[] = [];
    
    if (input.splitMode === 'default') {
      // Use default ratios from users
      const totalAmount = input.currency === 'USDT' 
        ? input.amount * exchangeRate 
        : input.amount;
      
      splits = users.map(u => ({
        userId: u.id,
        userName: u.name,
        ratio: u.ratio,
        amount: Math.round(totalAmount * u.ratio * 100) / 100
      }));
    } else if (input.splitMode === 'single' && input.singleTargetId) {
      // 100% to single user
      const targetUser = users.find(u => u.id === input.singleTargetId);
      if (targetUser) {
        const totalAmount = input.currency === 'USDT' 
          ? input.amount * exchangeRate 
          : input.amount;
        splits = [{
          userId: targetUser.id,
          userName: targetUser.name,
          ratio: 1.0,
          amount: Math.round(totalAmount * 100) / 100
        }];
      } else {
        // Fallback to default
        const totalAmount = input.currency === 'USDT' 
          ? input.amount * exchangeRate 
          : input.amount;
        splits = users.map(u => ({
          userId: u.id,
          userName: u.name,
          ratio: u.ratio,
          amount: Math.round(totalAmount * u.ratio * 100) / 100
        }));
      }
    } else if (input.splitMode === 'custom' && input.customRatios) {
      // Use custom ratios
      const totalAmount = input.currency === 'USDT' 
        ? input.amount * exchangeRate 
        : input.amount;
      
      splits = users.map(u => {
        const ratio = input.customRatios![u.id] || 0;
        return {
          userId: u.id,
          userName: u.name,
          ratio: ratio,
          amount: Math.round(totalAmount * ratio * 100) / 100
        };
      }).filter(s => s.ratio > 0);
    }
    
    // Ensure we have at least one split
    if (splits.length === 0) {
      const totalAmount = input.currency === 'USDT' 
        ? input.amount * exchangeRate 
        : input.amount;
      splits = users.map(u => ({
        userId: u.id,
        userName: u.name,
        ratio: u.ratio,
        amount: Math.round(totalAmount * u.ratio * 100) / 100
      }));
    }
    
    // Create transaction
    // Create transaction object
    // New transactions are always unsettled (cleared = false) by default
    const transaction: Transaction = {
      id,
      timestamp: formattedTimestamp,
      source: 'Manual',
      currency: input.currency,
      originalAmount: input.amount,
      cnyAmount,
      status: 'Completed',
      splits,
      cleared: false // Default: unsettled
    };
    
    // Add to store
    const created = transactionStore.add(transaction);
    
    log.debug(`Created manual transaction: ${created.id}`);
    res.status(201).json(created);
  } catch (error) {
    log.error('Error creating manual transaction:', error);
    res.status(500).json({ error: 'Failed to create transaction' });
  }
});

/**
 * Helper function: Check if splits have changed
 */
function hasSplitsChanged(
  oldSplits: SplitDetail[],
  newSplits: SplitDetail[]
): boolean {
  if (oldSplits.length !== newSplits.length) return true;
  
  const oldMap = new Map(oldSplits.map(s => [s.userId, s.ratio]));
  
  for (const s of newSplits) {
    if (!oldMap.has(s.userId)) return true;
    const oldRatio = oldMap.get(s.userId)!;
    // Compare ratios with small tolerance for floating point errors
    if (Math.abs(oldRatio - s.ratio) > 1e-6) return true;
  }
  
  return false;
}

/**
 * PATCH /api/transactions/:id/splits
 * 
 * Body: { splits: SplitDetail[], remark?: string }
 * 
 * Updates the splits for a specific transaction and creates a log entry.
 * Returns: Transaction (updated)
 */
router.patch('/:id/splits', (req, res) => {
  try {
    const { id } = req.params;
    const { splits, remark } = req.body;
    
    log.debug(`PATCH /:id/splits called: id=${id}, splits count=${splits?.length}, remark=${remark || 'none'}`);
    
    if (!splits || !Array.isArray(splits)) {
      log.warn(`Validation failed: splits is not an array`);
      return res.status(400).json({ error: 'splits must be an array' });
    }
    
    const transaction = transactionStore.getById(id);
    if (!transaction) {
      log.warn(`Transaction not found: ${id}`);
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    log.debug(`Transaction found: ${transaction.id}, current splits count: ${transaction.splits?.length || 0}`);
    
    // Validate splits format
    for (let i = 0; i < splits.length; i++) {
      const split = splits[i];
      if (!split.userId) {
        log.warn(`Validation failed: split[${i}] missing userId`);
        return res.status(400).json({ error: `Invalid split format at index ${i}: missing userId` });
      }
      if (!split.userName) {
        log.debug(`Warning: split[${i}] missing userName, will be filled from userStore`);
      }
      if (typeof split.ratio !== 'number') {
        log.warn(`Validation failed: split[${i}] ratio is not a number: ${typeof split.ratio}`);
        return res.status(400).json({ error: `Invalid split format at index ${i}: ratio must be a number` });
      }
      if (typeof split.amount !== 'number') {
        log.warn(`Validation failed: split[${i}] amount is not a number: ${typeof split.amount}`);
        return res.status(400).json({ error: `Invalid split format at index ${i}: amount must be a number` });
      }
    }
    
    log.debug(`All splits validated successfully`);
    
    // Get all users for name mapping (ensure userName is always present)
    const allUsers = userStore.getAll();
    const userMap = new Map(allUsers.map(u => [u.id, u.name]));
    
    // Get old splits for comparison (ensure userName is present)
    const oldSplits: SplitDetail[] = (transaction.splits || []).map(s => ({
      userId: s.userId,
      userName: s.userName || userMap.get(s.userId) || s.userId,
      ratio: s.ratio,
      amount: s.amount
    }));
    
    // Normalize new splits to ensure userName is present
    const normalizedNewSplits: SplitDetail[] = splits.map(s => ({
      userId: s.userId,
      userName: s.userName || userMap.get(s.userId) || s.userId,
      ratio: s.ratio,
      amount: s.amount
    }));
    
    // Debug: Log old and new splits for comparison
    log.debug(`Comparing splits for transaction ${id}:`, {
      oldSplits: oldSplits.map(s => ({ userId: s.userId, ratio: s.ratio })),
      newSplits: normalizedNewSplits.map(s => ({ userId: s.userId, ratio: s.ratio }))
    });
    
    // Check if splits have actually changed
    const changed = hasSplitsChanged(oldSplits, normalizedNewSplits);
    log.debug(`Splits changed: ${changed}`);
    
    // Update transaction with normalized splits
    const updated = transactionStore.update(id, { splits: normalizedNewSplits });
    
    if (!updated) {
      log.error(`Failed to update transaction ${id}`);
      return res.status(500).json({ error: 'Failed to update transaction' });
    }
    
    log.info(`Transaction ${id} updated successfully`);
    
    // ALWAYS create a log entry when splits are updated (even if ratios are the same, amounts might differ)
    // This ensures all manual adjustments are tracked
    const logEntry: TransactionShareLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      transactionId: id,
      time: Date.now(),
      operator: 'system', // TODO: Get from auth context if available
      oldShares: oldSplits.map(s => ({
        userId: s.userId,
        userName: s.userName,
        ratio: s.ratio,
        amount: s.amount
      })),
      newShares: normalizedNewSplits.map(s => ({
        userId: s.userId,
        userName: s.userName,
        ratio: s.ratio,
        amount: s.amount
      })),
      remark: remark || undefined
    };
    
    try {
      shareLogStore.add(id, logEntry);
      log.debug(`Created log entry ${logEntry.id} for transaction ${id}`);
    } catch (error) {
      log.error(`Error adding log entry:`, error);
    }
    
    res.json(updated);
  } catch (error) {
    log.error('Error updating transaction splits:', error);
    res.status(500).json({ error: 'Failed to update transaction splits' });
  }
});

/**
 * DELETE /api/transactions/batch
 * POST /api/transactions/batch/delete (alternative endpoint)
 * 
 * Body: { ids: string[] }
 * 
 * Deletes multiple transactions by IDs.
 * Returns: { ok: true, deletedCount: number, deletedIds: string[] }
 * 
 * NOTE: This route must be defined BEFORE /:id route to avoid route conflict
 * 
 * Some browsers/proxies may not support DELETE with body, so we also provide POST alternative
 */
router.delete('/batch', (req, res) => {
  try {
    log.debug('DELETE /api/transactions/batch request received');
    log.debug('Request headers:', req.headers);
    console.log('[DELETE /api/transactions/batch] Request body:', JSON.stringify(req.body));
    
    // Check if body is parsed correctly
    if (!req.body || typeof req.body !== 'object') {
      console.error('[DELETE /api/transactions/batch] Request body is not an object:', req.body);
      return res.status(400).json({ error: 'Invalid request body. Expected JSON object with "ids" array.' });
    }
    
    const { ids } = req.body;
    
    if (!ids) {
      console.error('[DELETE /api/transactions/batch] Missing "ids" field in request body');
      return res.status(400).json({ error: 'Missing ids in request body' });
    }
    
    if (!Array.isArray(ids)) {
      log.error(`"ids" is not an array: ${typeof ids}`);
      return res.status(400).json({ error: 'ids must be an array' });
    }
    
    if (ids.length === 0) {
      log.warn('Empty ids array');
      return res.status(400).json({ error: 'ids array is empty' });
    }
    
    log.info(`Attempting to delete ${ids.length} transactions`);
    log.debug(`Transaction IDs (first 10):`, ids.slice(0, 10));
    
    const deletedCount = transactionStore.deleteMany(ids);
    
    log.info(`Successfully deleted ${deletedCount} transactions (requested: ${ids.length})`);
    res.json({ ok: true, deletedCount, deletedIds: ids });
  } catch (error) {
    log.error('Error deleting transactions:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: `Failed to delete transactions: ${errorMessage}` });
  }
});

/**
 * POST /api/transactions/batch/delete
 * 
 * Alternative endpoint for batch deletion (some browsers don't support DELETE with body)
 * Same functionality as DELETE /api/transactions/batch
 */
router.post('/batch/delete', (req, res) => {
  try {
    console.log('[POST /api/transactions/batch/delete] Request received');
    console.log('[POST /api/transactions/batch/delete] Request headers:', req.headers);
    console.log('[POST /api/transactions/batch/delete] Request body:', JSON.stringify(req.body));
    
    // Check if body is parsed correctly
    if (!req.body || typeof req.body !== 'object') {
      console.error('[POST /api/transactions/batch/delete] Request body is not an object:', req.body);
      return res.status(400).json({ error: 'Invalid request body. Expected JSON object with "ids" array.' });
    }
    
    const { ids } = req.body;
    
    if (!ids) {
      console.error('[POST /api/transactions/batch/delete] Missing "ids" field in request body');
      return res.status(400).json({ error: 'Missing ids in request body' });
    }
    
    if (!Array.isArray(ids)) {
      console.error('[POST /api/transactions/batch/delete] "ids" is not an array:', typeof ids);
      return res.status(400).json({ error: 'ids must be an array' });
    }
    
    if (ids.length === 0) {
      console.warn('[POST /api/transactions/batch/delete] Empty ids array');
      return res.status(400).json({ error: 'ids array is empty' });
    }
    
    console.log(`[POST /api/transactions/batch/delete] Attempting to delete ${ids.length} transactions`);
    console.log(`[POST /api/transactions/batch/delete] Transaction IDs (first 10):`, ids.slice(0, 10));
    
    const deletedCount = transactionStore.deleteMany(ids);
    
    console.log(`[POST /api/transactions/batch/delete] Successfully deleted ${deletedCount} transactions (requested: ${ids.length})`);
    res.json({ ok: true, deletedCount, deletedIds: ids });
  } catch (error) {
    console.error('[POST /api/transactions/batch/delete] Error deleting transactions:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('[POST /api/transactions/batch/delete] Error stack:', errorStack);
    res.status(500).json({ error: `Failed to delete transactions: ${errorMessage}` });
  }
});

/**
 * DELETE /api/transactions/:id
 * 
 * Deletes a transaction by ID.
 * Returns: { ok: true, deletedId: string }
 */
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    const deleted = transactionStore.delete(id);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    console.log(`[DELETE /api/transactions/:id] Deleted transaction: ${id}`);
    res.json({ ok: true, deletedId: id });
  } catch (error) {
    console.error('Error deleting transaction:', error);
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
});

export default router;

