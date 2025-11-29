import React, { useState } from 'react';
import { ApiConfig, WalletConfig } from '../types';
import { 
  Server, Globe, Plus, Trash2, Key,
  Wallet, RefreshCw, CheckCircle2, AlertCircle
} from 'lucide-react';

interface AdminPanelProps {
  apiConfigs: ApiConfig[];
  onSaveApiConfigs: (configs: ApiConfig[]) => void;
  walletConfigs: WalletConfig[];
  onSaveWalletConfigs: (configs: WalletConfig[]) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ 
  apiConfigs, onSaveApiConfigs, walletConfigs, onSaveWalletConfigs 
}) => {
  const [activeTab, setActiveTab] = useState<'api' | 'wallet'>('api');

  // --- Robust ID Generator ---
  // Uses timestamp + random string to prevent collisions
  const generateId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  // --- API Handlers ---
  const handleAddApi = () => {
    const newApi: ApiConfig = {
      id: generateId('api'),
      name: 'New Payment Site',
      baseUrl: 'https://api.example.com',
      apiKey: '',
      adapterType: 'Standard',
      isActive: false,
      provider: 'other', // Default provider
      signType: 'MD5' // Default sign type
    };
    onSaveApiConfigs([...apiConfigs, newApi]);
  };

  const handleUpdateApi = (id: string, field: keyof ApiConfig, value: any) => {
    const updated = apiConfigs.map(api => {
      if (api.id === id) {
        return { ...api, [field]: value };
      }
      return api;
    });
    onSaveApiConfigs(updated);
  };

  const handleDeleteApi = (id: string, e: React.MouseEvent) => {
    // STOP event propagation immediately to prevent card expansion/clicks
    e.stopPropagation();
    e.preventDefault();
    // Safely call stopImmediatePropagation if available
    if (typeof e.stopImmediatePropagation === 'function') {
      e.stopImmediatePropagation();
    }
    
    console.log('[Delete] Attempting to delete API:', id);
    console.log('[Delete] Current configs:', apiConfigs);
    
    const item = apiConfigs.find(a => a.id === id);
    if (!item) {
        console.warn('[Delete] Item not found, attempting cleanup');
        const cleanList = apiConfigs.filter(a => a.id !== id);
        onSaveApiConfigs(cleanList);
        return;
    }

    // DIRECT Synchronous confirm - most reliable method
    const confirmed = window.confirm(`确定要删除支付接口: "${item.name}"?`);
    if (confirmed) {
      console.log('[Delete] User confirmed deletion');
      const nextConfigs = apiConfigs.filter(a => a.id !== id);
      console.log('[Delete] New configs after deletion:', nextConfigs);
      console.log('[Delete] Calling onSaveApiConfigs with', nextConfigs.length, 'items');
      onSaveApiConfigs(nextConfigs);
      console.log('[Delete] onSaveApiConfigs called successfully');
    } else {
      console.log('[Delete] User cancelled deletion');
    }
  };

  const toggleApiActive = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const target = apiConfigs.find(a => a.id === id);
    if (target) handleUpdateApi(id, 'isActive', !target.isActive);
  };

  // --- Wallet Handlers ---
  const handleAddWallet = () => {
    // Generate wallet ID if not provided
    // Format: wallet-{timestamp} for consistency with backend
    const walletId = `wallet-${Date.now()}`;
    
    const newWallet: WalletConfig = {
      id: walletId,
      address: '', // Empty address is allowed - user will fill it in
      network: 'TRC20',
      label: 'New Wallet',
      status: 'Active'
    };
    // Call onSaveWalletConfigs to add new wallet
    // Backend now allows empty address, so this should work
    onSaveWalletConfigs([...walletConfigs, newWallet]);
  };

  const handleUpdateWallet = (id: string, field: keyof WalletConfig, value: any) => {
    onSaveWalletConfigs(walletConfigs.map(w => w.id === id ? { ...w, [field]: value } : w));
  };

  const handleDeleteWallet = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    // Safely call stopImmediatePropagation if available
    if (typeof e.stopImmediatePropagation === 'function') {
      e.stopImmediatePropagation();
    }

    console.log('[Delete] Attempting to delete Wallet:', id);
    console.log('[Delete] Current wallets:', walletConfigs);

    const item = walletConfigs.find(w => w.id === id);
    if (!item) {
         console.warn('[Delete] Wallet not found, attempting cleanup');
         const cleanList = walletConfigs.filter(w => w.id !== id);
         onSaveWalletConfigs(cleanList);
         return;
    }

    const confirmed = window.confirm(`确定要删除监控地址: "${item.label}"?`);
    if (confirmed) {
      console.log('[Delete] User confirmed wallet deletion');
      const nextConfigs = walletConfigs.filter(w => w.id !== id);
      console.log('[Delete] New wallets after deletion:', nextConfigs);
      console.log('[Delete] Calling onSaveWalletConfigs with', nextConfigs.length, 'items');
      onSaveWalletConfigs(nextConfigs);
      console.log('[Delete] onSaveWalletConfigs called successfully');
    } else {
      console.log('[Delete] User cancelled wallet deletion');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 min-h-[600px] flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
        <div className="p-2 bg-slate-800 text-white rounded-lg">
          <Server className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800">后台接口管理</h2>
          <p className="text-sm text-slate-500">Manage external payment gateways and crypto nodes</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 px-6">
        <button
          onClick={() => setActiveTab('api')}
          className={`px-6 py-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'api' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Globe className="w-4 h-4" /> 支付接口 (Payment APIs)
        </button>
        <button
          onClick={() => setActiveTab('wallet')}
          className={`px-6 py-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'wallet' 
              ? 'border-purple-600 text-purple-600' 
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Wallet className="w-4 h-4" /> 钱包监控 (Wallet Watch)
        </button>
      </div>

      {/* Content Area */}
      <div className="p-6 bg-slate-50/30 flex-grow">
        
        {/* --- API TAB --- */}
        {activeTab === 'api' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div className="text-sm text-slate-500">
                Configure endpoints to fetch transactions automatically.
              </div>
              <button 
                type="button"
                onClick={handleAddApi}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm active:scale-95"
              >
                <Plus className="w-4 h-4" /> 添加新接口
              </button>
            </div>

            <div className="grid gap-4">
              {apiConfigs.map(api => (
                <div key={api.id} className={`bg-white rounded-lg border p-5 transition-all group ${api.isActive ? 'border-blue-300 ring-1 ring-blue-100 shadow-md' : 'border-slate-200 shadow-sm opacity-90 hover:opacity-100 hover:border-blue-200'}`}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className={`w-3 h-3 rounded-full flex-shrink-0 ${api.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                      <input 
                        type="text" 
                        value={api.name}
                        onChange={(e) => handleUpdateApi(api.id, 'name', e.target.value)}
                        className="font-bold text-slate-800 text-lg bg-transparent border-b border-transparent focus:border-slate-300 outline-none hover:border-slate-200 transition-colors min-w-[200px]"
                        placeholder="Site Name"
                      />
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200 font-mono">
                        {api.adapterType}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
                      <button 
                        type="button"
                        onClick={(e) => toggleApiActive(api.id, e)}
                        className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5 active:scale-95 ${api.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                      >
                        {api.isActive ? <CheckCircle2 className="w-3.5 h-3.5" /> : null}
                        {api.isActive ? '运行中 (Active)' : '已停用 (Inactive)'}
                      </button>
                      <div className="w-px h-6 bg-slate-200 mx-1"></div>
                      <button 
                        type="button"
                        onClick={(e) => {
                          console.log('[Button] Delete button clicked for API:', api.id);
                          handleDeleteApi(api.id, e);
                        }}
                        onMouseDown={(e) => {
                          // Prevent any default behavior
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100 active:bg-red-100 active:scale-95 relative z-10 cursor-pointer"
                        style={{ pointerEvents: 'auto' }}
                        title="删除此接口"
                        aria-label="Delete API"
                      >
                        <Trash2 className="w-4 h-4 pointer-events-none" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-400 uppercase flex items-center gap-1">
                        <Globe className="w-3 h-3" /> Provider Type
                      </label>
                      <select
                        value={api.provider || 'other'}
                        onChange={(e) => handleUpdateApi(api.id, 'provider', e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                      >
                        <option value="safeperim">Safeperim</option>
                        <option value="alphapay">AlphaPay</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-400 uppercase flex items-center gap-1">
                        <Globe className="w-3 h-3" /> API Endpoint URL
                      </label>
                      <input 
                        type="text" 
                        value={api.baseUrl}
                        onChange={(e) => handleUpdateApi(api.id, 'baseUrl', e.target.value)}
                        placeholder="https://api.payment-provider.com"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm text-slate-700 font-mono focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                      />
                    </div>
                  </div>

                  {/* Safeperim-specific fields */}
                  {api.provider === 'safeperim' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 p-4 bg-blue-50/50 border border-blue-100 rounded-lg">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-blue-600 uppercase flex items-center gap-1">
                          Merchant ID
                        </label>
                        <input 
                          type="text" 
                          value={api.merchantId || ''}
                          onChange={(e) => handleUpdateApi(api.id, 'merchantId', e.target.value)}
                          placeholder="YOUR_MERCHANT_ID"
                          className="w-full px-3 py-2 bg-white border border-blue-200 rounded text-sm text-slate-700 font-mono focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-blue-600 uppercase flex items-center gap-1">
                          Signature Type
                        </label>
                        <select
                          value={api.signType || 'MD5'}
                          onChange={(e) => handleUpdateApi(api.id, 'signType', e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-blue-200 rounded text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                        >
                          <option value="MD5">MD5</option>
                          <option value="RSA">RSA</option>
                          <option value="MD5+RSA">MD5+RSA</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Fee Configuration */}
                  <div className="mt-4 p-4 bg-amber-50/50 border border-amber-100 rounded-lg">
                    <label className="text-xs font-semibold text-amber-700 uppercase flex items-center gap-1 mb-2">
                          手续费百分比 (Fee Percentage)
                        </label>
                        <div className="flex items-center gap-2">
                          <input 
                            type="number" 
                            step="0.01"
                            min="0"
                            max="100"
                            value={api.feePercentage ? (api.feePercentage * 100).toFixed(2) : ''}
                            onChange={(e) => {
                              const percentValue = e.target.value ? parseFloat(e.target.value) : undefined;
                              // Convert percentage to decimal (e.g., 6 -> 0.06)
                              const decimalValue = percentValue !== undefined ? percentValue / 100 : undefined;
                              handleUpdateApi(api.id, 'feePercentage', decimalValue);
                            }}
                            placeholder="6"
                            className="w-full px-3 py-2 bg-white border border-amber-200 rounded text-sm text-slate-700 focus:ring-2 focus:ring-amber-500 outline-none transition-shadow"
                          />
                          <span className="text-sm text-amber-600 whitespace-nowrap">%</span>
                        </div>
                      </div>

                  {/* API Key field (for non-Safeperim providers) */}
                  {api.provider !== 'safeperim' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-400 uppercase flex items-center gap-1">
                          <Key className="w-3 h-3" /> API Secret / Key
                        </label>
                        <div className="relative">
                          <input 
                            type="password" 
                            value={api.apiKey || ''}
                            onChange={(e) => handleUpdateApi(api.id, 'apiKey', e.target.value)}
                            placeholder="sk_example_..."
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm text-slate-700 font-mono focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {api.lastSync && (
                    <div className="mt-3 flex items-center gap-1 text-xs text-slate-400">
                      <RefreshCw className="w-3 h-3" /> Last Synced: {api.lastSync}
                    </div>
                  )}
                </div>
              ))}

              {apiConfigs.length === 0 && (
                <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-lg bg-slate-50/50">
                  <div className="inline-flex p-4 rounded-full bg-slate-100 mb-4">
                     <AlertCircle className="w-8 h-8 text-slate-300" />
                  </div>
                  <h3 className="text-slate-600 font-medium">没有配置接口</h3>
                  <p className="text-slate-400 text-sm mt-1">点击右上角添加新的支付网站接口</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- WALLET TAB --- */}
        {activeTab === 'wallet' && (
          <div className="space-y-6">
             <div className="flex justify-between items-center">
              <div className="text-sm text-slate-500">
                System will listen to transactions on these addresses.
              </div>
              <button 
                type="button"
                onClick={handleAddWallet}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md text-sm font-medium hover:bg-purple-700 transition-colors shadow-sm active:scale-95"
              >
                <Plus className="w-4 h-4" /> 添加监控地址
              </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Network</th>
                    <th className="px-4 py-3">Label</th>
                    <th className="px-4 py-3 w-1/2">Address</th>
                    <th className="px-4 py-3">手续费 (USDT)</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {walletConfigs.map(wallet => (
                    <tr key={wallet.id} className="hover:bg-slate-50 group">
                      <td className="px-4 py-3">
                        <select 
                          value={wallet.network}
                          onChange={(e) => handleUpdateWallet(wallet.id, 'network', e.target.value)}
                          className="bg-slate-100 border-none rounded px-2 py-1 text-xs font-bold text-slate-600 focus:ring-1 focus:ring-purple-500 cursor-pointer"
                        >
                          <option>TRC20</option>
                          <option>ERC20</option>
                          <option>BTC</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input 
                          type="text" 
                          value={wallet.label}
                          onChange={(e) => handleUpdateWallet(wallet.id, 'label', e.target.value)}
                          className="w-full bg-transparent border-b border-transparent focus:border-purple-300 outline-none px-1"
                        />
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-600">
                        <input 
                          type="text" 
                          value={wallet.address}
                          onChange={(e) => handleUpdateWallet(wallet.id, 'address', e.target.value)}
                          placeholder="Enter wallet address..."
                          className="w-full bg-transparent border border-transparent hover:border-slate-200 focus:border-purple-300 focus:bg-white rounded px-2 py-1 outline-none transition-all"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <input 
                            type="number" 
                            step="0.01"
                            min="0"
                            value={wallet.feeAmount || ''}
                            onChange={(e) => handleUpdateWallet(wallet.id, 'feeAmount', e.target.value ? parseFloat(e.target.value) : undefined)}
                            placeholder="0.00"
                            className="w-20 px-2 py-1 bg-amber-50 border border-amber-200 rounded text-xs text-slate-700 focus:ring-1 focus:ring-amber-500 outline-none transition-shadow"
                          />
                          <span className="text-xs text-amber-600">USDT</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button 
                          type="button"
                          onClick={() => handleUpdateWallet(wallet.id, 'status', wallet.status === 'Active' ? 'Inactive' : 'Active')}
                          className={`text-xs px-2 py-1 rounded-full font-medium transition-colors active:scale-95 ${wallet.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                        >
                          {wallet.status}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                         <button 
                          type="button"
                          onClick={(e) => {
                            console.log('[Button] Delete button clicked for Wallet:', wallet.id);
                            handleDeleteWallet(wallet.id, e);
                          }}
                          onMouseDown={(e) => {
                            // Prevent any default behavior
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100 active:bg-red-100 active:scale-95 relative z-10 cursor-pointer"
                          style={{ pointerEvents: 'auto' }}
                          title="删除钱包"
                          aria-label="Delete Wallet"
                        >
                          <Trash2 className="w-4 h-4 pointer-events-none" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {walletConfigs.length === 0 && (
                     <tr>
                       <td colSpan={6} className="px-4 py-8 text-center text-slate-400 italic">
                         No wallets monitored.
                       </td>
                     </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
      
      {/* Footer Info */}
      <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 text-xs text-slate-400 flex justify-between">
        <span>Unified Adapter System v2.1</span>
        <span>Secure Configuration</span>
      </div>
    </div>
  );
};