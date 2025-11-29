import React, { useState } from 'react';
import { Transaction, SourceType, SplitStatus, UpdateTransactionHandler, SplitDetail, UserSplit } from '../types';
import { ChevronDown, ChevronUp, Search, Filter, CheckCircle2, Edit3, Check, X, Plus, Trash2, Calendar, AlertCircle } from 'lucide-react';
import { TransactionDetailPanel } from './TransactionDetailPanel';

interface TransactionTableProps {
  transactions: Transaction[];
  exchangeRate: number;
  users: UserSplit[];
  apiConfigs?: Array<{ id: string; name: string }>; // API configs for dynamic source types
  onUpdateTransaction?: UpdateTransactionHandler;
  onRefreshTransactions?: () => Promise<void>; // Callback to refresh transaction list
}

export const TransactionTable: React.FC<TransactionTableProps> = ({ transactions, exchangeRate, users, apiConfigs = [], onUpdateTransaction, onRefreshTransactions }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailPanelId, setDetailPanelId] = useState<string | null>(null);
  
  // State for the list of splits currently being edited
  const [editingSplits, setEditingSplits] = useState<SplitDetail[]>([]);
  
  const [filterSource, setFilterSource] = useState<SourceType | 'All'>('All');
  const [filterStatus, setFilterStatus] = useState<SplitStatus | 'All'>('All');
  const [filterStartDateTime, setFilterStartDateTime] = useState<string>(''); // Format: YYYY-MM-DDTHH:mm
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const toggleExpand = (id: string) => {
    if (editingId && editingId !== id) {
       if(!confirm("You have unsaved changes. Discard?")) return;
       setEditingId(null);
    }
    setExpandedId(expandedId === id ? null : id);
    if (expandedId === id) setEditingId(null);
  };

  const startEditing = (t: Transaction, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(t.id);
    // Deep copy current splits to edit state, ensuring all fields are present
    setEditingSplits(t.splits.map(s => ({
      userId: s.userId,
      userName: s.userName || users.find(u => u.id === s.userId)?.name || s.userId,
      ratio: s.ratio,
      amount: s.amount || Math.round((t.cnyAmount || 0) * s.ratio * 100) / 100
    })));
  };

  const cancelEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
    setEditingSplits([]);
  };

  const saveEditing = (t: Transaction, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onUpdateTransaction) return;

    // Validate total roughly 1
    const total = editingSplits.reduce((acc, s) => acc + (s.ratio || 0), 0);
    if (Math.abs(total - 1) > 0.01 && Math.abs(total - 0) > 0.01) { 
       if (!confirm(`当前总分账比例为 ${(total * 100).toFixed(2)}%。确定保存吗？`)) return;
    }

    // Recalculate amounts based on current ratio and transaction CNY amount
    // This ensures amount field is always in sync with ratio
    const cnyAmount = t.cnyAmount || 0;
    const normalizedSplits = editingSplits.map(s => ({
      ...s,
      amount: Math.round(cnyAmount * s.ratio * 100) / 100, // Round to 2 decimal places
      userName: s.userName || users.find(u => u.id === s.userId)?.name || s.userId // Ensure userName is present
    }));

    onUpdateTransaction(t.id, normalizedSplits);
    setEditingId(null);
  };

  // --- Edit Mode Handlers ---
  const handleSplitUserChange = (index: number, newUserId: string) => {
    const user = users.find(u => u.id === newUserId);
    if (user) {
        const newSplits = [...editingSplits];
        newSplits[index] = { ...newSplits[index], userId: user.id, userName: user.name };
        setEditingSplits(newSplits);
    }
  };

  const handleSplitRatioChange = (index: number, newRatio: number) => {
    const newSplits = [...editingSplits];
    const transaction = transactions.find(t => t.id === editingId);
    const cnyAmount = transaction?.cnyAmount || 0;
    // Update ratio and recalculate amount
    newSplits[index] = { 
      ...newSplits[index], 
      ratio: newRatio,
      amount: Math.round(cnyAmount * newRatio * 100) / 100 // Round to 2 decimal places
    };
    setEditingSplits(newSplits);
  };

  const handleAddSplitRow = () => {
    // Default to the first available user not already in the list, or just the first user
    const defaultUser = users[0];
    if (defaultUser) {
        setEditingSplits([
            ...editingSplits, 
            { userId: defaultUser.id, userName: defaultUser.name, ratio: 0, amount: 0 }
        ]);
    }
  };

  const handleRemoveSplitRow = (index: number) => {
      const newSplits = [...editingSplits];
      newSplits.splice(index, 1);
      setEditingSplits(newSplits);
  };

  // --- Filtering ---
  // Use cleared field for settlement filter: cleared === true means settled
  // Backward compatibility: if cleared is undefined, treat as unsettled
  const filteredData = transactions
    .filter(t => {
      if (filterSource !== 'All' && t.source !== filterSource) return false;
      if (filterStatus !== 'All' && t.status !== filterStatus) return false;
      
      // Time filter: only show transactions from filterStartDateTime onwards
      if (filterStartDateTime) {
        // Convert filterStartDateTime to comparable format: "YYYY-MM-DD HH:mm"
        const filterDateTime = filterStartDateTime.replace('T', ' ');
        // Transaction timestamp format: "YYYY-MM-DD HH:mm" or "YYYY-MM-DD HH:mm:ss"
        // Compare up to minute precision (truncate seconds if present)
        const txDateTime = t.timestamp.substring(0, 16); // Get "YYYY-MM-DD HH:mm"
        if (txDateTime < filterDateTime) {
          return false; // Transaction is before filter datetime, exclude it
        }
      }
      
      return true;
    })
    .sort((a, b) => {
      // Sort by timestamp in descending order (newest first)
      // timestamp format: "YYYY-MM-DD HH:mm:ss"
      // String comparison works because of ISO format
      return b.timestamp.localeCompare(a.timestamp);
    });

  // Calculate transactions that would be cleared (outside filter range)
  const transactionsToClear = filterStartDateTime 
    ? transactions.filter(t => {
        const filterDateTime = filterStartDateTime.replace('T', ' ');
        // Transaction timestamp format: "YYYY-MM-DD HH:mm" or "YYYY-MM-DD HH:mm:ss"
        // Compare up to minute precision (truncate seconds if present)
        const txDateTime = t.timestamp.substring(0, 16); // Get "YYYY-MM-DD HH:mm"
        return txDateTime < filterDateTime;
      })
    : [];

  const handleClearOldTransactions = async () => {
    if (transactionsToClear.length === 0) {
      alert('没有需要清除的交易');
      return;
    }

    const filterDisplay = filterStartDateTime.replace('T', ' ');
    const confirmed = confirm(
      `确定要清除 ${transactionsToClear.length} 条 ${filterDisplay} 之前的交易吗？\n\n此操作不可撤销！`
    );

    if (!confirmed) return;

    try {
      // Delete transactions in batch via backend
      const idsToDelete = transactionsToClear.map(tx => tx.id);
      
      console.log(`[ClearOldTransactions] Attempting to delete ${idsToDelete.length} transactions`);
      console.log(`[ClearOldTransactions] Transaction IDs (first 5):`, idsToDelete.slice(0, 5));
      
      const requestBody = { ids: idsToDelete };
      console.log(`[ClearOldTransactions] Request body:`, JSON.stringify(requestBody).substring(0, 200));
      
      // Try DELETE first, fallback to POST if DELETE fails (some browsers/proxies don't support DELETE with body)
      let response: Response;
      try {
        response = await fetch('/api/transactions/batch', {
          method: 'DELETE',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });
        
        // If DELETE returns 405 (Method Not Allowed) or 400 with body parsing error, try POST
        if (response.status === 405 || (response.status === 400 && !response.ok)) {
          console.log('[ClearOldTransactions] DELETE failed, trying POST alternative endpoint');
          response = await fetch('/api/transactions/batch/delete', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify(requestBody)
          });
        }
      } catch (fetchError) {
        // If DELETE fails completely, try POST
        console.log('[ClearOldTransactions] DELETE request failed, trying POST alternative endpoint', fetchError);
        response = await fetch('/api/transactions/batch/delete', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });
      }

      console.log(`[ClearOldTransactions] Response status: ${response.status} ${response.statusText}`);
      
      // Try to parse response body
      let responseText = '';
      try {
        responseText = await response.text();
        console.log(`[ClearOldTransactions] Response body:`, responseText.substring(0, 500));
      } catch (e) {
        console.error(`[ClearOldTransactions] Failed to read response body:`, e);
      }

      if (!response.ok) {
        let errorData;
        try {
          errorData = JSON.parse(responseText);
        } catch (e) {
          errorData = { error: responseText || `HTTP ${response.status}` };
        }
        console.error(`[ClearOldTransactions] HTTP error: ${response.status}`, errorData);
        throw new Error(errorData.error || errorData.message || `HTTP error! status: ${response.status}`);
      }

      const result = JSON.parse(responseText);
      console.log(`[ClearOldTransactions] Successfully deleted ${result.deletedCount} transactions`);
      
      // Refresh transaction list
      if (onRefreshTransactions) {
        await onRefreshTransactions();
      }
      
      alert(`✅ 已清除 ${result.deletedCount || transactionsToClear.length} 条旧交易`);
      setShowClearConfirm(false);
      setFilterStartDateTime(''); // Clear filter after deletion
    } catch (error) {
      console.error('[ClearOldTransactions] Failed to clear old transactions:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      alert(`❌ 清除交易失败：${errorMessage}\n\n请检查：\n1. 后端服务是否正常运行 (http://localhost:3001)\n2. 网络连接是否正常\n3. 查看浏览器控制台获取详细错误信息`);
    }
  };

  // Get all unique source types from API configs and common sources
  // Only use API config names for payment APIs to avoid duplicates
  // Common sources (USDT Wallet, Manual) are always included
  const getAllSourceTypes = (): SourceType[] => {
    const allSources = new Set<SourceType>();
    
    // Add payment API names from configs (this is the source of truth)
    apiConfigs.forEach(config => {
      if (config.isActive) {
        allSources.add(config.name);
      }
    });
    
    // Always include common sources
    allSources.add('USDT Wallet');
    allSources.add('Manual');
    
    return Array.from(allSources).sort();
  };

  const getSourceBadge = (source: SourceType) => {
    // Common sources with specific styling
    if (source === 'USDT Wallet') {
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">USDT Wallet</span>;
    }
    if (source === 'Manual') {
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">Manual</span>;
    }
    // Dynamic payment API sources - use blue color scheme
    return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">{source}</span>;
  };

  const getDisplayedCNY = (t: Transaction) => {
    return t.currency === 'USDT' ? t.originalAmount * exchangeRate : t.originalAmount;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col transition-all duration-200 h-full" style={{ minHeight: '400px' }}>
      {/* Header & Filter Bar */}
      <div className="p-4 border-b border-slate-100 flex flex-col gap-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            交易流水
            <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{filteredData.length} records</span>
          </h2>
          
          <div className="flex items-center gap-2 text-sm">
            <div className="relative">
              <Filter className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" />
              <select 
                className="pl-9 pr-8 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-600 bg-white appearance-none cursor-pointer hover:border-slate-400 transition-colors"
                value={filterSource}
                onChange={(e) => setFilterSource(e.target.value as any)}
              >
                <option value="All">所有来源</option>
                {getAllSourceTypes().map(source => (
                  <option key={source} value={source}>{source}</option>
                ))}
              </select>
            </div>

            <div className="relative">
              <CheckCircle2 className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" />
              <select 
                className="pl-9 pr-8 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-600 bg-white appearance-none cursor-pointer hover:border-slate-400 transition-colors"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
              >
                <option value="All">所有状态</option>
                <option value="Completed">已完成</option>
                <option value="Pending">待处理</option>
              </select>
            </div>
          </div>
        </div>

        {/* Time Filter Row */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <label className="text-xs font-medium text-slate-600 whitespace-nowrap">筛选起始时间：</label>
            <input
              type="datetime-local"
              value={filterStartDateTime}
              onChange={(e) => setFilterStartDateTime(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 bg-white text-sm"
            />
            {filterStartDateTime && (
              <button
                onClick={() => setFilterStartDateTime('')}
                className="px-2 py-1 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
                title="清除时间筛选"
              >
                清除
              </button>
            )}
          </div>
          
          {filterStartDateTime && transactionsToClear.length > 0 && (
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs text-amber-600 font-medium">
                将清除 {transactionsToClear.length} 条 {filterStartDateTime.replace('T', ' ')} 之前的交易
              </span>
              <button
                onClick={handleClearOldTransactions}
                className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded transition-colors flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                清除旧数据
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Table Content - Scrollable */}
      <div className="overflow-y-auto overflow-x-auto flex-1 relative" style={{ minHeight: 0 }}>
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 text-slate-500 font-medium sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 bg-slate-50">时间</th>
              <th className="px-4 py-3 bg-slate-50">来源</th>
              <th className="px-4 py-3 text-right bg-slate-50">原始金额</th>
              <th className="px-4 py-3 text-right bg-slate-50">手续费</th>
              <th className="px-4 py-3 text-right bg-slate-50">净额 (CNY)</th>
              <th className="px-4 py-3 text-center bg-slate-50">状态</th>
              <th className="px-4 py-3 bg-slate-50"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredData.map((t) => {
               const displayCny = getDisplayedCNY(t);
               const isEditing = editingId === t.id;
               // Use editing splits if editing, otherwise committed splits
               const splitsToRender = isEditing ? editingSplits : t.splits;
               const totalRatio = splitsToRender.reduce((acc, s) => acc + (s.ratio || 0), 0);
               const totalPercent = totalRatio * 100;

               // Generate unique key: use tx.id if available, otherwise create a composite key
               const rowKey = t.id || `${t.source || 'unknown'}-${t.externalTxId || 'noExt'}-${t.timestamp || Date.now()}`;
               
               return (
              <React.Fragment key={rowKey}>
                <tr 
                  className={`hover:bg-slate-50 transition-colors cursor-pointer ${expandedId === t.id ? 'bg-slate-50' : ''}`}
                  onClick={() => toggleExpand(t.id)}
                >
                  <td className="px-4 py-3 font-mono text-slate-600">{t.timestamp}</td>
                  <td className="px-4 py-3">{getSourceBadge(t.source)}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-700">
                    {t.originalAmount.toLocaleString()} <span className="text-xs text-slate-400">{t.currency}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-500">
                    {t.feeAmount && t.feeAmount > 0 ? (
                      <span className="text-red-600">
                        -{t.feeAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {t.currency}
                        <br />
                        <span className="text-xs">(¥ {t.feeAmountCNY?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'})</span>
                      </span>
                    ) : (
                      <span className="text-slate-300">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-slate-800">
                    {t.netAmountCNY !== undefined ? (
                      <>
                        ¥ {t.netAmountCNY.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        <br />
                        <span className="text-xs font-normal text-slate-400 line-through">
                          ¥ {displayCny.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </>
                    ) : (
                      <>¥ {displayCny.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {t.status === 'Completed' ? (
                      <span className="text-emerald-600 font-medium text-xs">完成</span>
                    ) : (
                      <span className="text-amber-600 font-medium text-xs">处理中</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-400">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDetailPanelId(t.id);
                        }}
                        className="text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                        title="查看详情"
                      >
                        详情
                      </button>
                      {expandedId === t.id ? <ChevronUp className="w-4 h-4 inline" /> : <ChevronDown className="w-4 h-4 inline" />}
                    </div>
                  </td>
                </tr>
                
                {/* Expandable Detail Row */}
                {expandedId === t.id && (
                  <tr className="bg-slate-50/80">
                    <td colSpan={7} className="px-4 py-3 border-b border-slate-100 shadow-inner">
                      <div className="pl-4 border-l-2 border-blue-400 relative">
                        
                        {/* Detail Header */}
                        <div className="flex items-center justify-between mb-3">
                           <div className="flex items-center gap-3">
                             <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                               {isEditing ? "编辑分账明细 (Editing)" : "分账明细详情"}
                             </h4>
                           </div>
                           
                           {!isEditing ? (
                             <button 
                               onClick={(e) => startEditing(t, e)}
                               className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                             >
                               <Edit3 className="w-3 h-3" /> 编辑 / 添加用户
                             </button>
                           ) : (
                             <div className="flex items-center gap-2">
                               <button 
                                 onClick={(e) => saveEditing(t, e)}
                                 className="text-xs flex items-center gap-1 text-white bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded transition-colors shadow-sm"
                               >
                                 <Check className="w-3 h-3" /> 保存本笔分账
                               </button>
                               <button 
                                 onClick={(e) => cancelEditing(e)}
                                 className="text-xs flex items-center gap-1 text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 px-3 py-1 rounded transition-colors"
                               >
                                 <X className="w-3 h-3" /> 取消
                               </button>
                             </div>
                           )}
                        </div>

                        {/* Detail Table/Grid */}
                        {isEditing ? (
                           // --- Editing View: List ---
                           <div className="bg-white rounded border border-blue-200 overflow-hidden shadow-sm">
                             <table className="w-full text-xs text-left">
                               <thead className="bg-blue-50 text-blue-800 font-semibold border-b border-blue-100">
                                 <tr>
                                   <th className="px-3 py-2">用户</th>
                                   <th className="px-3 py-2 text-right">比例 (%)</th>
                                   <th className="px-3 py-2 text-right">金额 (CNY)</th>
                                   <th className="px-3 py-2 text-center">操作</th>
                                 </tr>
                               </thead>
                               <tbody className="divide-y divide-blue-50">
                                 {editingSplits.map((split, idx) => (
                                   <tr key={idx} className="hover:bg-blue-50/30">
                                     <td className="px-3 py-2">
                                       <select 
                                          className="w-full p-1 border border-blue-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                                          value={split.userId}
                                          onChange={(e) => handleSplitUserChange(idx, e.target.value)}
                                       >
                                         {users.map(u => (
                                           <option key={u.id} value={u.id}>{u.name}</option>
                                         ))}
                                       </select>
                                     </td>
                                     <td className="px-3 py-2 text-right">
                                       <input 
                                         type="number" step="0.1" min="0" max="100"
                                         className="w-20 text-right p-1 border border-blue-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                         // Display as percentage
                                         value={+(split.ratio * 100).toFixed(2)}
                                         // Save as decimal
                                         onChange={(e) => handleSplitRatioChange(idx, parseFloat(e.target.value) / 100)}
                                       />
                                     </td>
                                     <td className="px-3 py-2 text-right font-mono text-slate-500">
                                       {(displayCny * (split.ratio || 0)).toFixed(2)}
                                     </td>
                                     <td className="px-3 py-2 text-center">
                                       <button 
                                         onClick={() => handleRemoveSplitRow(idx)}
                                         className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50"
                                       >
                                         <Trash2 className="w-3.5 h-3.5" />
                                       </button>
                                     </td>
                                   </tr>
                                 ))}
                                 {editingSplits.length === 0 && (
                                   <tr>
                                     <td colSpan={4} className="text-center py-4 text-slate-400 italic">No participants yet</td>
                                   </tr>
                                 )}
                               </tbody>
                             </table>
                             <div className="p-2 border-t border-blue-100 flex justify-between items-center bg-slate-50">
                               <button 
                                 onClick={handleAddSplitRow}
                                 className="text-blue-600 text-xs font-medium flex items-center gap-1 hover:underline"
                               >
                                 <Plus className="w-3 h-3" /> 新增分账用户
                               </button>
                               <div className="text-xs">
                                 Current Total: <span className={`font-mono font-bold ${Math.abs(totalPercent - 100) < 0.1 ? 'text-emerald-600' : 'text-amber-500'}`}>{totalPercent.toFixed(2)}%</span>
                               </div>
                             </div>
                           </div>
                        ) : (
                           // --- Read Only View ---
                           <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            {t.splits.map((split, idx) => {
                              const splitAmt = displayCny * split.ratio;
                              return (
                              <div key={idx} className="bg-white p-2 rounded border border-slate-200 flex justify-between items-center shadow-sm">
                                <div>
                                  <div className="text-sm font-medium text-slate-800">{split.userName}</div>
                                  <div className="text-xs text-slate-400">{(split.ratio * 100).toFixed(2)}%</div>
                                </div>
                                <div className="text-right">
                                  <div className="text-sm font-bold text-indigo-600">
                                    ¥ {splitAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </div>
                                </div>
                              </div>
                            )})}
                          </div>
                        )}
                        
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            )})}
          </tbody>
        </table>
      </div>
      
      {filteredData.length === 0 && (
        <div className="p-8 text-center text-slate-400">
          <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>没有找到符合条件的记录</p>
        </div>
      )}

      {/* Transaction Detail Panel Modal */}
      {detailPanelId && (() => {
        const tx = transactions.find(t => t.id === detailPanelId);
        if (!tx) return null;
        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setDetailPanelId(null)}>
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <TransactionDetailPanel
                transaction={tx}
                users={users}
                exchangeRate={exchangeRate}
                onClose={() => {
                  setDetailPanelId(null);
                }}
                onUpdate={async () => {
                  // Reload transaction data from backend
                  if (onRefreshTransactions) {
                    await onRefreshTransactions();
                  } else {
                    // Fallback: reload page if no callback provided
                    window.location.reload();
                  }
                  setDetailPanelId(null);
                }}
              />
            </div>
          </div>
        );
      })()}
    </div>
  );
};