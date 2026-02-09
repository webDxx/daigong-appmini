
import React, { useState, useMemo } from 'react';
import { AppData, IncomeRecord } from '../types';
import { db, loadDataFromServer, supabase } from '../db';
import Pagination from '../components/Pagination';
import { Wallet, TrendingUp, TrendingDown, Plus, X, Landmark, ArrowDownRight, ArrowUpRight, RefreshCw } from 'lucide-react';

const Finance: React.FC<{ data: AppData; updateData: (fn: (d: AppData) => AppData) => void }> = ({ data, updateData }) => {
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newIncome, setNewIncome] = useState<Partial<IncomeRecord>>({
    date: new Date().toISOString().split('T')[0],
    platform: '小红书1店',
    bank_card: '雪雪卡'
  });
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const platformOptions = ['小红书1店', '小红书2店', '微信', '个人售卖1店', '个人售卖2店', '闲鱼'];

  const totalExpenditure = useMemo(() => {
    const orderPaid = data.orders.reduce((sum, o) => sum + (o.paid_amount || 0), 0);
    const transfers = data.transfers.reduce((sum, t) => sum + t.amount, 0);
    return orderPaid + transfers;
  }, [data.orders, data.transfers]);

  const totalIncome = useMemo(() => {
    return data.incomes.reduce((sum, i) => sum + i.amount, 0);
  }, [data.incomes]);

  // 分页后的收入列表
  const paginatedIncomes = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return data.incomes.slice(startIndex, endIndex);
  }, [data.incomes, currentPage, itemsPerPage]);

  const handleSaveIncome = async () => {
    if (!newIncome.amount || !newIncome.quantity) {
      alert("请填写金额和数量");
      return;
    }
    
    setIsSaving(true);
    try {
      // 1. 保存收入记录到数据库
      const incomeResult = await db.addIncomeRecord({
        date: newIncome.date,
        platform: newIncome.platform,
        amount: newIncome.amount,
        quantity: newIncome.quantity
      });
      
      if (incomeResult.error) {
        console.error("保存收入记录失败:", incomeResult.error);
        throw incomeResult.error;
      }

      // 2. 获取"完整"类型的最新库存余额并创建出库记录（销售只能出库完整手绳）
      const { data: latestInventory } = await supabase
        .from('inventory')
        .select('balance_quantity, item_type')
        .eq('item_type', '完整')
        .order('id', { ascending: false })
        .limit(1);
      
      const lastBalance = latestInventory && latestInventory.length > 0
        ? latestInventory[0].balance_quantity
        : 0;

      const inventoryResult = await db.addInventoryRecord({
        transaction_date: newIncome.date,
        transaction_type: 'out',
        quantity_change: -Math.abs(newIncome.quantity),
        balance_quantity: lastBalance - Math.abs(newIncome.quantity),
        item_type: '完整',
        remarks: `销售出库: ${newIncome.platform}`
      });

      if (inventoryResult.error) {
        console.error("创建库存记录失败:", inventoryResult.error);
        throw inventoryResult.error;
      }

      // 3. 刷新全局数据
      const freshData = await loadDataFromServer();
      updateData(() => freshData);
      
      console.log("✅ 收入记录保存成功");
      console.log("📦 最新库存余额:", freshData.inventory[freshData.inventory.length - 1]?.balance_quantity || 0);
      console.log("💰 最新收入记录数:", freshData.incomes.length);
      
      setShowIncomeModal(false);
      setNewIncome({
        date: new Date().toISOString().split('T')[0],
        platform: '小红书1店',
        bank_card: '雪雪卡'
      });
    } catch (err) {
      console.error("保存失败:", err);
      alert("操作失败，请重试");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-2 lg:space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg lg:text-xl font-black text-slate-800 tracking-tight">财务账本</h2>
          <p className="text-[9px] text-slate-400 font-bold tracking-widest uppercase">Financial Ledger</p>
        </div>
        <button 
          onClick={() => setShowIncomeModal(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg font-bold shadow-lg text-xs active:scale-95 transition-all"
        >
          <Plus size={14} />
          记一笔收入
        </button>
      </div>

      <div className="bg-slate-900 p-4 lg:p-6 rounded-xl text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col items-center text-center">
          <span className="text-[8px] font-black text-white/40 uppercase tracking-wider mb-1">当前经营盈亏</span>
          <div className="text-2xl lg:text-3xl font-black tracking-tight">
            ¥{(totalIncome - totalExpenditure).toLocaleString()}
          </div>
          <div className="mt-2 flex gap-3">
             <div className="flex flex-col">
               <span className="text-[7px] text-white/30 uppercase font-bold tracking-widest text-center">累计营收</span>
               <span className="text-emerald-400 text-sm font-black">¥{totalIncome.toLocaleString()}</span>
             </div>
             <div className="w-px h-5 bg-white/10 self-center"></div>
             <div className="flex flex-col">
               <span className="text-[7px] text-white/30 uppercase font-bold tracking-widest text-center">代工支出</span>
               <span className="text-rose-400 text-sm font-black">¥{totalExpenditure.toLocaleString()}</span>
             </div>
          </div>
        </div>
        <div className="absolute -right-6 -bottom-6 text-white/5 pointer-events-none">
          <Landmark size={120} />
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-1.5">
          <ArrowUpRight size={12} className="text-emerald-500" /> 销售流水
        </h3>
        <div className="bg-white rounded-lg border border-slate-100 shadow-sm overflow-hidden">
          <div className="space-y-1.5 p-2">
            {paginatedIncomes.map(item => (
            <div key={item.id} className="bg-white p-2.5 rounded-lg border border-slate-100 flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-800 text-xs">{item.platform}</div>
                <div className="text-[9px] text-slate-400 font-mono">{item.date}</div>
              </div>
              <div className="text-right">
                <div className="font-black text-emerald-600 text-sm">+¥{item.amount.toLocaleString()}</div>
                <div className="text-[9px] font-bold text-slate-300">出货 {item.quantity} 条</div>
              </div>
            </div>
          ))}
          {data.incomes.length === 0 && <div className="text-center py-6 text-slate-300 font-bold uppercase text-[9px]">暂无记录</div>}
          </div>
          {data.incomes.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalItems={data.incomes.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
            />
          )}
        </div>
      </div>

      {showIncomeModal && (
        <div className="fixed inset-0 z-[100] flex items-end lg:items-center justify-center p-0 lg:p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-t-[1.5rem] lg:rounded-[1.5rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-20 duration-500">
            <div className="p-3.5 border-b border-slate-50 flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-800">记一笔营收</h3>
              <button onClick={() => setShowIncomeModal(false)}><X size={18} className="text-slate-300" /></button>
            </div>
            <div className="p-3.5 space-y-3">
              <div className="space-y-0.5">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">销售实收 (元)</label>
                <input 
                  type="number" 
                  value={newIncome.amount || ''} 
                  onChange={e => setNewIncome({...newIncome, amount: parseFloat(e.target.value)})}
                  className="w-full px-4 py-2.5 bg-emerald-50 border border-emerald-100 rounded-lg font-black text-xl text-emerald-900 outline-none" 
                  placeholder="0.00"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-0.5">
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">数量 (条)</label>
                  <input type="number" value={newIncome.quantity || ''} onChange={e => setNewIncome({...newIncome, quantity: parseInt(e.target.value)})} className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg font-black text-sm outline-none" />
                </div>
                <div className="space-y-0.5">
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">日期</label>
                  <input type="date" value={newIncome.date} onChange={e => setNewIncome({...newIncome, date: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg font-bold text-[10px] outline-none" />
                </div>
              </div>

              <div className="space-y-0.5">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">销售渠道</label>
                <select 
                  value={newIncome.platform} 
                  onChange={e => setNewIncome({...newIncome, platform: e.target.value})} 
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg font-bold text-sm outline-none appearance-none"
                >
                  {platformOptions.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-0.5">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">收款银行卡</label>
                <select 
                  value={newIncome.bank_card || '雪雪卡'} 
                  onChange={e => setNewIncome({...newIncome, bank_card: e.target.value})} 
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg font-bold text-sm outline-none appearance-none"
                >
                  <option value="雪雪卡">雪雪卡</option>
                  <option value="中信卡">中信卡</option>
                  <option value="翕翕卡">翕翕卡</option>
                </select>
              </div>
            </div>
            <div className="p-3.5 bg-slate-50 flex gap-2.5">
              <button onClick={() => setShowIncomeModal(false)} className="flex-1 text-xs font-bold text-slate-400">取消</button>
              <button 
                onClick={handleSaveIncome} 
                disabled={isSaving}
                className="flex-[2] py-2.5 bg-emerald-600 text-white text-xs font-black rounded-lg shadow-lg active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isSaving ? <><RefreshCw className="animate-spin" size={12} /> 保存中...</> : '入库并记账'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Finance;
