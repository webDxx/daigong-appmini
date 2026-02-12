
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AppData } from '../types';
import { 
  Package, 
  Truck, 
  DollarSign, 
  AlertTriangle,
  TrendingUp,
  CreditCard,
  Plus,
  Users,
  BarChart2
} from 'lucide-react';
import { differenceInDays, isBefore } from 'date-fns';

const StatCard = ({ title, value, unit, icon: Icon, colorClass, subText, to }: any) => (
  <Link to={to} className="bg-white p-2 lg:p-3 rounded-lg border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all active:scale-95 cursor-pointer">
    <div className="flex justify-between items-start mb-1">
      <div className={`p-1 lg:p-1.5 rounded-md ${colorClass} bg-opacity-10`}>
        <Icon size={14} className={`${colorClass.replace('bg-', 'text-')} lg:w-5 lg:h-5`} />
      </div>
    </div>
    <div className="space-y-0.5">
      <p className="text-[8px] lg:text-[10px] font-bold text-slate-400 uppercase tracking-wider">{title}</p>
      <div className="flex items-baseline gap-0.5">
        <span className="text-base lg:text-lg font-black text-slate-800">{value}</span>
        <span className="text-[8px] lg:text-[10px] font-bold text-slate-400">{unit}</span>
      </div>
      {subText && <p className="text-[8px] text-slate-400 line-clamp-1">{subText}</p>}
    </div>
  </Link>
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
    const totalOtherExpenses = data.expenses.reduce((sum, e) => sum + e.amount, 0);
    const actualProfit = totalRevenue - totalPaidExpenditure - totalOtherExpenses;

    return { totalInventory, inTransit, unpaidAmount, actualProfit, totalRevenue };
  }, [data]);

  // 三张卡的进出账统计
  const bankCardStats = useMemo(() => {
    const cards = ['雪雪卡', '中信卡', '翕翕卡'];
    return cards.map(card => {
      // 收入：销售收入
      const income = data.incomes
        .filter(i => i.bank_card === card)
        .reduce((sum, i) => sum + i.amount, 0);
      
      // 支出：订单已付工费 + 其他支出
      const orderExpenditure = data.orders
        .filter(o => o.bank_card === card)
        .reduce((sum, o) => sum + (o.paid_amount || 0), 0);
      
      const otherExpenditure = data.expenses
        .filter(e => e.bank_card === card)
        .reduce((sum, e) => sum + e.amount, 0);
      
      const expenditure = orderExpenditure + otherExpenditure;
      const balance = income - expenditure;
      
      return { card, income, expenditure, balance };
    });
  }, [data.incomes, data.orders, data.expenses]);

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

  // 工人产量统计
  const workerStats = useMemo(() => {
    return data.workers.slice(0, 5).map(w => {
      const totalQty = data.orders
        .filter(o => o.worker_id === w.id)
        .reduce((sum, o) => sum + o.quantity, 0);
      return { name: w.name, value: totalQty };
    }).sort((a, b) => b.value - a.value);
  }, [data]);

  // 各销售渠道收入统计
  const platformStats = useMemo(() => {
    const stats: Record<string, number> = {};
    data.incomes.forEach(income => {
      const platform = income.platform || '未知';
      stats[platform] = (stats[platform] || 0) + income.amount;
    });
    
    return Object.entries(stats)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [data.incomes]);

  return (
    <div className="space-y-2 lg:space-y-4 pb-4">
      <div>
        <h2 className="text-lg lg:text-xl font-black text-slate-800 tracking-tight">业务看板</h2>
        <p className="text-[9px] lg:text-[10px] text-slate-500 font-medium">代工数据实时概览</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-3">
        <StatCard 
          title="当前库存" 
          value={stats.totalInventory} 
          unit="条" 
          icon={Package} 
          colorClass="bg-blue-600"
          subText={`在途: ${stats.inTransit}`}
          to="/inventory"
        />
        <StatCard 
          title="累计利润" 
          value={stats.actualProfit.toFixed(0)} 
          unit="元" 
          icon={TrendingUp} 
          colorClass="bg-emerald-600"
          subText={`营收: ¥${stats.totalRevenue.toFixed(0)}`}
          to="/finance"
        />
        <StatCard 
          title="待付工费" 
          value={stats.unpaidAmount.toFixed(0)} 
          unit="元" 
          icon={CreditCard} 
          colorClass="bg-rose-600"
          to="/orders"
        />
        <StatCard 
          title="签约工人" 
          value={data.workers.length} 
          unit="位" 
          icon={Users} 
          colorClass="bg-indigo-600"
          to="/workers"
        />
      </div>

      <div className="bg-white rounded-lg border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-2 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
          <h3 className="font-bold text-slate-800 text-[10px] flex items-center gap-1.5">
            <AlertTriangle className="text-rose-500" size={12} />
            延期预警 ({delayedOrders.length})
          </h3>
        </div>
        <div className="divide-y divide-slate-50">
          {delayedOrders.length > 0 ? (
            delayedOrders.slice(0, 5).map(order => (
              <div key={order.order_no} className="p-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-rose-50 rounded-lg flex items-center justify-center text-rose-500">
                    <Truck size={14} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 text-[10px]">{order.workerName} <span className="text-slate-400 font-normal">({order.quantity}条)</span></p>
                    <p className="text-[8px] text-slate-400 font-mono">{order.order_no}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-bold text-rose-500">延期 {order.delay} 天</p>
                </div>
              </div>
            ))
          ) : (
            <div className="p-6 text-center text-slate-300 text-[9px] font-bold uppercase tracking-widest">
              暂无延期
            </div>
          )}
        </div>
      </div>

      {/* 数据看板 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        {/* 销售渠道收入对比 */}
        <div className="bg-white rounded-lg border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-2 border-b border-slate-50 bg-slate-50/30 flex justify-between items-center">
            <h3 className="font-bold text-slate-800 text-[10px] flex items-center gap-1.5">
              <BarChart2 className="text-emerald-500" size={12} />
              销售渠道收入
            </h3>
            <span className="text-[8px] text-slate-400 font-bold">累计总额</span>
          </div>
          <div className="p-2 space-y-1.5">
            {platformStats.length > 0 ? platformStats.map((item, idx) => {
              const maxAmount = Math.max(...platformStats.map(i => i.amount), 1);
              const widthPercent = (item.amount / maxAmount) * 100;
              const colors = [
                { bg: 'bg-blue-500', text: 'text-blue-600' },
                { bg: 'bg-emerald-500', text: 'text-emerald-600' },
                { bg: 'bg-purple-500', text: 'text-purple-600' },
                { bg: 'bg-amber-500', text: 'text-amber-600' },
                { bg: 'bg-rose-500', text: 'text-rose-600' }
              ];
              const color = colors[idx % colors.length];
              return (
                <div key={idx} className="flex items-center gap-2">
                  <div className="text-[9px] font-black text-slate-400 w-4">{idx + 1}</div>
                  <div className="text-[10px] font-bold text-slate-700 min-w-[70px] flex-shrink-0">{item.name}</div>
                  <div className="flex-1 bg-slate-100 h-5 rounded-full overflow-hidden">
                    <div 
                      className={`${color.bg} h-full rounded-full transition-all flex items-center justify-end pr-2`}
                      style={{ width: `${Math.max(widthPercent, 10)}%` }}
                    >
                      <span className="text-[8px] text-white font-bold whitespace-nowrap">
                        {widthPercent >= 20 ? `¥${item.amount.toFixed(0)}` : ''}
                      </span>
                    </div>
                  </div>
                  <div className={`text-[10px] font-black ${color.text} min-w-[50px] text-right`}>
                    ¥{item.amount.toFixed(0)}
                  </div>
                </div>
              );
            }) : (
              <div className="w-full text-center py-6 text-slate-300 text-[9px] font-bold">暂无收入数据</div>
            )}
          </div>
        </div>

        {/* 工人产量TOP5 */}
        <div className="bg-white rounded-lg border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-2 border-b border-slate-50 bg-slate-50/30">
            <h3 className="font-bold text-slate-800 text-[10px] flex items-center gap-1.5">
              <Users className="text-indigo-500" size={12} />
              工人产量 TOP5
            </h3>
          </div>
          <div className="p-2 space-y-1.5">
            {workerStats.map((worker, idx) => {
              const maxValue = Math.max(...workerStats.map(w => w.value), 1);
              const widthPercent = (worker.value / maxValue) * 100;
              return (
                <div key={idx} className="flex items-center gap-2">
                  <div className="text-[9px] font-black text-slate-400 w-4">{idx + 1}</div>
                  <div className="text-[10px] font-bold text-slate-700 w-16 truncate">{worker.name}</div>
                  <div className="flex-1 bg-slate-100 h-4 rounded-full overflow-hidden">
                    <div 
                      className="bg-indigo-500 h-full rounded-full transition-all"
                      style={{ width: `${widthPercent}%` }}
                    ></div>
                  </div>
                  <div className="text-[9px] font-black text-slate-600 w-12 text-right">{worker.value} 条</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

     
    </div>
  );
};

export default Dashboard;
