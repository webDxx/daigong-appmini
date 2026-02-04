
import React, { useState } from 'react';
import { AppData, Worker } from '../types';
import { db } from '../db';
import { Plus, Search, Edit2, Phone, CreditCard, RefreshCw, Users, X, ShieldAlert, MessageCircle } from 'lucide-react';

const Workers: React.FC<{ data: AppData; updateData: (fn: (d: AppData) => AppData) => void }> = ({ data, updateData }) => {
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentWorker, setCurrentWorker] = useState<Partial<Worker>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [debugError, setDebugError] = useState<{message: string, details?: string, hint?: string} | null>(null);

  const filteredWorkers = data.workers.filter(w => {
    const name = w.name || '';
    const wechat = w.wechat_nickname || '';
    return name.includes(searchTerm) || wechat.includes(searchTerm);
  });

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
    <div className="space-y-4 lg:space-y-6">
      {/* 错误提示 */}
      {debugError && (
        <div className="fixed top-16 left-4 right-4 z-[200] bg-rose-50 border-2 border-rose-200 rounded-2xl p-4 shadow-xl flex gap-3">
          <ShieldAlert className="text-rose-600 flex-shrink-0" size={24} />
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start">
              <h4 className="text-rose-900 font-bold text-sm">提交失败</h4>
              <button onClick={() => setDebugError(null)}><X size={16}/></button>
            </div>
            <p className="text-rose-700 text-xs truncate">{debugError.message}</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-xl lg:text-2xl font-black text-slate-800 tracking-tight">工人资料</h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Worker Management</p>
        </div>
        <button 
          onClick={() => { setDebugError(null); setCurrentWorker({ status: 'active', unit_price: 8 }); setShowModal(true); }}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold shadow-lg text-xs active:scale-95 transition-all"
        >
          <Plus size={14} />
          添加工人
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
        <input 
          type="text" 
          placeholder="搜索姓名或微信..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-medium text-sm"
        />
      </div>

      {/* 移动端卡片布局 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:hidden">
        {filteredWorkers.length > 0 ? filteredWorkers.map(worker => (
          <div key={worker.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-3">
             <div className="flex justify-between items-start">
               <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black">
                    {worker.name ? worker.name[0] : '?'}
                  </div>
                  <div>
                    <h4 className="font-black text-slate-800 text-sm">{worker.name}</h4>
                    <div className="flex items-center gap-1 text-slate-400 text-[10px] font-bold">
                       <MessageCircle size={10} /> {worker.wechat_nickname || '未填'}
                    </div>
                  </div>
               </div>
               <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase ${worker.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                  {worker.status === 'active' ? '服务中' : '已停用'}
                </span>
             </div>
             
             <div className="flex items-center justify-between border-t border-slate-50 pt-3">
               <div className="flex flex-col">
                 <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">标准工价</span>
                 <span className="text-sm font-black text-slate-700">¥{Number(worker.unit_price).toFixed(1)}</span>
               </div>
               <button onClick={() => { setDebugError(null); setCurrentWorker(worker); setShowModal(true); }} className="px-4 py-1.5 bg-slate-50 text-blue-600 rounded-lg text-[10px] font-bold hover:bg-blue-50 transition-colors">
                 编辑资料
               </button>
             </div>
          </div>
        )) : (
          <div className="col-span-1 py-12 text-center text-slate-300 text-[10px] font-bold uppercase tracking-widest">无记录</div>
        )}
      </div>

      {/* PC端表格保留 */}
      <div className="hidden lg:block bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b">
            <tr>
              <th className="px-6 py-4">工人</th>
              <th className="px-6 py-4">单价</th>
              <th className="px-6 py-4">电话</th>
              <th className="px-6 py-4 text-center">状态</th>
              <th className="px-6 py-4 text-center">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredWorkers.map(worker => (
              <tr key={worker.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 font-bold">{worker.name}</td>
                <td className="px-6 py-4 font-black">¥{Number(worker.unit_price).toFixed(2)}</td>
                <td className="px-6 py-4 text-slate-500">{worker.phone || '-'}</td>
                <td className="px-6 py-4 text-center">
                  <span className="px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700 text-[10px] font-bold">ACTIVE</span>
                </td>
                <td className="px-6 py-4 text-center">
                  <button onClick={() => { setCurrentWorker(worker); setShowModal(true); }} className="p-2 text-slate-300 hover:text-blue-600"><Edit2 size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-end lg:items-center justify-center bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-t-[2.5rem] lg:rounded-3xl shadow-2xl animate-in slide-in-from-bottom-10 duration-500 overflow-hidden">
            <div className="p-6 border-b border-slate-50 flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-800">工人配置</h3>
              <button onClick={() => setShowModal(false)}><X size={20}/></button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">姓名</label>
                  <input type="text" value={currentWorker.name || ''} onChange={e => setCurrentWorker({...currentWorker, name: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl outline-none font-bold text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">微信</label>
                  <input type="text" value={currentWorker.wechat_nickname || ''} onChange={e => setCurrentWorker({...currentWorker, wechat_nickname: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl outline-none font-bold text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">单价 (元)</label>
                  <input type="number" step="0.1" value={currentWorker.unit_price || ''} onChange={e => setCurrentWorker({...currentWorker, unit_price: parseFloat(e.target.value)})} className="w-full px-4 py-2.5 bg-blue-50 border border-blue-50 text-blue-700 rounded-xl outline-none font-black text-lg" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">电话</label>
                  <input type="text" value={currentWorker.phone || ''} onChange={e => setCurrentWorker({...currentWorker, phone: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl outline-none font-bold text-sm" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">状态</label>
                <select value={currentWorker.status || 'active'} onChange={e => setCurrentWorker({...currentWorker, status: e.target.value as any})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl font-bold text-sm appearance-none outline-none">
                  <option value="active">服务中 (Active)</option>
                  <option value="inactive">停用 (Inactive)</option>
                </select>
              </div>
            </div>
            <div className="p-6 bg-slate-50 flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 text-slate-400 font-bold text-sm">取消</button>
              <button onClick={handleSave} disabled={isSaving} className="flex-[2] py-3.5 bg-blue-600 text-white font-black rounded-xl active:scale-95 transition-all">
                {isSaving ? <RefreshCw className="animate-spin mx-auto" size={16} /> : '保存资料'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Workers;
