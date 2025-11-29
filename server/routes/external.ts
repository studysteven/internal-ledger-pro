/**
 * External API Routes
 * 
 * Handles external payment gateway API endpoints:
 * - GET /api/external/transactions - Fetch transactions from external payment APIs
 * 
 * Frontend Contract:
 * - Request: GET /api/external/transactions?configId=xxx
 * - Response: Transaction[] (array of Transaction objects)
 * - Error Response: { error: string } (when configId is missing or config not found)
 */

import { Router } from 'express';
import { apiConfigStore, userStore, getExchangeRate, transactionStore, getTransactions, addTransactions } from '../models/store.js';
import { ApiConfig, Transaction, SplitDetail } from '../models/types.js';
import { fetchSafeperimTransactions, SafeperimConfig } from '../adapters/safeperimAdapter.js';
import { createScopedLogger } from '../utils/logger.js';

const router = Router();
const log = createScopedLogger('External');

/**
 * GET /api/external/transactions
 * 
 * Query parameters:
 * - configId: string - API configuration ID (e.g., "api-1", "safeperim-main")
 * - since?: number - Optional timestamp (milliseconds) for incremental sync
 * 
 * Returns: { ok: boolean, added: number, transactions: Transaction[] }
 * - ok: true if successful, false if error
 * - added: number of new transactions added to store
 * - transactions: array of newly added transactions
 */
router.get('/transactions', async (req, res) => {
  try {
    const configId = String(req.query.configId ?? req.query.confId ?? '');
    const since = req.query.since ? Number(req.query.since) : undefined;
    
    log.debug(`Request received, configId: ${configId}, since: ${since ? new Date(since).toISOString() : 'none'}`);
    
    // Validate configId
    if (!configId) {
      log.error('Missing configId parameter');
      return res.status(400).json({ ok: false, error: 'Missing configId parameter', added: 0, transactions: [] });
    }
    
    // 1. Get API configuration from store
    const apiConfig = apiConfigStore.getById(configId);
    
    if (!apiConfig) {
      log.error(`Config not found: ${configId}`);
      return res.status(404).json({ ok: false, error: `API configuration not found: ${configId}`, added: 0, transactions: [] });
    }
    
    // Check if config is active
    if (!apiConfig.isActive) {
      log.warn(`Config ${configId} is not active`);
      return res.status(400).json({ ok: false, error: `API configuration ${configId} is not active`, added: 0, transactions: [] });
    }
    
    log.info(`Found config: ${apiConfig.name} (${apiConfig.baseUrl}), provider: ${apiConfig.provider || 'unknown'}`);
    
    let newTransactions: Transaction[] = [];
    
    // 2. Route to appropriate adapter based on provider
    if (apiConfig.provider !== 'safeperim') {
      log.warn(`Unsupported provider: ${apiConfig.provider || 'unknown'}`);
      return res.status(400).json({ ok: false, error: 'unsupported_provider', added: 0, transactions: [] });
    }
    
    // Safeperim adapter
    log.debug('Using Safeperim adapter');
    
    // Construct SafeperimConfig with fallback to environment variables
    const safeperimConfig: SafeperimConfig = {
      baseUrl: apiConfig.baseUrl || process.env.SAFEPERIM_BASE_URL || '',
      merchantId: apiConfig.merchantId || process.env.SAFEPERIM_MERCHANT_ID || ''
    };
    
    if (!safeperimConfig.baseUrl || !safeperimConfig.merchantId) {
      log.error('Missing baseUrl or merchantId in config');
      return res.status(400).json({ ok: false, error: 'Missing baseUrl or merchantId', added: 0, transactions: [] });
    }
    
    // Fetch transactions from Safeperim
    const externalTxs = await fetchSafeperimTransactions(safeperimConfig, since);
    
    log.debug(`Safeperim returned ${externalTxs.length} external transactions`);
    
    if (externalTxs.length === 0) {
      return res.json({ ok: true, added: 0, transactions: [] });
    }
    
    // 3. Map ExternalTx[] to Transaction[] and deduplicate
    const users = userStore.getAll();
    const existingTransactions = getTransactions();
    const existingExternalTxIds = new Set(
      existingTransactions
        .map(t => t.externalTxId)
        .filter((id): id is string => !!id)
    );
    
    log.debug(`Existing transactions: ${existingTransactions.length}, existing externalTxIds: ${existingExternalTxIds.size}`);
    
    // Get exchange rate for fee calculation
    const exchangeRate = getExchangeRate();
    
    // Map all ExternalTx to Transaction (temporarily accept all, no status filtering)
    const mapped: Transaction[] = externalTxs.map(extTx => {
      // Skip if already exists (deduplicate by externalTxId)
      const externalTxId = `safeperim:${extTx.externalTxId}`;
      if (existingExternalTxIds.has(externalTxId)) {
        log.debug(`Skipping duplicate transaction: ${externalTxId}`);
        return null; // Will filter out nulls later
      }
      
      // Calculate CNY amount (assume 1:1 for CNY, can add exchange rate later for other currencies)
      const originalCnyAmount = extTx.currency === 'CNY' ? extTx.amount : extTx.amount;
      
      // Calculate fee (percentage-based for payment APIs)
      const feePercentage = apiConfig.feePercentage || 0;
      const feeAmount = feePercentage > 0 
        ? Math.round(extTx.amount * feePercentage * 100) / 100 
        : 0;
      const feeAmountCNY = extTx.currency === 'CNY' 
        ? feeAmount 
        : Math.round(feeAmount * exchangeRate * 100) / 100;
      
      // Calculate net amounts (after fees)
      const netAmount = extTx.amount - feeAmount;
      const netAmountCNY = originalCnyAmount - feeAmountCNY;
      
      // Use net amount for splits calculation (users receive net amount after fees)
      const cnyAmount = netAmountCNY;
      
      // Generate default splits based on user ratios (using net amount)
      const splits: SplitDetail[] = users.map(u => ({
        userId: u.id,
        userName: u.name,
        ratio: u.ratio,
        amount: Math.round(cnyAmount * u.ratio * 100) / 100
      }));
      
      // Format timestamp
      const txDate = new Date(extTx.paidAt);
      const year = txDate.getFullYear();
      const month = String(txDate.getMonth() + 1).padStart(2, '0');
      const day = String(txDate.getDate()).padStart(2, '0');
      const hours = String(txDate.getHours()).padStart(2, '0');
      const minutes = String(txDate.getMinutes()).padStart(2, '0');
      const formattedTimestamp = `${year}-${month}-${day} ${hours}:${minutes}`;
      
      // Generate unique transaction ID
      // Use a combination of config ID, external transaction ID, timestamp, and a random suffix to ensure uniqueness
      // This prevents duplicate IDs when the same external transaction is synced multiple times
      const randomSuffix = Math.random().toString(36).substring(2, 9);
      const transactionId = `external-${apiConfig.id}-${extTx.externalTxId}-${extTx.paidAt}-${randomSuffix}`;
      
      // Create transaction object
      // Use apiConfig.name as source to support dynamic payment API names
      // This allows each payment API to have its own source identifier
      const transaction: Transaction = {
        id: transactionId,
        timestamp: formattedTimestamp,
        source: apiConfig.name || 'Payment API', // Use API config name as source
        currency: extTx.currency === 'CNY' ? 'CNY' : 'USDT',
        originalAmount: extTx.amount,
        cnyAmount: originalCnyAmount, // Original amount before fees
        feeAmount: feeAmount > 0 ? feeAmount : undefined,
        feeAmountCNY: feeAmountCNY > 0 ? feeAmountCNY : undefined,
        netAmount: netAmount,
        netAmountCNY: netAmountCNY,
        status: extTx.status === 'SUCCESS' ? 'Completed' : 'Pending', // Map SUCCESS -> Completed, others -> Pending
        splits,
        externalTxId,
        cleared: false // New transactions are always unsettled
      };
      
      log.debug(`Prepared transaction: ${transactionId} (${extTx.amount} ${extTx.currency}), source: ${transaction.source}`);
      return transaction;
    }).filter((tx): tx is Transaction => tx !== null); // Filter out nulls (duplicates)
    
    // Set newTransactions to mapped array
    newTransactions = mapped;
    
    // 4. Add all new transactions to store using addTransactions
    if (newTransactions.length > 0) {
      addTransactions(newTransactions);
      log.info(`Added ${newTransactions.length} transactions to store via addTransactions()`);
    }
    
    log.info(`Successfully added ${newTransactions.length} new transactions from ${apiConfig.name}`);
    
    // 5. Return response with ok, added, and transactions
    res.json({
      ok: true,
      added: newTransactions.length,
      transactions: newTransactions
    });
    
  } catch (error) {
    log.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ 
      ok: false, 
      error: `Failed to fetch external transactions: ${errorMessage}`,
      added: 0,
      transactions: [] 
    });
  }
});

