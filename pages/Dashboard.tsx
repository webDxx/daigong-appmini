
import React, { useMemo } from 'react';
import { AppData } from '../types';
import { 
  Package, 
  Truck, 
  DollarSign, 
  AlertTriangle,
  TrendingUp,
  CreditCard,
  Plus,
  Users
} from 'lucide-react';
import { differenceInDays, isBefore } from 'date-fns';

const StatCard = ({ title, value, unit, icon: Icon, colorClass, subText }: any) => (
  <div className="bg-white p-3 lg:p-6 rounded-xl lg:rounded-2xl border border-slate-100 shadow-sm">
    <div className="flex justify-between items-start mb-1.5 lg:mb-4">
      <div className={`p-1.5 lg:p-3 rounded-lg lg:rounded-xl ${colorClass} bg-opacity-10`}>
        <Icon size={16} className={`${colorClass.replace('bg-', 'text-')} lg:w-6 lg:h-6`} />
      </div>
    </div>
    <div className="space-y-0.5">
      <p className="text-[9px] lg:text-sm font-bold text-slate-400 uppercase tracking-wider">{title}</p>
      <div className="flex items-baseline gap-1">
        <span className="text-lg lg:text-2xl font-black text-slate-800">{value}</span>
        <span className="text-[9px] lg:text-sm font-bold text-slate-400">{unit}</span>
      </div>
      {subText && <p className="text-[9px] text-slate-400 mt-0.5 line-clamp-1">{subText}</p>}
    </div>
  </div>
);

const Dashboard: React.FC<{ data: AppData }> = ({ data }) => {
  const stats = useMemo(() => {
    const totalInventory = data.inventory[data.inventory.length - 1]?.balance_quantity || 0;
    const inTransit = data.orders
      .filter(o => ['confirmed', 'producing', 'delivered'].includes(o.order_status))
      .reduce((sum, o) => sum + o.quantity, 0);
    
    const unpaidAmount = data.orders.reduce((sum, o) => sum + (Number(o.total_amount || 0) - Number(o.paid_amount || 0)), 0);
    const totalRevenue = data.incomes.reduce((sum, i) => sum + i.amount, 0);
    const totalPaidExpenditure = data.orders.reduce((sum, o) => sum + (o.paid_amount || 0), 0) + data.transfers.reduce((sum, t) => sum + t.amount, 0);
    const actualProfit = totalRevenue - totalPaidExpenditure;

    return { totalInventory, inTransit, unpaidAmount, actualProfit, totalRevenue };
  }, [data]);

  const delayedOrders = useMemo(() => {
    const today = new Date();
    return data.orders
      .filter(o => {
        if (['received', 'completed', 'cancelled'].includes(o.order_status)) return false;
        if (!o.expected_delivery) return false;
        return isBefore(new Date(o.expected_delivery), today);
      })
      .map(o => {
        const worker = data.workers.find(w => w.id === o.worker_id);
        const delay = differenceInDays(today, new Date(o.expected_delivery!));
        return { ...o, workerName: worker?.name, delay };
      });
  }, [data]);

  return (
    <div className="space-y-4 lg:space-y-8 pb-4">
      <div>
        <h2 className="text-xl lg:text-2xl font-black text-slate-800 tracking-tight">业务看板</h2>
        <p className="text-[10px] lg:text-sm text-slate-500 font-medium">代工数据实时概览。</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 lg:gap-6">
        <StatCard 
          title="当前库存" 
          value={stats.totalInventory} 
          unit="条" 
          icon={Package} 
          colorClass="bg-blue-600"
          subText={`在途: ${stats.inTransit}`}
        />
        <StatCard 
          title="累计利润" 
          value={stats.actualProfit.toFixed(0)} 
          unit="元" 
          icon={TrendingUp} 
          colorClass="bg-emerald-600"
          subText={`营收: ¥${stats.totalRevenue.toFixed(0)}`}
        />
        <StatCard 
          title="待付工费" 
          value={stats.unpaidAmount.toFixed(0)} 
          unit="元" 
          icon={CreditCard} 
          colorClass="bg-rose-600"
        />
        <StatCard 
          title="签约工人" 
          value={data.workers.length} 
          unit="位" 
          icon={Users} 
          colorClass="bg-indigo-600"
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-3 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
          <h3 className="font-bold text-slate-800 text-[11px] flex items-center gap-2">
            <AlertTriangle className="text-rose-500" size={14} />
            延期预警 ({delayedOrders.length})
          </h3>
        </div>
        <div className="divide-y divide-slate-50">
          {delayedOrders.length > 0 ? (
            delayedOrders.slice(0, 5).map(order => (
              <div key={order.order_no} className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-rose-50 rounded-lg flex items-center justify-center text-rose-500">
                    <Truck size={16} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 text-[11px]">{order.workerName} <span className="text-slate-400 font-normal">({order.quantity}条)</span></p>
                    <p className="text-[9px] text-slate-400 font-mono">{order.order_no}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-rose-500">延期 {order.delay} 天</p>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-slate-300 text-[10px] font-bold uppercase tracking-widest">
              暂无延期
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 lg:hidden">
          <QuickAction icon={Plus} label="建单" to="/orders" color="bg-blue-600" />
          <QuickAction icon={Users} label="增人" to="/workers" color="bg-indigo-600" />
          <QuickAction icon={TrendingUp} label="记账" to="/finance" color="bg-emerald-600" />
          <QuickAction icon={Package} label="仓库" to="/inventory" color="bg-indigo-600" />
      </div>
    </div>
  );
};

const QuickAction = ({ icon: Icon, label, to, color }: any) => (
  <a href={`#${to}`} className="flex flex-col items-center gap-1.5 p-2.5 bg-white border border-slate-100 rounded-xl active:scale-95 transition-all">
    <div className={`w-8 h-8 ${color} text-white rounded-lg flex items-center justify-center shadow-md`}>
      <Icon size={16} />
    </div>
    <span className="text-[9px] font-black text-slate-600">{label}</span>
  </a>
);

export default Dashboard;
