/**
 * Share Adjustment Logs Store
 * 
 * Stores logs of share ratio adjustments for transactions.
 * Each log entry records when and how a transaction's share ratios were modified.
 */

import { TransactionShareLog } from './types.js';

// In-memory store for share adjustment logs
// Key: transactionId, Value: array of log entries
const shareLogs: Map<string, TransactionShareLog[]> = new Map();

export const shareLogStore = {
  /**
   * Get all logs for a specific transaction
   */
  getByTransactionId: (transactionId: string): TransactionShareLog[] => {
    return shareLogs.get(transactionId) || [];
  },

  /**
   * Get all logs across all transactions
   * Returns a flat array of all log entries, sorted by time (newest first)
   */
  getAll: (): TransactionShareLog[] => {
    const allLogs: TransactionShareLog[] = [];
    shareLogs.forEach((logs) => {
      allLogs.push(...logs);
    });
    // Sort by time (newest first)
    return allLogs.sort((a, b) => b.time - a.time);
  },

  /**
   * Add a new log entry for a transaction
   */
  add: (transactionId: string, log: TransactionShareLog): void => {
    const logs = shareLogs.get(transactionId) || [];
    logs.push(log);
    shareLogs.set(transactionId, logs);
    console.log(`[ShareLogStore] Added log entry for transaction ${transactionId}, total logs: ${logs.length}`);
  },

  /**
   * Clear all logs for a transaction (for testing/debugging)
   */
  clear: (transactionId: string): void => {
    shareLogs.delete(transactionId);
    console.log(`[ShareLogStore] Cleared logs for transaction ${transactionId}`);
  },

  /**
   * Clear all logs across all transactions
   */
  clearAll: (): void => {
    const count = shareLogs.size;
    shareLogs.clear();
    console.log(`[ShareLogStore] Cleared all logs (${count} transactions)`);
  }
};

