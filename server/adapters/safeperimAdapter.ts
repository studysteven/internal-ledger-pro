/**
 * Safeperim Payment Gateway Adapter
 * 
 * This module provides functions to fetch transactions from Safeperim payment gateway.
 * 
 * Configuration:
 * - baseUrl: from SAFEPERIM_BASE_URL env var or config
 * - merchantId: from SAFEPERIM_MERCHANT_ID env var or config
 * - md5Key: from SAFEPERIM_MD5_KEY env var (NEVER expose to frontend or logs)
 * 
 * TODO: Implement V1 query interface based on Safeperim API documentation
 * - Request URL: /gateway/orderQuery (to be confirmed from docs)
 * - Request method: GET/POST (to be confirmed from docs)
 * - Signature generation: MD5 hash of sorted parameters + md5Key
 * - Response parsing: Extract order list and map to ExternalTx format
 */

// Note: No crypto import needed - Safeperim API uses key directly in URL

export interface SafeperimConfig {
  baseUrl: string;    // 例如 https://api.example.com/
  merchantId: string; // pid (商户ID)
}

export interface ExternalTx {
  externalTxId: string; // Order ID or transaction ID from Safeperim
  amount: number; // Transaction amount
  currency: string; // Currency code (e.g., 'CNY', 'USDT')
  paidAt: number; // Payment timestamp in milliseconds
  status: 'SUCCESS' | 'FAILED' | 'PENDING' | 'REFUNDED'; // Transaction status
  raw: any; // Raw response data for debugging
}

/**
 * Safeperim API Response Interface
 */
interface SafeperimOrdersResponse {
  code: number;  // 1 为成功，其它为失败
  msg: string;   // 提示信息
  data?: any[];  // 订单列表
}

/**
 * Fetch transactions from Safeperim payment gateway
 * 
 * Uses the official Safeperim API: act=orders (批量查询订单)
 * 
 * @param config - Safeperim configuration (baseUrl, merchantId)
 * @param since - Optional timestamp (milliseconds) to filter transactions locally
 * @returns Array of external transactions
 */