/**
 * Generate mock transactions for testing
 * 
 * This function creates sample Transaction objects that match the expected format.
 * In production, this would be replaced with actual API calls to external payment gateways.
 */
function generateMockTransactions(apiConfig: ApiConfig): Transaction[] {
  const users = userStore.getAll();
  const exchangeRate = getExchangeRate();
  
  // Generate 2-3 mock transactions
  const mockCount = 2 + Math.floor(Math.random() * 2); // 2 or 3 transactions
  const transactions: Transaction[] = [];
  
  const now = new Date();
  
  for (let i = 0; i < mockCount; i++) {
    // Generate random amount (100-5000 CNY or 10-500 USDT)
    const isUSDT = Math.random() > 0.5;
    const originalAmount = isUSDT 
      ? Math.round((10 + Math.random() * 490) * 100) / 100 // 10-500 USDT
      : Math.round(100 + Math.random() * 4900); // 100-5000 CNY
    
    const cnyAmount = isUSDT 
      ? Math.round(originalAmount * exchangeRate * 100) / 100
      : originalAmount;
    
    // Generate timestamp (within last 7 days)
    const daysAgo = Math.floor(Math.random() * 7);
    const hoursAgo = Math.floor(Math.random() * 24);
    const timestamp = new Date(now);
    timestamp.setDate(timestamp.getDate() - daysAgo);
    timestamp.setHours(timestamp.getHours() - hoursAgo);
    
    const formattedTimestamp = `${timestamp.getFullYear()}-${String(timestamp.getMonth() + 1).padStart(2, '0')}-${String(timestamp.getDate()).padStart(2, '0')} ${String(timestamp.getHours()).padStart(2, '0')}:${String(timestamp.getMinutes()).padStart(2, '0')}`;
    
    // Generate default splits based on user ratios
    const splits: SplitDetail[] = users.map(u => ({
      userId: u.id,
      userName: u.name,
      ratio: u.ratio,
      amount: Math.round(cnyAmount * u.ratio * 100) / 100
    }));
    
    // Generate unique transaction ID
    const transactionId = `external-${apiConfig.id}-${Date.now()}-${i}`;
    
    const transaction: Transaction = {
      id: transactionId,
      timestamp: formattedTimestamp,
      source: apiConfig.name || 'Payment API', // Use API config name as source
      currency: isUSDT ? 'USDT' : 'CNY',
      originalAmount,
      cnyAmount,
      status: 'Completed',
      splits,
      cleared: false // New transactions are always unsettled
    };
    
    transactions.push(transaction);
  }
  
  return transactions;
}

export default router;

