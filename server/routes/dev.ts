/**
 * Development Routes
 * 
 * Temporary routes for testing and seeding demo data.
 * These should be removed or protected in production.
 */

import { Router } from 'express';
import { Transaction } from '../models/types.js';
import { addTransactions, apiConfigStore } from '../models/store.js';
import { fetchSafeperimRawResponse, SafeperimConfig } from '../adapters/safeperimAdapter.js';

const router = Router();

/**
 * POST /api/dev/seed-demo-tx
 * 
 * Seed a demo transaction for testing purposes.
 * This helps verify that the transaction store is working correctly.
 */
router.post('/seed-demo-tx', (req, res) => {
  try {
    const demo: Transaction = {
      id: `demo-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      source: 'DemoSeed',
      currency: 'CNY',
      originalAmount: 100,
      cnyAmount: 100,
      status: 'Completed',
      splits: [],
      externalTxId: `demo-ext-${Date.now()}`,
      cleared: false
    };
    
    addTransactions([demo]);
    
    console.log(`[DEV] Seeded demo transaction: ${demo.id}`);
    
    res.json({ 
      ok: true, 
      message: 'Demo transaction seeded',
      transaction: demo
    });
  } catch (error) {
    console.error('[DEV] Error seeding demo transaction:', error);
    res.status(500).json({ 
      ok: false, 
      error: 'Failed to seed demo transaction' 
    });
  }
});

/**
 * GET /api/dev/safeperim/raw
 * 
 * Debug endpoint to fetch raw Safeperim API response.
 * This helps inspect the actual response structure from Safeperim.
 */
router.get('/safeperim/raw', async (req, res) => {
  try {
    const configId = String(req.query.configId || 'api-1');
    
    // Get API config
    const apiConfig = apiConfigStore.getById(configId);
    if (!apiConfig) {
      return res.status(404).json({ 
        ok: false, 
        error: `API config not found: ${configId}` 
      });
    }
    
    if (apiConfig.provider !== 'safeperim') {
      return res.status(400).json({ 
        ok: false, 
        error: `Config ${configId} is not a Safeperim config` 
      });
    }
    
    // Construct SafeperimConfig
    const safeperimConfig: SafeperimConfig = {
      baseUrl: apiConfig.baseUrl || process.env.SAFEPERIM_BASE_URL || '',
      merchantId: apiConfig.merchantId || process.env.SAFEPERIM_MERCHANT_ID || '',
      signType: apiConfig.signType || 'MD5'
    };
    
    if (!safeperimConfig.baseUrl || !safeperimConfig.merchantId) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Missing baseUrl or merchantId in config' 
      });
    }
    
    // Fetch raw response
    const rawJson = await fetchSafeperimRawResponse(safeperimConfig);
    
    res.json({
      ok: true,
      configId,
      rawResponse: rawJson
    });
  } catch (error) {
    console.error('[DEV] Error fetching Safeperim raw response:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ 
      ok: false, 
      error: `Failed to fetch Safeperim raw response: ${errorMessage}` 
    });
  }
});

export default router;

