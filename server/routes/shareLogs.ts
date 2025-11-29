/**
 * Global Share Logs Routes
 * 
 * Provides endpoints for viewing all share adjustment logs across all transactions:
 * - GET /api/share-logs/all - Get all share adjustment logs
 * - DELETE /api/share-logs/all - Clear all share adjustment logs
 */

import { Router } from 'express';
import { shareLogStore } from '../models/shareLogs.js';
import { transactionStore } from '../models/store.js';

const router = Router();

/**
 * GET /api/share-logs/all
 * 
 * Returns all share adjustment logs across all transactions.
 * Optionally filters by transactionId, operator, or time range.
 * 
 * Query parameters:
 * - transactionId?: string - Filter by specific transaction ID
 * - operator?: string - Filter by operator name
 * - since?: number - Only return logs after this timestamp (milliseconds)
 * - limit?: number - Maximum number of logs to return (default: 1000)
 */
router.get('/all', (req, res) => {
  try {
    const { transactionId, operator, since, limit } = req.query;
    
    // Get all logs
    let allLogs = shareLogStore.getAll();
    
    // Apply filters
    if (transactionId) {
      allLogs = allLogs.filter(log => log.transactionId === transactionId);
    }
    
    if (operator) {
      allLogs = allLogs.filter(log => log.operator === operator);
    }
    
    if (since) {
      const sinceTimestamp = Number(since);
      if (!isNaN(sinceTimestamp)) {
        allLogs = allLogs.filter(log => log.time >= sinceTimestamp);
      }
    }
    
    // Apply limit
    const limitNum = limit ? Number(limit) : 1000;
    if (!isNaN(limitNum) && limitNum > 0) {
      allLogs = allLogs.slice(0, limitNum);
    }
    
    // Enrich logs with transaction information
    const enrichedLogs = allLogs.map(log => {
      const transaction = transactionStore.getById(log.transactionId);
      return {
        ...log,
        transaction: transaction ? {
          id: transaction.id,
          timestamp: transaction.timestamp,
          source: transaction.source,
          currency: transaction.currency,
          originalAmount: transaction.originalAmount,
          cnyAmount: transaction.cnyAmount,
          externalTxId: transaction.externalTxId
        } : null
      };
    });
    
    res.json({
      total: enrichedLogs.length,
      logs: enrichedLogs
    });
  } catch (error) {
    console.error('Error getting all share logs:', error);
    res.status(500).json({ error: 'Failed to get share logs' });
  }
});

/**
 * DELETE /api/share-logs/all
 * 
 * Clears all share adjustment logs.
 * This is a destructive operation and cannot be undone.
 * 
 * Returns: { ok: true, message: string }
 */
router.delete('/all', (req, res) => {
  try {
    const beforeCount = shareLogStore.getAll().length;
    shareLogStore.clearAll();
    
    console.log(`[ShareLogs] Cleared all logs (${beforeCount} logs removed)`);
    
    res.json({
      ok: true,
      message: `已清除所有分账日志记录（共 ${beforeCount} 条）`,
      clearedCount: beforeCount
    });
  } catch (error) {
    console.error('Error clearing all share logs:', error);
    res.status(500).json({ ok: false, error: 'Failed to clear share logs' });
  }
});

export default router;

