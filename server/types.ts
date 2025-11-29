// Shared types for backend (matching frontend types.ts)

export interface ApiConfig {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  adapterType: 'Standard' | 'CustomV1'; 
  isActive: boolean;
  lastSync?: string;
}

export interface WalletConfig {
  id: string;
  address: string;
  network: 'TRC20' | 'ERC20' | 'BTC';
  label: string;
  status: 'Active' | 'Inactive';
}

// Transaction types (matching frontend)
export type Currency = 'CNY' | 'USDT';
// SourceType is now a string to support dynamic payment API names
// Common values: 'USDT Wallet', 'Manual', and any ApiConfig.name value
export type SourceType = string;
export type SplitStatus = 'Pending' | 'Completed';

export interface SplitDetail {
  userId: string;
  userName: string;
  ratio: number;
  amount: number;
}

export interface Transaction {
  id: string;
  timestamp: string; // ISO string format: YYYY-MM-DD HH:mm
  source: SourceType;
  currency: Currency;
  originalAmount: number;
  cnyAmount: number; // Converted or same if CNY
  status: SplitStatus;
  splits: SplitDetail[];
}

