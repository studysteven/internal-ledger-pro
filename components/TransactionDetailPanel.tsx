/**
 * Transaction Detail Panel Component
 * 
 * Displays detailed information about a transaction including:
 * - Basic information (order ID, source, time, amount)
 * - Current share configuration (editable ratios)
 * - Share adjustment logs
 */

import React, { useState, useEffect } from 'react';
import { Transaction, UserSplit } from '../types';
import { Edit3, Save, X, FileText, AlertCircle } from 'lucide-react';

interface TransactionShare {
  transactionId: string;
  users: Array<{
    userId: string;
    userName: string;
    ratio: number;
    amountCny: number;
  }>;
  fromDefault: boolean;
}


interface TransactionDetailPanelProps {
  transaction: Transaction;
  users: UserSplit[];
  exchangeRate: number;
  onClose: () => void;
  onUpdate?: () => void; // Callback to refresh parent component
}

export const TransactionDetailPanel: React.FC<TransactionDetailPanelProps> = ({
  transaction,
  users,
  exchangeRate,
  onClose,
  onUpdate
}) => {
  const [share, setShare] = useState<TransactionShare | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editedShares, setEditedShares] = useState<Array<{ userId: string; userName: string; ratio: number; amountCny: number }>>([]);
  const [remark, setRemark] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load share configuration and logs
  useEffect(() => {
    console.log('[TransactionDetailPanel] Component mounted/updated, transaction ID:', transaction.id);
    loadShareData();
  }, [transaction.id]);

  const loadShareData = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('[TransactionDetailPanel] Loading data for transaction:', transaction.id);
      
      // Load share configuration
      const shareUrl = `/api/transactions/${transaction.id}/shares`;
      console.log('[TransactionDetailPanel] Fetching shares from:', shareUrl);
      const shareRes = await fetch(shareUrl);
      
      if (!shareRes.ok) {
        const errorText = await shareRes.text();
        console.error('[TransactionDetailPanel] Share fetch failed:', shareRes.status, errorText);
        throw new Error(`Failed to load shares: ${shareRes.status} - ${errorText}`);
      }
      
      const shareData = await shareRes.json();
      console.log('[TransactionDetailPanel] Share data loaded:', shareData);
      console.log('[TransactionDetailPanel] Share users count:', shareData.users?.length || 0);
      console.log('[TransactionDetailPanel] Transaction cnyAmount:', transaction.cnyAmount);
      
      setShare(shareData);
      
      // Initialize editedShares with full user data including calculated amounts
      if (shareData.users && shareData.users.length > 0) {
        const initialShares = shareData.users.map((u: any) => ({
          userId: u.userId,
          userName: u.userName,
          ratio: u.ratio,
          amountCny: u.amountCny || (transaction.cnyAmount * u.ratio)
        }));
        setEditedShares(initialShares);
        console.log('[TransactionDetailPanel] Initialized editedShares:', initialShares);
      } else {
        console.warn('[TransactionDetailPanel] No users in share data, setting empty array');
        setEditedShares([]);
      }
    } catch (err) {
      console.error('[TransactionDetailPanel] Error loading share data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load transaction details');
      // Set empty defaults on error
      setShare(null);
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = () => {
    setEditing(true);
    setRemark('');
  };

  const handleCancelEdit = () => {
    setEditing(false);
    if (share) {
      // Reset to original share data
      const resetShares = share.users.map(u => ({
        userId: u.userId,
        userName: u.userName,
        ratio: u.ratio,
        amountCny: u.amountCny || (transaction.cnyAmount * u.ratio)
      }));
      setEditedShares(resetShares);
    }
    setRemark('');
  };

  const handleRatioChange = (userId: string, newRatioPercent: number) => {
    // newRatioPercent is 0-100, convert to 0-1
    const newRatio = Math.max(0, Math.min(100, newRatioPercent)) / 100;
    
    const updated = editedShares.map(s => {
      if (s.userId === userId) {
        const newAmountCny = transaction.cnyAmount * newRatio;
        return {
          ...s,
          ratio: newRatio,
          amountCny: Math.round(newAmountCny * 100) / 100
        };
      }
      return s;
    });
    
    setEditedShares(updated);
    console.log('[TransactionDetailPanel] Ratio changed for user:', userId, 'new ratio:', newRatio);
  };

  const handleSaveShares = async () => {
    if (!transaction?.id) {
      setError('交易ID不存在');
      return;
    }

    setSaving(true);
    setError(null);
    
    try {
      // Validate total ratio
      const totalRatio = editedShares.reduce((sum, s) => sum + s.ratio, 0);
      const totalPercent = totalRatio * 100;
      
      if (Math.abs(totalPercent - 100) > 0.01 && Math.abs(totalPercent - 0) > 0.01) {
        if (!confirm(`当前总分账比例为 ${totalPercent.toFixed(2)}%，不等于 100%。确定保存吗？`)) {
          setSaving(false);
          return;
        }
      }

      console.log('[TransactionDetailPanel] Saving shares:', {
        transactionId: transaction.id,
        users: editedShares.map(u => ({ userId: u.userId, ratio: u.ratio })),
        remark: remark.trim() || undefined
      });

      const response = await fetch(`/api/transactions/${transaction.id}/shares`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          users: editedShares.map(u => ({
            userId: u.userId,
            ratio: u.ratio
          })),
          remark: remark.trim() || undefined
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('[TransactionDetailPanel] Save response:', result);

      // Reload data from backend to ensure consistency
      const updatedRes = await fetch(`/api/transactions/${transaction.id}/shares`);
      if (updatedRes.ok) {
        const updatedData = await updatedRes.json();
        setShare(updatedData);
        const updatedShares = updatedData.users.map((u: any) => ({
          userId: u.userId,
          userName: u.userName,
          ratio: u.ratio,
          amountCny: u.amountCny || (transaction.cnyAmount * u.ratio)
        }));
        setEditedShares(updatedShares);
      }

      setEditing(false);
      setRemark('');
      
      // Notify parent to refresh
      if (onUpdate) {
        await onUpdate();
      }
      
      // Show success message
      alert('✅ 分账比例已更新！\n\n调整记录已自动保存到"分账日志"页面，可在导航栏中查看。');
    } catch (err) {
      console.error('[TransactionDetailPanel] Error saving shares:', err);
      setError(err instanceof Error ? err.message : '保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  // Calculate totals for display
  const totalRatio = editedShares.reduce((sum, s) => sum + s.ratio, 0);
  const totalPercent = totalRatio * 100;
  const totalAmountCny = editedShares.reduce((sum, s) => sum + s.amountCny, 0);

  if (loading) {
    return (
      <div className="p-6 text-center text-slate-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-3 text-sm font-medium">正在加载交易详情...</p>
        <p className="mt-1 text-xs text-slate-400">交易ID: {transaction.id}</p>
      </div>
    );
  }

  if (error && !share) {
    return (
      <div className="p-6 bg-red-50 border-2 border-red-300 rounded-lg">
        <div className="flex items-start gap-3 text-red-700 mb-4">
          <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold mb-1">加载失败</p>
            <p className="text-sm">{error}</p>
            <p className="text-xs text-red-600 mt-2">交易ID: {transaction.id}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadShareData}
            className="text-sm bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded transition-colors"
          >
            重试
          </button>
          <button
            onClick={onClose}
            className="text-sm text-red-600 bg-white border border-red-300 hover:bg-red-50 px-4 py-2 rounded transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b-2 border-slate-300">
        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          交易详情面板
        </h3>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1 rounded transition-colors"
          title="关闭"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Basic Information */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-slate-600 mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4" />
          基本信息
        </h4>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-slate-500">订单号:</span>
            <span className="ml-2 font-mono text-slate-800">{transaction.externalTxId || transaction.id}</span>
          </div>
          <div>
            <span className="text-slate-500">来源:</span>
            <span className="ml-2 text-slate-800">{transaction.source}</span>
          </div>
          <div>
            <span className="text-slate-500">时间:</span>
            <span className="ml-2 text-slate-800">{transaction.timestamp}</span>
          </div>
          <div>
            <span className="text-slate-500">金额:</span>
            <span className="ml-2 font-semibold text-slate-800">
              {transaction.originalAmount.toLocaleString()} {transaction.currency}
              {transaction.currency === 'USDT' && ` (¥${transaction.cnyAmount.toLocaleString()})`}
            </span>
          </div>
          {transaction.cleared && (
            <div className="col-span-2">
              <span className="text-slate-500">结算状态:</span>
              <span className="ml-2 text-slate-600">
                已结清 {transaction.settlementId ? `(${transaction.settlementId})` : ''}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Share Configuration */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-slate-600 flex items-center gap-2">
            <Edit3 className="w-4 h-4" />
            当前分账设置
            {share?.fromDefault && (
              <span className="text-xs text-slate-400 font-normal">(使用默认比例)</span>
            )}
          </h4>
          {!editing && transaction.cleared !== true && (
            <button
              onClick={handleStartEdit}
              className="text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded transition-colors flex items-center gap-1"
            >
              <Edit3 className="w-3 h-3" />
              编辑比例
            </button>
          )}
        </div>

        {error && (
          <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="bg-slate-50 rounded border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 border-b border-slate-200">
              <tr>
                <th className="px-3 py-2 text-left text-slate-600 font-semibold">用户名</th>
                <th className="px-3 py-2 text-right text-slate-600 font-semibold">比例 (%)</th>
                <th className="px-3 py-2 text-right text-slate-600 font-semibold">应得金额 (CNY)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {editing ? (
                editedShares.length > 0 ? (
                  editedShares.map((editShare) => (
                    <tr key={editShare.userId} className="hover:bg-white">
                      <td className="px-3 py-2 font-medium text-slate-800">{editShare.userName}</td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={(editShare.ratio * 100).toFixed(2)}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            handleRatioChange(editShare.userId, val);
                          }}
                          className="w-24 text-right p-1.5 border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          disabled={transaction.cleared === true}
                        />
                        <span className="ml-1 text-xs text-slate-500">%</span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-slate-700 font-semibold">
                        ¥{editShare.amountCny.toFixed(2)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-3 py-4 text-center text-slate-400 text-sm">
                      暂无分账用户数据
                    </td>
                  </tr>
                )
              ) : (
                share?.users && share.users.length > 0 ? (
                  share.users.map((u) => (
                    <tr key={u.userId} className="hover:bg-white">
                      <td className="px-3 py-2 font-medium text-slate-800">{u.userName}</td>
                      <td className="px-3 py-2 text-right text-slate-600">
                        {(u.ratio * 100).toFixed(2)}%
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-semibold text-slate-800">
                        ¥{u.amountCny.toFixed(2)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-3 py-4 text-center text-slate-400 text-sm">
                      暂无分账数据
                    </td>
                  </tr>
                )
              )}
            </tbody>
            {editing && (
              <tfoot className="bg-slate-100 border-t-2 border-slate-300">
                <tr>
                  <td className="px-3 py-2 text-sm font-semibold text-slate-700">总计:</td>
                  <td className="px-3 py-2 text-right">
                    <span className={`text-sm font-mono font-bold ${Math.abs(totalPercent - 100) < 0.1 ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {totalPercent.toFixed(2)}%
                    </span>
                    {Math.abs(totalPercent - 100) >= 0.1 && (
                      <span className="ml-2 text-xs text-amber-600">(应为 100%)</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-bold text-slate-800">
                    ¥{totalAmountCny.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {editing && (
          <div className="mt-3 space-y-2">
            <div>
              <label className="block text-xs text-slate-600 mb-1">备注 (可选)</label>
              <input
                type="text"
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder="输入调整原因或备注..."
                className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSaveShares}
                disabled={saving || transaction.cleared === true || editedShares.length === 0}
                className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium shadow-sm"
              >
                <Save className="w-4 h-4" />
                {saving ? '保存中...' : '保存当前订单分账'}
              </button>
              <button
                onClick={handleCancelEdit}
                disabled={saving}
                className="text-xs text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 px-4 py-2 rounded transition-colors disabled:opacity-50 flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                取消
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

