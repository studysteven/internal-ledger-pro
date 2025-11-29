/**
 * Settlements Routes
 * 
 * Handles settlement-related API endpoints:
 * - POST /api/settlements - Create a new settlement (mark all unsettled transactions as settled)
 */

import { Router } from 'express';
import { transactionStore, settlementStore, getExchangeRate } from '../models/store.js';
import { shareLogStore } from '../models/shareLogs.js';
import { Settlement } from '../models/types.js';
import { createScopedLogger } from '../utils/logger.js';

const router = Router();
const log = createScopedLogger('Settlement');

/**
 * POST /api/settlements
 * 
 * Creates a new settlement by deleting all completed transactions.
 * This clears all transaction records and share logs to prevent tampering.
 * Returns: { settlement: Settlement, deletedCount: number }
 */
router.post('/', (req, res) => {
  try {
    // IMPORTANT: Get ALL transactions from store (no pagination, no limit)
    const allTransactions = transactionStore.getAll();
    log.debug(`Total transactions in store: ${allTransactions.length}`);
    
    // Filter for completed transactions that are not yet cleared
    // Only settle transactions that haven't been cleared yet
    const completedTransactions = allTransactions.filter(t => 
      t.status === 'Completed' && !t.cleared
    );
    
    log.info(`Found ${completedTransactions.length} unsettled completed transactions out of ${allTransactions.length} total`);
    
    // Log breakdown by source for debugging
    const bySource = completedTransactions.reduce((acc, t) => {
      acc[t.source] = (acc[t.source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    log.debug(`Completed transactions by source:`, bySource);
    
    if (completedTransactions.length === 0) {
      return res.status(400).json({ error: 'No completed transactions to settle' });
    }
    
    // Calculate totals BEFORE deleting
    const exchangeRate = getExchangeRate();
    let totalCNY = 0;
    let totalUSDT = 0;
    const timestamps = completedTransactions.map(t => t.timestamp).sort();
    
    completedTransactions.forEach(t => {
      if (t.currency === 'USDT') {
        totalUSDT += t.originalAmount;
        totalCNY += t.cnyAmount || (t.originalAmount * exchangeRate);
      } else {
        totalCNY += t.originalAmount;
      }
    });
    
    // Generate settlement ID
    const settlementId = `SET-${Date.now()}`;
    const settledAt = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const clearedAt = Date.now();
    
    // Mark all completed transactions as cleared (cleared = true) before deleting
    // This ensures consistency with the cleared field usage throughout the system
    completedTransactions.forEach(tx => {
      transactionStore.update(tx.id, { 
        cleared: true,
        clearedAt: clearedAt,
        settlementId: settlementId,
        settledAt: settledAt
      });
    });
    
    // DELETE all completed transactions (after marking as cleared)
    const transactionIds = completedTransactions.map(t => t.id);
    const deletedCount = transactionStore.deleteMany(transactionIds);
    
    log.info(`Successfully deleted ${deletedCount} transactions (expected: ${completedTransactions.length})`);
    
    // Verify: Check remaining transactions
    const allAfterSettlement = transactionStore.getAll();
    log.debug(`Remaining transactions after settlement: ${allAfterSettlement.length}`);
    
    // Create settlement record
    const settlement: Settlement = {
      id: settlementId,
      createdAt: settledAt,
      fromTime: timestamps[0],
      toTime: timestamps[timestamps.length - 1],
      totalAmountCNY: Math.round(totalCNY * 100) / 100,
      totalAmountUSDT: Math.round(totalUSDT * 100) / 100,
      transactionCount: deletedCount
    };
    
    settlementStore.add(settlement);
    
    // IMPORTANT: Clear all share adjustment logs after settlement
    // This prevents log tampering and ensures data integrity
    const logsBeforeClear = shareLogStore.getAll().length;
    shareLogStore.clearAll();
    log.info(`Cleared all share adjustment logs (${logsBeforeClear} logs removed)`);
    
    // Return settlement info
    res.status(201).json({
      settlement,
      deletedCount: deletedCount,
      totalAmountCNY: settlement.totalAmountCNY,
      totalAmountUSDT: settlement.totalAmountUSDT,
      clearedLogsCount: logsBeforeClear
    });
  } catch (error) {
    log.error('Error creating settlement:', error);
    res.status(500).json({ error: 'Failed to create settlement' });
  }
});

export default router;

