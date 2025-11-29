/**
 * Configuration Routes
 * 
 * Handles API and wallet configuration endpoints:
 * - GET /api/api-configs - Get all API configs
 * - POST /api/api-configs - Replace all API configs
 * - GET /api/wallet-configs - Get all wallet configs
 * - POST /api/wallet-configs - Replace all wallet configs
 */

import { Router } from 'express';
import { apiConfigStore, walletConfigStore, transactionStore, getExchangeRate, userStore } from '../models/store.js';
import { ApiConfig, WalletConfig, Transaction } from '../models/types.js';

const router = Router();

/**
 * GET /api/api-configs
 * 
 * Returns: ApiConfig[]
 * 
 * For Safeperim configs, fills in default values from environment variables:
 * - baseUrl: from SAFEPERIM_BASE_URL (if not set)
 * - merchantId: from SAFEPERIM_MERCHANT_ID (if not set)
 * - signType: defaults to 'MD5' (if not set)
 */
router.get('/api-configs', (req, res) => {
  try {
    const configs = apiConfigStore.getAll();
    
    // Fill in Safeperim defaults from environment variables
    const safeperimBaseUrl = process.env.SAFEPERIM_BASE_URL;
    const safeperimMerchantId = process.env.SAFEPERIM_MERCHANT_ID;
    
    const enrichedConfigs = configs.map(config => {
      // If this is a Safeperim config, fill in defaults
      if (config.provider === 'safeperim') {
        return {
          ...config,
          baseUrl: config.baseUrl || safeperimBaseUrl || '',
          merchantId: config.merchantId || safeperimMerchantId || '',
          signType: config.signType || 'MD5'
        };
      }
      return config;
    });
    
    res.json(enrichedConfigs);
  } catch (error) {
    console.error('Error fetching API configs:', error);
    res.status(500).json({ error: 'Failed to fetch API configs' });
  }
});

/**
 * POST /api/api-configs
 * 
 * Body: ApiConfig[]
 * 
 * Replaces the entire API config list with the provided array.
 * Returns: ApiConfig[] (updated list)
 */
router.post('/api-configs', (req, res) => {
  try {
    const configs: ApiConfig[] = req.body;
    
    if (!Array.isArray(configs)) {
      return res.status(400).json({ error: 'Body must be an array of API configs' });
    }
    
    // Validate each config
    for (const config of configs) {
      if (!config.id || !config.name || !config.baseUrl) {
        return res.status(400).json({ error: 'Invalid API config format. Each config must have id, name, and baseUrl' });
      }
    }
    
    // Get old configs to detect fee changes
    const oldConfigs = apiConfigStore.getAll();
    const oldConfigMap = new Map(oldConfigs.map(c => [c.id, c]));
    
    // Update store
    apiConfigStore.setAll(configs);
    
    // Recalculate fees for transactions if fee percentage changed
    const allTransactions = transactionStore.getAll();
    const exchangeRate = getExchangeRate();
    const users = userStore.getAll();
    let updatedCount = 0;
    
    configs.forEach(newConfig => {
      const oldConfig = oldConfigMap.get(newConfig.id);
      const feeChanged = oldConfig?.feePercentage !== newConfig.feePercentage;
      
      if (feeChanged && newConfig.feePercentage !== undefined) {
        // Find all transactions from this API config
        const relatedTransactions = allTransactions.filter(tx => tx.source === newConfig.name);
        
        relatedTransactions.forEach(tx => {
          // Recalculate fee
          const feeAmount = Math.round(tx.originalAmount * newConfig.feePercentage * 100) / 100;
          const feeAmountCNY = tx.currency === 'CNY' 
            ? feeAmount 
            : Math.round(feeAmount * exchangeRate * 100) / 100;
          
          const netAmount = tx.originalAmount - feeAmount;
          const netAmountCNY = tx.cnyAmount - feeAmountCNY;
          
          // Recalculate splits based on net amount
          const splits = users.map(u => ({
            userId: u.id,
            userName: u.name,
            ratio: u.ratio,
            amount: Math.round(netAmountCNY * u.ratio * 100) / 100
          }));
          
          // Update transaction
          transactionStore.update(tx.id, {
            feeAmount: feeAmount > 0 ? feeAmount : undefined,
            feeAmountCNY: feeAmountCNY > 0 ? feeAmountCNY : undefined,
            netAmount: netAmount,
            netAmountCNY: netAmountCNY,
            splits: splits
          });
          
          updatedCount++;
        });
      }
    });
    
    if (updatedCount > 0) {
      console.log(`[POST /api/api-configs] Updated ${updatedCount} transactions with new fee percentages`);
    }
    
    res.json(apiConfigStore.getAll());
  } catch (error) {
    console.error('Error updating API configs:', error);
    res.status(500).json({ error: 'Failed to update API configs' });
  }
});

/**
 * GET /api/wallet-configs
 * 
 * Returns: WalletConfig[]
 */
router.get('/wallet-configs', (req, res) => {
  try {
    const configs = walletConfigStore.getAll();
    res.json(configs);
  } catch (error) {
    console.error('Error fetching wallet configs:', error);
    res.status(500).json({ error: 'Failed to fetch wallet configs' });
  }
});

