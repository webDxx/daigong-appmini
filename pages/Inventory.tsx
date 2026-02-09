
import React, { useState, useMemo } from 'react';
import { AppData, InventoryTransaction } from '../types';
import { db } from '../db';
import Pagination from '../components/Pagination';
import { Package, ArrowDownRight, ArrowUpLeft, Settings2, History, DollarSign, RefreshCw } from 'lucide-react';

const Inventory: React.FC<{ data: AppData; updateData: (fn: (d: AppData) => AppData) => void }> = ({ data, updateData }) => {
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('完整');
  const [newTrans, setNewTrans] = useState<Partial<InventoryTransaction>>({
    transaction_type: 'out',
    transaction_date: new Date().toISOString().split('T')[0],
    item_type: '完整'
  });
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const handleSaveTransaction = async () => {
    if (!newTrans.quantity_change || !newTrans.transaction_type || !newTrans.item_type) {
      alert("请填写完整信息");
      return;
    }
    setIsSaving(true);
    try {
      // 获取该类型的最新余额
      const lastBalanceOfType = [...data.inventory]
        .reverse()
        .find(inv => inv.item_type === newTrans.item_type)?.balance_quantity || 0;
      
      const change = newTrans.transaction_type === 'out' ? -Math.abs(newTrans.quantity_change) : newTrans.quantity_change;
      
      const { data: savedData, error } = await db.addInventoryRecord({
        ...newTrans,
        quantity_change: change,
        balance_quantity: lastBalanceOfType + change,
      });
      if (error) throw error;

      updateData(prev => ({
        ...prev,
        inventory: [...prev.inventory, savedData[0]]
      }));
      setShowAdjustModal(false);
      setNewTrans({ transaction_type: 'out', transaction_date: new Date().toISOString().split('T')[0], item_type: '完整' });
    } catch (err) {
      alert("提交失败: " + (err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  // 分类型计算库存余额
  const inventoryBreakdown = useMemo(() => {
    const breakdown = { complete: 0, mainRope: 0, coil: 0 };
    
    // 分别获取每种类型的最新余额
    const types = ['完整', '主绳', '线圈'];
    types.forEach(type => {
      const lastRecord = [...data.inventory]
        .reverse()
        .find(inv => inv.item_type === type);
      
      if (type === '完整') {
        breakdown.complete = lastRecord?.balance_quantity || 0;
      } else if (type === '主绳') {
        breakdown.mainRope = lastRecord?.balance_quantity || 0;
      } else if (type === '线圈') {
        breakdown.coil = lastRecord?.balance_quantity || 0;
      }
    });
    
    return breakdown;
  }, [data.inventory]);

  const currentBalance = inventoryBreakdown.complete; // 只有完整手绳能销售

  // 筛选后的库存记录
  const filteredInventory = useMemo(() => {
    return [...data.inventory].filter(item => item.item_type === activeTab).reverse();
  }, [data.inventory, activeTab]);

  // 分页后的库存记录
  const paginatedInventory = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredInventory.slice(startIndex, endIndex);
  }, [filteredInventory, currentPage, itemsPerPage]);

  // 切换tab时重置到第一页
  useMemo(() => {
    setCurrentPage(1);
  }, [activeTab]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-lg lg:text-xl font-black text-slate-800 tracking-tight">成品库存</h2>
          <p className="text-[9px] text-slate-500">实时记录出入库变动</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => { setNewTrans({ transaction_type: 'adjust', transaction_date: new Date().toISOString().split('T')[0], quantity_change: 0, item_type: '完整' }); setShowAdjustModal(true); }} 
            className="flex items-center gap-1.5 px-3 py-2 bg-amber-600 text-white rounded-lg font-bold text-xs shadow-lg hover:bg-amber-700 transition-all"
          >
            <Settings2 size={14} /> 库存更正
          </button>
          <button 
            onClick={() => { setNewTrans({ transaction_type: 'out', transaction_date: new Date().toISOString().split('T')[0], item_type: '完整' }); setShowAdjustModal(true); }} 
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-lg font-bold text-xs shadow-lg hover:bg-indigo-700 transition-all"
          >
            <DollarSign size={14} /> 销售出库
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4 pb-3 border-b border-slate-100">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shadow-inner flex-shrink-0">
            <Package size={32} />
          </div>
          <div className="flex-1">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">可销售库存（完整手绳）</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-4xl font-black text-slate-900">{currentBalance}</span>
              <span className="text-base font-bold text-slate-400">条</span>
            </div>
          </div>
        </div>
        <div className="pt-3 grid grid-cols-3 gap-2">
          <div className="bg-slate-50 rounded-lg px-3 py-2">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">完整</p>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-slate-700">{inventoryBreakdown.complete}</span>
              <span className="text-[9px] font-bold text-slate-400">条</span>
            </div>
          </div>
          <div className="bg-amber-50 rounded-lg px-3 py-2">
            <p className="text-[8px] font-black text-amber-600 uppercase tracking-widest mb-0.5">主绳</p>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-amber-700">{inventoryBreakdown.mainRope}</span>
              <span className="text-[9px] font-bold text-amber-400">条</span>
            </div>
          </div>
          <div className="bg-blue-50 rounded-lg px-3 py-2">
            <p className="text-[8px] font-black text-blue-600 uppercase tracking-widest mb-0.5">线圈</p>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-blue-700">{inventoryBreakdown.coil}</span>
              <span className="text-[9px] font-bold text-blue-400">条</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-2.5 border-b border-slate-100 bg-slate-50/50">
           <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5 mb-2">
              <History className="text-indigo-500" size={12} /> 出入库流水
           </h3>
           <div className="flex gap-1">
             {['完整', '主绳', '线圈'].map(tab => (
               <button
                 key={tab}
                 onClick={() => setActiveTab(tab)}
                 className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                   activeTab === tab
                     ? tab === '完整' ? 'bg-slate-600 text-white' :
                       tab === '主绳' ? 'bg-amber-600 text-white' :
                       'bg-blue-600 text-white'
                     : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                 }`}
               >
                 {tab}
               </button>
             ))}
           </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[10px]">
            <thead className="bg-slate-50 text-[8px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100">
              <tr>
                <th className="px-2 py-1.5 whitespace-nowrap">日期</th>
                <th className="px-2 py-1.5 whitespace-nowrap">类型</th>
                <th className="px-2 py-1.5 text-right whitespace-nowrap">变动</th>
                <th className="px-2 py-1.5 text-right whitespace-nowrap">结余</th>
                <th className="px-2 py-1.5">备注</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedInventory.map(item => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-2 py-1.5 text-slate-500 font-mono whitespace-nowrap">{item.transaction_date.slice(5)}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    <span className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase whitespace-nowrap ${
                      item.transaction_type === 'in' ? 'bg-emerald-100 text-emerald-700' : 
                      item.transaction_type === 'out' ? 'bg-indigo-100 text-indigo-700' : 
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {item.transaction_type === 'in' ? '入库' : item.transaction_type === 'out' ? '出库' : '更正'}
                    </span>
                  </td>
                  <td className={`px-2 py-1.5 text-right font-black whitespace-nowrap ${item.quantity_change > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {item.quantity_change > 0 ? '+' : ''}{item.quantity_change}
                  </td>
                  <td className="px-2 py-1.5 text-right font-black text-slate-800 whitespace-nowrap">{item.balance_quantity}</td>
                  <td className="px-2 py-1.5 text-slate-400">
                    {item.related_order && <span className="text-blue-500 font-mono font-bold mr-1 text-[9px]">{item.related_order}</span>}
                    <span className="text-[9px]">{item.remarks}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredInventory.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalItems={filteredInventory.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
          />
        )}
      </div>

      {showAdjustModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-3.5 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-sm font-black text-slate-800">
                {newTrans.transaction_type === 'adjust' ? '库存更正' : '销售出库'}
              </h3>
            </div>
            <div className="p-3.5 space-y-3">
              <div className="space-y-0.5">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">手绳类型 <span className="text-rose-500">*</span></label>
                {newTrans.transaction_type === 'out' ? (
                  <div className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-lg font-bold text-sm text-slate-600">
                    完整（销售出库只能选择完整手绳）
                  </div>
                ) : (
                  <select 
                    value={newTrans.item_type || '完整'} 
                    onChange={e => setNewTrans({...newTrans, item_type: e.target.value})} 
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-sm outline-none appearance-none"
                  >
                    <option value="完整">完整</option>
                    <option value="主绳">主绳</option>
                    <option value="线圈">线圈</option>
                  </select>
                )}
              </div>
              {newTrans.transaction_type === 'adjust' && (
                <div className="space-y-0.5">
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">调整类型</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const absValue = Math.abs(newTrans.quantity_change || 1);
                        setNewTrans({...newTrans, quantity_change: absValue});
                      }}
                      className={`py-2 px-3 rounded-lg font-bold text-xs transition-all ${
                        (newTrans.quantity_change || 0) > 0
                          ? 'bg-emerald-600 text-white shadow-lg'
                          : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      增加库存 +
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const absValue = Math.abs(newTrans.quantity_change || 1);
                        setNewTrans({...newTrans, quantity_change: -absValue});
                      }}
                      className={`py-2 px-3 rounded-lg font-bold text-xs transition-all ${
                        (newTrans.quantity_change || 0) < 0
                          ? 'bg-rose-600 text-white shadow-lg'
                          : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      减少库存 -
                    </button>
                  </div>
                </div>
              )}
              <div className="space-y-0.5">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">
                  {newTrans.transaction_type === 'adjust' ? '调整数量' : '销售数量'}
                </label>
                <div className="relative">
                   <input 
                     type="number" 
                     value={Math.abs(newTrans.quantity_change || 0)} 
                     onChange={e => {
                       const value = parseInt(e.target.value) || 0;
                       if (newTrans.transaction_type === 'adjust') {
                         // 保持正负号
                         setNewTrans({...newTrans, quantity_change: (newTrans.quantity_change || 0) >= 0 ? value : -value});
                       } else {
                         setNewTrans({...newTrans, quantity_change: value});
                       }
                     }} 
                     className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg font-black text-2xl outline-none focus:ring-2 focus:ring-blue-100" 
                   />
                   <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 font-bold text-sm">条</div>
                </div>
                {newTrans.transaction_type === 'adjust' && (
                  <p className="text-[9px] text-slate-500 px-1">
                    当前库存（{newTrans.item_type}）: {
                      newTrans.item_type === '完整' ? inventoryBreakdown.complete :
                      newTrans.item_type === '主绳' ? inventoryBreakdown.mainRope :
                      inventoryBreakdown.coil
                    } 条，
                    更正后: {
                      (newTrans.item_type === '完整' ? inventoryBreakdown.complete :
                       newTrans.item_type === '主绳' ? inventoryBreakdown.mainRope :
                       inventoryBreakdown.coil) + (newTrans.quantity_change || 0)
                    } 条
                  </p>
                )}
                {newTrans.transaction_type === 'out' && (
                  <p className="text-[9px] text-slate-500 px-1">
                    当前库存（完整）: {inventoryBreakdown.complete} 条
                  </p>
                )}
              </div>
              <div className="space-y-0.5">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">备注说明</label>
                <input 
                  type="text" 
                  value={newTrans.remarks || ''} 
                  onChange={e => setNewTrans({...newTrans, remarks: e.target.value})} 
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-sm outline-none" 
                  placeholder={newTrans.transaction_type === 'adjust' ? '如：盘点更正' : '如：微信销售'} 
                />
              </div>
            </div>
            <div className="p-3.5 bg-slate-50 flex gap-2.5">
              <button onClick={() => setShowAdjustModal(false)} className="flex-1 py-2 text-xs font-bold text-slate-500">取消</button>
              <button 
                onClick={handleSaveTransaction} 
                disabled={isSaving || !newTrans.quantity_change} 
                className="flex-[2] py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg shadow-lg hover:bg-indigo-700 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isSaving && <RefreshCw className="animate-spin" size={14} />}
                确认提交
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
