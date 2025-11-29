import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface SettleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isSubmitting: boolean;
}

export const SettleModal: React.FC<SettleModalProps> = ({ isOpen, onClose, onConfirm, isSubmitting }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-red-100 rounded-full">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">确认结清?</h3>
              <p className="text-sm text-slate-500">此操作不可撤销。</p>
            </div>
            <button onClick={onClose} className="ml-auto text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <p className="text-slate-600 mb-6 leading-relaxed">
            即将删除所有交易记录并重置统计。
            <br />
            <span className="text-xs text-red-500 font-medium">注意：此操作将：</span>
            <br />
            <span className="text-xs text-red-500 font-medium">1. 永久删除所有已完成的交易记录</span>
            <br />
            <span className="text-xs text-red-500 font-medium">2. 清除所有分账调整日志记录（防止篡改）</span>
            <br />
            <span className="text-xs text-red-500 font-medium">3. 重置所有统计信息</span>
            <br />
            <span className="text-xs text-red-500 font-bold">⚠️ 此操作不可撤销，数据将永久丢失！</span>
          </p>

          <div className="flex justify-end gap-3">
            <button 
              onClick={onClose}
              className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded font-medium transition-colors"
              disabled={isSubmitting}
            >
              取消
            </button>
            <button 
              onClick={onConfirm}
              className="px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded font-medium shadow-sm transition-colors flex items-center gap-2"
              disabled={isSubmitting}
            >
              {isSubmitting ? '处理中...' : '确认结清'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};