
import React, { useState, useMemo } from 'react';
import { AppData, Worker } from '../types';
import { db } from '../db';
import Pagination from '../components/Pagination';
import { Plus, Search, Edit2, Phone, CreditCard, RefreshCw, Users, X, ShieldAlert, MessageCircle } from 'lucide-react';

const Workers: React.FC<{ data: AppData; updateData: (fn: (d: AppData) => AppData) => void }> = ({ data, updateData }) => {
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSpecialty, setFilterSpecialty] = useState<string>('');
  const [currentWorker, setCurrentWorker] = useState<Partial<Worker>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [debugError, setDebugError] = useState<{message: string, details?: string, hint?: string} | null>(null);
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const filteredWorkers = useMemo(() => {
    return data.workers.filter(w => {
      const name = w.name || '';
      const wechat = w.wechat_nickname || '';
      const address = w.address || '';
      const nameMatch = name.toLowerCase().includes(searchTerm.toLowerCase()) || wechat.toLowerCase().includes(searchTerm.toLowerCase());
      const specialtyMatch = !filterSpecialty || address.toLowerCase().includes(filterSpecialty.toLowerCase());
      return nameMatch && specialtyMatch;
    });
  }, [data.workers, searchTerm, filterSpecialty]);

  // 分页后的工人列表
  const paginatedWorkers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredWorkers.slice(startIndex, endIndex);
  }, [filteredWorkers, currentPage, itemsPerPage]);

  // 筛选条件变化时重置到第一页
  useMemo(() => {
    setCurrentPage(1);
  }, [searchTerm, filterSpecialty]);

  const handleSave = async () => {
    if (!currentWorker.name || currentWorker.name.trim() === '') return alert("请输入姓名");
    setIsSaving(true);
    setDebugError(null);
    try {
      const { data: savedData, error } = await db.upsertWorker(currentWorker);
      if (error) {
        setDebugError({ message: error.message, details: error.details, hint: error.hint });
        throw new Error(error.message);
      }
      const freshData = await (await import('../db')).loadDataFromServer();
      updateData(() => freshData);
      setShowModal(false);
      setCurrentWorker({});
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-2 lg:space-y-4">
      {/* 错误提示 */}
      {debugError && (
        <div className="fixed top-12 left-3 right-3 z-[200] bg-rose-50 border border-rose-200 rounded-lg p-3 shadow-xl flex gap-2">
          <ShieldAlert className="text-rose-600 flex-shrink-0" size={18} />
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start">
              <h4 className="text-rose-900 font-bold text-xs">提交失败</h4>
              <button onClick={() => setDebugError(null)}><X size={14}/></button>
            </div>
            <p className="text-rose-700 text-[10px] truncate">{debugError.message}</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg lg:text-xl font-black text-slate-800 tracking-tight">工人资料</h2>
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Worker Management</p>
        </div>
        <button 
          onClick={() => { setDebugError(null); setCurrentWorker({ status: 'active', unit_price: 8 }); setShowModal(true); }}
          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg font-bold shadow-lg text-xs active:scale-95 transition-all"
        >
          <Plus size={12} />
          添加工人
        </button>
      </div>

      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input 
            type="text" 
            placeholder="搜索姓名或微信..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-medium text-sm"
          />
        </div>
        
        <div>
          <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1 block mb-1">擅长类型</label>
          <input
            type="text"
            value={filterSpecialty}
            onChange={(e) => setFilterSpecialty(e.target.value)}
            placeholder="搜索备注..."
            className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none"
          />
        </div>
        
        {(searchTerm || filterSpecialty) && (
          <button
            onClick={() => {
              setSearchTerm('');
              setFilterSpecialty('');
            }}
            className="text-[10px] text-slate-400 hover:text-blue-600 font-bold"
          >
            清除筛选
          </button>
        )}
      </div>

      {/* 移动端列表布局 */}
      <div className="bg-white rounded-lg border border-slate-100 shadow-sm overflow-hidden lg:hidden">
        <div className="space-y-1.5 p-2">
          {paginatedWorkers.length > 0 ? paginatedWorkers.map(worker => (
          <div key={worker.id} className="bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm">
             <div className="flex items-center justify-between">
               <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="w-7 h-7 rounded-md bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-xs flex-shrink-0">
                    {worker.name ? worker.name[0] : '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className="font-black text-slate-800 text-xs">{worker.name}</h4>
                      <span className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase flex-shrink-0 ${worker.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                        {worker.status === 'active' ? '在职' : '停用'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex items-center gap-0.5 text-slate-400 text-[9px] font-bold">
                         <MessageCircle size={8} /> {worker.wechat_nickname || '未填'}
                      </div>
                      <div className="text-[9px] font-black text-blue-600">
                        ¥{Number(worker.unit_price).toFixed(1)}/条
                      </div>
                    </div>
                  </div>
               </div>
               <button onClick={() => { setDebugError(null); setCurrentWorker(worker); setShowModal(true); }} className="p-1.5 text-slate-300 hover:text-blue-600 active:scale-95 transition-all flex-shrink-0">
                 <Edit2 size={13} />
               </button>
             </div>
             {worker.address && (
               <div className="mt-1.5 text-[9px] text-slate-600 bg-slate-50 px-2 py-1 rounded">
                 <span className="text-slate-400">备注: </span>{worker.address}
               </div>
             )}
          </div>
        )) : (
          <div className="py-6 text-center text-slate-300 text-[9px] font-bold uppercase tracking-widest">无记录</div>
        )}
        </div>
        {filteredWorkers.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalItems={filteredWorkers.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
          />
        )}
      </div>

      {/* PC端表格 */}
      <div className="hidden lg:block bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-left text-[10px]">
          <thead className="bg-slate-50 text-[8px] font-black uppercase tracking-wider text-slate-400 border-b">
            <tr>
              <th className="px-3 py-2">工人</th>
              <th className="px-3 py-2">微信</th>
              <th className="px-3 py-2">单价</th>
              <th className="px-3 py-2">电话</th>
              <th className="px-3 py-2">状态</th>
              <th className="px-3 py-2">备注</th>
              <th className="px-3 py-2 text-center">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedWorkers.map(worker => (
              <tr key={worker.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-bold">{worker.name}</td>
                <td className="px-3 py-2 text-slate-500">{worker.wechat_nickname || '-'}</td>
                <td className="px-3 py-2 font-black">¥{Number(worker.unit_price).toFixed(1)}</td>
                <td className="px-3 py-2 text-slate-500">{worker.phone || '-'}</td>
                <td className="px-3 py-2">
                  <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[8px] font-bold">
                    {worker.status === 'active' ? '在职' : '停用'}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-400 text-[9px] max-w-[120px] truncate">{worker.address || '-'}</td>
                <td className="px-3 py-2 text-center">
                  <button onClick={() => { setCurrentWorker(worker); setShowModal(true); }} className="p-1.5 text-slate-300 hover:text-blue-600"><Edit2 size={12} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredWorkers.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalItems={filteredWorkers.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
          />
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-end lg:items-center justify-center bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-t-[1.5rem] lg:rounded-2xl shadow-2xl animate-in slide-in-from-bottom-10 duration-500 overflow-hidden">
            <div className="p-3.5 border-b border-slate-50 flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-800">工人配置</h3>
              <button onClick={() => setShowModal(false)}><X size={18}/></button>
            </div>
            <div className="p-3.5 space-y-2.5 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-0.5">
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">姓名</label>
                  <input type="text" value={currentWorker.name || ''} onChange={e => setCurrentWorker({...currentWorker, name: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg outline-none font-bold text-sm" />
                </div>
                <div className="space-y-0.5">
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">微信</label>
                  <input type="text" value={currentWorker.wechat_nickname || ''} onChange={e => setCurrentWorker({...currentWorker, wechat_nickname: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg outline-none font-bold text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-0.5">
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">单价 (元)</label>
                  <input type="number" step="0.1" value={currentWorker.unit_price || ''} onChange={e => setCurrentWorker({...currentWorker, unit_price: parseFloat(e.target.value)})} className="w-full px-3 py-2 bg-blue-50 border border-blue-50 text-blue-700 rounded-lg outline-none font-black text-base" />
                </div>
                <div className="space-y-0.5">
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">电话</label>
                  <input type="text" value={currentWorker.phone || ''} onChange={e => setCurrentWorker({...currentWorker, phone: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg outline-none font-bold text-sm" />
                </div>
              </div>
              <div className="space-y-0.5">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">状态</label>
                <select value={currentWorker.status || 'active'} onChange={e => setCurrentWorker({...currentWorker, status: e.target.value as any})} className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg font-bold text-sm appearance-none outline-none">
                  <option value="active">服务中 (Active)</option>
                  <option value="inactive">停用 (Inactive)</option>
                </select>
              </div>
              <div className="space-y-0.5">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">备注（擅长类型等）</label>
                <input 
                  type="text" 
                  value={currentWorker.address || ''} 
                  onChange={e => setCurrentWorker({...currentWorker, address: e.target.value})} 
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg font-medium text-sm outline-none" 
                  placeholder="如：擅长完整、擅长主绳等..."
                />
              </div>
            </div>
            <div className="p-3.5 bg-slate-50 flex gap-2.5">
              <button onClick={() => setShowModal(false)} className="flex-1 text-slate-400 font-bold text-xs">取消</button>
              <button onClick={handleSave} disabled={isSaving} className="flex-[2] py-2.5 bg-blue-600 text-white text-xs font-black rounded-lg active:scale-95 transition-all">
                {isSaving ? <RefreshCw className="animate-spin mx-auto" size={14} /> : '保存资料'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Workers;
