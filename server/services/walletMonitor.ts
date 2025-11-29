/**
 * Wallet Monitor Service
 * 
 * This module provides functions to sync wallet transactions from blockchain
 * and add them to the transaction store.
 */

import { walletConfigStore, transactionStore, userStore, getExchangeRate } from '../models/store.js';
import { WalletConfig, Transaction, SplitDetail } from '../models/types.js';
import { fetchWalletTransactionsFromExplorer, ChainTx } from './walletExplorer.js';

/**
 * Sync transactions for a specific wallet
 * 
 * This function:
 * 1. Finds the wallet config by ID
 * 2. Fetches new transactions from blockchain explorer
 * 3. Filters incoming transactions (to === wallet address)
 * 4. Converts ChainTx to Transaction objects
 * 5. Deduplicates by externalTxId
 * 6. Adds new transactions to the store
 * 7. Updates wallet's lastSyncTime
 * 
 * @param walletId - Wallet configuration ID
 * @returns Array of newly added transactions
 */
export async function syncWalletById(walletId: string): Promise<Transaction[]> {
  console.log(`[WalletMonitor] Starting sync for wallet: ${walletId}`);
  
  // 1. Find wallet config
  const wallet = walletConfigStore.getById(walletId);
  if (!wallet) {
    throw new Error(`Wallet not found: ${walletId}`);
  }
  
  if (wallet.status !== 'Active') {
    console.log(`[WalletMonitor] Wallet ${walletId} is not active, skipping sync`);
    return [];
  }
  
  // 2. Fetch transactions from explorer
  const since = wallet.lastSyncTime;
  console.log(`[WalletMonitor] Fetching transactions for wallet ${walletId} (${wallet.address}) on network ${wallet.network}`);
  console.log(`[WalletMonitor] Last sync time: ${since ? new Date(since).toISOString() : 'never'}`);
  
  const chainTxs = await fetchWalletTransactionsFromExplorer(
    wallet.address,
    wallet.network,
    since
  );
  
  console.log(`[WalletMonitor] Received ${chainTxs.length} chain transactions from explorer`);
  if (chainTxs.length > 0) {
    console.log(`[WalletMonitor] Sample chain transaction:`, {
      txId: chainTxs[0].txId,
      from: chainTxs[0].from,
      to: chainTxs[0].to,
      amount: chainTxs[0].amount,
      timestamp: new Date(chainTxs[0].timestamp).toISOString()
    });
  }
  
  if (chainTxs.length === 0) {
    console.log(`[WalletMonitor] No new transactions found for wallet ${walletId}`);
    // Update lastSyncTime even if no new transactions
    updateWalletLastSync(walletId, Date.now());
    return [];
  }
  
  // 3. Filter incoming transactions (to === wallet address, case-insensitive)
  // Note: This filter is redundant since fetchWalletTransactionsFromExplorer already filters by 'to',
  // but keeping it for safety
  const incomingTxs = chainTxs.filter(tx => 
    tx.to.toLowerCase() === wallet.address.toLowerCase()
  );
  
  console.log(`[WalletMonitor] Found ${incomingTxs.length} incoming transactions (after address filter)`);
  
  // 4. Get existing transactions to check for duplicates
  const existingTransactions = transactionStore.getAll();
  console.log(`[WalletMonitor] Existing transactions in store: ${existingTransactions.length}`);
  
  const existingExternalTxIds = new Set(
    existingTransactions
      .map(t => t.externalTxId)
      .filter((id): id is string => !!id)
  );
  
  console.log(`[WalletMonitor] Existing external transaction IDs: ${existingExternalTxIds.size}`);
  if (existingExternalTxIds.size > 0) {
    console.log(`[WalletMonitor] Sample existing externalTxIds:`, Array.from(existingExternalTxIds).slice(0, 5));
  }
  
  // 5. Convert ChainTx to Transaction and deduplicate
  const users = userStore.getAll();
  const exchangeRate = getExchangeRate();
  console.log(`[WalletMonitor] Exchange rate: ${exchangeRate}, Users: ${users.length}`);
  
  const newTransactions: Transaction[] = [];
  
  for (const chainTx of incomingTxs) {
    console.log(`[WalletMonitor] Processing chain transaction: ${chainTx.txId}`);
    
    // Skip if transaction already exists
    if (existingExternalTxIds.has(chainTx.txId)) {
      console.log(`[WalletMonitor] Skipping duplicate transaction: ${chainTx.txId}`);
      continue;
    }
    
    console.log(`[WalletMonitor] Transaction ${chainTx.txId} is new, creating Transaction object`);
    
    // Calculate fee (fixed amount for wallet transactions)
    const feeAmount = wallet.feeAmount || 0;
    const feeAmountCNY = Math.round(feeAmount * exchangeRate * 100) / 100;
    
    // Calculate net amounts (after fees)
    const netAmount = Math.max(0, chainTx.amount - feeAmount); // Ensure non-negative
    const netAmountCNY = Math.round(netAmount * exchangeRate * 100) / 100;
    
    // Original CNY amount (before fees)
    const originalCnyAmount = Math.round(chainTx.amount * exchangeRate * 100) / 100;
    
    // Use net amount for splits calculation (users receive net amount after fees)
    const cnyAmount = netAmountCNY;
    
    // Generate default splits based on user ratios (using net amount)
    const splits: SplitDetail[] = users.map(u => ({
      userId: u.id,
      userName: u.name,
      ratio: u.ratio,
      amount: Math.round(cnyAmount * u.ratio * 100) / 100
    }));
    
    // Format timestamp (YYYY-MM-DD HH:mm)
    const txDate = new Date(chainTx.timestamp);
    const year = txDate.getFullYear();
    const month = String(txDate.getMonth() + 1).padStart(2, '0');
    const day = String(txDate.getDate()).padStart(2, '0');
    const hours = String(txDate.getHours()).padStart(2, '0');
    const minutes = String(txDate.getMinutes()).padStart(2, '0');
    const formattedTimestamp = `${year}-${month}-${day} ${hours}:${minutes}`;
    
    // Generate unique transaction ID
    const transactionId = `wallet-${walletId}-${chainTx.txId.substring(0, 16)}-${Date.now()}`;
    
    // Create transaction object
    // New transactions from wallet sync are always unsettled (cleared = false) by default
    const transaction: Transaction = {
      id: transactionId,
      timestamp: formattedTimestamp,
      source: 'USDT Wallet',
      currency: 'USDT',
      originalAmount: chainTx.amount,
      cnyAmount: originalCnyAmount, // Original amount before fees
      feeAmount: feeAmount > 0 ? feeAmount : undefined,
      feeAmountCNY: feeAmountCNY > 0 ? feeAmountCNY : undefined,
      netAmount: netAmount,
      netAmountCNY: netAmountCNY,
      status: 'Completed',
      splits,
      externalTxId: chainTx.txId,
      cleared: false // Default: unsettled
    };
    
    // 6. Add to store
    console.log(`[WalletMonitor] Adding transaction to store:`, {
      id: transactionId,
      externalTxId: chainTx.txId,
      amount: chainTx.amount,
      cnyAmount,
      timestamp: formattedTimestamp
    });
    
    transactionStore.add(transaction);
    newTransactions.push(transaction);
    
    console.log(`[WalletMonitor] Successfully added transaction: ${transactionId} (${chainTx.amount} USDT)`);
    
    // Verify it was added
    const verifyTx = transactionStore.getById(transactionId);
    if (verifyTx) {
      console.log(`[WalletMonitor] Verified transaction in store: ${verifyTx.id}`);
    } else {
      console.error(`[WalletMonitor] ERROR: Transaction ${transactionId} was not found in store after adding!`);
    }
  }
  
  // 7. Update wallet's lastSyncTime (use the latest transaction timestamp or current time)
  const latestTxTimestamp = incomingTxs.length > 0
    ? Math.max(...incomingTxs.map(tx => tx.timestamp))
    : Date.now();
  
  updateWalletLastSync(walletId, latestTxTimestamp);
  
  console.log(`[WalletMonitor] Sync completed for wallet ${walletId}: ${newTransactions.length} new transactions`);
  
  return newTransactions;
}

/**
 * Update wallet's last sync time and last transaction ID
 */
function updateWalletLastSync(walletId: string, timestamp: number): void {
  const wallet = walletConfigStore.getById(walletId);
  if (!wallet) return;
  
  // Get the latest transaction for this wallet to find lastTxId
  // Find transactions that match this wallet's address pattern
  const allTransactions = transactionStore.getAll();
  const walletTransactions = allTransactions.filter(
    t => t.source === 'USDT Wallet' && 
         t.externalTxId &&
         t.id.includes(`wallet-${walletId}`)
  );
  
  const latestTx = walletTransactions
    .sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return timeB - timeA;
    })[0];
  
  // Update wallet config
  const updatedWallet: WalletConfig = {
    ...wallet,
    lastSyncTime: timestamp,
    lastTxId: latestTx?.externalTxId
  };
  
  // Update in store (we need to update the entire array)
  const allWallets = walletConfigStore.getAll();
  const updatedWallets = allWallets.map(w => 
    w.id === walletId ? updatedWallet : w
  );
  walletConfigStore.setAll(updatedWallets);
}

