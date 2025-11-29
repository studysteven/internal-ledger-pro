/**
 * In-Memory Data Store
 * 
 * This module provides a simple in-memory data store for the application.
 * In production, this would be replaced with a real database.
 * 
 * Data is stored in memory arrays and can be persisted to JSON files if needed.
 */

import { Transaction, UserSplit, ApiConfig, WalletConfig, Settlement } from './types.js';

// In-memory data stores
let transactions: Transaction[] = [];
let users: UserSplit[] = [];
let apiConfigs: ApiConfig[] = [];
let walletConfigs: WalletConfig[] = []; // Will be initialized by ensureDefaultWalletConfigs()
let settlements: Settlement[] = [];

// Default exchange rate (can be moved to config later)
const DEFAULT_EXCHANGE_RATE = 7.12;

/**
 * Transactions Store
 */
/**
 * Unified Transaction Store
 * 
 * This is the SINGLE SOURCE OF TRUTH for all transactions in the system.
 * All routes and services must use this store to read/write transactions.
 */
export const transactionStore = {
  getAll: (): Transaction[] => {
    console.log(`[TxStore] getAll() called, returning ${transactions.length} transactions`);
    return [...transactions];
  },
  
  getById: (id: string): Transaction | undefined => {
    return transactions.find(t => t.id === id);
  },
  
  add: (transaction: Transaction): Transaction => {
    const beforeCount = transactions.length;
    transactions.push(transaction);
    console.log(`[TxStore] add() called, added transaction ${transaction.id}, count: ${beforeCount} -> ${transactions.length}`);
    return transaction;
  },
  
  /**
   * Add multiple transactions at once
   * Used by external sync and batch operations
   */
  addTransactions: (newOnes: Transaction[]): void => {
    const beforeCount = transactions.length;
    transactions = [...transactions, ...newOnes];
    console.log(`[TxStore] addTransactions() called, added ${newOnes.length} transactions, count: ${beforeCount} -> ${transactions.length}`);
  },
  
  update: (id: string, updates: Partial<Transaction>): Transaction | null => {
    const index = transactions.findIndex(t => t.id === id);
    if (index === -1) return null;
    transactions[index] = { ...transactions[index], ...updates };
    return transactions[index];
  },
  
  delete: (id: string): boolean => {
    const index = transactions.findIndex(t => t.id === id);
    if (index === -1) return false;
    transactions.splice(index, 1);
    console.log(`[TxStore] delete() called, removed transaction ${id}, count: ${transactions.length}`);
    return true;
  },
  
  deleteMany: (ids: string[]): number => {
    const beforeCount = transactions.length;
    transactions = transactions.filter(t => !ids.includes(t.id));
    const deletedCount = beforeCount - transactions.length;
    console.log(`[TxStore] deleteMany() called, removed ${deletedCount} transactions, count: ${beforeCount} -> ${transactions.length}`);
    return deletedCount;
  },
  
  filter: (predicate: (t: Transaction) => boolean): Transaction[] => {
    return transactions.filter(predicate);
  },
  
  clear: (): void => {
    transactions = [];
  }
};

// Export convenience functions for easier access
export function getTransactions(): Transaction[] {
  return transactionStore.getAll();
}

export function addTransactions(newOnes: Transaction[]): void {
  transactionStore.addTransactions(newOnes);
}

/**
 * Users Store
 */
export const userStore = {
  getAll: (): UserSplit[] => [...users],
  
  setAll: (newUsers: UserSplit[]): void => {
    users = [...newUsers];
  },
  
  getById: (id: string): UserSplit | undefined => {
    return users.find(u => u.id === id);
  }
};

/**
 * API Configs Store
 */
export const apiConfigStore = {
  getAll: (): ApiConfig[] => [...apiConfigs],
  
  setAll: (configs: ApiConfig[]): void => {
    apiConfigs = [...configs];
  },
  
  getById: (id: string): ApiConfig | undefined => {
    return apiConfigs.find(c => c.id === id);
  }
};