export async function fetchSafeperimTransactions(
  config: SafeperimConfig,
  since?: number
): Promise<ExternalTx[]> {
  try {
    // Get merchant key from environment (NEVER log or expose this)
    const key = process.env.SAFEPERIM_MD5_KEY;
    
    if (!key) {
      console.error('[SafeperimAdapter] SAFEPERIM_MD5_KEY is not set in environment variables');
      return [];
    }
    
    // Use config values or fallback to environment variables
    const baseUrl = (config.baseUrl || process.env.SAFEPERIM_BASE_URL || '').replace(/\/$/, ''); // Remove trailing slash
    const pid = config.merchantId || process.env.SAFEPERIM_MERCHANT_ID || '';
    
    if (!baseUrl || !pid) {
      console.error('[SafeperimAdapter] Missing baseUrl or merchantId', { baseUrl: baseUrl ? '***' : '', merchantId: pid ? '***' : '' });
      return [];
    }
    
    console.log(`[SafeperimAdapter] Fetching transactions for merchant ${pid}${since ? ` since ${new Date(since).toISOString()}` : ''}`);
    
    // Fetch orders from multiple pages (first 3 pages, 50 orders per page)
    const MAX_PAGES = 3;
    const LIMIT_PER_PAGE = 50;
    const allOrders: any[] = [];
    
    for (let page = 1; page <= MAX_PAGES; page++) {
      // Build request URL according to Safeperim API documentation
      // URL: http://api.example.com/api.php?act=orders&pid=(商户ID)&key=(商户密钥)&limit=50&page=1
      const url = new URL(`${baseUrl}/api.php`);
      url.searchParams.set('act', 'orders');
      url.searchParams.set('pid', pid);
      url.searchParams.set('key', key);
      url.searchParams.set('limit', String(LIMIT_PER_PAGE));
      url.searchParams.set('page', String(page));
      
      console.log('[Safeperim] orders request', { 
        baseUrl, 
        pid: config.merchantId,
        page,
        url: url.toString().replace(/key=[^&]+/, 'key=***') // Don't log the key
      });
      
      // Make HTTP GET request
      const response = await fetch(url.toString(), {
        method: 'GET'
      });
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unable to read error response');
        console.error(`[SafeperimAdapter] HTTP error for page ${page}: ${response.status} ${response.statusText}`);
        console.error(`[SafeperimAdapter] Response body: ${errorText.substring(0, 500)}`);
        // Continue to next page even if this one fails
        continue;
      }
      
      // Parse response JSON
      let json: SafeperimOrdersResponse;
      try {
        json = await response.json();
      } catch (parseError) {
        const text = await response.text();
        console.error(`[SafeperimAdapter] Failed to parse JSON response for page ${page}:`, parseError);
        console.error(`[SafeperimAdapter] Response text:`, text.substring(0, 500));
        continue;
      }
      
      console.log('[Safeperim] orders response', {
        page,
        status: response.status,
        code: json.code,
        msg: json.msg,
        count: Array.isArray(json.data) ? json.data.length : 0
      });
      
      // Check if API call was successful (code === 1 means success)
      if (json.code !== 1) {
        console.error(`[SafeperimAdapter] API error for page ${page}: code=${json.code}, msg=${json.msg}`);
        // If first page fails, stop trying other pages
        if (page === 1) {
          return [];
        }
        // Otherwise continue to next page
        continue;
      }
      
      // Extract orders from response
      if (!Array.isArray(json.data)) {
        console.warn(`[SafeperimAdapter] Response data is not an array for page ${page}`);
        continue;
      }
      
      if (json.data.length === 0) {
        // No more orders, stop pagination
        console.log(`[SafeperimAdapter] No more orders on page ${page}, stopping pagination`);
        break;
      }
      
      allOrders.push(...json.data);
      
      // If this page has fewer orders than limit, we've reached the end
      if (json.data.length < LIMIT_PER_PAGE) {
        console.log(`[SafeperimAdapter] Page ${page} has fewer orders than limit, stopping pagination`);
        break;
      }
    }
    
    console.log(`[SafeperimAdapter] Fetched ${allOrders.length} total orders from Safeperim`);
    
    // Map orders to ExternalTx[]
    const list: ExternalTx[] = [];
    
    for (const item of allOrders) {
      // 订单唯一标识：优先用 out_trade_no（商户订单号），否则 fallback trade_no
      const id = item.out_trade_no || item.trade_no;
      if (!id) {
        console.warn('[SafeperimAdapter] Order missing both out_trade_no and trade_no, skipping:', item);
        continue;
      }
      
      // 支付成功判断：根据文档，status = 1 为支付成功，0 未支付
      const isPaid = String(item.status) === '1';
      
      // 金额：money 字段是 String，需要转换为 Number
      const amount = Number(item.money ?? 0);
      if (amount <= 0) {
        console.warn('[SafeperimAdapter] Order has invalid amount, skipping:', { id, money: item.money });
        continue;
      }
      
      // 支付时间：优先使用支付完成时间 endtime，否则使用创建时间 addtime
      const payTimeStr = item.endtime || item.addtime;
      // Safeperim 时间格式可能是 "YYYY-MM-DD HH:mm:ss" 或类似格式
      // Date.parse() 需要将 "-" 替换为 "/" 才能正确解析
      const paidAt = payTimeStr 
        ? (Date.parse(payTimeStr.replace(/-/g, '/')) || Date.now())
        : Date.now();
      
      list.push({
        externalTxId: String(id),
        amount,
        currency: 'CNY', // Safeperim 处理的是法币
        paidAt,
        status: isPaid ? 'SUCCESS' : 'FAILED',
        raw: item,
      });
    }
    
    console.log(`[SafeperimAdapter] Mapped ${list.length} valid transactions (out of ${allOrders.length} total orders)`);
    
    // Apply since filter locally if provided
    if (since) {
      const filtered = list.filter(tx => tx.paidAt > since);
      console.log(`[SafeperimAdapter] Filtered by since: ${list.length} -> ${filtered.length} transactions`);
      return filtered;
    }
    
    return list;
    
  } catch (error) {
    console.error('[SafeperimAdapter] Error fetching Safeperim transactions:', error);
    // Don't expose MD5 key in error messages
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[SafeperimAdapter] Error details:', errorMessage);
    return [];
  }
}

/**
 * Fetch raw Safeperim API response for debugging
 * This function makes the same API call as fetchSafeperimTransactions but returns the raw JSON
 */
export async function fetchSafeperimRawResponse(
  config: SafeperimConfig
): Promise<any> {
  try {
    const key = process.env.SAFEPERIM_MD5_KEY;
    if (!key) {
      throw new Error('SAFEPERIM_MD5_KEY is not set');
    }
    
    const baseUrl = (config.baseUrl || process.env.SAFEPERIM_BASE_URL || '').replace(/\/$/, '');
    const pid = config.merchantId || process.env.SAFEPERIM_MERCHANT_ID || '';
    
    if (!baseUrl || !pid) {
      throw new Error('Missing baseUrl or merchantId');
    }
    
    // Fetch first page only for debugging
    const url = new URL(`${baseUrl}/api.php`);
    url.searchParams.set('act', 'orders');
    url.searchParams.set('pid', pid);
    url.searchParams.set('key', key);
    url.searchParams.set('limit', '50');
    url.searchParams.set('page', '1');
    
    const response = await fetch(url.toString(), {
      method: 'GET'
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unable to read error response');
      throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 200)}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[SafeperimAdapter] Error fetching raw response:', error);
    throw error;
  }
}

// Note: Status mapping is now done directly in fetchSafeperimTransactions
// based on Safeperim API documentation: status = 1 (支付成功), status = 0 (未支付)

