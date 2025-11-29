/**
 * Users Routes
 * 
 * Handles user split configuration API endpoints:
 * - GET /api/users - Get all users
 * - POST /api/users - Update all users (replaces entire list)
 * 
 * When users are updated, all existing transactions are automatically updated
 * to use the new split ratios.
 */

import { Router } from 'express';
import { userStore, transactionStore, getExchangeRate } from '../models/store.js';
import { UserSplit, Transaction, SplitDetail } from '../models/types.js';
import { createScopedLogger } from '../utils/logger.js';

const router = Router();
const log = createScopedLogger('Users');

/**
 * Generate default splits for a transaction based on current user ratios
 * This function is shared with transactions.ts logic
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
 * GET /api/users
 * 
 * Returns: UserSplit[]
 */
router.get('/', (req, res) => {
  try {
    const users = userStore.getAll();
    res.json(users);
  } catch (error) {
    log.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * POST /api/users
 * 
 * Body: UserSplit[]
 * 
 * Replaces the entire user list with the provided array.
 * Returns: UserSplit[] (updated list)
 */
router.post('/', (req, res) => {
  try {
    const users: UserSplit[] = req.body;
    
    if (!Array.isArray(users)) {
      return res.status(400).json({ error: 'Body must be an array of users' });
    }
    
    // Validate each user
    for (const user of users) {
      if (!user.id || !user.name || typeof user.ratio !== 'number') {
        return res.status(400).json({ error: 'Invalid user format. Each user must have id, name, and ratio' });
      }
      if (user.ratio < 0 || user.ratio > 1) {
        return res.status(400).json({ error: 'User ratio must be between 0 and 1' });
      }
    }
    
    // Update store
    userStore.setAll(users);
    
    // CRITICAL: Immediately update ALL existing transactions to use the new split ratios
    // This ensures that when users adjust their split ratios, all transaction flows reflect the change
    log.info(`Updating all transactions to use new split ratios`);
    log.debug(`New ratios: ${users.map(u => `${u.name}:${(u.ratio * 100).toFixed(2)}%`).join(', ')}`);
    
    const allTransactions = transactionStore.getAll();
    const exchangeRate = getExchangeRate();
    let updatedCount = 0;
    
    if (allTransactions.length > 0) {
      log.debug(`Processing ${allTransactions.length} transactions...`);
      
      allTransactions.forEach((tx, index) => {
        const defaultSplits = generateDefaultSplits(tx, users, exchangeRate);
        const updated = transactionStore.update(tx.id, { splits: defaultSplits });
        
        if (updated) {
          updatedCount++;
          if (index < 5 || updatedCount <= 10) {
            // Log first 5 transactions or first 10 updates (debug level only)
            const newRatios = defaultSplits.map(s => `${s.userName}:${(s.ratio * 100).toFixed(2)}%`).join(', ');
            log.debug(`Updated tx ${tx.id} (${tx.timestamp}): [${newRatios}]`);
          }
        } else {
          log.error(`Failed to update transaction ${tx.id} - not found in store`);
        }
      });
      
      log.info(`Successfully updated ${updatedCount} out of ${allTransactions.length} transactions`);
    } else {
      log.debug(`No transactions to update`);
    }
    
    res.json(userStore.getAll());
  } catch (error) {
    log.error('Error updating users:', error);
    res.status(500).json({ error: 'Failed to update users' });
  }
});

export default router;

