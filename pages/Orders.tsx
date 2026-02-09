
import React, { useState, useMemo } from 'react';
import { AppData, Order, OrderStatus } from '../types';
import { db, loadDataFromServer, supabase } from '../db';
import Pagination from '../components/Pagination';
import { 
  Plus, 
  CheckCircle2, 
  X, 
  Clock, 
  Calendar, 
  RefreshCw, 
  Edit3, 
  Loader2,
  Trash2,
  TrendingUp,
  Users as UsersIcon,
  Filter,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

const Orders: React.FC<{ data: AppData; updateData: (fn: (d: AppData) => AppData) => void }> = ({ data, updateData }) => {
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusUpdatingNo, setStatusUpdatingNo] = useState<string | null>(null);
  const [deletingNo, setDeletingNo] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  
  // 筛选条件
  const [filterWorker, setFilterWorker] = useState<number | ''>('');
  const [filterType, setFilterType] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterDateStart, setFilterDateStart] = useState<string>('');
  const [filterDateEnd, setFilterDateEnd] = useState<string>('');
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const initialOrder: Partial<Order> = {
    order_date: new Date().toISOString().split('T')[0],
    expected_delivery: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    quantity: 100,
    unit_price: 0,
    order_status: 'confirmed',
    payment_status: 'unpaid',
    paid_amount: 0,
    remarks: '完整',
    bank_card: '雪雪卡'
  };

  const [newOrder, setNewOrder] = useState<Partial<Order>>(initialOrder);

  // 计算下周预计收货统计
  const nextWeekStats = useMemo(() => {
    const today = new Date();
    const nextWeekEnd = new Date(today.getTime() + 7 * 86400000);
    
    const nextWeekOrders = data.orders.filter(o => {
      if (!o.expected_delivery || o.order_status === 'received' || o.order_status === 'completed') return false;
      const deliveryDate = new Date(o.expected_delivery);
      return deliveryDate >= today && deliveryDate <= nextWeekEnd;
    });
    
    const totalQuantity = nextWeekOrders.reduce((sum, o) => sum + o.quantity, 0);
    const uniqueWorkers = new Set(nextWeekOrders.map(o => o.worker_id));
    
    return {
      quantity: totalQuantity,
      workerCount: uniqueWorkers.size,
      orders: nextWeekOrders
    };
  }, [data.orders]);

  // 订单筛选和排序
  const sortedOrders = useMemo(() => {
    const today = new Date();
    const nextWeekEnd = new Date(today.getTime() + 7 * 86400000);
    
    // 先筛选
    let filtered = [...data.orders];
    
    if (filterWorker) {
      filtered = filtered.filter(o => o.worker_id === filterWorker);
    }
    
    if (filterType) {
      filtered = filtered.filter(o => o.remarks === filterType);
    }
    
    if (filterStatus) {
      filtered = filtered.filter(o => o.order_status === filterStatus);
    }
    
    if (filterDateStart) {
      filtered = filtered.filter(o => o.order_date >= filterDateStart);
    }
    
    if (filterDateEnd) {
      filtered = filtered.filter(o => o.order_date <= filterDateEnd);
    }
    
    // 再排序
    return filtered.sort((a, b) => {
      // 已完成的排在最后
      if (a.order_status === 'received' && b.order_status !== 'received') return 1;
      if (b.order_status === 'received' && a.order_status !== 'received') return -1;
      
      // 都是未完成的订单，按预计交货日期排序
      if (a.order_status !== 'received' && b.order_status !== 'received') {
        const aDate = a.expected_delivery ? new Date(a.expected_delivery) : new Date('1970-01-01');
        const bDate = b.expected_delivery ? new Date(b.expected_delivery) : new Date('1970-01-01');
        
        // 下周内的订单优先
        const aIsNextWeek = aDate >= today && aDate <= nextWeekEnd;
        const bIsNextWeek = bDate >= today && bDate <= nextWeekEnd;
        
        if (aIsNextWeek && !bIsNextWeek) return -1;
        if (!aIsNextWeek && bIsNextWeek) return 1;
        
        // 都是下周的，或都不是下周的，按日期倒序排序（最晚的在前）
        return bDate.getTime() - aDate.getTime();
      }
      
      // 都是已完成的订单，按完成日期倒序排序（最晚完成的在前）
      if (a.order_status === 'received' && b.order_status === 'received') {
        const aReceiveDate = a.receive_date ? new Date(a.receive_date) : new Date('1970-01-01');
        const bReceiveDate = b.receive_date ? new Date(b.receive_date) : new Date('1970-01-01');
        return bReceiveDate.getTime() - aReceiveDate.getTime();
      }
      
      return 0;
    });
  }, [data.orders, filterWorker, filterType, filterStatus, filterDateStart, filterDateEnd]);

  // 分页后的订单列表
  const paginatedOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return sortedOrders.slice(startIndex, endIndex);
  }, [sortedOrders, currentPage, itemsPerPage]);

  // 筛选条件变化时重置到第一页
  useMemo(() => {
    setCurrentPage(1);
  }, [filterWorker, filterType, filterStatus, filterDateStart, filterDateEnd]);

  const handleSaveOrder = async () => {
    if (!newOrder.worker_id || !newOrder.quantity) {
        alert("请选择工人并输入数量");
        return;
    }
    if (!newOrder.remarks) {
        alert("请选择手绳类型");
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
   * 删除订单
   */
  const handleDeleteOrder = async (order: Order) => {
    const workerName = data.workers.find(w => w.id === order.worker_id)?.name || '未知工人';
    if (!confirm(`确认删除工人 [${workerName}] 的订单 #${order.order_no} 吗？`)) return;
    
    setDeletingNo(order.order_no);
    try {
      const { error } = await supabase.from('orders').delete().eq('order_no', order.order_no);
      if (error) throw error;
      
      const freshData = await loadDataFromServer();
      updateData(() => freshData);
    } catch (err) {
      console.error("删除订单失败:", err);
      alert("删除失败，请重试");
    } finally {
      setDeletingNo(null);
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
      const now = new Date().toISOString();
      const today = now.split('T')[0];
      
      // 1. 更新订单状态、收货日期（带时分秒），并将待结费用清零
      const orderUpdate: any = { 
        order_status: status, 
        receive_date: now
      };
      
      // 订单完成时，将 paid_amount 设为 total_amount，待结费用自动清零
      if (status === 'received' || status === 'completed') {
        orderUpdate.paid_amount = order.total_amount;
      }
      
      const orderResult = await supabase
        .from('orders')
        .update(orderUpdate)
        .eq('order_no', order.order_no)
        .select();
      
      if (orderResult.error) {
        console.error("订单状态更新失败:", orderResult.error);
        throw orderResult.error;
      }
      
      // 2. 联动库存：如果是收货操作，自动生成库存入库记录
      if (status === 'received') {
        const itemType = order.remarks || '完整'; // 获取订单的手绳类型
        
        // 从数据库获取该类型的最新库存余额，确保数据准确
        const { data: latestInventory } = await supabase
          .from('inventory')
          .select('balance_quantity, item_type')
          .eq('item_type', itemType)
          .order('id', { ascending: false })
          .limit(1);
        
        const lastBalance = latestInventory && latestInventory.length > 0
          ? latestInventory[0].balance_quantity
          : 0;
        
        const invResult = await db.addInventoryRecord({
          transaction_date: today,
          transaction_type: 'in',
          quantity_change: order.quantity,
          balance_quantity: lastBalance + order.quantity,
          related_order: order.order_no,
          item_type: itemType,
          remarks: `代工收货: ${workerName}`
        });
        
        if (invResult.error) {
          console.error("库存记录失败:", invResult.error);
          throw invResult.error;
        }
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
    <div className="space-y-2 lg:space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg lg:text-xl font-black text-slate-800 tracking-tight">流水线</h2>
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Production Pipeline</p>
        </div>
        <button 
          onClick={() => { setIsEditMode(false); setNewOrder(initialOrder); setShowOrderModal(true); }}
          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg font-bold shadow-lg text-xs active:scale-95 transition-all"
        >
          <Plus size={12} />
          新下订单
        </button>
      </div>

      {/* 下周预计收货统计 */}
      {nextWeekStats.quantity > 0 && (
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-3 rounded-lg shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                <TrendingUp className="text-white" size={16} />
              </div>
              <div>
                <p className="text-[8px] text-white/70 font-bold uppercase tracking-widest">下周预计收货</p>
                <p className="text-white font-black text-base">{nextWeekStats.quantity} 条</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                <UsersIcon className="text-white" size={16} />
              </div>
              <div>
                <p className="text-[8px] text-white/70 font-bold uppercase tracking-widest">涉及工人</p>
                <p className="text-white font-black text-base">{nextWeekStats.workerCount} 位</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 筛选条件 */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
        <div 
          className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-slate-50 transition-colors"
          onClick={() => setShowFilters(!showFilters)}
        >
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-slate-400" />
            <span className="text-xs font-bold text-slate-600">筛选订单</span>
            {(filterWorker || filterType || filterStatus || filterDateStart || filterDateEnd) && (
              <span className="text-[9px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-bold">
                已启用
              </span>
            )}
          </div>
          {showFilters ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
        </div>
        
        {showFilters && (
          <div className="px-3 pb-3 border-t border-slate-100">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-3">
              <div>
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1 block mb-1">工人</label>
                <select
                  value={filterWorker}
                  onChange={(e) => setFilterWorker(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none"
                >
                  <option value="">全部工人</option>
                  {data.workers.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1 block mb-1">类型</label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none"
                >
                  <option value="">全部类型</option>
                  <option value="完整">完整</option>
                  <option value="主绳">主绳</option>
                  <option value="线圈">线圈</option>
                </select>
              </div>
              
              <div>
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1 block mb-1">状态</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none"
                >
                  <option value="">全部状态</option>
                  <option value="confirmed">已确认</option>
                  <option value="producing">制作中</option>
                  <option value="delivered">已交付</option>
                  <option value="received">已完成</option>
                </select>
              </div>
              
              <div className="col-span-2 lg:col-span-1">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1 block mb-1">时间区间</label>
                <div className="flex gap-1">
                  <input
                    type="date"
                    value={filterDateStart}
                    onChange={(e) => setFilterDateStart(e.target.value)}
                    className="flex-1 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold outline-none"
                    placeholder="开始"
                  />
                  <input
                    type="date"
                    value={filterDateEnd}
                    onChange={(e) => setFilterDateEnd(e.target.value)}
                    className="flex-1 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold outline-none"
                    placeholder="结束"
                  />
                </div>
              </div>
            </div>
            
            {(filterWorker || filterType || filterStatus || filterDateStart || filterDateEnd) && (
              <button
                onClick={() => {
                  setFilterWorker('');
                  setFilterType('');
                  setFilterStatus('');
                  setFilterDateStart('');
                  setFilterDateEnd('');
                }}
                className="mt-2 text-[10px] text-slate-400 hover:text-blue-600 font-bold"
              >
                清除筛选
              </button>
            )}
          </div>
        )}
      </div>

      {/* 订单动态列表 */}
      <div className="bg-white rounded-lg border border-slate-100 shadow-sm overflow-hidden">
        <div className="space-y-2 p-2">
          {paginatedOrders.length > 0 ? paginatedOrders.map(order => {
          const isNextWeek = (() => {
            if (!order.expected_delivery || order.order_status === 'received') return false;
            const today = new Date();
            const nextWeekEnd = new Date(today.getTime() + 7 * 86400000);
            const deliveryDate = new Date(order.expected_delivery);
            return deliveryDate >= today && deliveryDate <= nextWeekEnd;
          })();
          
          return (
          <div key={order.order_no} className={`bg-white p-2.5 rounded-lg border transition-all ${order.order_status === 'received' ? 'border-slate-100 opacity-60' : isNextWeek ? 'border-blue-300 shadow-md ring-1 ring-blue-100' : 'border-blue-100 shadow-sm'}`}>
            <div className="flex justify-between items-start mb-1.5">
              <div className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${order.order_status === 'received' ? 'bg-slate-300' : isNextWeek ? 'bg-blue-500 animate-pulse' : 'bg-blue-500 animate-pulse'}`}></div>
                <span className="text-[11px] font-black text-slate-800">
                  {data.workers.find(w => w.id === order.worker_id)?.name || '未知工人'}
                </span>
                {order.order_status === 'received' && (
                  <span className="text-[7px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded font-bold uppercase tracking-widest">已完成</span>
                )}
                {isNextWeek && order.order_status !== 'received' && (
                  <span className="text-[7px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-bold uppercase tracking-widest">下周交付</span>
                )}
              </div>
              <div className="text-[8px] font-mono text-slate-300 tracking-tight">#{order.order_no}</div>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-1.5">
              <div className="flex flex-col">
                <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">代工总量</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-sm font-black text-slate-800">{order.quantity}</span>
                  <span className="text-[8px] font-normal text-slate-400">条</span>
                  {order.remarks && (
                    <span className="text-[8px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded font-bold">
                      {order.remarks}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-col text-center">
                <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">总工费</span>
                <span className="text-sm font-black text-slate-700">
                  ¥{Number(order.total_amount).toFixed(0)}
                </span>
              </div>
              <div className="flex flex-col text-right">
                <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">待结费用</span>
                <span className={`text-sm font-black ${order.order_status === 'received' ? 'text-slate-400' : 'text-rose-500'}`}>
                  ¥{(Number(order.total_amount) - (order.paid_amount || 0)).toFixed(0)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1.5 border-t border-slate-50">
              <div className="flex flex-col gap-0.5">
                 <div className="flex items-center gap-1 text-[8px] font-bold text-slate-400">
                    <Clock size={9} />
                    <span>下单: {order.order_date}</span>
                 </div>
                 {order.order_status !== 'received' && order.expected_delivery && (
                    <div className="flex items-center gap-1 text-[8px] font-bold text-blue-500">
                       <Calendar size={9} />
                       <span>预计: {order.expected_delivery}</span>
                    </div>
                 )}
                 {order.order_status === 'received' && order.receive_date && (
                    <div className="flex items-center gap-1 text-[8px] font-bold text-emerald-500">
                       <CheckCircle2 size={9} />
                       <span>交付: {order.receive_date}</span>
                    </div>
                 )}
              </div>
              <div className="flex gap-1.5">
                <button 
                  disabled={statusUpdatingNo === order.order_no || deletingNo === order.order_no}
                  onClick={() => { setNewOrder(order); setIsEditMode(true); setShowOrderModal(true); }}
                  className="p-1.5 bg-slate-50 text-slate-400 rounded-lg active:bg-blue-50 active:text-blue-600 transition-colors"
                >
                  <Edit3 size={13} />
                </button>
                <button 
                  disabled={statusUpdatingNo === order.order_no || deletingNo === order.order_no}
                  onClick={() => handleDeleteOrder(order)}
                  title="删除订单"
                  className="p-1.5 bg-rose-50 text-rose-500 rounded-lg active:scale-95 transition-all flex items-center justify-center min-w-[30px]"
                >
                  {deletingNo === order.order_no ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Trash2 size={13} />
                  )}
                </button>
                {order.order_status !== 'received' && (
                  <button 
                    disabled={statusUpdatingNo === order.order_no || deletingNo === order.order_no}
                    onClick={() => handleStatusUpdate(order, 'received')}
                    title="标记为完成收货"
                    className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg active:scale-95 transition-all flex items-center justify-center min-w-[30px]"
                  >
                    {statusUpdatingNo === order.order_no ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={13} />
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
        }) : (
          <div className="py-8 text-center text-slate-300 text-[9px] font-bold uppercase tracking-widest">暂无活跃订单</div>
        )}
        </div>
        {sortedOrders.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalItems={sortedOrders.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
          />
        )}
      </div>

      {/* 弹窗详情 */}
      {showOrderModal && (
        <div className="fixed inset-0 z-[100] flex items-end lg:items-center justify-center bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-t-[1.5rem] lg:rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 duration-500">
            <div className="p-3.5 border-b border-slate-50 flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-800">{isEditMode ? '修改订单信息' : '新下代工单'}</h3>
              <button onClick={() => setShowOrderModal(false)} className="p-1 text-slate-300"><X size={18} /></button>
            </div>
            <div className="p-3.5 space-y-3 max-h-[75vh] overflow-y-auto">
              <div className="space-y-0.5">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">执行工人</label>
                <select 
                  value={newOrder.worker_id || ''} 
                  onChange={e => {
                    const id = parseInt(e.target.value);
                    const w = data.workers.find(x => x.id === id);
                    setNewOrder({...newOrder, worker_id: id, unit_price: w?.unit_price || 0});
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg font-bold text-sm outline-none appearance-none"
                >
                  <option value="">点击指派工人</option>
                  {data.workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-0.5">
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">下单日期</label>
                  <input 
                    type="date" 
                    value={newOrder.order_date || ''} 
                    onChange={e => setNewOrder({...newOrder, order_date: e.target.value})} 
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg font-bold text-[10px] outline-none" 
                  />
                </div>
                <div className="space-y-0.5">
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">预计交货</label>
                  <input 
                    type="date" 
                    value={newOrder.expected_delivery || ''} 
                    onChange={e => setNewOrder({...newOrder, expected_delivery: e.target.value})} 
                    className="w-full px-3 py-2 bg-blue-50 border border-blue-50 text-blue-600 rounded-lg font-bold text-[10px] outline-none" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-0.5">
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">代工数量</label>
                  <input type="number" value={newOrder.quantity || ''} onChange={e => setNewOrder({...newOrder, quantity: parseInt(e.target.value)})} className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg font-black text-sm outline-none" />
                </div>
                <div className="space-y-0.5">
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">工价 (元/条)</label>
                  <input type="number" step="0.1" value={newOrder.unit_price || ''} onChange={e => setNewOrder({...newOrder, unit_price: parseFloat(e.target.value)})} className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg font-black text-sm outline-none" />
                </div>
              </div>

              <div className="space-y-0.5">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">已付工费 (元)</label>
                <input type="number" step="0.1" value={newOrder.paid_amount || 0} onChange={e => setNewOrder({...newOrder, paid_amount: parseFloat(e.target.value)})} className="w-full px-3 py-2 bg-emerald-50 border border-emerald-50 text-emerald-600 rounded-lg font-black text-sm outline-none" />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-0.5">
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">手绳类型 <span className="text-rose-500">*</span></label>
                  <select 
                    value={newOrder.remarks || '完整'} 
                    onChange={e => setNewOrder({...newOrder, remarks: e.target.value})} 
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg font-bold text-sm outline-none appearance-none"
                    required
                  >
                    <option value="完整">完整</option>
                    <option value="主绳">主绳</option>
                    <option value="线圈">线圈</option>
                  </select>
                </div>
                <div className="space-y-0.5">
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">支付银行卡 <span className="text-rose-500">*</span></label>
                  <select 
                    value={newOrder.bank_card || '雪雪卡'} 
                    onChange={e => setNewOrder({...newOrder, bank_card: e.target.value})} 
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg font-bold text-sm outline-none appearance-none"
                    required
                  >
                    <option value="雪雪卡">雪雪卡</option>
                    <option value="中信卡">中信卡</option>
                    <option value="翕翕卡">翕翕卡</option>
                  </select>
                </div>
              </div>

              <div className="p-2.5 bg-slate-900 rounded-lg text-white flex justify-between items-center">
                 <div>
                    <p className="text-[7px] text-slate-500 font-bold uppercase tracking-widest">应付合计</p>
                    <p className="text-sm font-black text-blue-400">¥{totalCalc.toFixed(1)}</p>
                 </div>
                 <div className="text-right">
                    <p className="text-[7px] text-slate-500 font-bold uppercase tracking-widest">待结欠款</p>
                    <p className="text-sm font-black text-rose-400">¥{unpaidCalc.toFixed(1)}</p>
                 </div>
              </div>
            </div>
            <div className="p-3.5 bg-slate-50 flex gap-2.5">
              <button onClick={() => setShowOrderModal(false)} className="flex-1 py-2.5 text-slate-400 font-bold text-xs uppercase tracking-widest">取消</button>
              <button onClick={handleSaveOrder} disabled={isSaving} className="flex-[2] py-2.5 bg-blue-600 text-white font-black rounded-lg shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 text-xs">
                {isSaving ? <RefreshCw className="animate-spin" size={12} /> : '提交保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;
