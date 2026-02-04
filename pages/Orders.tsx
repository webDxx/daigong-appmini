
import React, { useState } from 'react';
import { AppData, Order, OrderStatus } from '../types';
import { db, loadDataFromServer } from '../db';
import { parseMultimodalChat } from '../geminiService';
import { 
  Plus, 
  CheckCircle2, 
  X, 
  Clock, 
  Calendar, 
  RefreshCw, 
  MessageSquare, 
  Sparkles, 
  Upload, 
  Edit3, 
  Loader2 
} from 'lucide-react';

const Orders: React.FC<{ data: AppData; updateData: (fn: (d: AppData) => AppData) => void }> = ({ data, updateData }) => {
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  // 记录正在更新状态的订单号
  const [statusUpdatingNo, setStatusUpdatingNo] = useState<string | null>(null);
  const [aiInput, setAiInput] = useState('');
  const [aiFiles, setAiFiles] = useState<File[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);

  const initialOrder: Partial<Order> = {
    order_date: new Date().toISOString().split('T')[0],
    expected_delivery: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    quantity: 100,
    unit_price: 0,
    order_status: 'confirmed',
    payment_status: 'unpaid',
    paid_amount: 0
  };

  const [newOrder, setNewOrder] = useState<Partial<Order>>(initialOrder);

  const handleAIScan = async () => {
    if (!aiInput && aiFiles.length === 0) return;
    setIsAIProcessing(true);
    try {
      const result = await parseMultimodalChat(aiFiles, aiInput);
      if (result) {
        const worker = data.workers.find(w => 
          w.name.includes(result.worker_name) || 
          (result.worker_name && result.worker_name.includes(w.name))
        );

        setNewOrder(prev => ({
          ...prev,
          quantity: result.quantity || prev.quantity,
          unit_price: result.unit_price || (worker?.unit_price) || 0,
          expected_delivery: result.expected_delivery || prev.expected_delivery,
          worker_id: worker?.id,
          remarks: result.remarks
        }));
        setAiInput('');
        setAiFiles([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsAIProcessing(false);
    }
  };

  const handleSaveOrder = async () => {
    if (!newOrder.worker_id || !newOrder.quantity) {
        alert("请选择工人并输入数量");
        return;
    }
    
    setIsSaving(true);
    try {
      if (isEditMode && newOrder.order_no) {
        await db.updateOrder(newOrder);
      } else {
        await db.createOrder(newOrder);
      }
      
      const freshData = await loadDataFromServer();
      updateData(() => freshData);
      setShowOrderModal(false);
      setNewOrder(initialOrder);
    } catch (err) {
      alert("订单保存失败");
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * 核心逻辑：更新订单状态并联动库存
   */
  const handleStatusUpdate = async (order: Order, status: OrderStatus) => {
    const workerName = data.workers.find(w => w.id === order.worker_id)?.name || '未知工人';
    
    if (status === 'received' && !confirm(`确认已收到工人 [${workerName}] 交付的 ${order.quantity} 条手绳并入库吗？`)) return;
    
    setStatusUpdatingNo(order.order_no);
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // 1. 更新订单状态和收货日期
      const { error: orderError } = await db.updateOrderStatus(order.order_no, status, today);
      if (orderError) throw orderError;
      
      // 2. 联动库存：如果是收货操作，自动生成库存入库记录
      if (status === 'received') {
        const lastBalance = data.inventory.length > 0 
          ? data.inventory[data.inventory.length - 1].balance_quantity 
          : 0;
        
        const { error: invError } = await db.addInventoryRecord({
          transaction_date: today,
          transaction_type: 'in',
          quantity_change: order.quantity,
          balance_quantity: lastBalance + order.quantity,
          related_order: order.order_no,
          remarks: `代工收货: ${workerName}`
        });
        if (invError) throw invError;
      }

      // 3. 全局刷新，确保全站数据同步
      const freshData = await loadDataFromServer();
      updateData(() => freshData);
      
    } catch (err) {
      console.error("更新状态失败:", err);
      alert("操作失败，请重试");
    } finally {
      setStatusUpdatingNo(null);
    }
  };

  const totalCalc = (newOrder.quantity || 0) * (newOrder.unit_price || 0);
  const unpaidCalc = totalCalc - (newOrder.paid_amount || 0);

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex justify-between items-center px-1">
        <div>
          <h2 className="text-xl lg:text-2xl font-black text-slate-800 tracking-tight">流水线</h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Production Pipeline</p>
        </div>
        <button 
          onClick={() => { setIsEditMode(false); setNewOrder(initialOrder); setShowOrderModal(true); }}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold shadow-lg text-xs active:scale-95 transition-all"
        >
          <Plus size={14} />
          新下订单
        </button>
      </div>

      {/* AI 录入区域 */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-3 rounded-2xl shadow-lg flex flex-col gap-2">
        <div className="relative">
          <textarea 
            placeholder="粘贴微信记录快速录入..." 
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
            className="w-full h-12 pl-9 pr-3 py-2 bg-white/10 text-white placeholder:text-white/40 border border-white/20 rounded-xl outline-none focus:bg-white/20 text-[11px] font-medium transition-all resize-none"
          />
          <Sparkles className="absolute left-2.5 top-2.5 text-blue-200" size={14} />
        </div>
        <div className="flex gap-2">
          <label className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white/10 border border-white/20 text-white rounded-xl text-[10px] font-bold cursor-pointer active:bg-white/20 transition-all">
             <Upload size={12} />
             <span>{aiFiles.length > 0 ? `已选${aiFiles.length}` : '拍照录入'}</span>
             <input type="file" hidden multiple accept="image/*" onChange={(e) => setAiFiles(Array.from(e.target.files || []))} />
          </label>
          <button 
            onClick={handleAIScan}
            disabled={isAIProcessing || (!aiInput && aiFiles.length === 0)}
            className="flex-[2] flex items-center justify-center gap-1.5 px-3 py-2 bg-white text-blue-600 rounded-xl text-[10px] font-black active:scale-95 transition-all disabled:opacity-50"
          >
            {isAIProcessing ? <RefreshCw className="animate-spin" size={12} /> : <MessageSquare size={12} />}
            AI 自动识别
          </button>
        </div>
      </div>

      {/* 订单动态列表 */}
      <div className="space-y-3 pb-4">
        {data.orders.length > 0 ? data.orders.map(order => (
          <div key={order.order_no} className={`bg-white p-3 rounded-xl border transition-all ${order.order_status === 'received' ? 'border-slate-100 opacity-60' : 'border-blue-100 shadow-sm'}`}>
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${order.order_status === 'received' ? 'bg-slate-300' : 'bg-blue-500 animate-pulse'}`}></div>
                <span className="text-[11px] font-black text-slate-800">
                  {data.workers.find(w => w.id === order.worker_id)?.name || '未知工人'}
                </span>
                {order.order_status === 'received' && (
                  <span className="text-[8px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded font-bold uppercase tracking-widest">已完成入库</span>
                )}
              </div>
              <div className="text-[9px] font-mono text-slate-300 tracking-tight">#{order.order_no}</div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-2.5">
              <div className="flex flex-col">
                <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">代工总量</span>
                <span className="text-base font-black text-slate-800">{order.quantity} <small className="text-[9px] font-normal text-slate-400">条</small></span>
              </div>
              <div className="flex flex-col text-right">
                <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">待结费用</span>
                <span className={`text-base font-black ${order.order_status === 'received' ? 'text-slate-400' : 'text-rose-500'}`}>
                  ¥{(Number(order.total_amount) - (order.paid_amount || 0)).toFixed(1)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-50">
              <div className="flex flex-col gap-0.5">
                 <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400">
                    <Clock size={10} />
                    <span>下单: {order.order_date}</span>
                 </div>
                 {order.order_status !== 'received' && (
                    <div className="flex items-center gap-1 text-[9px] font-bold text-blue-500">
                       <Calendar size={10} />
                       <span>预计交期: {order.expected_delivery || '未设置'}</span>
                    </div>
                 )}
                 {order.order_status === 'received' && (
                    <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-500">
                       <CheckCircle2 size={10} />
                       <span>交付日期: {order.receive_date}</span>
                    </div>
                 )}
              </div>
              <div className="flex gap-2">
                <button 
                  disabled={statusUpdatingNo === order.order_no}
                  onClick={() => { setNewOrder(order); setIsEditMode(true); setShowOrderModal(true); }}
                  className="p-1.5 bg-slate-50 text-slate-400 rounded-lg active:bg-blue-50 active:text-blue-600 transition-colors"
                >
                  <Edit3 size={14} />
                </button>
                {/* 完善后的核心图标：完成收货图标 */}
                {order.order_status !== 'received' && (
                  <button 
                    disabled={statusUpdatingNo === order.order_no}
                    onClick={() => handleStatusUpdate(order, 'received')}
                    title="标记为完成收货"
                    className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg active:scale-95 transition-all flex items-center justify-center min-w-[34px] hover:bg-emerald-100"
                  >
                    {statusUpdatingNo === order.order_no ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={14} />
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        )) : (
          <div className="py-12 text-center text-slate-300 text-[10px] font-bold uppercase tracking-widest">暂无活跃订单</div>
        )}
      </div>

      {/* 弹窗详情 */}
      {showOrderModal && (
        <div className="fixed inset-0 z-[100] flex items-end lg:items-center justify-center bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-t-[2rem] lg:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 duration-500">
            <div className="p-5 border-b border-slate-50 flex items-center justify-between">
              <h3 className="text-base font-black text-slate-800">{isEditMode ? '修改订单信息' : '新下代工单'}</h3>
              <button onClick={() => setShowOrderModal(false)} className="p-1 text-slate-300"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">执行工人</label>
                <select 
                  value={newOrder.worker_id || ''} 
                  onChange={e => {
                    const id = parseInt(e.target.value);
                    const w = data.workers.find(x => x.id === id);
                    setNewOrder({...newOrder, worker_id: id, unit_price: w?.unit_price || 0});
                  }}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl font-bold text-sm outline-none appearance-none"
                >
                  <option value="">点击指派工人</option>
                  {data.workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">下单日期</label>
                  <input 
                    type="date" 
                    value={newOrder.order_date || ''} 
                    onChange={e => setNewOrder({...newOrder, order_date: e.target.value})} 
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl font-bold text-[11px] outline-none" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">预计交货</label>
                  <input 
                    type="date" 
                    value={newOrder.expected_delivery || ''} 
                    onChange={e => setNewOrder({...newOrder, expected_delivery: e.target.value})} 
                    className="w-full px-4 py-2.5 bg-blue-50 border border-blue-50 text-blue-600 rounded-xl font-bold text-[11px] outline-none" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">代工数量</label>
                  <input type="number" value={newOrder.quantity || ''} onChange={e => setNewOrder({...newOrder, quantity: parseInt(e.target.value)})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl font-black text-sm outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">工价 (元/条)</label>
                  <input type="number" step="0.1" value={newOrder.unit_price || ''} onChange={e => setNewOrder({...newOrder, unit_price: parseFloat(e.target.value)})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl font-black text-sm outline-none" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">已付工费 (元)</label>
                <input type="number" step="0.1" value={newOrder.paid_amount || 0} onChange={e => setNewOrder({...newOrder, paid_amount: parseFloat(e.target.value)})} className="w-full px-4 py-2.5 bg-emerald-50 border border-emerald-50 text-emerald-600 rounded-xl font-black text-sm outline-none" />
              </div>

              <div className="p-3 bg-slate-900 rounded-xl text-white flex justify-between items-center">
                 <div>
                    <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">应付合计</p>
                    <p className="text-base font-black text-blue-400">¥{totalCalc.toFixed(1)}</p>
                 </div>
                 <div className="text-right">
                    <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">待结欠款</p>
                    <p className="text-base font-black text-rose-400">¥{unpaidCalc.toFixed(1)}</p>
                 </div>
              </div>
            </div>
            <div className="p-5 bg-slate-50 flex gap-3">
              <button onClick={() => setShowOrderModal(false)} className="flex-1 py-3 text-slate-400 font-bold text-xs uppercase tracking-widest">取消</button>
              <button onClick={handleSaveOrder} disabled={isSaving} className="flex-[2] py-3 bg-blue-600 text-white font-black rounded-xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 text-xs">
                {isSaving ? <RefreshCw className="animate-spin" size={14} /> : '提交保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;
