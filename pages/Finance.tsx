
import React, { useState, useMemo } from 'react';
import { AppData, IncomeRecord } from '../types';
import { generateId } from '../db';
import { Wallet, TrendingUp, TrendingDown, Plus, X, Landmark, ArrowDownRight, ArrowUpRight, RefreshCw } from 'lucide-react';

const Finance: React.FC<{ data: AppData; updateData: (fn: (d: AppData) => AppData) => void }> = ({ data, updateData }) => {
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [newIncome, setNewIncome] = useState<Partial<IncomeRecord>>({
    date: new Date().toISOString().split('T')[0],
    platform: '微信销售'
  });

  const totalExpenditure = useMemo(() => {
    const orderPaid = data.orders.reduce((sum, o) => sum + (o.paid_amount || 0), 0);
    const transfers = data.transfers.reduce((sum, t) => sum + t.amount, 0);
    return orderPaid + transfers;
  }, [data.orders, data.transfers]);

  const totalIncome = useMemo(() => {
    return data.incomes.reduce((sum, i) => sum + i.amount, 0);
  }, [data.incomes]);

  const handleSaveIncome = () => {
    if (!newIncome.amount || !newIncome.quantity) return;
    const record: IncomeRecord = { ...(newIncome as IncomeRecord), id: generateId('INC') };

    updateData(prev => {
        const lastBalance = prev.inventory[prev.inventory.length - 1]?.balance_quantity || 0;
        const newInventoryTrans = {
            id: Date.now(),
            transaction_date: record.date,
            transaction_type: 'out' as const,
            quantity_change: -Math.abs(record.quantity),
            balance_quantity: lastBalance - Math.abs(record.quantity),
            remarks: `销售出库: ${record.platform}`
        };
        return {
            ...prev,
            incomes: [record, ...prev.incomes],
            inventory: [...prev.inventory, newInventoryTrans]
        };
    });
    setShowIncomeModal(false);
  };

  return (
    <div className="space-y-4 lg:space-y-8">
      <div className="flex justify-between items-center px-1">
        <div>
          <h2 className="text-xl lg:text-3xl font-black text-slate-800 tracking-tight">财务账本</h2>
          <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase mt-0.5">Financial Ledger</p>
        </div>
        <button 
          onClick={() => setShowIncomeModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-50 text-xs active:scale-95 transition-all"
        >
          <Plus size={16} />
          记一笔收入
        </button>
      </div>

      <div className="bg-slate-900 p-6 lg:p-10 rounded-[2rem] text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col items-center text-center">
          <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-2">当前经营盈亏</span>
          <div className="text-4xl lg:text-5xl font-black tracking-tighter">
            ¥{(totalIncome - totalExpenditure).toLocaleString()}
          </div>
          <div className="mt-4 flex gap-4">
             <div className="flex flex-col">
               <span className="text-[8px] text-white/30 uppercase font-bold tracking-widest text-center">累计营收</span>
               <span className="text-emerald-400 font-black">¥{totalIncome.toLocaleString()}</span>
             </div>
             <div className="w-px h-6 bg-white/10 self-center"></div>
             <div className="flex flex-col">
               <span className="text-[8px] text-white/30 uppercase font-bold tracking-widest text-center">代工支出</span>
               <span className="text-rose-400 font-black">¥{totalExpenditure.toLocaleString()}</span>
             </div>
          </div>
        </div>
        <div className="absolute -right-8 -bottom-8 text-white/5 pointer-events-none">
          <Landmark size={180} />
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
          <ArrowUpRight size={14} className="text-emerald-500" /> 销售流水 (最近10笔)
        </h3>
        <div className="space-y-2">
          {data.incomes.slice(0, 10).map(item => (
            <div key={item.id} className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-800 text-sm">{item.platform}</div>
                <div className="text-[10px] text-slate-400 font-mono">{item.date}</div>
              </div>
              <div className="text-right">
                <div className="font-black text-emerald-600">+¥{item.amount.toLocaleString()}</div>
                <div className="text-[10px] font-bold text-slate-300">出货 {item.quantity} 条</div>
              </div>
            </div>
          ))}
          {data.incomes.length === 0 && <div className="text-center py-10 text-slate-300 font-bold uppercase text-[10px]">暂无记录</div>}
        </div>
      </div>

      {showIncomeModal && (
        <div className="fixed inset-0 z-[100] flex items-end lg:items-center justify-center p-0 lg:p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-t-[2.5rem] lg:rounded-[2.5rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-20 duration-500">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between">
              <h3 className="text-xl font-black text-slate-800">记一笔营收</h3>
              <button onClick={() => setShowIncomeModal(false)}><X size={24} className="text-slate-300" /></button>
            </div>
            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">销售实收 (元)</label>
                <input 
                  type="number" 
                  value={newIncome.amount || ''} 
                  onChange={e => setNewIncome({...newIncome, amount: parseFloat(e.target.value)})}
                  className="w-full px-6 py-4 bg-emerald-50 border border-emerald-100 rounded-2xl font-black text-3xl text-emerald-900 outline-none" 
                  placeholder="0.00"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">数量 (条)</label>
                  <input type="number" value={newIncome.quantity || ''} onChange={e => setNewIncome({...newIncome, quantity: parseInt(e.target.value)})} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl font-black text-lg outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">日期</label>
                  <input type="date" value={newIncome.date} onChange={e => setNewIncome({...newIncome, date: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-sm outline-none" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">销售渠道</label>
                <input type="text" value={newIncome.platform} onChange={e => setNewIncome({...newIncome, platform: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl font-bold outline-none" placeholder="如：微信销售" />
              </div>
            </div>
            <div className="p-8 bg-slate-50 flex gap-4">
              <button onClick={() => setShowIncomeModal(false)} className="flex-1 font-bold text-slate-400">取消</button>
              <button onClick={handleSaveIncome} className="flex-[2] py-4 bg-emerald-600 text-white font-black rounded-xl shadow-lg active:scale-95 transition-all">入库并记账</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Finance;
