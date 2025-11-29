import { Transaction, ApiConfig } from '../types';

/**
 * THE UNIFIED INTERFACE
 * Any payment website you add just needs to be adapted to return this format.
 */
export interface PaymentAdapter {
  fetchTransactions(): Promise<Transaction[]>;
}

/**
 * Standard Adapter
 * Fetches transactions from backend API, which handles the actual external API calls.
 * The backend decides how to fetch real transactions (or returns mock data for now).
 */
export class StandardApiAdapter implements PaymentAdapter {
  constructor(private config: ApiConfig) {}

  async fetchTransactions(): Promise<Transaction[]> {
    console.log(`[Adapter] Fetching transactions via backend for ${this.config.name}...`);
    
    try {
      // Import authenticatedFetch for authenticated requests
      const { authenticatedFetch } = await import('../utils/auth');
      // Call backend API endpoint with authentication
      const response = await authenticatedFetch(`/api/external/transactions?configId=${this.config.id}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      // Backend now returns { ok: boolean, added: number, transactions: Transaction[] }
      // Support both old format (array) and new format (object) for backward compatibility
      let transactions: Transaction[];
      
      if (Array.isArray(result)) {
        // Old format: direct array
        transactions = result;
      } else if (result.ok && Array.isArray(result.transactions)) {
        // New format: { ok, added, transactions }
        transactions = result.transactions;
        console.log(`[Adapter] Backend returned ${result.added} new transactions`);
      } else {
        throw new Error('Invalid response format: expected array or { ok, transactions } object');
      }

      console.log(`[Adapter] Successfully fetched ${transactions.length} transactions from backend`);
      return transactions;
    } catch (error) {
      console.error(`[Adapter] Error fetching transactions:`, error);
      throw error;
    }
  }
}

/**
 * Factory to get the right adapter based on configuration
 */
export const getAdapter = (config: ApiConfig): PaymentAdapter => {
  // If you have different logic for different sites, switch here
  // if (config.adapterType === 'CustomV1') return new CustomV1Adapter(config);
  
  return new StandardApiAdapter(config);
};