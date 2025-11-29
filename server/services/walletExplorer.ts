/**
 * Wallet Explorer Service
 * 
 * This module provides functions to fetch wallet transactions from blockchain explorers.
 * Currently uses mock data, but can be replaced with real API calls to block explorers.
 */

/**
 * Chain transaction data structure
 */
export interface ChainTx {
  txId: string; // Transaction hash/ID
  from: string; // Sender address
  to: string; // Recipient address
  amount: number; // Transaction amount
  tokenSymbol: string; // Token symbol (e.g., 'USDT')
  timestamp: number; // Timestamp in milliseconds
}

/**
 * Fetch wallet transactions from blockchain explorer
 * 
 * @param address - Wallet address to monitor
 * @param network - Network type ('TRC20', 'ERC20', 'BTC')
 * @param since - Optional timestamp (milliseconds) to fetch transactions since this time
 * @returns Array of chain transactions
 * 
 * Implementation:
 * 
 * For TRC20 (Tron):
 *   - Uses TronGrid API: https://api.trongrid.io/v1/accounts/{address}/transactions/trc20
 *   - Reference: https://developers.tron.network/reference/trongrid-api
 *   - USDT (TRC20) contract address: TRExample1234567890ABCDEFGHIJKLMNOPQRST (example)
 *   - API supports query parameters: limit, only_confirmed, only_to, only_from
 * 
 * For ERC20 (Ethereum):
 *   - Use Etherscan API: https://api.etherscan.io/api?module=account&action=tokentx&address={address}
 *   - Or Infura/Alchemy APIs
 * 
 * For BTC:
 *   - Use BlockCypher API: https://api.blockcypher.com/v1/btc/main/addrs/{address}/txs
 *   - Or Blockchain.com API
 */
export async function fetchWalletTransactionsFromExplorer(
  address: string,
  network: string,
  since?: number
): Promise<ChainTx[]> {
  console.log(`[WalletExplorer] Fetching transactions for ${address} on ${network}${since ? ` since ${new Date(since).toISOString()}` : ''}`);
  
  // Handle TRON network variants (TRC20 USDT)
  // Support multiple network name formats for compatibility
  const tronNetworks = ['TRON', 'TRC20', 'TRON-USDT'];
  if (tronNetworks.includes(network)) {
    return await fetchTRC20Transactions(address, since);
  }
  
  // Other networks not yet implemented
  // Return empty array for now, can be extended later
  if (network === 'ERC20' || network === 'BTC') {
    console.log(`[WalletExplorer] Network ${network} is not yet implemented, returning empty array`);
    return [];
  }
  
  console.warn(`[WalletExplorer] Unknown network: ${network}, returning empty array`);
  return [];
}

/**
 * Fetch TRC20 USDT transactions from TronGrid API
 * 
 * Reference: https://developers.tron.network/reference/trongrid-api
 * API Endpoint: GET /v1/accounts/{address}/transactions/trc20
 * 
 * @param address - Tron wallet address (base58 format)
 * @param since - Optional timestamp (milliseconds) to fetch transactions since this time
 * @returns Array of chain transactions
 */
