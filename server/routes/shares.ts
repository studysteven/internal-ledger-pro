/**
 * Transaction Shares Routes
 * 
 * Handles share ratio management for individual transactions:
 * - GET /api/transactions/:id/shares - Get current share configuration
 * - POST /api/transactions/:id/shares - Update share configuration with logging
 * - GET /api/transactions/:id/share-logs - Get adjustment history
 */

import { Router } from 'express';
import { transactionStore, userStore } from '../models/store.js';
import { shareLogStore } from '../models/shareLogs.js';
import { TransactionShare, TransactionShareLog, SplitDetail } from '../models/types.js';

const router = Router();

/**
 * GET /api/transactions/:id/shares
 * 
 * Returns the current share configuration for a transaction.
 * If the transaction has custom shares, returns those.
 * Otherwise, generates default shares based on current user ratios.
 */
router.get('/:id/shares', (req, res) => {
  try {
    const { id } = req.params;
    const transaction = transactionStore.getById(id);
    
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    // Get all users for reference
    const users = userStore.getAll();
    
    // Check if transaction has custom splits (non-default)
    // For now, we consider splits as "custom" if they exist and match user count
    // In a more sophisticated system, we'd track a "fromDefault" flag
    const hasCustomSplits = transaction.splits && transaction.splits.length > 0;
    
    // Build share configuration
    const share: TransactionShare = {
      transactionId: id,
      users: transaction.splits.map(split => ({
        userId: split.userId,
        userName: split.userName,
        ratio: split.ratio,
        amountCny: split.amount || (transaction.cnyAmount * split.ratio)
      })),
      fromDefault: !hasCustomSplits // Simplified: if no splits, it's from default
    };
    
    // If no splits exist, generate from default user ratios
    if (share.users.length === 0) {
      share.users = users.map(u => ({
        userId: u.id,
        userName: u.name,
        ratio: u.ratio,
        amountCny: transaction.cnyAmount * u.ratio
      }));
      share.fromDefault = true;
    }
    
    res.json(share);
  } catch (error) {
    console.error('Error getting transaction shares:', error);
    res.status(500).json({ error: 'Failed to get transaction shares' });
  }
});

/**
 * POST /api/transactions/:id/shares
 * 
 * Updates the share configuration for a transaction and creates a log entry.
 * 
 * Body: {
 *   users: Array<{ userId: string, ratio: number }>,
 *   remark?: string
 * }
 */
router.post('/:id/shares', (req, res) => {
  try {
    const { id } = req.params;
    const { users: newUsers, remark } = req.body;
    
    const transaction = transactionStore.getById(id);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    // Validate input
    if (!newUsers || !Array.isArray(newUsers) || newUsers.length === 0) {
      return res.status(400).json({ error: 'users must be a non-empty array' });
    }
    
    // Validate each user entry
    for (const u of newUsers) {
      if (!u.userId || typeof u.ratio !== 'number' || u.ratio < 0 || u.ratio > 1) {
        return res.status(400).json({ error: 'Invalid user entry: userId required, ratio must be between 0 and 1' });
      }
    }
    
    // Get user names
    const allUsers = userStore.getAll();
    const userMap = new Map(allUsers.map(u => [u.id, u.name]));
    
    // Save old shares for logging
    const oldShares: SplitDetail[] = transaction.splits.map(s => ({
      userId: s.userId,
      userName: s.userName,
      ratio: s.ratio,
      amount: s.amount
    }));
    
    // Build new splits
    const newSplits: SplitDetail[] = newUsers.map(u => {
      const userName = userMap.get(u.userId) || 'Unknown';
      const amount = transaction.cnyAmount * u.ratio;
      return {
        userId: u.userId,
        userName,
        ratio: u.ratio,
        amount: Math.round(amount * 100) / 100
      };
    });
    
    // Update transaction
    const updated = transactionStore.update(id, { splits: newSplits });
    if (!updated) {
      return res.status(500).json({ error: 'Failed to update transaction' });
    }
    
    // Create log entry
    const logEntry: TransactionShareLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      transactionId: id,
      time: Date.now(),
      operator: 'system', // TODO: Get from auth context if available
      oldShares,
      newShares: newSplits,
      remark: remark || undefined
    };
    
    shareLogStore.add(id, logEntry);
    
    console.log(`[Shares] Updated shares for transaction ${id}, created log entry ${logEntry.id}`);
    
    // Return success response
    res.json({ ok: true, share: {
      transactionId: id,
      users: newSplits.map(s => ({
        userId: s.userId,
        userName: s.userName,
        ratio: s.ratio,
        amountCny: s.amount
      })),
      fromDefault: false
    }});
  } catch (error) {
    console.error('Error updating transaction shares:', error);
    res.status(500).json({ error: 'Failed to update transaction shares' });
  }
});

/**
 * GET /api/transactions/:id/share-logs
 * 
 * Returns the adjustment history for a transaction's share ratios.
 */
router.get('/:id/share-logs', (req, res) => {
  try {
    const { id } = req.params;
    
    // Verify transaction exists
    const transaction = transactionStore.getById(id);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    // Get logs
    const logs = shareLogStore.getByTransactionId(id);
    
    // Sort by time (newest first)
    const sortedLogs = logs.sort((a, b) => b.time - a.time);
    
    res.json(sortedLogs);
  } catch (error) {
    console.error('Error getting share logs:', error);
    res.status(500).json({ error: 'Failed to get share logs' });
  }
});

export default router;

