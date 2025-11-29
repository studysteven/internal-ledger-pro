import React, { useState, useEffect, useMemo } from 'react';
import { StatsCards } from './components/StatsCards';
import { TransactionTable } from './components/TransactionTable';
import { UserSplitSettings } from './components/UserSplitSettings';
import { ManualEntryForm } from './components/ManualEntryForm';
import { SettleModal } from './components/SettleModal';
import { AdminPanel } from './components/AdminPanel';
import { ShareLogsPage } from './components/ShareLogsPage';
import { LoginPage } from './components/LoginPage';
import { Transaction, UserSplit, SystemStats, Currency, SplitDetail, ApiConfig, WalletConfig, ManualTransactionInput, Settlement } from './types';
import { getAdapter } from './services/adapter';
import { BellRing, ShieldCheck, Trash2, Coins, Settings, LayoutDashboard, Database, RefreshCw, FileText, LogOut } from 'lucide-react';
import { isAuthenticated, setAuth, clearAuth, getAuthHeaders, verifyToken, getUser, User } from './utils/auth';

// --- MOCK DATA START ---
const INITIAL_USERS: UserSplit[] = [
  { id: 'u1', name: 'Admin (Me)', ratio: 0.60 },
  { id: 'u2', name: 'Partner A', ratio: 0.25 },
  { id: 'u3', name: 'Partner B', ratio: 0.15 },
];

const INITIAL_TRANSACTIONS: Transaction[] = [
  // Note: Old 'SafePerim' transactions will be automatically migrated to use API config name
  // This initial transaction is only used if backend returns empty array
  {
    id: 't1',
    timestamp: '2023-10-27 14:30',
    source: 'Manual', // Changed from 'SafePerim' to avoid confusion
    currency: 'CNY',
    originalAmount: 5000,
    cnyAmount: 5000,
    status: 'Completed',
    splits: [
      { userId: 'u1', userName: 'Admin (Me)', ratio: 0.60, amount: 3000 },
      { userId: 'u2', userName: 'Partner A', ratio: 0.25, amount: 1250 },
      { userId: 'u3', userName: 'Partner B', ratio: 0.15, amount: 750 },
    ],
    cleared: false
  },
  {
    id: 't2',
    timestamp: '2023-10-27 11:15',
    source: 'USDT Wallet',
    currency: 'USDT',
    originalAmount: 1000,
    cnyAmount: 7120, 
    status: 'Completed',
    splits: [
      { userId: 'u1', userName: 'Admin (Me)', ratio: 0.60, amount: 4272 },
      { userId: 'u2', userName: 'Partner A', ratio: 0.25, amount: 1780 },
      { userId: 'u3', userName: 'Partner B', ratio: 0.15, amount: 1068 },
    ],
    cleared: false
  },
];

const DEFAULT_API_CONFIGS: ApiConfig[] = [
  { id: 'api-1', name: 'AlphaPay Main', baseUrl: 'https://api.example.com/v1', apiKey: 'sk_example_1234567890abcdef', adapterType: 'Standard', isActive: true }
];

const DEFAULT_WALLET_CONFIGS: WalletConfig[] = [
  { id: 'w-1', address: 'TExample1234567890ABCDEFGHIJKLMNOPQRST', network: 'TRC20', label: 'Company Main', status: 'Active' }
];
// --- MOCK DATA END ---

