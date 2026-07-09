
import React, { useState, useMemo } from 'react';
import { AppData, IncomeRecord, ExpenseRecord } from '../types';
import { db, loadDataFromServer, supabase } from '../db';
import Pagination from '../components/Pagination';
import { Wallet, TrendingUp, TrendingDown, Plus, X, Landmark, ArrowDownRight, ArrowUpRight, RefreshCw, Filter, BarChart3, Edit3 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// 渠道选项和颜色映射
const platformOptions = ['小红书1店', '小红书2店', '抖音1店', '抖音2店', '微信', '个人售卖1店', '个人售卖2店', '闲鱼'];
const platformColors: { [key: string]: string } = {
  '小红书1店': '#ff6b6b',
  '小红书2店': '#ee5a6f',
  '抖音1店': '#fe2c55',
  '抖音2店': '#00c2ff',
  '微信': '#07c160',
  '个人售卖1店': '#4dabf7',
  '个人售卖2店': '#748ffc',
  '闲鱼': '#ffa94d'
};

const Finance: React.FC<{ data: AppData; updateData: (fn: (d: AppData) => AppData) => void }> = ({ data, updateData }) => {
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingIncomeId, setEditingIncomeId] = useState<number | null>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null);
  const [newIncome, setNewIncome] = useState<Partial<IncomeRecord>>({
    date: new Date().toISOString().split('T')[0],
    platform: '小红书1店',
    bank_card: '雪雪卡'
  });
  const [newExpense, setNewExpense] = useState<Partial<ExpenseRecord>>({
    date: new Date().toISOString().split('T')[0],
    bank_card: '雪雪卡'
  });
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  
  // Tab 状态
  const [activeTab, setActiveTab] = useState<'income' | 'expense'>('income');
  
  // 筛选框展开状态
  const [showFilters, setShowFilters] = useState(false);
  
  // 图表维度状态
  const [chartDimension, setChartDimension] = useState<'daily' | 'monthly'>('daily');
  
  // 图表渠道显示状态
  const [visiblePlatforms, setVisiblePlatforms] = useState<{ [key: string]: boolean }>(() => {
    const initial: { [key: string]: boolean } = {};
    platformOptions.forEach(platform => {
      initial[platform] = true;
    });
    return initial;
  });
  
  // 筛选条件状态
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    minAmount: '',
    maxAmount: '',
    platform: ''
  });

  const totalExpenditure = useMemo(() => {
    const orderPaid = data.orders.reduce((sum, o) => sum + (o.paid_amount || 0), 0);
    const transfers = data.transfers.reduce((sum, t) => sum + t.amount, 0);
    return orderPaid + transfers;
  }, [data.orders, data.transfers]);

  const totalIncome = useMemo(() => {
    return data.incomes.reduce((sum, i) => sum + i.amount, 0);
  }, [data.incomes]);

  const totalOtherExpenses = useMemo(() => {
    return data.expenses.reduce((sum, e) => sum + e.amount, 0);
  }, [data.expenses]);

  // 筛选后的收入列表
  const filteredIncomes = useMemo(() => {
    return data.incomes.filter(item => {
      // 日期筛选
      if (filters.startDate && item.date < filters.startDate) return false;
      if (filters.endDate && item.date > filters.endDate) return false;
      
      // 金额筛选
      if (filters.minAmount && item.amount < parseFloat(filters.minAmount)) return false;
      if (filters.maxAmount && item.amount > parseFloat(filters.maxAmount)) return false;
      
      // 渠道筛选
      if (filters.platform && item.platform !== filters.platform) return false;
      
      return true;
    });
  }, [data.incomes, filters]);

  // 分页后的收入列表
  const paginatedIncomes = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredIncomes.slice(startIndex, endIndex);
  }, [filteredIncomes, currentPage, itemsPerPage]);

  // 分页后的支出列表
  const paginatedExpenses = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return data.expenses.slice(startIndex, endIndex);
  }, [data.expenses, currentPage, itemsPerPage]);

  // 图表数据处理
  const chartData = useMemo(() => {
    if (chartDimension === 'daily') {
      // 按日期分组
      const dailyData: { [key: string]: any } = {};
      
      filteredIncomes.forEach(income => {
        if (!dailyData[income.date]) {
          dailyData[income.date] = { date: income.date };
          platformOptions.forEach(platform => {
            dailyData[income.date][platform] = 0;
          });
        }
        dailyData[income.date][income.platform] = (dailyData[income.date][income.platform] || 0) + income.amount;
      });
      
      return Object.values(dailyData).sort((a, b) => a.date.localeCompare(b.date));
    } else {
      // 按月份分组
      const monthlyData: { [key: string]: any } = {};
      
      filteredIncomes.forEach(income => {
        const month = income.date.substring(0, 7); // YYYY-MM
        if (!monthlyData[month]) {
          monthlyData[month] = { month };
          platformOptions.forEach(platform => {
            monthlyData[month][platform] = 0;
          });
        }
        monthlyData[month][income.platform] = (monthlyData[month][income.platform] || 0) + income.amount;
      });
      
      return Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month));
    }
  }, [filteredIncomes, chartDimension]);

  const handleSaveIncome = async () => {
    if (!newIncome.amount || !newIncome.quantity) {
      alert("请填写金额和数量");
      return;
    }
    
    setIsSaving(true);
    try {
      if (isEditMode && editingIncomeId) {
        // 编辑模式：更新记录
        const { error } = await supabase
          .from('incomes')
          .update({
            date: newIncome.date,
            platform: newIncome.platform,
            amount: newIncome.amount,
            quantity: newIncome.quantity,
            bank_card: newIncome.bank_card
          })
          .eq('id', editingIncomeId);
        
        if (error) throw error;
      } else {
        // 新增模式
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
      }

      // 3. 刷新全局数据
      const freshData = await loadDataFromServer();
      updateData(() => freshData);
      
      console.log("✅ 收入记录保存成功");
      
      setShowIncomeModal(false);
      setIsEditMode(false);
      setEditingIncomeId(null);
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

  const handleSaveExpense = async () => {
    if (!newExpense.amount || !newExpense.purpose || !newExpense.quantity) {
      alert("请填写支出金额、用途和数量");
      return;
    }
    
    setIsSaving(true);
    try {
      if (isEditMode && editingExpenseId) {
        // 编辑模式：更新记录
        const { error } = await supabase
          .from('expenses')
          .update({
            date: newExpense.date,
            purpose: newExpense.purpose,
            amount: newExpense.amount,
            quantity: newExpense.quantity,
            bank_card: newExpense.bank_card
          })
          .eq('id', editingExpenseId);
        
        if (error) throw error;
      } else {
        // 新增模式
        const expenseResult = await db.addExpenseRecord({
          date: newExpense.date,
          purpose: newExpense.purpose,
          amount: newExpense.amount,
          quantity: newExpense.quantity,
          bank_card: newExpense.bank_card
        });
        
        if (expenseResult.error) {
          console.error("保存支出记录失败:", expenseResult.error);
          throw expenseResult.error;
        }
      }

      const freshData = await loadDataFromServer();
      updateData(() => freshData);
      
      console.log("✅ 支出记录保存成功");
      
      setShowExpenseModal(false);
      setIsEditMode(false);
      setEditingExpenseId(null);
      setNewExpense({
        date: new Date().toISOString().split('T')[0],
        bank_card: '雪雪卡'
      });
    } catch (err) {
      console.error("保存失败:", err);
      alert("操作失败，请重试");
    } finally {
      setIsSaving(false);
    }
  };

  // 切换渠道显示状态
  const togglePlatformVisibility = (platform: string) => {
    setVisiblePlatforms(prev => ({
      ...prev,
      [platform]: !prev[platform]
    }));
  };

  // 全部显示/隐藏
  const toggleAllPlatforms = (show: boolean) => {
    const newState: { [key: string]: boolean } = {};
    platformOptions.forEach(platform => {
      newState[platform] = show;
    });
    setVisiblePlatforms(newState);
  };

  return (
    <div className="space-y-2 lg:space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg lg:text-xl font-black text-slate-800 tracking-tight">账单</h2>
          <p className="text-[9px] text-slate-400 font-bold tracking-widest uppercase">Financial Ledger</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => {
              setIsEditMode(false);
              setEditingExpenseId(null);
              setNewExpense({
                date: new Date().toISOString().split('T')[0],
                bank_card: '雪雪卡'
              });
              setShowExpenseModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-rose-600 text-white rounded-lg font-bold shadow-lg text-xs active:scale-95 transition-all"
          >
            <Plus size={14} />
            记一笔支出
          </button>
          <button 
            onClick={() => {
              setIsEditMode(false);
              setEditingIncomeId(null);
              setNewIncome({
                date: new Date().toISOString().split('T')[0],
                platform: '小红书1店',
                bank_card: '雪雪卡'
              });
              setShowIncomeModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg font-bold shadow-lg text-xs active:scale-95 transition-all"
          >
            <Plus size={14} />
            记一笔收入
          </button>
        </div>
      </div>

      <div className="bg-slate-900 p-4 lg:p-6 rounded-xl text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col items-center text-center">
          <span className="text-[8px] font-black text-white/40 uppercase tracking-wider mb-1">当前经营盈亏</span>
          <div className="text-2xl lg:text-3xl font-black tracking-tight">
            ¥{(totalIncome - totalExpenditure - totalOtherExpenses).toLocaleString()}
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
             <div className="w-px h-5 bg-white/10 self-center"></div>
             <div className="flex flex-col">
               <span className="text-[7px] text-white/30 uppercase font-bold tracking-widest text-center">其他支出</span>
               <span className="text-orange-400 text-sm font-black">¥{totalOtherExpenses.toLocaleString()}</span>
             </div>
          </div>
        </div>
        <div className="absolute -right-6 -bottom-6 text-white/5 pointer-events-none">
          <Landmark size={120} />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex gap-2 border-b border-slate-100">
          <button
            onClick={() => { setActiveTab('income'); setCurrentPage(1); }}
            className={`px-4 py-2 text-xs font-black uppercase tracking-widest transition-all ${
              activeTab === 'income'
                ? 'text-emerald-600 border-b-2 border-emerald-600'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <ArrowUpRight size={12} /> 销售流水
            </span>
          </button>
          <button
            onClick={() => { setActiveTab('expense'); setCurrentPage(1); }}
            className={`px-4 py-2 text-xs font-black uppercase tracking-widest transition-all ${
              activeTab === 'expense'
                ? 'text-rose-600 border-b-2 border-rose-600'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <ArrowDownRight size={12} /> 支出流水
            </span>
          </button>
        </div>

        {activeTab === 'income' && (
          <>
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold hover:bg-slate-200 transition-all"
              >
                <Filter size={12} />
                {showFilters ? '收起筛选' : '展开筛选'}
                {(filters.startDate || filters.endDate || filters.minAmount || filters.maxAmount || filters.platform) && (
                  <span className="ml-1 px-1.5 py-0.5 bg-emerald-500 text-white rounded text-[8px]">
                    {filteredIncomes.length}
                  </span>
                )}
              </button>
            </div>

            {showFilters && (
              <div className="bg-slate-50 rounded-lg p-3 space-y-2 mb-2">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                  <div className="space-y-0.5">
                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">开始日期</label>
                    <input 
                      type="date" 
                      value={filters.startDate}
                      onChange={e => { setFilters({...filters, startDate: e.target.value}); setCurrentPage(1); }}
                      className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold outline-none"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">结束日期</label>
                    <input 
                      type="date" 
                      value={filters.endDate}
                      onChange={e => { setFilters({...filters, endDate: e.target.value}); setCurrentPage(1); }}
                      className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold outline-none"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">最低金额</label>
                    <input 
                      type="number" 
                      value={filters.minAmount}
                      onChange={e => { setFilters({...filters, minAmount: e.target.value}); setCurrentPage(1); }}
                      placeholder="0"
                      className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold outline-none"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">最高金额</label>
                    <input 
                      type="number" 
                      value={filters.maxAmount}
                      onChange={e => { setFilters({...filters, maxAmount: e.target.value}); setCurrentPage(1); }}
                      placeholder="9999"
                      className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold outline-none"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 space-y-0.5">
                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">销售渠道</label>
                    <select 
                      value={filters.platform}
                      onChange={e => { setFilters({...filters, platform: e.target.value}); setCurrentPage(1); }}
                      className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold outline-none"
                    >
                      <option value="">全部渠道</option>
                      {platformOptions.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button 
                      onClick={() => { 
                        setFilters({ startDate: '', endDate: '', minAmount: '', maxAmount: '', platform: '' }); 
                        setCurrentPage(1); 
                      }}
                      className="px-3 py-1.5 bg-slate-200 text-slate-600 rounded-lg text-[10px] font-bold hover:bg-slate-300 transition-all"
                    >
                      清除筛选
                    </button>
                  </div>
                </div>
                {(filters.startDate || filters.endDate || filters.minAmount || filters.maxAmount || filters.platform) && (
                  <div className="text-[9px] font-bold text-emerald-600">
                    已筛选 {filteredIncomes.length} 条记录（共 {data.incomes.length} 条）
                  </div>
                )}
              </div>
            )}

            {/* 折线图展示 */}
            <div className="bg-white rounded-lg border border-slate-100 shadow-sm p-4 mb-2">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <BarChart3 size={16} className="text-emerald-600" />
                  <h3 className="text-sm font-black text-slate-800">销售趋势</h3>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setChartDimension('daily')}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                      chartDimension === 'daily'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    每日
                  </button>
                  <button
                    onClick={() => setChartDimension('monthly')}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                      chartDimension === 'monthly'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    每月
                  </button>
                </div>
              </div>
              
              {/* 渠道选择器 */}
              <div className="mb-3 pb-3 border-b border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">渠道筛选</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => toggleAllPlatforms(true)}
                      className="text-[9px] font-bold text-emerald-600 hover:text-emerald-700 px-2 py-0.5 rounded hover:bg-emerald-50 transition-colors"
                    >
                      全选
                    </button>
                    <button
                      onClick={() => toggleAllPlatforms(false)}
                      className="text-[9px] font-bold text-slate-400 hover:text-slate-600 px-2 py-0.5 rounded hover:bg-slate-100 transition-colors"
                    >
                      清空
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {platformOptions.map(platform => (
                    <button
                      key={platform}
                      onClick={() => togglePlatformVisibility(platform)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                        visiblePlatforms[platform]
                          ? 'text-white shadow-sm'
                          : 'bg-slate-100 text-slate-400'
                      }`}
                      style={{
                        backgroundColor: visiblePlatforms[platform] ? platformColors[platform] : undefined
                      }}
                    >
                      {platform}
                    </button>
                  ))}
                </div>
              </div>
              
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis 
                      dataKey={chartDimension === 'daily' ? 'date' : 'month'} 
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      stroke="#cbd5e1"
                    />
                    <YAxis 
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      stroke="#cbd5e1"
                    />
                    <Tooltip 
                      contentStyle={{ 
                        fontSize: 11, 
                        backgroundColor: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                      }}
                    />
                    <Legend 
                      wrapperStyle={{ fontSize: 10 }}
                      onClick={(e) => {
                        if (e.dataKey) {
                          togglePlatformVisibility(e.dataKey as string);
                        }
                      }}
                    />
                    {platformOptions.map(platform => (
                      visiblePlatforms[platform] && (
                        <Line
                          key={platform}
                          type="monotone"
                          dataKey={platform}
                          stroke={platformColors[platform]}
                          strokeWidth={2}
                          dot={{ r: 3 }}
                          activeDot={{ r: 5 }}
                          name={platform}
                        />
                      )
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-slate-300 text-[10px] font-bold uppercase tracking-widest">
                  暂无数据
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg border border-slate-100 shadow-sm overflow-hidden">
              <div className="space-y-1.5 p-2">
                {paginatedIncomes.map(item => (
                  <div key={item.id} className="bg-white p-2.5 rounded-lg border border-slate-100 flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-bold text-slate-800 text-xs">{item.platform}</div>
                      <div className="text-[9px] text-slate-400 font-mono">{item.date}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <div className="font-black text-emerald-600 text-sm">+¥{item.amount.toLocaleString()}</div>
                        <div className="text-[9px] font-bold text-slate-300">出货 {item.quantity} 条</div>
                      </div>
                      <button
                        onClick={() => {
                          setNewIncome(item);
                          setIsEditMode(true);
                          setEditingIncomeId(item.id);
                          setShowIncomeModal(true);
                        }}
                        className="p-1.5 bg-slate-50 text-slate-400 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors"
                      >
                        <Edit3 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
                {filteredIncomes.length === 0 && <div className="text-center py-6 text-slate-300 font-bold uppercase text-[9px]">暂无符合条件的记录</div>}
              </div>
              {filteredIncomes.length > 0 && (
                <Pagination
                  currentPage={currentPage}
                  totalItems={filteredIncomes.length}
                  itemsPerPage={itemsPerPage}
                  onPageChange={setCurrentPage}
                />
              )}
            </div>
          </>
        )}

        {activeTab === 'expense' && (
          <div className="bg-white rounded-lg border border-slate-100 shadow-sm overflow-hidden">
            <div className="space-y-1.5 p-2">
              {paginatedExpenses.map(item => (
                <div key={item.id} className="bg-white p-2.5 rounded-lg border border-slate-100 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-bold text-slate-800 text-xs">{item.purpose}</div>
                    <div className="text-[9px] text-slate-400 font-mono">{item.date}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <div className="font-black text-rose-600 text-sm">-¥{item.amount.toLocaleString()}</div>
                      <div className="text-[9px] font-bold text-slate-300">数量 {item.quantity}</div>
                    </div>
                    <button
                      onClick={() => {
                        setNewExpense(item);
                        setIsEditMode(true);
                        setEditingExpenseId(item.id);
                        setShowExpenseModal(true);
                      }}
                      className="p-1.5 bg-slate-50 text-slate-400 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors"
                    >
                      <Edit3 size={13} />
                    </button>
                  </div>
                </div>
              ))}
              {data.expenses.length === 0 && <div className="text-center py-6 text-slate-300 font-bold uppercase text-[9px]">暂无记录</div>}
            </div>
            {data.expenses.length > 0 && (
              <Pagination
                currentPage={currentPage}
                totalItems={data.expenses.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
              />
            )}
          </div>
        )}
      </div>

      {showIncomeModal && (
        <div className="fixed inset-0 z-[100] flex items-end lg:items-center justify-center p-0 lg:p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-t-[1.5rem] lg:rounded-[1.5rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-20 duration-500">
            <div className="p-3.5 border-b border-slate-50 flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-800">{isEditMode ? '修改收入记录' : '记一笔营收'}</h3>
              <button onClick={() => {
                setShowIncomeModal(false);
                setIsEditMode(false);
                setEditingIncomeId(null);
                setNewIncome({
                  date: new Date().toISOString().split('T')[0],
                  platform: '小红书1店',
                  bank_card: '雪雪卡'
                });
              }}><X size={18} className="text-slate-300" /></button>
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
              <button onClick={() => {
                setShowIncomeModal(false);
                setIsEditMode(false);
                setEditingIncomeId(null);
                setNewIncome({
                  date: new Date().toISOString().split('T')[0],
                  platform: '小红书1店',
                  bank_card: '雪雪卡'
                });
              }} className="flex-1 text-xs font-bold text-slate-400">取消</button>
              <button 
                onClick={handleSaveIncome} 
                disabled={isSaving}
                className="flex-[2] py-2.5 bg-emerald-600 text-white text-xs font-black rounded-lg shadow-lg active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isSaving ? <><RefreshCw className="animate-spin" size={12} /> 保存中...</> : (isEditMode ? '保存修改' : '入库并记账')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showExpenseModal && (
        <div className="fixed inset-0 z-[100] flex items-end lg:items-center justify-center p-0 lg:p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-t-[1.5rem] lg:rounded-[1.5rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-20 duration-500">
            <div className="p-3.5 border-b border-slate-50 flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-800">{isEditMode ? '修改支出记录' : '记一笔支出'}</h3>
              <button onClick={() => {
                setShowExpenseModal(false);
                setIsEditMode(false);
                setEditingExpenseId(null);
                setNewExpense({
                  date: new Date().toISOString().split('T')[0],
                  bank_card: '雪雪卡'
                });
              }}><X size={18} className="text-slate-300" /></button>
            </div>
            <div className="p-3.5 space-y-3">
              <div className="space-y-0.5">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">支出金额 (元)</label>
                <input 
                  type="number" 
                  value={newExpense.amount || ''} 
                  onChange={e => setNewExpense({...newExpense, amount: parseFloat(e.target.value)})}
                  className="w-full px-4 py-2.5 bg-rose-50 border border-rose-100 rounded-lg font-black text-xl text-rose-900 outline-none" 
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-0.5">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">用途</label>
                <input 
                  type="text" 
                  value={newExpense.purpose || ''} 
                  onChange={e => setNewExpense({...newExpense, purpose: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg font-bold text-sm outline-none" 
                  placeholder="例如：采购材料、快递费等"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-0.5">
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">数量</label>
                  <input 
                    type="number" 
                    value={newExpense.quantity || ''} 
                    onChange={e => setNewExpense({...newExpense, quantity: parseInt(e.target.value)})} 
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg font-black text-sm outline-none" 
                  />
                </div>
                <div className="space-y-0.5">
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">日期</label>
                  <input 
                    type="date" 
                    value={newExpense.date} 
                    onChange={e => setNewExpense({...newExpense, date: e.target.value})} 
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg font-bold text-[10px] outline-none" 
                  />
                </div>
              </div>

              <div className="space-y-0.5">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">支付银行卡</label>
                <select 
                  value={newExpense.bank_card || '雪雪卡'} 
                  onChange={e => setNewExpense({...newExpense, bank_card: e.target.value})} 
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg font-bold text-sm outline-none appearance-none"
                >
                  <option value="雪雪卡">雪雪卡</option>
                  <option value="中信卡">中信卡</option>
                  <option value="翕翕卡">翕翕卡</option>
                </select>
              </div>
            </div>
            <div className="p-3.5 bg-slate-50 flex gap-2.5">
              <button onClick={() => {
                setShowExpenseModal(false);
                setIsEditMode(false);
                setEditingExpenseId(null);
                setNewExpense({
                  date: new Date().toISOString().split('T')[0],
                  bank_card: '雪雪卡'
                });
              }} className="flex-1 text-xs font-bold text-slate-400">取消</button>
              <button 
                onClick={handleSaveExpense} 
                disabled={isSaving}
                className="flex-[2] py-2.5 bg-rose-600 text-white text-xs font-black rounded-lg shadow-lg active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isSaving ? <><RefreshCw className="animate-spin" size={12} /> 保存中...</> : (isEditMode ? '保存修改' : '保存支出')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Finance;
