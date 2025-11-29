/**
 * Wallet Routes
 * 
 * Handles wallet-related API endpoints:
 * - POST /api/wallets/:id/sync - Manually trigger sync for a specific wallet
 */

import { Router } from 'express';
import { syncWalletById } from '../services/walletMonitor.js';

const router = Router();

/**
 * POST /api/wallets/:id/sync
 * 
 * Manually trigger synchronization for a specific wallet.
 * Fetches new transactions from blockchain explorer and adds them to the transaction store.
 * 
 * Returns: { ok: true, added: number, transactions: Transaction[] }
 */
router.post('/:id/sync', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ ok: false, error: 'Wallet ID is required' });
    }
    
    console.log(`[Wallets API] Manual sync requested for wallet: ${id}`);
    
    const newTxs = await syncWalletById(id);
    
    res.json({ 
      ok: true, 
      added: newTxs.length, 
      transactions: newTxs 
    });
  } catch (error) {
    console.error('[Wallets API] Sync failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ 
      ok: false, 
      error: 'Wallet sync failed',
      message: errorMessage
    });
  }
});

export default router;