/**
 * Ensure default wallet configurations are initialized
 * Called at server startup to seed default wallet configs
 */
export function ensureDefaultWalletConfigs(): void {
  const current = walletConfigStore.getAll();
  if (!current || current.length === 0) {
    const defaultWallet: WalletConfig = {
      id: 'wallet-1',
      label: '默认测试钱包',
      address: 'TExample1234567890ABCDEFGHIJKLMNOPQRST',
      network: 'TRC20',
      status: 'Active',
      lastSyncTime: 0,
      lastTxId: undefined,
      feeAmount: 3 // Default 3 USDT fee
    };
    walletConfigStore.setAll([defaultWallet]);
    console.log('[Seed] Created default wallet-config: wallet-1');
  } else {
    console.log(`[Seed] Wallet configs already exist (${current.length} items), skipping default seed`);
  }
}

/**
 * Ensure default API configurations are initialized
 * Called at server startup to seed default API configs
 */
export function ensureDefaultApiConfigs(): void {
  const current = apiConfigStore.getAll();
  if (!current || current.length === 0) {
    const defaultApi: ApiConfig = {
      id: 'api-1',
      name: 'Safeperim',
      baseUrl: process.env.SAFEPERIM_BASE_URL || 'https://api.example.com/',
      merchantId: process.env.SAFEPERIM_MERCHANT_ID || 'YOUR_MERCHANT_ID',
      provider: 'safeperim',
      signType: 'MD5',
      adapterType: 'Standard',
      isActive: true,
      feePercentage: 0.06 // Default 6% fee
    };
    apiConfigStore.setAll([defaultApi]);
    console.log('[Seed] Created default api-config: api-1');
  } else {
    console.log(`[Seed] API configs already exist (${current.length} items), skipping default seed`);
  }
}

/**
 * Ensure default users are initialized
 * Called at server startup to seed default user split ratios
 */
export function ensureDefaultUsers(): void {
  const current = userStore.getAll();
  if (!current || current.length === 0) {
    const defaultUsers: UserSplit[] = [
      { id: 'u1', name: 'Admin (Me)', ratio: 0.60 },
      { id: 'u2', name: 'Partner A', ratio: 0.25 },
      { id: 'u3', name: 'Partner B', ratio: 0.15 },
    ];
    userStore.setAll(defaultUsers);
    console.log('[Seed] Created default users: u1, u2, u3');
    console.log(`[Seed] Default split ratios: ${defaultUsers.map(u => `${u.name}:${(u.ratio * 100).toFixed(2)}%`).join(', ')}`);
  } else {
    console.log(`[Seed] Users already exist (${current.length} items), skipping default seed`);
  }
}

/**
 * Wallet Configs Store
 */
export const walletConfigStore = {
  getAll: (): WalletConfig[] => [...walletConfigs],
  
  setAll: (configs: WalletConfig[]): void => {
    walletConfigs = [...configs];
  },
  
  getById: (id: string): WalletConfig | undefined => {
    return walletConfigs.find(c => c.id === id);
  },
  
  update: (id: string, updates: Partial<WalletConfig>): WalletConfig | null => {
    const index = walletConfigs.findIndex(c => c.id === id);
    if (index === -1) return null;
    walletConfigs[index] = { ...walletConfigs[index], ...updates };
    return walletConfigs[index];
  }
};

/**
 * Settlements Store
 */
export const settlementStore = {
  getAll: (): Settlement[] => [...settlements],
  
  add: (settlement: Settlement): Settlement => {
    settlements.push(settlement);
    return settlement;
  },
  
  getById: (id: string): Settlement | undefined => {
    return settlements.find(s => s.id === id);
  }
};

/**
 * Get default exchange rate
 */
export const getExchangeRate = (): number => {
  return DEFAULT_EXCHANGE_RATE;
};

