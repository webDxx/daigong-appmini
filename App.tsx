
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  ShoppingCart, 
  Wallet, 
  Package, 
  BarChart3, 
  RefreshCw
} from 'lucide-react';
import { loadDataFromServer } from './db';
import { AppData } from './types';

// Pages
import Dashboard from './pages/Dashboard';
import Workers from './pages/Workers';
import Orders from './pages/Orders';
import Finance from './pages/Finance';
import Inventory from './pages/Inventory';
import Reports from './pages/Reports';

const NavItem = ({ to, icon: Icon, label, active }: { to: string, icon: any, label: string, active: boolean }) => (
  <Link
    to={to}
    className={`flex flex-col items-center justify-center flex-1 py-1 transition-all duration-300 ${
      active ? 'text-blue-600' : 'text-slate-400'
    }`}
  >
    <div className={`p-1.5 rounded-xl ${active ? 'bg-blue-50' : ''}`}>
      <Icon size={18} strokeWidth={active ? 2.5 : 2} />
    </div>
    <span className={`text-[9px] mt-0.5 font-bold ${active ? 'opacity-100' : 'opacity-70'}`}>{label}</span>
  </Link>
);

const AppLayout = () => {
  const [data, setData] = useState<AppData | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const location = useLocation();

  useEffect(() => {
    loadDataFromServer().then(res => {
      setData(res);
    });
  }, []);

  const updateData = (updater: (prev: AppData) => AppData) => {
    setData(prev => prev ? updater(prev) : null);
  };

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-400 font-bold text-xs tracking-widest uppercase">Initializing...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans pb-16 lg:pb-0">
      {/* 顶部导航 - 更加紧凑 */}
      <header className="h-12 lg:h-16 bg-white/80 backdrop-blur-md border-b border-slate-100 sticky top-0 z-40 px-4 lg:px-8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-white font-black text-sm shadow-lg rotate-3 lg:w-9 lg:h-9 lg:rounded-xl">绳</div>
          <h1 className="text-base font-black text-slate-800 tracking-tight lg:text-lg">代工管理</h1>
        </div>
        <div className="flex items-center gap-2 px-2.5 py-1 bg-slate-100 rounded-full">
           <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
           <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Online</span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* PC侧边栏 */}
        <aside className="hidden lg:flex w-60 bg-white border-r border-slate-200 flex-col p-4 overflow-y-auto">
          <nav className="space-y-1 flex-1">
             <Link to="/" className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${location.pathname === '/' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-600 hover:bg-slate-100'}`}>
               <LayoutDashboard size={18} /><span className="font-bold text-sm">首页看板</span>
             </Link>
             <Link to="/orders" className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${location.pathname === '/orders' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-600 hover:bg-slate-100'}`}>
               <ShoppingCart size={18} /><span className="font-bold text-sm">订单流水</span>
             </Link>
             <Link to="/finance" className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${location.pathname === '/finance' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-600 hover:bg-slate-100'}`}>
               <Wallet size={18} /><span className="font-bold text-sm">财务核销</span>
             </Link>
             <Link to="/inventory" className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${location.pathname === '/inventory' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-600 hover:bg-slate-100'}`}>
               <Package size={18} /><span className="font-bold text-sm">库存管理</span>
             </Link>
             <Link to="/workers" className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${location.pathname === '/workers' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-600 hover:bg-slate-100'}`}>
               <Users size={18} /><span className="font-bold text-sm">工人资料</span>
             </Link>
             <Link to="/reports" className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${location.pathname === '/reports' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-600 hover:bg-slate-100'}`}>
               <BarChart3 size={18} /><span className="font-bold text-sm">统计报表</span>
             </Link>
          </nav>
        </aside>

        {/* 内容区 - 统一减少内边距 */}
        <main className="flex-1 overflow-y-auto p-3 lg:p-8">
          <div className="max-w-4xl mx-auto">
            <Routes>
              <Route path="/" element={<Dashboard data={data} />} />
              <Route path="/workers" element={<Workers data={data} updateData={updateData} />} />
              <Route path="/orders" element={<Orders data={data} updateData={updateData} />} />
              <Route path="/finance" element={<Finance data={data} updateData={updateData} />} />
              <Route path="/inventory" element={<Inventory data={data} updateData={updateData} />} />
              <Route path="/reports" element={<Reports data={data} />} />
            </Routes>
          </div>
        </main>
      </div>

      {/* 底部导航栏 - 增加工人选项卡，总计5个 */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-slate-100 px-1 py-1 flex items-center justify-around z-50 shadow-[0_-2px_15px_rgba(0,0,0,0.05)]">
        <NavItem to="/" icon={LayoutDashboard} label="首页" active={location.pathname === '/'} />
        <NavItem to="/orders" icon={ShoppingCart} label="订单" active={location.pathname === '/orders'} />
        <NavItem to="/finance" icon={Wallet} label="财务" active={location.pathname === '/finance'} />
        <NavItem to="/inventory" icon={Package} label="仓库" active={location.pathname === '/inventory'} />
        <NavItem to="/workers" icon={Users} label="工人" active={location.pathname === '/workers'} />
      </nav>
    </div>
  );
};

const App = () => {
  return (
    <HashRouter>
      <AppLayout />
    </HashRouter>
  );
};

export default App;
