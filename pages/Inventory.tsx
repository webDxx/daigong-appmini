
import React, { useState, useMemo } from 'react';
import { AppData, InventoryTransaction } from '../types';
import { db } from '../db';
import { Package, ArrowDownRight, ArrowUpLeft, Settings2, History, DollarSign, RefreshCw } from 'lucide-react';

const Inventory: React.FC<{ data: AppData; updateData: (fn: (d: AppData) => AppData) => void }> = ({ data, updateData }) => {
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newTrans, setNewTrans] = useState<Partial<InventoryTransaction>>({
    transaction_type: 'out',
    transaction_date: new Date().toISOString().split('T')[0]
  });

  const handleSaveTransaction = async () => {
    if (!newTrans.quantity_change || !newTrans.transaction_type) return;
    setIsSaving(true);
    try {
      const lastBalance = data.inventory[data.inventory.length - 1]?.balance_quantity || 0;
      const change = newTrans.transaction_type === 'out' ? -Math.abs(newTrans.quantity_change) : newTrans.quantity_change;
      
      const { data: savedData, error } = await db.addInventoryRecord({
        ...newTrans,
        quantity_change: change,
        balance_quantity: lastBalance + change,
      });
      if (error) throw error;

      updateData(prev => ({
        ...prev,
        inventory: [...prev.inventory, savedData[0]]
      }));
      setShowAdjustModal(false);
      setNewTrans({ transaction_type: 'out', transaction_date: new Date().toISOString().split('T')[0] });
    } catch (err) {
      alert("提交失败: " + (err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const currentBalance = data.inventory[data.inventory.length - 1]?.balance_quantity || 0;
  // 仅计算 transaction_type 为 out 的销售收益
  const totalSales = data.inventory
    .filter(i => i.transaction_type === 'out')
    .reduce((sum, i) => sum + Math.abs(i.quantity_change) * data.settings.sale_price_per_unit, 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">成品库存中心</h2>
          <p className="text-slate-500">销售价锁定为 ¥15.00/条。所有变动实时记录至日志。</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => { setNewTrans({ ...newTrans, transaction_type: 'out' }); setShowAdjustModal(true); }} className="flex items-center gap-2 px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl hover:bg-indigo-700 transition-all">
            <DollarSign size={20} /> 确认销售出库
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm flex items-center gap-8">
          <div className="w-24 h-24 bg-blue-50 text-blue-600 rounded-[2rem] flex items-center justify-center shadow-inner">
            <Package size={48} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">可销售库存</p>
            <div className="flex items-baseline gap-2">
              <span className="text-6xl font-black text-slate-900 tracking-tighter">{currentBalance}</span>
              <span className="text-xl font-bold text-slate-400">条</span>
            </div>
          </div>
        </div>
        <div className="bg-slate-900 p-10 rounded-[2.5rem] flex items-center gap-8 text-white relative overflow-hidden">
           <div className="relative z-10">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">累计预估流水</p>
              <div className="flex items-baseline gap-2">
                <span className="text-6xl font-black text-blue-400 tracking-tighter">¥{totalSales.toLocaleString()}</span>
              </div>
           </div>
           <DollarSign className="absolute -right-8 -bottom-8 text-white/5" size={240} />
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-8 border-b border-slate-100 bg-slate-50/50">
           <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
              <History className="text-indigo-500" /> 出入库全流水记录
           </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
              <tr>
                <th className="px-8 py-5">时间</th>
                <th className="px-8 py-5">类型</th>
                <th className="px-8 py-5 text-right">变动数量</th>
                <th className="px-8 py-5 text-right">结余</th>
                <th className="px-8 py-5">关联订单/备注</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...data.inventory].reverse().map(item => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-8 py-5 text-sm text-slate-500 font-mono">{item.transaction_date}</td>
                  <td className="px-8 py-5">
                    <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${item.transaction_type === 'in' ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>
                      {item.transaction_type === 'in' ? '收货入库' : item.transaction_type === 'out' ? '销售出库' : '修正'}
                    </span>
                  </td>
                  <td className={`px-8 py-5 text-right font-black ${item.quantity_change > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {item.quantity_change > 0 ? '+' : ''}{item.quantity_change}
                  </td>
                  <td className="px-8 py-5 text-right font-black text-slate-800">{item.balance_quantity}</td>
                  <td className="px-8 py-5 text-xs text-slate-400 italic">
                    {item.related_order ? <span className="text-blue-500 font-mono font-bold mr-2">{item.related_order}</span> : ''}
                    {item.remarks}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAdjustModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
          <div className="bg-white rounded-[3rem] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-10 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-2xl font-black text-slate-800">库存流水录入</h3>
            </div>
            <div className="p-10 space-y-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">变动数量</label>
                <div className="relative">
                   <input type="number" value={newTrans.quantity_change || ''} onChange={e => setNewTrans({...newTrans, quantity_change: parseInt(e.target.value)})} className="w-full px-8 py-6 bg-slate-50 border border-slate-200 rounded-3xl font-black text-4xl outline-none focus:ring-4 focus:ring-blue-100" />
                   <div className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-300 font-bold">条</div>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">变动备注</label>
                <input type="text" value={newTrans.remarks || ''} onChange={e => setNewTrans({...newTrans, remarks: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none" placeholder="如：微信转账 10 条" />
              </div>
            </div>
            <div className="p-10 bg-slate-50 flex gap-4">
              <button onClick={() => setShowAdjustModal(false)} className="flex-1 py-4 font-bold text-slate-500">取消</button>
              <button onClick={handleSaveTransaction} disabled={isSaving} className="flex-[2] py-4 bg-indigo-600 text-white font-bold rounded-2xl shadow-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2">
                {isSaving && <RefreshCw className="animate-spin" size={18} />}
                确认提交流水
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
