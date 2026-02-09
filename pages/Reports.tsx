
import React, { useMemo } from 'react';
import { AppData } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { TrendingUp, Users, Package, Award, LayoutGrid, PieChart as PieIcon, Landmark } from 'lucide-react';

const Reports: React.FC<{ data: AppData }> = ({ data }) => {
  // 工人表现统计
  const workerPerformance = useMemo(() => {
    return data.workers.map(w => {
      const orders = data.orders.filter(o => o.worker_id === w.id);
      const totalQty = orders.reduce((sum, o) => sum + o.quantity, 0);
      const completedQty = orders.filter(o => ['received', 'completed'].includes(o.order_status)).reduce((sum, o) => sum + o.quantity, 0);
      return {
        name: w.name,
        total: totalQty,
        completed: completedQty,
        orderCount: orders.length,
        completionRate: totalQty > 0 ? Math.round((completedQty / totalQty) * 100) : 0
      };
    }).sort((a, b) => b.total - a.total);
  }, [data]);

  // 销售平台统计
  const platformSales = useMemo(() => {
    const stats: Record<string, number> = {};
    data.incomes.forEach(income => {
        const p = income.platform || '未知平台';
        stats[p] = (stats[p] || 0) + income.amount;
    });
    return Object.entries(stats).map(([name, value]) => ({ name, value }));
  }, [data.incomes]);

  const financialSummary = useMemo(() => {
    const totalPayable = data.orders.reduce((sum, o) => sum + o.total_amount, 0);
    const totalPaid = data.orders.reduce((sum, o) => sum + o.paid_amount, 0);
    const totalIncome = data.incomes.reduce((sum, i) => sum + i.amount, 0);
    return { totalPayable, totalPaid, debt: totalPayable - totalPaid, totalIncome };
  }, [data]);

  const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#6366f1'];

  return (
    <div className="space-y-4 animate-in fade-in duration-700">
      <div>
        <h2 className="text-lg lg:text-xl font-black text-slate-800 tracking-tight">统计中心</h2>
        <p className="text-[9px] text-slate-500">深度剖析生产效能与营收构成</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Platform Sales Pie Chart */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-1.5 mb-4">
            <PieIcon className="text-indigo-500" size={18} />
            <h3 className="font-bold text-slate-800 text-sm">营收渠道构成</h3>
          </div>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={platformSales}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {platformSales.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.05)'}}
                  formatter={(value: number) => [`¥${value.toLocaleString()}`, '销售额']}
                />
                <Legend iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Worker Performance Chart */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-1.5 mb-4">
            <Award className="text-amber-500" size={18} />
            <h3 className="font-bold text-slate-800 text-sm">工人产量贡献</h3>
          </div>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={workerPerformance}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}} 
                  contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.05)'}} 
                />
                <Bar dataKey="total" radius={[8, 8, 0, 0]}>
                  {workerPerformance.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-3 border-b border-slate-100 bg-slate-50/50 flex items-center gap-1.5">
            <LayoutGrid className="text-blue-500" size={14} />
            <h3 className="font-bold text-slate-800 text-sm">工人工作量及产能统计</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/30 text-slate-400 text-[9px] font-black uppercase tracking-widest border-b border-slate-100">
                  <th className="px-3 py-2">工人姓名</th>
                  <th className="px-3 py-2 text-center">累计订单</th>
                  <th className="px-3 py-2 text-center">总生产件数</th>
                  <th className="px-3 py-2 text-center">当前进度</th>
                  <th className="px-3 py-2 text-right">预估工费支出</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {workerPerformance.map(w => {
                   const worker = data.workers.find(item => item.name === w.name);
                   return (
                    <tr key={w.name} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-2 font-bold text-slate-800">{w.name}</td>
                      <td className="px-3 py-2 text-center text-slate-600 font-medium">{w.orderCount} 笔</td>
                      <td className="px-3 py-2 text-center text-slate-900 font-black">{w.total} <span className="text-slate-400 text-[9px] font-normal">条</span></td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-blue-500 h-full rounded-full transition-all duration-1000" style={{width: `${w.completionRate}%`}}></div>
                          </div>
                          <span className="text-[9px] font-black text-slate-400">{w.completionRate}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-black text-slate-900 text-[10px]">
                        ¥{(w.total * (worker?.unit_price || 0)).toLocaleString()}
                      </td>
                    </tr>
                   );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
            <div className="bg-gradient-to-br from-slate-900 to-indigo-950 p-4 rounded-xl text-white shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-125 transition-transform duration-500">
                    <Landmark size={80} />
                </div>
                <div className="relative z-10 space-y-3">
                    <div>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">核心财务漏斗</p>
                        <h4 className="text-2xl font-black">¥{financialSummary.totalIncome.toLocaleString()}</h4>
                        <p className="text-[10px] text-slate-400">累计总销售收入</p>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between items-center text-[10px]">
                            <span className="text-slate-400 font-bold uppercase">已结代工费</span>
                            <span className="font-mono text-emerald-400 font-bold">¥{financialSummary.totalPaid.toLocaleString()}</span>
                        </div>
                        <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-emerald-500 h-full rounded-full" style={{width: `${(financialSummary.totalPaid / (financialSummary.totalPayable || 1) * 100)}%`}}></div>
                        </div>
                        <div className="flex justify-between items-center text-[10px] font-black">
                            <span className="text-slate-400 font-bold uppercase">待结算欠款</span>
                            <span className="text-rose-400 font-mono">¥{financialSummary.debt.toLocaleString()}</span>
                        </div>
                    </div>

                    <div className="pt-3 border-t border-white/10">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">毛利率估算</span>
                            <span className="text-xl font-black text-blue-400">
                                {Math.round(((financialSummary.totalIncome - financialSummary.totalPayable) / (financialSummary.totalIncome || 1)) * 100)}%
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
