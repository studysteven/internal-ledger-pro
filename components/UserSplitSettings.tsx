import React, { useState, useEffect } from 'react';
import { UserSplit } from '../types';
import { Save, AlertCircle, Plus, Trash2, User } from 'lucide-react';

interface UserSplitSettingsProps {
  users: UserSplit[];
  onSaveUsers: (newUsers: UserSplit[]) => void;
}

export const UserSplitSettings: React.FC<UserSplitSettingsProps> = ({ users: initialUsers, onSaveUsers }) => {
  const [localUsers, setLocalUsers] = useState<UserSplit[]>(initialUsers);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Sync state if props change (and we haven't modified local)
  useEffect(() => {
    if (!hasUnsavedChanges) {
        setLocalUsers(initialUsers);
    }
  }, [initialUsers, hasUnsavedChanges]);

  const handleUpdate = (id: string, field: keyof UserSplit, value: string | number) => {
    setLocalUsers(prev => prev.map(u => {
      if (u.id === id) {
        return { ...u, [field]: value };
      }
      return u;
    }));
    setHasUnsavedChanges(true);
  };

  const handleAddUser = () => {
    const newUser: UserSplit = {
      id: `u-${Date.now()}`,
      name: '新用户',
      ratio: 0
    };
    setLocalUsers(prev => [...prev, newUser]);
    setHasUnsavedChanges(true);
  };

  const handleDeleteUser = (id: string) => {
    if (confirm("确定要删除该用户吗？")) {
      setLocalUsers(prev => prev.filter(u => u.id !== id));
      setHasUnsavedChanges(true);
    }
  };

  const handleSave = () => {
    const totalRatio = localUsers.reduce((acc, u) => acc + (u.ratio || 0), 0);
    // Check against 1.0 (internal decimal value)
    if (Math.abs(totalRatio - 1.0) > 0.001 && Math.abs(totalRatio - 0) > 0.001) {
       if(!confirm(`当前总比例为 ${(totalRatio * 100).toFixed(2)}%，不等于 100%。确定保存吗？`)) {
         return;
       }
    }
    onSaveUsers(localUsers);
    setHasUnsavedChanges(false);
  };

  const totalRatio = localUsers.reduce((acc, u) => acc + (u.ratio || 0), 0);
  const isTotalValid = Math.abs(totalRatio - 1.0) < 0.001 || Math.abs(totalRatio - 0) < 0.001;
  const totalPercent = totalRatio * 100;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 flex flex-col" style={{ maxHeight: '500px', minHeight: '300px' }}>
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100 flex-shrink-0">
        <h2 className="text-lg font-bold text-slate-800">分账用户管理</h2>
        {!isTotalValid && (
          <div className="text-amber-500 animate-pulse" title={`Current Total: ${totalPercent.toFixed(2)}%`}>
            <AlertCircle className="w-5 h-5" />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 overflow-y-auto flex-1" style={{ minHeight: 0 }}>
        {/* Header Row */}
        <div className="flex gap-2 text-xs font-semibold text-slate-400 px-2 uppercase mb-1">
            <div className="flex-grow">用户名</div>
            <div className="w-16 text-right">比例(%)</div>
            <div className="w-8"></div>
        </div>

        {localUsers.map((user) => (
            <div key={user.id} className="flex items-center gap-2 p-2 rounded bg-slate-50 border border-slate-100 hover:border-blue-200 transition-colors group">
              <div className="flex-grow relative">
                 <User className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                 <input 
                   type="text"
                   className="w-full pl-6 pr-2 py-1 bg-white border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                   value={user.name}
                   onChange={(e) => handleUpdate(user.id, 'name', e.target.value)}
                 />
              </div>
              
              <div className="relative w-16">
                  <input 
                    type="number" 
                    step="0.1" 
                    min="0" 
                    max="100"
                    className="w-full px-1 py-1 bg-white border border-slate-200 rounded text-sm text-right font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                    // Display percentage: ratio * 100. Using + to remove trailing zeros if integer
                    value={+(user.ratio * 100).toFixed(2)}
                    // Convert back to decimal on change
                    onChange={(e) => handleUpdate(user.id, 'ratio', parseFloat(e.target.value) / 100)}
                  />
              </div>
              
              <button 
                onClick={() => handleDeleteUser(user.id)}
                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                title="删除用户"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
        ))}

        <button 
          onClick={handleAddUser}
          className="mt-2 w-full py-2 border border-dashed border-slate-300 rounded text-slate-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all text-sm font-medium flex items-center justify-center gap-1 flex-shrink-0"
        >
           <Plus className="w-4 h-4" /> 新增用户
        </button>
      </div>

      <div className={`mt-4 flex justify-between items-center px-3 py-2 rounded border flex-shrink-0 ${isTotalValid ? 'bg-slate-50 border-slate-200 text-slate-600' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
         <span className="text-xs font-bold uppercase">当前总比例</span>
         <span className="font-mono font-bold">{totalPercent.toFixed(2)}%</span>
      </div>

      <button 
         onClick={handleSave}
         disabled={!hasUnsavedChanges}
         className={`mt-4 w-full py-2.5 rounded shadow-sm font-medium flex items-center justify-center gap-2 transition-all flex-shrink-0 ${
             hasUnsavedChanges 
             ? 'bg-blue-600 hover:bg-blue-700 text-white translate-y-0' 
             : 'bg-slate-100 text-slate-400 cursor-not-allowed'
         }`}
      >
        <Save className="w-4 h-4" /> 保存用户设置
      </button>
    </div>
  );
};