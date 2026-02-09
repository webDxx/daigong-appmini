
import React, { useState } from 'react';
import { Lock, User, AlertCircle } from 'lucide-react';

interface LoginProps {
  onLogin: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // 简单延迟模拟登录过程
    setTimeout(() => {
      if (username === 'dxx' && password === 'dxx') {
        localStorage.setItem('isLoggedIn', 'true');
        onLogin();
      } else {
        setError('账号或密码错误');
        setIsLoading(false);
      }
    }, 500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-xl mx-auto mb-3 rotate-3">
            绳
          </div>
          <h1 className="text-xl font-black text-slate-800">代工管理系统</h1>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Supply Chain Management</p>
        </div>

        {/* 登录表单 */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-lg">
                  <AlertCircle className="text-rose-500 flex-shrink-0" size={16} />
                  <span className="text-rose-700 text-xs font-bold">{error}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">账号</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm"
                    placeholder="请输入账号"
                    autoComplete="username"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">密码</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm"
                    placeholder="请输入密码"
                    autoComplete="current-password"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || !username || !password}
                className="w-full py-3.5 bg-blue-600 text-white font-black rounded-xl shadow-lg hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? '登录中...' : '登录系统'}
              </button>
            </form>
          </div>

          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100">
            <p className="text-[9px] text-slate-400 text-center">
              手绳代工供销存管理系统 v1.0
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