/**
 * POST /api/wallet-configs
 * 
 * Body: WalletConfig[]
 * 
 * Replaces the entire wallet config list with the provided array.
 * This endpoint is called when frontend AdminPanel saves wallet configurations.
 * After saving, the new wallets will be automatically monitored by the backend sync logic.
 * 
 * Returns: WalletConfig[] (updated list)
 * 
 * Verification:
 * A. Open AdminPanel, add a new wallet address, click save (or modify existing wallet)
 *    - Refresh GET /api/wallet-configs, should see the new/updated wallet
 * B. In browser Console, manually execute:
 *    fetch('/api/wallets/<new_wallet_id>/sync', { method: 'POST' }).then(r => r.json()).then(console.log)
 *    - Should return ok: true, indicating backend can fetch data from TronGrid using this wallet
 * C. Wait for a period (e.g., 1 minute), check backend logs:
 *    - Should see auto-sync logic calling syncWalletById for the new wallet id
 *    - /api/transactions should contain transactions from this wallet (if there are historical records on-chain)
 */
router.post('/wallet-configs', (req, res) => {
  try {
    // Debug: Log request details
    console.log('[POST /api/wallet-configs] Request received');
    console.log('[POST /api/wallet-configs] Request body:', JSON.stringify(req.body, null, 2));
    
    const configs: WalletConfig[] = req.body;
    
    if (!Array.isArray(configs)) {
      console.error('[POST /api/wallet-configs] Body is not an array:', typeof configs);
      return res.status(400).json({ error: 'Body must be an array of wallet configs' });
    }
    
    console.log(`[POST /api/wallet-configs] Received ${configs.length} wallet config(s)`);
    
    // Validate each config (relaxed validation - allow empty address for new wallets)
    for (let i = 0; i < configs.length; i++) {
      const config = configs[i];
      console.log(`[POST /api/wallet-configs] Validating config ${i + 1}:`, {
        id: config.id,
        label: config.label,
        address: config.address,
        network: config.network,
        status: config.status
      });
      
      // Required fields: id and label
      if (!config.id) {
        console.error(`[POST /api/wallet-configs] Config ${i + 1} missing id`);
        return res.status(400).json({ error: `Wallet config at index ${i} is missing required field: id` });
      }
      
      if (!config.label || config.label.trim() === '') {
        console.error(`[POST /api/wallet-configs] Config ${i + 1} missing or empty label`);
        return res.status(400).json({ error: `Wallet config at index ${i} is missing or has empty label` });
      }
      
      // Address can be empty for new wallets (will be filled later)
      // But if provided, it should be a string
      if (config.address !== undefined && typeof config.address !== 'string') {
        console.error(`[POST /api/wallet-configs] Config ${i + 1} has invalid address type`);
        return res.status(400).json({ error: `Wallet config at index ${i} has invalid address type` });
      }
      
      // Ensure network is valid
      if (config.network && !['TRC20', 'ERC20', 'BTC'].includes(config.network)) {
        console.error(`[POST /api/wallet-configs] Config ${i + 1} has invalid network: ${config.network}`);
        return res.status(400).json({ error: `Wallet config at index ${i} has invalid network: ${config.network}` });
      }
      
      // Ensure status is valid
      if (config.status && !['Active', 'Inactive'].includes(config.status)) {
        console.error(`[POST /api/wallet-configs] Config ${i + 1} has invalid status: ${config.status}`);
        return res.status(400).json({ error: `Wallet config at index ${i} has invalid status: ${config.status}` });
      }
    }
    
    // Get old configs to detect fee changes
    const oldConfigs = walletConfigStore.getAll();
    const oldConfigMap = new Map(oldConfigs.map(c => [c.id, c]));
    
    // Update unified store - this will be used by auto-sync logic
    walletConfigStore.setAll(configs);
    
    // Recalculate fees for transactions if fee amount changed
    const allTransactions = transactionStore.getAll();
    const exchangeRate = getExchangeRate();
    const users = userStore.getAll();
    let updatedCount = 0;
    
    configs.forEach(newConfig => {
      const oldConfig = oldConfigMap.get(newConfig.id);
      const feeChanged = oldConfig?.feeAmount !== newConfig.feeAmount;
      
      if (feeChanged) {
        // Find all transactions from this wallet (by checking if transaction ID contains wallet ID)
        const relatedTransactions = allTransactions.filter(tx => 
          tx.source === 'USDT Wallet' && tx.id.includes(newConfig.id)
        );
        
        relatedTransactions.forEach(tx => {
          // Recalculate fee
          const feeAmount = newConfig.feeAmount || 0;
          const feeAmountCNY = Math.round(feeAmount * exchangeRate * 100) / 100;
          
          const netAmount = Math.max(0, tx.originalAmount - feeAmount);
          const netAmountCNY = Math.round(netAmount * exchangeRate * 100) / 100;
          
          // Recalculate splits based on net amount
          const splits = users.map(u => ({
            userId: u.id,
            userName: u.name,
            ratio: u.ratio,
            amount: Math.round(netAmountCNY * u.ratio * 100) / 100
          }));
          
          // Update transaction
          transactionStore.update(tx.id, {
            feeAmount: feeAmount > 0 ? feeAmount : undefined,
            feeAmountCNY: feeAmountCNY > 0 ? feeAmountCNY : undefined,
            netAmount: netAmount,
            netAmountCNY: netAmountCNY,
            splits: splits
          });
          
          updatedCount++;
        });
      }
    });
    
    if (updatedCount > 0) {
      console.log(`[POST /api/wallet-configs] Updated ${updatedCount} transactions with new fee amounts`);
    }
    
    console.log(`[POST /api/wallet-configs] Successfully updated ${configs.length} wallet configuration(s)`);
    
    const updatedConfigs = walletConfigStore.getAll();
    res.json(updatedConfigs);
  } catch (error) {
    console.error('[POST /api/wallet-configs] Error updating wallet configs:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: 'Failed to update wallet configs', details: errorMessage });
  }
});

export default router;

