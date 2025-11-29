import React, { useState, useEffect } from 'react';
import { SystemStats, Currency, WalletConfig } from '../types';
import { Wallet, TrendingUp, RefreshCw, Save } from 'lucide-react';

interface UserPendingAmount {
  name: string;
  amountCNY: number;
  amountUSDT: number;
}

interface StatsCardsProps {
  stats: SystemStats;
  displayCurrency: Currency;
  exchangeRate: number;
  onRateUpdate: (newRate: number) => void;
  walletConfigs: WalletConfig[];
  onSyncWallet: (walletId: string) => Promise<void>;
  apiConfigs?: Array<{ id: string; name: string; isActive?: boolean }>;
  onSyncAll?: () => Promise<void>;
  isSyncingAll?: boolean;
  userPendingAmounts?: UserPendingAmount[];
}

export const StatsCards: React.FC<StatsCardsProps> = ({ 
  stats, 
  displayCurrency, 
  exchangeRate, 
  onRateUpdate,
  walletConfigs,
  onSyncWallet,
  apiConfigs = [],
  onSyncAll,
  isSyncingAll = false,
  userPendingAmounts = []
}) => {
  const [localRate, setLocalRate] = useState(exchangeRate.toString());
  const [isModified, setIsModified] = useState(false);
  const [syncingWalletId, setSyncingWalletId] = useState<string | null>(null);

  // Get first active wallet for display
  const activeWallet = walletConfigs.find(w => w.status === 'Active') || walletConfigs[0];
  
  // Get active API config name
  const activeApiName = apiConfigs.find(a => a.isActive)?.name || '';

  // Format last sync time
  const formatLastSyncTime = (lastSyncTime?: number): string => {
    if (!lastSyncTime) return '尚未同步';
    const date = new Date(lastSyncTime);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `最后同步：${year}-${month}-${day} ${hours}:${minutes}`;
  };

  const handleSyncWallet = async (walletId: string) => {
    if (syncingWalletId) return; // Prevent duplicate clicks
    
    setSyncingWalletId(walletId);
    try {
      await onSyncWallet(walletId);
    } finally {
      setSyncingWalletId(null);
    }
  };

  // Sync local state if prop changes externally
  useEffect(() => {
    setLocalRate(exchangeRate.toString());
    setIsModified(false);
  }, [exchangeRate]);

  const handleRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalRate(e.target.value);
    setIsModified(true);
  };

  const handleSave = () => {
    const val = parseFloat(localRate);
    if (!isNaN(val) && val > 0) {
      onRateUpdate(val);
      setIsModified(false);
    } else {
      setLocalRate(exchangeRate.toString());
      setIsModified(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    }
  };
  
  // Helper to format currency based on display mode
  const formatMoney = (amountCNY: number, amountUSDT: number) => {
    if (displayCurrency === 'CNY') {
      return {
        main: `¥ ${amountCNY.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        sub: `≈ ${amountUSDT.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`
      };
    } else {
      return {
        main: `${amountUSDT.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`,
        sub: `≈ ¥ ${amountCNY.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      };
    }
  };

  // Calculate dynamic values
  // Total Income
  const todayValues = formatMoney(stats.todayTotalCNY, stats.todayTotalCNY / exchangeRate);
  
  // Payment API (Source is CNY)
  const safePerimValues = formatMoney(stats.totalSafePerimCNY, stats.totalSafePerimCNY / exchangeRate);
  
  // USDT Wallet (Source is USDT)
  // Base value is in USDT, converted CNY is rate dependent
  const usdtWalletCNY = stats.totalUSDTWalletUSDT * exchangeRate;
  const usdtWalletValues = formatMoney(usdtWalletCNY, stats.totalUSDTWalletUSDT);
  
  // Overall Total (Payment API + USDT Wallet)
  const overallValues = formatMoney(stats.totalOverallCNY, stats.totalOverallUSDT);

  return (
    <div className="space-y-4 mb-6">
      {/* Wallet Monitor Card */}
      {activeWallet && (
        <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Wallet className="w-5 h-5 text-purple-500 flex-shrink-0" />
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium whitespace-nowrap">
                  {activeWallet.label}
                </span>
                {activeApiName && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium whitespace-nowrap">
                    {activeApiName}
                  </span>
                )}
                <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${
                  activeWallet.status === 'Active' 
                    ? 'bg-emerald-100 text-emerald-700' 
                    : 'bg-slate-100 text-slate-500'
                }`}>
                  {activeWallet.status === 'Active' ? '运行中' : '已停用'}
                </span>
              </div>
              <div className="text-sm text-slate-500">
                {formatLastSyncTime(activeWallet.lastSyncTime)}
              </div>
            </div>
            {onSyncAll && (
              <button
                onClick={onSyncAll}
                disabled={isSyncingAll || syncingWalletId !== null || activeWallet.status !== 'Active'}
                className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-all flex-shrink-0 ${
                  isSyncingAll || syncingWalletId !== null || activeWallet.status !== 'Active'
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                }`}
              >
                <RefreshCw className={`w-4 h-4 ${isSyncingAll ? 'animate-spin' : ''}`} />
                {isSyncingAll ? '同步中...' : '同步全部'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
      {/* Card 1: Today's Income */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 flex flex-col justify-between transition-all duration-300">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-slate-500 text-sm font-semibold uppercase tracking-wider">今日总收入</h3>
          <TrendingUp className="w-5 h-5 text-emerald-500" />
        </div>
        <div>
          <div className="text-2xl font-bold text-slate-800 tracking-tight">{todayValues.main}</div>
          <div className="text-sm text-slate-400 font-mono mt-1">{todayValues.sub}</div>
        </div>
      </div>

      {/* Card 2: Payment API Total */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 flex flex-col justify-between transition-all duration-300">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-slate-500 text-sm font-semibold uppercase tracking-wider">支付接口累计</h3>
          <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">P</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-slate-800 tracking-tight">{safePerimValues.main}</div>
          <div className="text-sm text-slate-400 mt-1">{safePerimValues.sub}</div>
        </div>
      </div>

      {/* Card 3: USDT Wallet */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 flex flex-col justify-between transition-all duration-300">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-slate-500 text-sm font-semibold uppercase tracking-wider">USDT 钱包累计</h3>
          <Wallet className="w-5 h-5 text-purple-500" />
        </div>
        <div>
          <div className="text-2xl font-bold text-slate-800 tracking-tight">{usdtWalletValues.main}</div>
          <div className="text-sm text-slate-400 mt-1">{usdtWalletValues.sub}</div>
        </div>
      </div>

      {/* Card 4: Overall Total */}
      <div className="bg-gradient-to-br from-indigo-50 to-blue-50 p-4 rounded-lg shadow-sm border border-indigo-200 flex flex-col justify-between transition-all duration-300">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-slate-600 text-sm font-semibold uppercase tracking-wider">整体累计</h3>
          <TrendingUp className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <div className="text-2xl font-bold text-indigo-800 tracking-tight">{overallValues.main}</div>
          <div className="text-sm text-indigo-600 mt-1 font-medium">{overallValues.sub}</div>
        </div>
      </div>

      {/* Card 5: Exchange Rate Info (Editable) */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 flex flex-col justify-between bg-slate-50/50">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-slate-500 text-sm font-semibold uppercase tracking-wider">系统汇率 (可编辑)</h3>
          <RefreshCw className="w-4 h-4 text-slate-400" />
        </div>
        <div className="flex items-end gap-2">
          <span className="text-lg font-medium text-slate-500 mb-1">1 USDT ≈ ¥</span>
          <div className="flex-1 relative">
            <input 
              type="number"
              step="0.01"
              value={localRate}
              onChange={handleRateChange}
              onKeyDown={handleKeyDown}
              className="w-full bg-transparent text-2xl font-bold text-indigo-600 border-b-2 border-slate-300 focus:border-indigo-600 outline-none transition-colors pb-0.5 font-mono"
            />
          </div>
          <button 
            onClick={handleSave}
            disabled={!isModified}
            className={`p-2 rounded-lg transition-all ${
              isModified 
                ? 'bg-blue-600 text-white shadow-md hover:bg-blue-700' 
                : 'bg-slate-200 text-slate-400 cursor-default'
            }`}
            title="Save Exchange Rate"
          >
            <Save className="w-4 h-4" />
          </button>
        </div>
        <div className="text-xs text-slate-400 mt-1">
          {isModified ? "按回车或点击按钮保存" : "Applied to all conversions"}
        </div>
      </div>
      </div>

      {/* User Pending Amounts Row */}
      {userPendingAmounts.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">用户待结清金额</h3>
          {userPendingAmounts.length > 5 ? (
            // Horizontal scrollable layout for more than 5 users
            <div className="overflow-x-auto pb-2 -mx-4 px-4">
              <div className="flex gap-4 min-w-max">
                {userPendingAmounts.map((user, index) => {
                  const userValues = formatMoney(user.amountCNY, user.amountUSDT);
                  return (
                    <div 
                      key={index}
                      className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 flex flex-col justify-between transition-all duration-300 min-w-[200px] flex-shrink-0"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-slate-600 text-sm font-semibold truncate flex-1 mr-2">{user.name}</h4>
                        <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 font-bold text-xs flex-shrink-0">
                          {String.fromCharCode(65 + index)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-slate-800 tracking-tight">{userValues.main}</div>
                        <div className="text-xs text-slate-400 mt-1">{userValues.sub}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            // Grid layout for 5 or fewer users
            <div className={`grid gap-4 ${
              userPendingAmounts.length === 1 
                ? 'grid-cols-1' 
                : userPendingAmounts.length === 2 
                ? 'grid-cols-1 md:grid-cols-2' 
                : userPendingAmounts.length === 3
                ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                : userPendingAmounts.length === 4
                ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
                : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'
            }`}>
              {userPendingAmounts.map((user, index) => {
                const userValues = formatMoney(user.amountCNY, user.amountUSDT);
                return (
                  <div 
                    key={index}
                    className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 flex flex-col justify-between transition-all duration-300"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-slate-600 text-sm font-semibold truncate flex-1 mr-2">{user.name}</h4>
                      <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 font-bold text-xs flex-shrink-0">
                        {String.fromCharCode(65 + index)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xl font-bold text-slate-800 tracking-tight">{userValues.main}</div>
                      <div className="text-xs text-slate-400 mt-1">{userValues.sub}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};