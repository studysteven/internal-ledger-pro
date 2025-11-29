import React, { useState, useEffect } from 'react';
import { UserSplit, Currency, ManualTransactionInput } from '../types';
import { PlusCircle, ChevronRight, Save, User, Users, PieChart } from 'lucide-react';

interface ManualEntryFormProps {
  users: UserSplit[];
  onCreateTransaction: (input: ManualTransactionInput) => void;
  exchangeRate: number;
}

type SplitMode = 'default' | 'single' | 'custom';

export const ManualEntryForm: React.FC<ManualEntryFormProps> = ({ users, onCreateTransaction, exchangeRate }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  // Form State
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>('CNY');
  const [note, setNote] = useState('');
  const [timestamp, setTimestamp] = useState('');
  
  // Split Logic
  const [splitMode, setSplitMode] = useState<SplitMode>('default');
  const [singleTargetId, setSingleTargetId] = useState<string>(users[0]?.id || '');
  const [customRatios, setCustomRatios] = useState<Record<string, string>>({}); // userId -> ratio string (now represents percentage 0-100)
  
  // Initialize timestamp to current time
  useEffect(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    setTimestamp(`${year}-${month}-${day}T${hours}:${minutes}`);
  }, []);

  // Initialize custom ratios with default values when opening/changing
  useEffect(() => {
    const init: Record<string, string> = {};
    // Convert decimal to percentage for initial display
    users.forEach(u => init[u.id] = (u.ratio * 100).toString());
    setCustomRatios(init);
  }, [users]);

  const handleCustomRatioChange = (userId: string, val: string) => {
    setCustomRatios(prev => ({...prev, [userId]: val}));
  };

  const getCustomTotal = (): number => {
    const values = Object.values(customRatios) as string[];
    return values.reduce((acc: number, val: string) => acc + (parseFloat(val) || 0), 0);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('请输入有效的金额');
      return;
    }
    
    // Validate custom ratios if in custom mode
    if (splitMode === 'custom') {
      const totalPercent = getCustomTotal();
      if (Math.abs(totalPercent - 100) > 0.1) {
        if (!confirm(`当前自定义分账总比例为 ${totalPercent.toFixed(2)}%，不等于 100%。确定继续吗？`)) {
          return;
        }
      }
    }
    
    // Prepare custom ratios (convert percentage to decimal)
    let customRatiosDecimal: Record<string, number> | undefined;
    if (splitMode === 'custom') {
      customRatiosDecimal = {};
      users.forEach(u => {
        const percent = parseFloat(customRatios[u.id] || '0');
        customRatiosDecimal![u.id] = percent / 100; // Convert percentage to decimal
      });
    }
    
    // Create transaction input
    const transactionInput: ManualTransactionInput = {
      amount: amountNum,
      currency,
      timestamp: timestamp || new Date().toISOString(),
      note: note.trim() || undefined,
      splitMode,
      singleTargetId: splitMode === 'single' ? singleTargetId : undefined,
      customRatios: customRatiosDecimal
    };
    
    // Call the create handler
    onCreateTransaction(transactionInput);
    
    // Reset form
    setAmount('');
    setNote('');
    setSplitMode('default'); // Always default to 'default' mode (use user ratios)
    setIsOpen(false);
    
    // Reset timestamp to current time
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    setTimestamp(`${year}-${month}-${day}T${hours}:${minutes}`);
  };

  return (
    <div className="mt-6 border border-slate-200 rounded-lg bg-white overflow-hidden shadow-sm">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors text-left group"
      >
        <span className="font-bold text-slate-700 flex items-center gap-2">
          <PlusCircle className="w-5 h-5 text-blue-600 group-hover:scale-110 transition-transform" />
          手动录入收入
        </span>
        <ChevronRight className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} />
      </button>

      {isOpen && (
        <form onSubmit={handleSubmit} className="p-5 border-t border-slate-200 bg-white">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left: Basic Info */}
            <div className="lg:col-span-4 space-y-4">
               <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">金额 & 币种</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      step="0.01"
                      required
                      placeholder="0.00"
                      className="w-full pl-3 pr-20 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono text-lg font-bold text-slate-700"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center">
                      <select 
                        value={currency}
                        onChange={e => setCurrency(e.target.value as Currency)}
                        className="h-full py-0 pl-2 pr-2 border-l bg-slate-50 text-slate-600 font-medium sm:text-sm rounded-r focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option>CNY</option>
                        <option>USDT</option>
                      </select>
                    </div>
                  </div>
               </div>

               <div>
                 <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">入账时间</label>
                 <input 
                    type="datetime-local" 
                    value={timestamp}
                    onChange={e => setTimestamp(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-slate-600 text-sm"
                  />
               </div>

               <div>
                 <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">备注</label>
                 <textarea 
                    rows={2}
                    placeholder="选填..."
                    className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    value={note}
                    onChange={e => setNote(e.target.value)}
                  />
               </div>
            </div>

            {/* Right: Split Configuration */}
            <div className="lg:col-span-8 bg-slate-50 rounded-lg p-4 border border-slate-200">
               <label className="block text-xs font-semibold text-slate-500 uppercase mb-3">分账模式</label>
               
               {/* Mode Switcher */}
               <div className="flex gap-2 mb-4">
                 <button 
                    type="button"
                    onClick={() => setSplitMode('default')}
                    className={`flex-1 py-2 px-3 rounded text-sm font-medium flex flex-col items-center gap-1 border transition-all ${splitMode === 'default' ? 'bg-white border-blue-500 text-blue-700 shadow-sm' : 'border-slate-200 text-slate-500 hover:bg-white'}`}
                  >
                    <Users className="w-4 h-4" />
                    默认比例
                  </button>
                  <button 
                    type="button"
                    onClick={() => setSplitMode('single')}
                    className={`flex-1 py-2 px-3 rounded text-sm font-medium flex flex-col items-center gap-1 border transition-all ${splitMode === 'single' ? 'bg-white border-blue-500 text-blue-700 shadow-sm' : 'border-slate-200 text-slate-500 hover:bg-white'}`}
                  >
                    <User className="w-4 h-4" />
                    指定一人
                  </button>
                  <button 
                    type="button"
                    onClick={() => setSplitMode('custom')}
                    className={`flex-1 py-2 px-3 rounded text-sm font-medium flex flex-col items-center gap-1 border transition-all ${splitMode === 'custom' ? 'bg-white border-blue-500 text-blue-700 shadow-sm' : 'border-slate-200 text-slate-500 hover:bg-white'}`}
                  >
                    <PieChart className="w-4 h-4" />
                    自定义详情
                  </button>
               </div>

               {/* Dynamic Content Based on Mode */}
               <div className="bg-white rounded border border-slate-200 p-3 min-h-[140px]">
                  
                  {splitMode === 'default' && (
                    <div className="text-center h-full flex flex-col items-center justify-center text-slate-400 text-sm">
                      <p>将应用系统当前的默认分账比例</p>
                    </div>
                  )}

                  {splitMode === 'single' && (
                    <div className="space-y-2">
                       <p className="text-xs text-slate-500">选择该笔收入 100% 归属的用户:</p>
                       <select 
                        value={singleTargetId}
                        onChange={(e) => setSingleTargetId(e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                       >
                         {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                       </select>
                    </div>
                  )}

                  {splitMode === 'custom' && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-slate-400 uppercase mb-1 border-b pb-1">
                        <div className="col-span-4">User</div>
                        <div className="col-span-8">Ratio (%)</div>
                      </div>
                      {users.map(u => (
                        <div key={u.id} className="grid grid-cols-12 gap-2 items-center">
                           <div className="col-span-4 text-sm font-medium text-slate-700 truncate" title={u.name}>{u.name}</div>
                           <div className="col-span-8">
                             <input 
                              type="number" 
                              step="0.1" min="0" max="100"
                              value={customRatios[u.id] ?? ''} 
                              onChange={(e) => handleCustomRatioChange(u.id, e.target.value)}
                              placeholder="0"
                              className="w-full p-1 border border-slate-200 rounded text-right font-mono text-sm focus:border-blue-500 outline-none"
                             />
                           </div>
                        </div>
                      ))}
                      <div className="flex justify-between items-center pt-2 border-t mt-2">
                        <span className="text-xs text-slate-500">Total:</span>
                        <span className={`text-sm font-bold font-mono ${Math.abs(getCustomTotal() - 100) < 0.1 ? 'text-emerald-600' : 'text-amber-500'}`}>
                          {getCustomTotal().toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  )}
               </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 mt-2 border-t border-slate-100">
            <button 
              type="submit"
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded shadow-sm flex items-center gap-2 transition-colors"
            >
              <Save className="w-4 h-4" />
              确认入账
            </button>
          </div>
        </form>
      )}
    </div>
  );
};