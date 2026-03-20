
import React, { useState, useMemo } from 'react';
import { AppData, Anchor } from '../types';
import { db } from '../db';
import Pagination from '../components/Pagination';
import { Plus, Search, Edit2, Phone, Trash2, User, X, ShieldAlert } from 'lucide-react';

const Anchors: React.FC<{ data: AppData; updateData: (fn: (d: AppData) => AppData) => void }> = ({ data, updateData }) => {
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentAnchor, setCurrentAnchor] = useState<Partial<Anchor>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [debugError, setDebugError] = useState<{message: string, details?: string, hint?: string} | null>(null);
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const filteredAnchors = useMemo(() => {
    return data.anchors.filter(a => {
      const name = a.name || '';
      const phone = a.phone || '';
      const nameMatch = name.toLowerCase().includes(searchTerm.toLowerCase()) || phone.includes(searchTerm);
      return nameMatch;
    });
  }, [data.anchors, searchTerm]);

  const paginatedAnchors = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredAnchors.slice(startIndex, endIndex);
  }, [filteredAnchors, currentPage, itemsPerPage]);

  useMemo(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const handleSave = async () => {
    if (!currentAnchor.name || currentAnchor.name.trim() === '') return alert("请输入姓名");
    if (!currentAnchor.phone || currentAnchor.phone.trim() === '') return alert("请输入电话");
    setIsSaving(true);
    setDebugError(null);
    try {
      const { data: savedData, error } = await db.upsertAnchor(currentAnchor);
      if (error) {
        setDebugError({ message: error.message, details: error.details, hint: error.hint });
        throw new Error(error.message);
      }
      const freshData = await (await import('../db')).loadDataFromServer();
      updateData(() => freshData);
      setShowModal(false);
      setCurrentAnchor({});
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确认删除该主播？')) return;
    try {
      const { error } = await db.deleteAnchor(id);
      if (error) {
        alert(`删除失败: ${error.message}`);
        return;
      }
      const freshData = await (await import('../db')).loadDataFromServer();
      updateData(() => freshData);
    } catch (err: any) {
      console.error(err);
      alert('删除失败');
    }
  };

  return (
    <div className="space-y-2 lg:space-y-4">
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
          <h2 className="text-lg lg:text-xl font-black text-slate-800 tracking-tight">主播管理</h2>
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Anchor Management</p>
        </div>
        <button 
          onClick={() => { setDebugError(null); setCurrentAnchor({}); setShowModal(true); }}
          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg font-bold shadow-lg text-xs active:scale-95 transition-all"
        >
          <Plus size={12} />
          添加主播
        </button>
      </div>

      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input 
            type="text" 
            placeholder="搜索姓名或电话..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-medium text-sm"
          />
        </div>
        
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="text-[10px] text-slate-400 hover:text-blue-600 font-bold"
          >
            清除筛选
          </button>
        )}
      </div>

      {/* 移动端列表布局 */}
      <div className="bg-white rounded-lg border border-slate-100 shadow-sm overflow-hidden lg:hidden">
        <div className="space-y-1.5 p-2">
          {paginatedAnchors.length > 0 ? paginatedAnchors.map(anchor => (
          <div key={anchor.id} className="bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm">
             <div className="flex items-center justify-between">
               <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="w-7 h-7 rounded-md bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white font-black text-xs flex-shrink-0">
                    {anchor.name ? anchor.name[0] : '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className="font-black text-slate-800 text-xs">{anchor.name}</h4>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex items-center gap-0.5 text-slate-400 text-[9px] font-bold">
                         <Phone size={8} /> {anchor.phone || '未填'}
                      </div>
                      {anchor.age && (
                        <div className="text-[9px] font-black text-slate-500">
                          {anchor.age}岁
                        </div>
                      )}
                    </div>
                  </div>
               </div>
               <div className="flex items-center gap-1">
                 <button onClick={() => { setDebugError(null); setCurrentAnchor(anchor); setShowModal(true); }} className="p-1.5 text-slate-300 hover:text-blue-600 active:scale-95 transition-all flex-shrink-0">
                   <Edit2 size={13} />
                 </button>
                 <button onClick={() => handleDelete(anchor.id)} className="p-1.5 text-slate-300 hover:text-rose-600 active:scale-95 transition-all flex-shrink-0">
                   <Trash2 size={13} />
                 </button>
               </div>
             </div>
             {anchor.address && (
               <div className="mt-1.5 text-[9px] text-slate-600 bg-slate-50 px-2 py-1 rounded">
                 <span className="text-slate-400">住址: </span>{anchor.address}
               </div>
             )}
          </div>
        )) : (
          <div className="py-6 text-center text-slate-300 text-[9px] font-bold uppercase tracking-widest">无记录</div>
        )}
        </div>
        {filteredAnchors.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalItems={filteredAnchors.length}
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
              <th className="px-3 py-2">姓名</th>
              <th className="px-3 py-2">电话</th>
              <th className="px-3 py-2">年龄</th>
              <th className="px-3 py-2">住址</th>
              <th className="px-3 py-2 text-center">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedAnchors.map(anchor => (
              <tr key={anchor.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-bold">{anchor.name}</td>
                <td className="px-3 py-2 text-slate-500">{anchor.phone || '-'}</td>
                <td className="px-3 py-2 text-slate-500">{anchor.age || '-'}</td>
                <td className="px-3 py-2 text-slate-400 text-[9px] max-w-[200px] truncate">{anchor.address || '-'}</td>
                <td className="px-3 py-2 text-center">
                  <button onClick={() => { setCurrentAnchor(anchor); setShowModal(true); }} className="p-1.5 text-slate-300 hover:text-blue-600 mr-1"><Edit2 size={12} /></button>
                  <button onClick={() => handleDelete(anchor.id)} className="p-1.5 text-slate-300 hover:text-rose-600"><Trash2 size={12} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredAnchors.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalItems={filteredAnchors.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
          />
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-end lg:items-center justify-center bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-t-[1.5rem] lg:rounded-2xl shadow-2xl animate-in slide-in-from-bottom-10 duration-500 overflow-hidden">
            <div className="p-3.5 border-b border-slate-50 flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-800">主播信息</h3>
              <button onClick={() => setShowModal(false)}><X size={18}/></button>
            </div>
            <div className="p-3.5 space-y-2.5 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-0.5">
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">姓名 *</label>
                  <input type="text" value={currentAnchor.name || ''} onChange={e => setCurrentAnchor({...currentAnchor, name: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg outline-none font-bold text-sm" />
                </div>
                <div className="space-y-0.5">
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">电话 *</label>
                  <input type="text" value={currentAnchor.phone || ''} onChange={e => setCurrentAnchor({...currentAnchor, phone: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg outline-none font-bold text-sm" />
                </div>
              </div>
              <div className="space-y-0.5">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">年龄</label>
                <input type="number" value={currentAnchor.age || ''} onChange={e => setCurrentAnchor({...currentAnchor, age: e.target.value ? parseInt(e.target.value) : undefined})} className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg outline-none font-bold text-sm" />
              </div>
              <div className="space-y-0.5">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">住址</label>
                <input 
                  type="text" 
                  value={currentAnchor.address || ''} 
                  onChange={e => setCurrentAnchor({...currentAnchor, address: e.target.value})} 
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg font-medium text-sm outline-none" 
                  placeholder="如：杭州市西湖区..."
                />
              </div>
            </div>
            <div className="p-3.5 bg-slate-50 flex gap-2.5">
              <button onClick={() => setShowModal(false)} className="flex-1 text-slate-400 font-bold text-xs">取消</button>
              <button onClick={handleSave} disabled={isSaving} className="flex-[2] py-2.5 bg-blue-600 text-white text-xs font-black rounded-lg active:scale-95 transition-all">
                {isSaving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Anchors;
