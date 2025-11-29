/**
 * Global Share Adjustment Logs Page
 * 
 * Displays all share adjustment logs across all transactions in a centralized view.
 * Allows filtering and searching for easy auditing and verification.
 */

import React, { useState, useEffect } from 'react';
import { Clock, Search, Filter, FileText, User, Calendar, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { Transaction } from '../types';

interface ShareLog {
  id: string;
  transactionId: string;
  time: number;
  operator: string;
  oldShares: Array<{ userId: string; userName: string; ratio: number; amount: number }>;
  newShares: Array<{ userId: string; userName: string; ratio: number; amount: number }>;
  remark?: string;
  transaction?: {
    id: string;
    timestamp: string;
    source: string;
    currency: string;
    originalAmount: number;
    cnyAmount: number;
    externalTxId?: string;
  } | null;
}

interface ShareLogsPageProps {
  transactions: Transaction[]; // For reference, but we'll load logs from API
  users?: Array<{ id: string; name: string }>; // Optional users list for fallback name lookup
}

export const ShareLogsPage: React.FC<ShareLogsPageProps> = ({ transactions, users = [] }) => {
  // Create a user name lookup map for fallback
  const userNameMap = new Map(users.map(u => [u.id, u.name]));
  
  // Helper function to get user name with fallback
  const getUserName = (shareItem: { userId: string; userName?: string }): string => {
    // Priority 1: Use userName from log entry (preserves historical names)
    if (shareItem.userName) {
      return shareItem.userName;
    }
    // Priority 2: Look up from current users list
    const name = userNameMap.get(shareItem.userId);
    if (name) {
      return name;
    }
    // Priority 3: Fallback to userId itself (better than "Unknown")
    return shareItem.userId;
  };
  const [logs, setLogs] = useState<ShareLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [filterTransactionId, setFilterTransactionId] = useState('');
  const [filterOperator, setFilterOperator] = useState('');
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    loadLogs();
    
    // Listen for refresh events from other components
    const handleRefresh = () => {
      console.log('[ShareLogsPage] Received refresh event, reloading logs...');
      loadLogs();
    };
    
    window.addEventListener('shareLogsRefresh', handleRefresh);
    
    return () => {
      window.removeEventListener('shareLogsRefresh', handleRefresh);
    };
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/share-logs/all?limit=500');
      if (!response.ok) {
        throw new Error(`Failed to load logs: ${response.status}`);
      }
      const data = await response.json();
      setLogs(data.logs || []);
      console.log(`[ShareLogsPage] Loaded ${data.logs?.length || 0} logs`);
    } catch (err) {
      console.error('Error loading share logs:', err);
      setError(err instanceof Error ? err.message : '加载日志失败');
    } finally {
      setLoading(false);
    }
  };


  const toggleExpand = (logId: string) => {
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId);
    } else {
      newExpanded.add(logId);
    }
    setExpandedLogs(newExpanded);
  };

  // Filter logs
  const filteredLogs = logs.filter(log => {
    if (filterTransactionId && log.transactionId !== filterTransactionId) return false;
    if (filterOperator && log.operator !== filterOperator) return false;
    if (searchText) {
      const searchLower = searchText.toLowerCase();
      const matchesRemark = log.remark?.toLowerCase().includes(searchLower);
      const matchesTxId = log.transactionId.toLowerCase().includes(searchLower);
      const matchesOperator = log.operator.toLowerCase().includes(searchLower);
      const matchesUserName = log.newShares.some(s => s.userName.toLowerCase().includes(searchLower));
      if (!matchesRemark && !matchesTxId && !matchesOperator && !matchesUserName) return false;
    }
    return true;
  });

  // Get unique operators for filter
  const operators = Array.from(new Set(logs.map(log => log.operator))).sort();
  
  // Get unique transaction IDs for filter
  const transactionIds = Array.from(new Set(logs.map(log => log.transactionId))).sort();

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-slate-600">正在加载分账调整日志...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 bg-red-50 border-2 border-red-200 rounded-lg">
        <div className="flex items-center gap-3 text-red-700 mb-4">
          <AlertCircle className="w-6 h-6" />
          <span className="font-semibold">加载失败</span>
        </div>
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={loadLogs}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded transition-colors"
        >
          重试
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
              <Clock className="w-7 h-7 text-blue-600" />
              分账调整日志
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              查看所有交易的分账调整历史记录，方便核对和审计
            </p>
          </div>
          <button
            onClick={loadLogs}
            className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors flex items-center gap-2"
          >
            <Clock className="w-4 h-4" />
            刷新
          </button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">搜索</label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="搜索备注、交易ID、操作人等..."
                className="w-full pl-8 pr-3 py-2 text-sm border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">交易ID</label>
            <select
              value={filterTransactionId}
              onChange={(e) => setFilterTransactionId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">全部交易</option>
              {transactionIds.map(id => (
                <option key={id} value={id}>{id}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">操作人</label>
            <select
              value={filterOperator}
              onChange={(e) => setFilterOperator(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">全部操作人</option>
              {operators.map(op => (
                <option key={op} value={op}>{op}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setFilterTransactionId('');
                setFilterOperator('');
                setSearchText('');
              }}
              className="w-full text-sm text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 px-4 py-2 rounded transition-colors"
            >
              清除筛选
            </button>
          </div>
        </div>

        {/* Stats and Actions */}
        <div className="mt-4 pt-4 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm text-slate-600">
              <span>总计: <span className="font-semibold text-slate-800">{logs.length}</span> 条记录</span>
              <span>筛选后: <span className="font-semibold text-blue-600">{filteredLogs.length}</span> 条</span>
            </div>
          </div>
        </div>
      </div>

      {/* Logs List */}
      {filteredLogs.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
          <FileText className="w-16 h-16 mx-auto mb-4 text-slate-300" />
          <p className="text-slate-500 font-medium">暂无日志记录</p>
          <p className="text-sm text-slate-400 mt-2">
            {logs.length === 0 
              ? '还没有任何分账调整记录' 
              : '没有符合条件的日志记录，请调整筛选条件'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLogs.map((log) => {
            const isExpanded = expandedLogs.has(log.id);
            const hasChanges = JSON.stringify(log.oldShares) !== JSON.stringify(log.newShares);
            const dateStr = new Date(log.time).toLocaleString('zh-CN', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            });

            return (
              <div
                key={log.id}
                className={`bg-white rounded-lg shadow-sm border-2 transition-all ${
                  hasChanges ? 'border-blue-200 hover:border-blue-300' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Log Header */}
                <div
                  className="p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => toggleExpand(log.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <div className={`w-2 h-2 rounded-full ${hasChanges ? 'bg-blue-500' : 'bg-slate-400'}`}></div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="font-semibold text-slate-800">{dateStr}</span>
                          {hasChanges && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                              分账调整
                            </span>
                          )}
                          {!hasChanges && (
                            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                              备注日志
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-slate-600">
                          <span className="flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            交易: <span className="font-mono">{log.transactionId}</span>
                          </span>
                          {log.transaction && (
                            <>
                              <span className="flex items-center gap-1">
                                <span>{log.transaction.source}</span>
                              </span>
                              <span>
                                {log.transaction.originalAmount} {log.transaction.currency}
                                {log.transaction.currency === 'USDT' && ` (¥${log.transaction.cnyAmount.toLocaleString()})`}
                              </span>
                            </>
                          )}
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            操作人: {log.operator}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {log.remark && (
                        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
                          有备注
                        </span>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-slate-200 pt-4 space-y-4">
                    {/* Transaction Info */}
                    {log.transaction && (
                      <div className="bg-slate-50 rounded p-3 text-sm">
                        <div className="font-semibold text-slate-700 mb-2">交易信息</div>
                        <div className="flex flex-col md:flex-row justify-between gap-4 md:gap-6">
                          {/* Left Column: Time and Order ID */}
                          <div className="flex flex-col gap-1 min-w-0 flex-1">
                            <div className="flex items-start text-xs">
                              <span className="text-slate-500 whitespace-nowrap mr-1">时间:</span>
                              <span className="text-slate-700">{log.transaction.timestamp}</span>
                            </div>
                            {log.transaction.externalTxId && (
                              <div className="flex items-start text-xs">
                                <span className="text-slate-500 whitespace-nowrap mr-1">订单号:</span>
                                <span className="text-slate-700 font-mono break-all">{log.transaction.externalTxId}</span>
                              </div>
                            )}
                          </div>
                          {/* Right Column: Source and Amount */}
                          <div className="flex flex-col gap-1 min-w-0 flex-1">
                            <div className="flex items-start text-xs">
                              <span className="text-slate-500 whitespace-nowrap mr-1">来源:</span>
                              <span className="text-slate-700">{log.transaction.source}</span>
                            </div>
                            <div className="flex items-start text-xs">
                              <span className="text-slate-500 whitespace-nowrap mr-1">金额:</span>
                              <span className="text-slate-700 font-semibold">
                                {log.transaction.originalAmount} {log.transaction.currency}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Share Changes */}
                    {hasChanges && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-red-50 border border-red-200 rounded p-3">
                          <div className="font-semibold text-red-700 mb-2 text-sm">调整前</div>
                          <div className="space-y-1">
                            {log.oldShares.map((s, idx) => (
                              <div key={idx} className="flex justify-between text-xs">
                                <span className="text-slate-700">{getUserName(s)}</span>
                                <span className="font-mono text-slate-600">
                                  {(s.ratio * 100).toFixed(2)}% (¥{s.amount.toFixed(2)})
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="bg-green-50 border border-green-200 rounded p-3">
                          <div className="font-semibold text-green-700 mb-2 text-sm">调整后</div>
                          <div className="space-y-1">
                            {log.newShares.map((s, idx) => (
                              <div key={idx} className="flex justify-between text-xs">
                                <span className="text-slate-700">{getUserName(s)}</span>
                                <span className="font-mono font-semibold text-slate-800">
                                  {(s.ratio * 100).toFixed(2)}% (¥{s.amount.toFixed(2)})
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Remark */}
                    {log.remark && (
                      <div className="bg-blue-50 border border-blue-200 rounded p-3">
                        <div className="font-semibold text-blue-700 mb-1 text-sm">备注</div>
                        <p className="text-sm text-slate-700">{log.remark}</p>
                      </div>
                    )}

                    {!hasChanges && !log.remark && (
                      <div className="text-sm text-slate-400 italic text-center py-2">
                        这是一条纯备注日志，没有分账比例变化
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