const App: React.FC = () => {
  // --- 0. Authentication State ---
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // --- 1. State ---
  const [currentView, setCurrentView] = useState<'dashboard' | 'admin' | 'logs'>('dashboard');

  // State initialization - will be loaded from backend
  const [users, setUsers] = useState<UserSplit[]>(INITIAL_USERS);
  const [transactions, setTransactions] = useState<Transaction[]>(INITIAL_TRANSACTIONS);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  
  // New Config State - will be loaded from backend
  const [apiConfigs, setApiConfigs] = useState<ApiConfig[]>(DEFAULT_API_CONFIGS);
  const [walletConfigs, setWalletConfigs] = useState<WalletConfig[]>(DEFAULT_WALLET_CONFIGS);

  const [exchangeRate, setExchangeRate] = useState<number>(7.12);
  const [displayCurrency, setDisplayCurrency] = useState<Currency>('CNY');
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [isSettling, setIsSettling] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoadingConfigs, setIsLoadingConfigs] = useState(true);

  // Load rate from local storage on mount
  useEffect(() => {
    const savedRate = localStorage.getItem('usdt_rate');
    if (savedRate) {
      setExchangeRate(parseFloat(savedRate));
    }
  }, []);

  // Check authentication status on mount
  useEffect(() => {
    const checkAuth = async () => {
      setIsCheckingAuth(true);
      
      // Check if token exists and is valid
      if (isAuthenticated()) {
        const isValid = await verifyToken();
        if (isValid) {
          const user = getUser();
          setCurrentUser(user);
          setIsLoggedIn(true);
        } else {
          // Token is invalid - clear it
          clearAuth();
          setIsLoggedIn(false);
        }
      } else {
        setIsLoggedIn(false);
      }
      
      setIsCheckingAuth(false);
    };
    
    checkAuth();
  }, []);

  // Handle login success
  const handleLoginSuccess = (token: string, user: User) => {
    setAuth(token, user);
    setCurrentUser(user);
    setIsLoggedIn(true);
  };

  // Handle logout
  const handleLogout = () => {
    clearAuth();
    setCurrentUser(null);
    setIsLoggedIn(false);
    // Reset all state
    setTransactions(INITIAL_TRANSACTIONS);
    setUsers(INITIAL_USERS);
    setApiConfigs(DEFAULT_API_CONFIGS);
    setWalletConfigs(DEFAULT_WALLET_CONFIGS);
  };

  // Load all data from backend on mount (only if authenticated)
  useEffect(() => {
    if (!isLoggedIn) return;
    
    const loadDataFromBackend = async () => {
      try {
        setIsLoadingConfigs(true);
        
        // Import authenticatedFetch dynamically
        const { authenticatedFetch } = await import('./utils/auth');
        
        // Fetch all data from backend with authentication
        const [transactionsRes, usersRes, apiConfigsRes, walletConfigsRes] = await Promise.all([
          authenticatedFetch('/api/transactions').catch(() => null),
          authenticatedFetch('/api/users').catch(() => null),
          authenticatedFetch('/api/api-configs').catch(() => null),
          authenticatedFetch('/api/wallet-configs').catch(() => null)
        ]);

        // Load transactions
        if (transactionsRes?.ok) {
          const transactionsData = await transactionsRes.json();
          if (Array.isArray(transactionsData)) {
            setTransactions(transactionsData.length > 0 ? transactionsData : INITIAL_TRANSACTIONS);
          }
        } else if (transactionsRes?.status === 401 || transactionsRes?.status === 403) {
          // Token expired or invalid - logout
          handleLogout();
          return;
        } else {
          console.warn('Failed to load transactions from backend, using fallback');
        }

        // Load users
        if (usersRes?.ok) {
          const usersData = await usersRes.json();
          if (Array.isArray(usersData) && usersData.length > 0) {
            setUsers(usersData);
          }
        } else if (usersRes?.status === 401 || usersRes?.status === 403) {
          handleLogout();
          return;
        } else {
          console.warn('Failed to load users from backend, using fallback');
        }

        // Load API configs
        if (apiConfigsRes?.ok) {
          const apiData = await apiConfigsRes.json();
          if (Array.isArray(apiData)) {
            setApiConfigs(apiData.length > 0 ? apiData : DEFAULT_API_CONFIGS);
            // Cache in localStorage as backup
            if (apiData.length > 0) {
              localStorage.setItem('admin_api_configs', JSON.stringify(apiData));
            }
          }
        } else if (apiConfigsRes?.status === 401 || apiConfigsRes?.status === 403) {
          handleLogout();
          return;
        } else {
          console.warn('Failed to load API configs from backend, using fallback');
        }

        // Load wallet configs
        if (walletConfigsRes?.ok) {
          const walletData = await walletConfigsRes.json();
          if (Array.isArray(walletData)) {
            setWalletConfigs(walletData.length > 0 ? walletData : DEFAULT_WALLET_CONFIGS);
            // Cache in localStorage as backup
            if (walletData.length > 0) {
              localStorage.setItem('admin_wallet_configs', JSON.stringify(walletData));
            }
          }
        } else if (walletConfigsRes?.status === 401 || walletConfigsRes?.status === 403) {
          handleLogout();
          return;
        } else {
          console.warn('Failed to load wallet configs from backend, using fallback');
        }
      } catch (error) {
        console.error('Failed to load data from backend:', error);
        alert('❌ 加载数据失败，请检查后端服务是否正常运行');
      } finally {
        setIsLoadingConfigs(false);
      }
    };

    loadDataFromBackend();
  }, []);

  // --- CRITICAL FIX: Sanitize Duplicate IDs on Mount ---
  // Ensure that on first load, we clean up any potential ID collisions from localStorage
  // This helps recover if the user previously created corrupted data.
  useEffect(() => {
    setApiConfigs(prev => {
      const seen = new Set<string>();
      return prev.map(item => {
        let newId = item.id;
        // If ID is duplicate OR if it looks like a simple date timestamp (old version), re-salt it
        if (seen.has(item.id) || !item.id.includes('-')) {
           newId = `${item.id}-${Math.random().toString(36).substr(2, 6)}`;
        }
        seen.add(newId);
        return { ...item, id: newId };
      });
    });

    setWalletConfigs(prev => {
      const seen = new Set<string>();
      return prev.map(item => {
        let newId = item.id;
        if (seen.has(item.id) || !item.id.includes('-')) {
           newId = `${item.id}-${Math.random().toString(36).substr(2, 6)}`;
        }
        seen.add(newId);
        return { ...item, id: newId };
      });
    });
  }, []); // Run once on mount

  // Note: Config syncing is now handled directly in AdminPanel save handlers


  // Recalculate stats whenever transactions or exchangeRate changes
  // NOTE: Statistics only count UNSETTLED transactions
  // Settled transactions (cleared === true) are excluded from all calculations
  // This ensures that after clicking "结清", settled transactions remain in the ledger
  // but are no longer counted in statistics
  const stats: SystemStats = useMemo(() => {
    let todayCNY = 0;
    let todayUSDT = 0; 
    let safePerimTotal = 0;
    let usdtWalletTotal = 0; 

    // Count only unsettled completed transactions (cleared === false)
    // This ensures statistics only reflect transactions that haven't been settled
    const completedTransactions = transactions.filter(t => 
      t.status === 'Completed' && !t.cleared
    );

    // Get today's date string in UTC+8 timezone for comparison
    // UTC+8 is 8 hours ahead of UTC
    const now = new Date();
    const utc8Offset = 8 * 60; // UTC+8 offset in minutes
    const utc8Time = new Date(now.getTime() + (now.getTimezoneOffset() + utc8Offset) * 60 * 1000);
    const todayDateStr = `${utc8Time.getFullYear()}-${String(utc8Time.getMonth() + 1).padStart(2, '0')}-${String(utc8Time.getDate()).padStart(2, '0')}`;

    completedTransactions.forEach(t => {
       const isUSDT = t.currency === 'USDT';
       // Recalculate CNY Amount based on current rate for USDT transactions
       // If source is USDT, we trust originalAmount as USDT value
       const cnyVal = isUSDT ? t.originalAmount * exchangeRate : t.originalAmount;
       const usdtVal = isUSDT ? t.originalAmount : t.originalAmount / exchangeRate;
       
       // Check if transaction is from today (UTC+8)
       // timestamp format: "YYYY-MM-DD HH:mm:ss" (e.g., "2024-11-29 14:30:00")
       // Assume timestamp is already in UTC+8 format
       const txDateStr = t.timestamp.split(' ')[0]; // Get date part "YYYY-MM-DD"
       
       // Only count today's transactions for todayTotal (UTC+8)
       if (txDateStr === todayDateStr) {
         todayCNY += cnyVal;
         todayUSDT += usdtVal;
       }

       // Count all transactions for totals
       // Payment API sources: any source that is NOT 'USDT Wallet' or 'Manual'
       // This dynamically includes all payment API names (e.g., 'Safeperim', 'AlphaPay', etc.)
       if (t.source === 'USDT Wallet' || (t.currency === 'USDT' && t.source !== 'Manual')) {
         usdtWalletTotal += isUSDT ? t.originalAmount : t.originalAmount / exchangeRate;
       } else if (t.source !== 'Manual' && t.source !== 'USDT Wallet') {
         // All other sources are payment APIs (CNY transactions from payment gateways)
         safePerimTotal += t.originalAmount; 
       }
    });

    // Calculate overall total (Payment API + USDT Wallet)
    const totalOverallCNY = safePerimTotal + (usdtWalletTotal * exchangeRate);
    const totalOverallUSDT = (safePerimTotal / exchangeRate) + usdtWalletTotal;

    return {
      todayTotalCNY: todayCNY,
      todayTotalUSDT: todayUSDT,
      totalSafePerimCNY: safePerimTotal,
      totalUSDTWalletUSDT: usdtWalletTotal,
      totalUSDTWalletCNY: usdtWalletTotal * exchangeRate,
      totalOverallCNY: totalOverallCNY,
      totalOverallUSDT: totalOverallUSDT,
      exchangeRate: exchangeRate
    };
  }, [transactions, exchangeRate]);

  // Calculate pending settlement amounts for each user
  // Only count unsettled (cleared === false) transactions
  const userPendingAmounts = useMemo(() => {
    const pendingMap: Record<string, { name: string; amountCNY: number; amountUSDT: number }> = {};
    
    // Initialize with all users
    users.forEach(user => {
      pendingMap[user.id] = {
        name: user.name,
        amountCNY: 0,
        amountUSDT: 0
      };
    });
    
    // Sum up pending amounts from unsettled transactions
    const unsettledTransactions = transactions.filter(t => 
      t.status === 'Completed' && !t.cleared
    );
    
    unsettledTransactions.forEach(tx => {
      tx.splits.forEach(split => {
        if (pendingMap[split.userId]) {
          // split.amount is already in CNY (calculated by backend)
          // So we can directly use it for CNY, and convert to USDT
          const cnyAmount = split.amount;
          const usdtAmount = split.amount / exchangeRate;
          
          pendingMap[split.userId].amountCNY += cnyAmount;
          pendingMap[split.userId].amountUSDT += usdtAmount;
        }
      });
    });
    
    // Convert to array and round to 2 decimal places
    return Object.values(pendingMap).map(user => ({
      ...user,
      amountCNY: Math.round(user.amountCNY * 100) / 100,
      amountUSDT: Math.round(user.amountUSDT * 100) / 100
    }));
  }, [transactions, users, exchangeRate]);

  // --- 2. Handlers ---
  
  const handleRateUpdate = (newRate: number) => {
    setExchangeRate(newRate);
    localStorage.setItem('usdt_rate', newRate.toString());
  };
  
  const handleUpdateTransaction = async (id: string, updatedSplits: SplitDetail[], remark?: string) => {
    try {
      console.log('[App] Updating transaction splits:', { id, splits: updatedSplits, remark });
      
      const { authenticatedFetch } = await import('./utils/auth');
      const response = await authenticatedFetch(`/api/transactions/${id}/splits`, {
        method: 'PATCH',
        body: JSON.stringify({ 
          splits: updatedSplits,
          remark: remark || undefined
        })
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          handleLogout();
          return;
        }
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('[App] Update failed:', errorData);
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const updatedTransaction = await response.json();
      console.log('[App] Update successful, transaction updated:', updatedTransaction.id);
      
      // Update local state
      setTransactions(prev => prev.map(t => {
        if (t.id === id) {
          return updatedTransaction;
        }
        return t;
      }));
      
      // Trigger logs refresh if logs page is currently open
      // We'll use a custom event to notify ShareLogsPage to refresh
      window.dispatchEvent(new CustomEvent('shareLogsRefresh'));
      
      // Show success message
      alert('✅ 分账比例已更新！\n\n调整记录已自动保存到"分账日志"页面，可在导航栏中查看。');
    } catch (error) {
      console.error('Failed to update transaction splits:', error);
      alert(`❌ 更新分账失败：${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleUpdateUsers = async (newUsers: UserSplit[]) => {
    try {
      const { authenticatedFetch } = await import('./utils/auth');
      const response = await authenticatedFetch('/api/users', {
        method: 'POST',
        body: JSON.stringify(newUsers)
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          handleLogout();
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const updatedUsers = await response.json();
      setUsers(updatedUsers);
      
      // CRITICAL: After updating user split ratios, reload all transactions
      // This ensures that all transaction flows immediately reflect the new split ratios
      console.log('[App] User ratios updated, reloading transactions to apply new splits...');
      await reloadTransactions();
      
      alert('✅ 用户配置已保存，所有交易的分账比例已更新');
    } catch (error) {
      console.error('Failed to update users:', error);
      alert('❌ 更新用户配置失败，请重试');
    }
  };

  const handleCreateManualTransaction = async (input: ManualTransactionInput) => {
    try {
      const { authenticatedFetch } = await import('./utils/auth');
      const response = await authenticatedFetch('/api/transactions/manual', {
        method: 'POST',
        body: JSON.stringify(input)
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          handleLogout();
          return;
        }
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const newTransaction = await response.json();
      
      // Insert at the beginning of transactions array
      setTransactions(prev => [newTransaction, ...prev]);
    } catch (error) {
      console.error('Failed to create manual transaction:', error);
      const errorMessage = error instanceof Error ? error.message : '创建交易失败';
      alert(`❌ ${errorMessage}\n\n请检查：\n1. 后端服务是否正常运行\n2. 网络连接是否正常`);
    }
  };

  // Reload transactions from backend
  const reloadTransactions = async () => {
    try {
      const { authenticatedFetch } = await import('./utils/auth');
      const response = await authenticatedFetch('/api/transactions');
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          // Token expired or invalid - logout
          handleLogout();
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const transactionsData = await response.json();
      if (Array.isArray(transactionsData)) {
        setTransactions(transactionsData.length > 0 ? transactionsData : INITIAL_TRANSACTIONS);
      }
    } catch (error) {
      console.error('Failed to reload transactions:', error);
      // Don't throw - allow user to continue with current state
    }
  };

  const handleSettleConfirm = async () => {
    setIsSettling(true);
    try {
      // Get all completed transactions (all transactions are eligible for settlement)
      const completedTransactions = transactions.filter(t => t.status === 'Completed');
      
      if (completedTransactions.length === 0) {
        setIsSettleModalOpen(false);
        alert('ℹ️ 没有可结清的交易记录');
        return;
      }

      // Call backend API to create settlement (this will delete all transactions)
      const { authenticatedFetch } = await import('./utils/auth');
      const response = await authenticatedFetch('/api/settlements', {
        method: 'POST'
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          handleLogout();
          return;
        }
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const settlementData = await response.json();
      const { settlement, deletedCount, clearedLogsCount } = settlementData;

      // Clear all transactions from local state (they've been deleted on backend)
      setTransactions([]);

      // Add settlement record
      setSettlements(prev => [settlement, ...prev]);
      
      setIsSettleModalOpen(false);
      
      // Show success message
      const message = `✅ 结清完成！\n\n` +
        `结算批次: ${settlement.id}\n` +
        `已删除交易: ${deletedCount || 0} 条\n` +
        `总金额: ¥${settlement.totalAmountCNY.toFixed(2)} (${settlement.totalAmountUSDT.toFixed(2)} USDT)\n` +
        `已清除分账日志: ${clearedLogsCount || 0} 条`;
      
      alert(message);
      
      // Trigger logs refresh if logs page is currently open
      window.dispatchEvent(new CustomEvent('shareLogsRefresh'));
    } catch (error) {
      console.error('Error settling accounts:', error);
      const errorMessage = error instanceof Error ? error.message : '结清失败';
      alert(`❌ ${errorMessage}\n\n请检查：\n1. 后端服务是否正常运行\n2. 网络连接是否正常`);
    } finally {
      setIsSettling(false);
    }
  };

  // --- Wallet Sync Logic ---
  const handleSyncWallet = async (walletId: string) => {
    try {
      const { authenticatedFetch } = await import('./utils/auth');
      // 点击"立即同步钱包"按钮后，将发起 POST /api/wallets/{id}/sync 和 GET /api/transactions 请求
      const syncResponse = await authenticatedFetch(`/api/wallets/${walletId}/sync`, {
        method: 'POST'
      });

      if (!syncResponse.ok) {
        if (syncResponse.status === 401 || syncResponse.status === 403) {
          handleLogout();
          return;
        }
        throw new Error(`HTTP error! status: ${syncResponse.status}`);
      }

      const syncResult = await syncResponse.json();
      const { added, transactions: newTransactions } = syncResult;

      // 重新获取交易列表以更新状态
      const transactionsRes = await authenticatedFetch('/api/transactions');
      if (transactionsRes.ok) {
        const transactionsData = await transactionsRes.json();
        if (Array.isArray(transactionsData)) {
          setTransactions(transactionsData);
        }
      }

      // 重新获取钱包配置以更新 lastSyncTime
      const walletConfigsRes = await authenticatedFetch('/api/wallet-configs');
      if (walletConfigsRes.ok) {
        const walletData = await walletConfigsRes.json();
        if (Array.isArray(walletData)) {
          setWalletConfigs(walletData);
        }
      }

      // 如果有新交易，显示提示
      if (added > 0) {
        alert(`钱包有新的到账 ${added} 条`);
      }
    } catch (error) {
      console.error('Failed to sync wallet:', error);
      alert('同步钱包失败，请稍后再试');
    }
  };

  // --- NEW: Sync Logic using Adapter ---
  const handleSyncData = async () => {
    setIsSyncing(true);
    try {
      const activeApi = apiConfigs.find(c => c.isActive);
      if (!activeApi) {
        alert('❌ 未配置活动的支付接口\n请先在后台管理中配置并激活一个支付接口。');
        return;
      }

      // 1. Get the unified adapter
      const adapter = getAdapter(activeApi);
      
      // 2. Fetch data from backend (backend handles external API calls)
      const newExternalTransactions = await adapter.fetchTransactions();

      // 3. Merge data (check for duplicates via ID)
      // Backend already applies default splits when creating transactions
      // Just merge the new transactions (backend returns complete Transaction objects with splits)
      setTransactions(prev => {
        const existingIds = new Set(prev.map(t => t.id));
        const uniqueNew = newExternalTransactions.filter(t => !existingIds.has(t.id));
        
        if (uniqueNew.length === 0) {
          return prev; // No new transactions
        }
        
        // Backend already calculated splits based on default user ratios
        return [...uniqueNew, ...prev];
      });

      const newCount = newExternalTransactions.filter(t => {
        const existingIds = new Set(transactions.map(tr => tr.id));
        return !existingIds.has(t.id);
      }).length;

      if (newCount > 0) {
        alert(`✅ 同步成功！\n从 ${activeApi.name} 获取了 ${newCount} 条新交易记录。`);
      } else {
        alert(`ℹ️ 同步完成\n从 ${activeApi.name} 获取了 ${newExternalTransactions.length} 条记录，但都是已存在的交易。`);
      }

    } catch (error) {
      console.error('[Sync Error]', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert(`❌ 同步失败\n${errorMessage}\n\n请检查：\n1. 后端服务是否正常运行\n2. 网络连接是否正常\n3. API 配置是否正确`);
    } finally {
      setIsSyncing(false);
    }
  };

  // --- Combined Sync: Both Payment API and Wallet ---
  const handleSyncAll = async () => {
    setIsSyncing(true);
    try {
      const { authenticatedFetch } = await import('./utils/auth');
      // 1. Sync payment API first
      const activeApi = apiConfigs.find(c => c.isActive);
      if (activeApi) {
        try {
          const adapter = getAdapter(activeApi);
          const newExternalTransactions = await adapter.fetchTransactions();
          
          // Backend already applies default splits when creating transactions
          // Just merge the new transactions (backend returns complete Transaction objects with splits)
          setTransactions(prev => {
            const existingIds = new Set(prev.map(t => t.id));
            const uniqueNew = newExternalTransactions.filter(t => !existingIds.has(t.id));
            
            if (uniqueNew.length === 0) {
              return prev;
            }
            
            // Backend already calculated splits based on default user ratios
            return [...uniqueNew, ...prev];
          });
        } catch (error) {
          console.error('[Payment API Sync Error]', error);
        }
      }

      // 2. Sync wallet
      const activeWallet = walletConfigs.find(w => w.status === 'Active');
      if (activeWallet) {
        try {
          await handleSyncWallet(activeWallet.id);
        } catch (error) {
          console.error('[Wallet Sync Error]', error);
        }
      }

      // 3. Reload transactions to get latest state
      await reloadTransactions();

      alert('✅ 同步完成！\n已同步支付接口和钱包数据。');
    } catch (error) {
      console.error('[Sync All Error]', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert(`❌ 同步失败\n${errorMessage}\n\n请检查：\n1. 后端服务是否正常运行\n2. 网络连接是否正常`);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-12 relative">
      <SettleModal 
        isOpen={isSettleModalOpen} 
        onClose={() => setIsSettleModalOpen(false)}
        onConfirm={handleSettleConfirm}
        isSubmitting={isSettling}
      />

      {/* Top Header Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-1.5 rounded text-white shadow-sm">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-600 hidden sm:block">
              Internal Ledger Pro
            </h1>
            <h1 className="text-xl font-bold text-blue-700 sm:hidden">
              Ledger Pro
            </h1>
          </div>
          
          <div className="flex items-center gap-3">
             {/* Navigation Buttons */}
             <div className="flex bg-slate-100 rounded-lg p-1 mr-2">
                <button 
                  onClick={() => setCurrentView('dashboard')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 transition-all ${currentView === 'dashboard' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <LayoutDashboard className="w-4 h-4" /> 仪表盘
                </button>
                  <button
                    onClick={() => setCurrentView('admin')}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 transition-all ${currentView === 'admin' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    <Database className="w-4 h-4" /> 后台管理
                  </button>
                  <button
                    onClick={() => setCurrentView('logs')}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 transition-all ${currentView === 'logs' ? 'bg-white text-green-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    <FileText className="w-4 h-4" /> 分账日志
                  </button>
             </div>

            <div className="hidden md:flex items-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
              <BellRing className="w-3.5 h-3.5" />
              System Active
            </div>

            {/* User Info & Logout Button */}
            {currentUser && (
              <div className="flex items-center gap-3">
                <div className="hidden md:flex items-center gap-2 text-xs text-slate-600 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {currentUser.username}
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors border border-transparent hover:border-red-100"
                  title="退出登录"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">退出</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Show login page if not authenticated */}
        {isCheckingAuth ? (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-slate-600">正在验证身份...</p>
            </div>
          </div>
        ) : !isLoggedIn ? (
          <LoginPage onLoginSuccess={handleLoginSuccess} />
        ) : (
          <>
            {currentView === 'dashboard' ? (
          <>
            {/* 1. Overview Cards */}
            <StatsCards
              stats={stats}
              displayCurrency={displayCurrency}
              exchangeRate={exchangeRate}
              onRateUpdate={handleRateUpdate}
              walletConfigs={walletConfigs}
              onSyncWallet={handleSyncWallet}
              apiConfigs={apiConfigs}
              onSyncAll={handleSyncAll}
              isSyncingAll={isSyncing}
              userPendingAmounts={userPendingAmounts}
            />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Left Column: Transaction List */}
              <div className="lg:col-span-8 xl:col-span-9 flex flex-col gap-6 h-full">
                {/* Transaction Table - Allow to expand upward */}
                <div className="flex-1 min-h-0">
                  <TransactionTable 
                    transactions={transactions}
                    exchangeRate={exchangeRate}
                    users={users}
                    apiConfigs={apiConfigs}
                    onUpdateTransaction={handleUpdateTransaction}
                    onRefreshTransactions={reloadTransactions}
                  />
                </div>
                {/* Manual Entry Form - Fixed at bottom */}
                <div className="flex-shrink-0">
                  <ManualEntryForm 
                    users={users} 
                    onCreateTransaction={handleCreateManualTransaction}
                    exchangeRate={exchangeRate}
                  />
                </div>
              </div>

              {/* Right Column: Settings */}
              <div className="lg:col-span-4 xl:col-span-3 flex flex-col h-full">
                <div className="sticky top-24 flex flex-col gap-6 h-full">
                  <div className="flex-1 min-h-0">
                    <UserSplitSettings 
                      users={users} 
                      onSaveUsers={handleUpdateUsers}
                    />
                  </div>

                  {/* System Control - Fixed at bottom to align with Manual Entry Form */}
                  <div className="flex-shrink-0">
                    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
                      <div className="flex items-center gap-2 mb-4 text-slate-800 font-bold">
                        <Settings className="w-5 h-5 text-slate-400" />
                        <span>系统控制</span>
                      </div>
                      
                      <div className="mb-6">
                        <label className="text-xs font-semibold text-slate-500 uppercase mb-2 block">全局显示单位</label>
                        <div className="flex bg-slate-100 p-1 rounded-lg">
                          <button
                            onClick={() => setDisplayCurrency('CNY')}
                            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2 ${
                              displayCurrency === 'CNY' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                            }`}
                          >
                            <span className="font-bold">¥</span> CNY
                          </button>
                          <button
                            onClick={() => setDisplayCurrency('USDT')}
                            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2 ${
                              displayCurrency === 'USDT' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                            }`}
                          >
                            <Coins className="w-3.5 h-3.5" /> USDT
                          </button>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100">
                        <button
                          onClick={() => setIsSettleModalOpen(true)}
                          className="w-full py-3 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 border border-red-100 rounded-lg transition-colors flex items-center justify-center gap-2 font-medium group"
                        >
                          <Trash2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                          结清 / 重置所有数据
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
          ) : currentView === 'logs' ? (
            // --- Share Logs View ---
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <ShareLogsPage transactions={transactions} users={users} />
            </div>
          ) : (
            // --- Admin Panel View ---
            <AdminPanel 
            apiConfigs={apiConfigs}
            onSaveApiConfigs={async (newConfigs: ApiConfig[]) => {
              try {
                const { authenticatedFetch } = await import('./utils/auth');
                const response = await authenticatedFetch('/api/api-configs', {
                  method: 'POST',
                  body: JSON.stringify(newConfigs)
                });

                if (!response.ok) {
                  if (response.status === 401 || response.status === 403) {
                    handleLogout();
                    return;
                  }
                  throw new Error(`HTTP error! status: ${response.status}`);
                }

                const updatedConfigs = await response.json();
                setApiConfigs(updatedConfigs);
                // Cache in localStorage as backup
                localStorage.setItem('admin_api_configs', JSON.stringify(updatedConfigs));
              } catch (error) {
                console.error('Failed to save API configs:', error);
                alert('❌ 保存 API 配置失败，请重试');
              }
            }}
            walletConfigs={walletConfigs}
            onSaveWalletConfigs={async (newConfigs: WalletConfig[]) => {
              try {
                // Debug: Log request details
                console.log('[SaveWalletConfigs] Request URL: /api/wallet-configs');
                console.log('[SaveWalletConfigs] Method: POST');
                console.log('[SaveWalletConfigs] Body (walletConfigs):', JSON.stringify(newConfigs, null, 2));
                
                const { authenticatedFetch } = await import('./utils/auth');
                const response = await authenticatedFetch('/api/wallet-configs', {
                  method: 'POST',
                  body: JSON.stringify(newConfigs)
                });

                console.log('[SaveWalletConfigs] Response status:', response.status);
                console.log('[SaveWalletConfigs] Response ok:', response.ok);

                if (!response.ok) {
                  if (response.status === 401 || response.status === 403) {
                    handleLogout();
                    return;
                  }
                  const errorText = await response.text().catch(() => 'Unable to read error response');
                  console.error('[SaveWalletConfigs] Response error:', errorText);
                  throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
                }

                const updatedConfigs = await response.json();
                console.log('[SaveWalletConfigs] Success, updated configs:', updatedConfigs);
                setWalletConfigs(updatedConfigs);
                // Cache in localStorage as backup
                localStorage.setItem('admin_wallet_configs', JSON.stringify(updatedConfigs));
              } catch (error) {
                console.error('[SaveWalletConfigs] Failed to save wallet configs:', error);
                const errorMessage = error instanceof Error ? error.message : String(error);
                alert(`❌ 保存钱包配置失败，请重试\n\n错误信息: ${errorMessage}`);
              }
            }}
          />
          )}
          </>
        )}
      </main>
    </div>
  );
};

export default App;