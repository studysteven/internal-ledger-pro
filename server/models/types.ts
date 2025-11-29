/**
 * Backend Type Definitions
 * 
 * These types match the frontend types.ts for consistency.
 * Used for API request/response validation and type safety.
 */

export type Currency = 'CNY' | 'USDT';
// SourceType is now a string to support dynamic payment API names
// Common values: 'USDT Wallet', 'Manual', and any ApiConfig.name value
export type SourceType = string;
export type SplitStatus = 'Pending' | 'Completed';

export interface UserSplit {
  id: string;
  name: string;
  ratio: number; // e.g., 0.60 for 60%
}

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
  originalAmount: number; // Original amount before fees
  cnyAmount: number; // Converted or same if CNY (before fees)
  feeAmount?: number; // Fee amount deducted (in transaction currency)
  feeAmountCNY?: number; // Fee amount in CNY
  netAmount?: number; // Net amount after fees (in transaction currency)
  netAmountCNY?: number; // Net amount after fees in CNY
  status: SplitStatus;
  splits: SplitDetail[];
  settlementId?: string;
  settledAt?: string;
  // Wallet transaction fields
  externalTxId?: string; // Chain transaction hash or ID (for wallet transactions)
  // Clearance status (for filtering and statistics)
  cleared: boolean; // true = settled/cleared, false = unsettled/pending (default: false)
  clearedAt?: number; // Timestamp in milliseconds when transaction was cleared (for sorting/filtering)
}

export interface Settlement {
  id: string;
  createdAt: string;
  fromTime?: string;
  toTime?: string;
  totalAmountCNY: number;
  totalAmountUSDT: number;
  transactionCount: number;
}

export interface ApiConfig {
  id: string;
  name: string; // Display label (e.g., "Safeperim", "AlphaPay Main")
  baseUrl: string;
  apiKey?: string; // Optional, for APIs that use API key authentication
  adapterType: 'Standard' | 'CustomV1';
  isActive: boolean;
  lastSync?: string;
  // Safeperim-specific fields
  provider?: 'safeperim' | 'alphapay' | 'other'; // Payment gateway provider type
  merchantId?: string; // Merchant ID (for Safeperim)
  signType?: 'MD5' | 'RSA' | 'MD5+RSA'; // Signature type (default: 'MD5')
  // Fee configuration
  feePercentage?: number; // Fee percentage (e.g., 0.02 for 2%), deducted from transaction amount
}

export interface WalletConfig {
  id: string;
  address: string;
  network: 'TRC20' | 'ERC20' | 'BTC';
  label: string;
  status: 'Active' | 'Inactive';
  // Wallet monitoring fields
  lastSyncTime?: number; // Timestamp in milliseconds
  lastTxId?: string; // Last chain transaction ID (for deduplication)
  // Fee configuration
  feeAmount?: number; // Fixed fee amount (in USDT), deducted from each transaction
}

/**
 * Transaction Share Configuration
 * Represents the share ratios for a specific transaction
 */
export interface TransactionShare {
  transactionId: string;
  users: Array<{
    userId: string;
    userName: string;
    ratio: number;     // Share ratio (0-1, e.g., 0.6 for 60%)
    amountCny: number; // Calculated amount in CNY
  }>;
  fromDefault: boolean; // true if using default user ratios, false if customized
}

/**
 * Share Adjustment Log Entry
 * Records each time a transaction's share ratios are modified
 */
export interface TransactionShareLog {
  id: string;
  transactionId: string;
  time: number; // Timestamp in milliseconds
  operator: string; // Who made the change (can be 'system' or user ID)
  oldShares: SplitDetail[]; // Previous share configuration
  newShares: SplitDetail[]; // New share configuration
  remark?: string; // Optional remark/note
}

// Request/Response types
export interface ManualTransactionInput {
  amount: number;
  currency: Currency;
  timestamp: string;
  note?: string;
  splitMode: 'default' | 'single' | 'custom';
  singleTargetId?: string;
  customRatios?: Record<string, number>;
}

