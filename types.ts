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
  timestamp: string; // ISO string
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
  // Settlement fields
  settlementId?: string; // ID of the settlement batch this transaction belongs to
  settledAt?: string; // Timestamp when this transaction was settled (ISO string format: YYYY-MM-DD HH:mm)
  // Clearance status (for filtering and statistics)
  cleared: boolean; // true = settled/cleared, false = unsettled/pending
  clearedAt?: number; // Timestamp in milliseconds when transaction was cleared (for sorting/filtering)
}

export interface SystemStats {
  todayTotalCNY: number;
  todayTotalUSDT: number;
  totalSafePerimCNY: number;
  totalUSDTWalletUSDT: number;
  totalUSDTWalletCNY: number; // Converted
  totalOverallCNY: number; // Payment API + USDT Wallet total
  totalOverallUSDT: number; // Payment API + USDT Wallet total
  exchangeRate: number;
}

// Settlement type for tracking settlement batches
export interface Settlement {
  id: string; // Settlement batch ID (e.g., "SET-1234567890")
  createdAt: string; // ISO string format: YYYY-MM-DD HH:mm
  fromTime?: string; // Optional: earliest transaction timestamp in this batch
  toTime?: string; // Optional: latest transaction timestamp in this batch
  totalAmountCNY: number; // Total CNY amount in this settlement
  totalAmountUSDT: number; // Total USDT amount in this settlement
  transactionCount: number; // Number of transactions in this settlement
}

export type UpdateTransactionHandler = (id: string, updatedSplits: SplitDetail[]) => void;

// --- Manual Entry Types ---
export interface ManualTransactionInput {
  amount: number;
  currency: Currency;
  timestamp: string;
  note?: string;
  splitMode: 'default' | 'single' | 'custom';
  singleTargetId?: string;
  customRatios?: Record<string, number>; // userId -> ratio (0-1 decimal)
}

// --- New Types for Backend Management ---

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