async function fetchTRC20Transactions(
  address: string,
  since?: number
): Promise<ChainTx[]> {
  try {
    // Read environment variables from .env file
    // Do not hardcode API keys or print them in logs
    const baseUrl = process.env.TRON_API_BASE_URL;
    const apiKey = process.env.TRON_API_KEY;
    
    // Check if both environment variables are set
    if (!baseUrl || !apiKey) {
      console.warn('⚠️ TRON_API_BASE_URL or TRON_API_KEY is not set, returning empty transactions.');
      return [];
    }
    
    // USDT (TRC20) contract address (example - replace with actual contract address)
    const USDT_CONTRACT_ADDRESS = 'TRExample1234567890ABCDEFGHIJKLMNOPQRST';
    
    // Build API URL according to TronGrid v1 accounts TRC20 history documentation
    // Reference: https://developers.tron.network/reference/getaccounttransactions
    // Endpoint: GET /v1/accounts/{address}/transactions/trc20
    // NOTE: Temporarily ignoring 'since' parameter to fetch all recent transactions
    // This helps debug why transactions are not being found
    const url = new URL(`${baseUrl}/v1/accounts/${address}/transactions/trc20`);
    url.searchParams.set('limit', '100'); // Request limit (adjustable, max 200)
    url.searchParams.set('only_confirmed', 'true'); // Only confirmed transactions
    url.searchParams.set('contract_address', USDT_CONTRACT_ADDRESS); // Filter USDT transactions
    // NOTE: Not adding start_timestamp or min_timestamp to avoid filtering out existing transactions
    
    // Add TronGrid API Key to request headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'TRON-PRO-API-KEY': apiKey
    };
    
    console.log(`[WalletExplorer] Requesting TronGrid API: ${url.toString()}`);
    console.log(`[WalletExplorer] Address: ${address}, Since: ${since ? new Date(since).toISOString() : 'none (fetching all)'}`);
    
    // Send GET request to TronGrid API
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers
    });
    
    // Check HTTP response status
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unable to read error response');
      console.error(`[WalletExplorer] TronGrid API error: ${response.status} ${response.statusText}`);
      console.error(`[WalletExplorer] Response body: ${errorText.substring(0, 500)}`);
      return [];
    }
    
    // Parse JSON response
    let data: any;
    try {
      data = await response.json();
    } catch (parseError) {
      console.error('[WalletExplorer] Failed to parse JSON response:', parseError);
      return [];
    }
    
    // Debug: Log TronGrid raw response
    console.log(`[WalletExplorer] TronGrid raw response count: ${data?.data?.length || 0}`);
    if (data?.data && data.data.length > 0) {
      console.log(`[WalletExplorer] First transaction sample:`, JSON.stringify(data.data[0], null, 2));
      // Check if any transaction matches the target address
      const matchingTxs = data.data.filter((tx: any) => 
        tx.to && tx.to.toLowerCase() === address.toLowerCase()
      );
      console.log(`[WalletExplorer] Transactions matching address ${address}: ${matchingTxs.length}`);
      if (matchingTxs.length > 0) {
        console.log(`[WalletExplorer] Sample matching transaction:`, JSON.stringify(matchingTxs[0], null, 2));
      }
    } else {
      console.warn(`[WalletExplorer] TronGrid returned empty data array`);
    }
    
    // Check if API returned error in response body
    if (data.error || !data.data) {
      console.error('[WalletExplorer] TronGrid API returned error:', data.error || 'No data field in response');
      if (data.error) {
        console.error('[WalletExplorer] Error details:', JSON.stringify(data.error, null, 2));
      }
      return [];
    }
    
    // Map TronGrid API response to ChainTx format
    // TronGrid API response structure:
    // {
    //   data: [
    //     {
    //       transaction_id: string,
    //       from: string,
    //       to: string,
    //       value: string (in smallest unit, USDT has 6 decimals),
    //       token_info: { symbol: string },
    //       block_timestamp: number (milliseconds)
    //     },
    //     ...
    //   ]
    // }
    const allMappedTxs: ChainTx[] = data.data.map((tx: any) => {
      // Convert value from smallest unit to human-readable USDT amount
      // USDT (TRC20) has 6 decimals: 1 USDT = 1,000,000 smallest units
      const amount = Number(tx.value || '0') / 1e6;
      
      // Extract timestamp (already in milliseconds)
      const timestamp = tx.block_timestamp || 0;
      
      // Map to ChainTx interface
      return {
        txId: tx.transaction_id || '',
        from: tx.from || '',
        to: tx.to || '',
        amount: amount,
        tokenSymbol: tx.token_info?.symbol || 'USDT', // Use token_info.symbol if available, otherwise default to 'USDT'
        timestamp: timestamp
      };
    });
    
    console.log(`[WalletExplorer] Mapped ${allMappedTxs.length} transactions from TronGrid`);
    
    // Filter transactions
    // NOTE: Temporarily ignoring 'since' filter to debug why transactions are not being found
    const transactions: ChainTx[] = allMappedTxs.filter((tx: ChainTx) => {
      // Filter 1: Only keep transactions where 'to' matches the monitored address (case-insensitive)
      if (tx.to.toLowerCase() !== address.toLowerCase()) {
        return false;
      }
      
      // Filter 2: Temporarily DISABLED - Use 'since' parameter for incremental sync
      // Only return transactions with timestamp > since
      // if (since && tx.timestamp <= since) {
      //   return false;
      // }
      
      // Filter 3: Filter out invalid transactions
      if (!tx.txId || !tx.from || tx.amount <= 0) {
        console.warn(`[WalletExplorer] Filtered out invalid transaction:`, { txId: tx.txId, from: tx.from, amount: tx.amount });
        return false;
      }
      
      return true;
    });
    
    // Sort by timestamp (oldest first)
    transactions.sort((a, b) => a.timestamp - b.timestamp);
    
    console.log(`[WalletExplorer] Found ${transactions.length} incoming USDT transactions for ${address} (after filtering)`);
    if (transactions.length > 0) {
      console.log(`[WalletExplorer] Transaction IDs:`, transactions.map(tx => tx.txId));
    }
    
    return transactions;
    
  } catch (error) {
    // Error handling: log error and return empty array to prevent server crash
    // This handles network errors, fetch failures, and other exceptions
    console.error('[WalletExplorer] Failed to fetch TRC20 transactions from TronGrid:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[WalletExplorer] Error details:', errorMessage);
    
    // Return empty array instead of throwing to prevent server crash
    return [];
  }
}

