import React, { useState, useMemo } from "react";
import { AppData, LiveSession } from "../types";
import { db } from "../db";
import Pagination from "../components/Pagination";
import { Plus, Search, Edit2, Trash2, DollarSign, Clock, TrendingUp, X, ShieldAlert, CalendarDays } from "lucide-react";

const AnchorSalary: React.FC<{ data: AppData; updateData: (fn: (d: AppData) => AppData) => void }> = ({ data, updateData }) => {
	const [showModal, setShowModal] = useState(false);
	const [searchTerm, setSearchTerm] = useState("");
	const [currentSession, setCurrentSession] = useState<Partial<LiveSession>>({});
	const [isSaving, setIsSaving] = useState(false);
	const [debugError, setDebugError] = useState<{ message: string; details?: string; hint?: string } | null>(null);
	const [showDetailModal, setShowDetailModal] = useState(false);
	const [selectedAnchorId, setSelectedAnchorId] = useState<number | null>(null);

	const [currentPage, setCurrentPage] = useState(1);
	const itemsPerPage = 50;

	// 薪资计算规则
	const DAY_SHIFT_RATE = 15; // 白班15元/小时
	const NIGHT_SHIFT_RATE = 20; // 晚班20元/小时
	const GMV_COMMISSION_RATE = 0.02; // 2%

	const filteredSessions = useMemo(() => {
		return data.liveSessions.filter((s) => {
			const anchor = data.anchors.find((a) => a.id === s.anchor_id);
			const anchorName = anchor?.name || "";
			const nameMatch = anchorName.toLowerCase().includes(searchTerm.toLowerCase());
			return nameMatch;
		});
	}, [data.liveSessions, data.anchors, searchTerm]);

	const paginatedSessions = useMemo(() => {
		const startIndex = (currentPage - 1) * itemsPerPage;
		const endIndex = startIndex + itemsPerPage;
		return filteredSessions.slice(startIndex, endIndex);
	}, [filteredSessions, currentPage, itemsPerPage]);

	useMemo(() => {
		setCurrentPage(1);
	}, [searchTerm]);

	// 计算单场工资
	const calculateSessionSalary = (session: LiveSession) => {
		const hourlyRate = session.shift === "night" ? NIGHT_SHIFT_RATE : DAY_SHIFT_RATE;
		const hourlyPay = session.duration_hours * hourlyRate;
		const gmvCommission = session.gmv * GMV_COMMISSION_RATE;
		return hourlyPay + gmvCommission;
	};

	// 按主播统计本周工资
	const weeklyStats = useMemo(() => {
		const now = new Date();
		const weekStart = new Date(now);
		weekStart.setDate(now.getDate() - now.getDay()); // 本周日
		weekStart.setHours(0, 0, 0, 0);

		const stats: Record<
			number,
			{
				anchorId: number;
				anchorName: string;
				totalHours: number;
				totalGMV: number;
				totalOffline: number;
				totalSalary: number;
				sessionCount: number;
				sessions: LiveSession[];
			}
		> = {};

		data.liveSessions.forEach((session) => {
			const sessionDate = new Date(session.live_date);
			if (sessionDate >= weekStart && sessionDate <= now) {
				if (!stats[session.anchor_id]) {
					const anchor = data.anchors.find((a) => a.id === session.anchor_id);
					stats[session.anchor_id] = {
						anchorId: session.anchor_id,
						anchorName: anchor?.name || "未知",
						totalHours: 0,
						totalGMV: 0,
						totalOffline: 0,
						totalSalary: 0,
						sessionCount: 0,
						sessions: [],
					};
				}
				stats[session.anchor_id].totalHours += session.duration_hours;
				stats[session.anchor_id].totalGMV += session.gmv;
				stats[session.anchor_id].totalSalary += calculateSessionSalary(session);
				stats[session.anchor_id].sessionCount += 1;
				stats[session.anchor_id].sessions.push(session);
			}
		});

		return Object.values(stats);
	}, [data.liveSessions, data.anchors]);

	const handleSave = async () => {
		if (!currentSession.anchor_id) return alert("请选择主播");
		if (!currentSession.live_date) return alert("请选择日期");
		if (currentSession.duration_hours === undefined || currentSession.duration_hours <= 0) return alert("请输入有效的直播时长");

		setIsSaving(true);
		setDebugError(null);
		try {
			const sessionData = {
				...currentSession,
				gmv: currentSession.gmv || 0,
			};

			let result;
			if (currentSession.id) {
				result = await db.updateLiveSession(sessionData);
			} else {
				result = await db.addLiveSession(sessionData);
			}

			if (result.error) {
				setDebugError({ message: result.error.message });
				throw new Error(result.error.message);
			}
			const freshData = await (await import("../db")).loadDataFromServer();
			updateData(() => freshData);
			setShowModal(false);
			setCurrentSession({});
		} catch (err: any) {
			console.error(err);
		} finally {
			setIsSaving(false);
		}
	};

	const handleDelete = async (id: number) => {
		if (!confirm("确认删除该直播记录？")) return;
		try {
			const { error } = await db.deleteLiveSession(id);
			if (error) {
				alert(`删除失败: ${error.message}`);
				return;
			}
			const freshData = await (await import("../db")).loadDataFromServer();
			updateData(() => freshData);
		} catch (err: any) {
			console.error(err);
			alert("删除失败");
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
							<button onClick={() => setDebugError(null)}>
								<X size={14} />
							</button>
						</div>
						<p className="text-rose-700 text-[10px] truncate">{debugError.message}</p>
					</div>
				</div>
			)}

			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-lg lg:text-xl font-black text-slate-800 tracking-tight">主播工资计算</h2>
					<p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Anchor Salary</p>
				</div>
				<button
					onClick={() => {
						setDebugError(null);
						setCurrentSession({
							live_date: new Date().toISOString().split("T")[0],
							shift: "day",
							duration_hours: 0,
							gmv: 0,
						});
						setShowModal(true);
					}}
					className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg font-bold shadow-lg text-xs active:scale-95 transition-all"
				>
					<Plus size={12} />
					添加直播
				</button>
			</div>

			{/* 本周工资统计 */}
			<div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-3 lg:p-4 rounded-lg border border-blue-100 shadow-sm">
				<div className="flex items-center gap-2 mb-3">
					<CalendarDays size={16} className="text-blue-600" />
					<h3 className="text-sm font-black text-slate-800">本周应发工资</h3>
				</div>
				{weeklyStats.length > 0 ? (
					<div className="space-y-2">
						{weeklyStats.map((stat) => (
							<div key={stat.anchorId} className="bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm">
								<div className="flex justify-between items-center mb-1.5">
									<h4 className="font-black text-slate-800 text-sm">{stat.anchorName}</h4>
									<span className="text-blue-600 font-black text-base">¥{stat.totalSalary.toFixed(2)}</span>
								</div>
								<div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-[9px]">
									<div className="flex items-center gap-1 text-slate-500">
										<Clock size={10} />
										<span>{stat.totalHours}小时</span>
									</div>
									<div className="flex items-center gap-1 text-slate-500">
										<TrendingUp size={10} />
										<span>
											GMV: ¥{stat.totalGMV.toFixed(0)} (提成¥{(stat.totalGMV * GMV_COMMISSION_RATE).toFixed(2)})
										</span>
									</div>

									<button
										onClick={() => {
											setSelectedAnchorId(stat.anchorId);
											setShowDetailModal(true);
										}}
										className="text-slate-400 hover:text-blue-600 hover:underline cursor-pointer transition-colors text-left"
									>
										{stat.sessionCount}场直播
									</button>
								</div>
							</div>
						))}
					</div>
				) : (
					<div className="text-center py-4 text-slate-400 text-xs">本周暂无直播记录</div>
				)}
			</div>

			{/* 搜索 */}
			<div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm space-y-2">
				<div className="relative">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
					<input
						type="text"
						placeholder="搜索主播姓名..."
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-medium text-sm"
					/>
				</div>

				{searchTerm && (
					<button onClick={() => setSearchTerm("")} className="text-[10px] text-slate-400 hover:text-blue-600 font-bold">
						清除筛选
					</button>
				)}
			</div>

			{/* 移动端列表布局 */}
			<div className="bg-white rounded-lg border border-slate-100 shadow-sm overflow-hidden lg:hidden">
				<div className="space-y-1.5 p-2">
					{paginatedSessions.length > 0 ? (
						paginatedSessions.map((session) => {
							const anchor = data.anchors.find((a) => a.id === session.anchor_id);
							const salary = calculateSessionSalary(session);
							return (
								<div key={session.id} className="bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm">
									<div className="flex items-center justify-between mb-2">
										<div className="flex-1">
											<h4 className="font-black text-slate-800 text-xs">{anchor?.name || "未知主播"}</h4>
											<p className="text-[9px] text-slate-400">{session.live_date}</p>
										</div>
										<div className="text-right">
											<div className="text-blue-600 font-black text-sm">¥{salary.toFixed(2)}</div>
										</div>
									</div>
									<div className="grid grid-cols-3 gap-1.5 text-[9px] text-slate-500 mb-2">
										<div className="bg-slate-50 px-2 py-1 rounded">
											<div className="text-slate-400">班次</div>
											<div className="font-bold">{session.shift === "night" ? "晚班" : "白班"}</div>
										</div>
										<div className="bg-slate-50 px-2 py-1 rounded">
											<div className="text-slate-400">时长</div>
											<div className="font-bold">{session.duration_hours}h</div>
										</div>
										<div className="bg-slate-50 px-2 py-1 rounded">
											<div className="text-slate-400">GMV</div>
											<div className="font-bold">¥{session.gmv}</div>
										</div>
									</div>
									<div className="flex justify-end gap-1">
										<button
											onClick={() => {
												setDebugError(null);
												setCurrentSession(session);
												setShowModal(true);
											}}
											className="p-1.5 text-slate-300 hover:text-blue-600"
										>
											<Edit2 size={13} />
										</button>
										<button onClick={() => handleDelete(session.id)} className="p-1.5 text-slate-300 hover:text-rose-600">
											<Trash2 size={13} />
										</button>
									</div>
								</div>
							);
						})
					) : (
						<div className="py-6 text-center text-slate-300 text-[9px] font-bold uppercase tracking-widest">无记录</div>
					)}
				</div>
				{filteredSessions.length > 0 && (
					<Pagination
						currentPage={currentPage}
						totalItems={filteredSessions.length}
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
							<th className="px-3 py-2">日期</th>
							<th className="px-3 py-2">主播</th>
							<th className="px-3 py-2">班次</th>
							<th className="px-3 py-2">时长(小时)</th>
							<th className="px-3 py-2">GMV</th>
							<th className="px-3 py-2">应发工资</th>
							<th className="px-3 py-2 text-center">操作</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{paginatedSessions.map((session) => {
							const anchor = data.anchors.find((a) => a.id === session.anchor_id);
							const salary = calculateSessionSalary(session);
							return (
								<tr key={session.id} className="hover:bg-slate-50">
									<td className="px-3 py-2 text-slate-500">{session.live_date}</td>
									<td className="px-3 py-2 font-bold">{anchor?.name || "未知"}</td>
									<td className="px-3 py-2">
										<span
											className={`px-2 py-0.5 rounded text-[9px] font-bold ${
												session.shift === "night" ? "bg-indigo-100 text-indigo-700" : "bg-amber-100 text-amber-700"
											}`}
										>
											{session.shift === "night" ? "晚班" : "白班"}
										</span>
									</td>
									<td className="px-3 py-2">{session.duration_hours}</td>
									<td className="px-3 py-2 font-black text-emerald-600">¥{session.gmv.toFixed(2)}</td>
									<td className="px-3 py-2 font-black text-orange-600">¥{salary.toFixed(2)}</td>
									<td className="px-3 py-2 text-center">
										<button
											onClick={() => {
												setCurrentSession(session);
												setShowModal(true);
											}}
											className="p-1.5 text-slate-300 hover:text-blue-600 mr-1"
										>
											<Edit2 size={12} />
										</button>
										<button onClick={() => handleDelete(session.id)} className="p-1.5 text-slate-300 hover:text-rose-600">
											<Trash2 size={12} />
										</button>
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
				{filteredSessions.length > 0 && (
					<Pagination
						currentPage={currentPage}
						totalItems={filteredSessions.length}
						itemsPerPage={itemsPerPage}
						onPageChange={setCurrentPage}
					/>
				)}
			</div>

			{showModal && (
				<div className="fixed inset-0 z-[100] flex items-end lg:items-center justify-center bg-slate-900/40 backdrop-blur-sm">
					<div className="bg-white w-full max-w-md rounded-t-[1.5rem] lg:rounded-2xl shadow-2xl animate-in slide-in-from-bottom-10 duration-500 overflow-hidden">
						<div className="p-3.5 border-b border-slate-50 flex items-center justify-between">
							<h3 className="text-sm font-black text-slate-800">直播记录</h3>
							<button onClick={() => setShowModal(false)}>
								<X size={18} />
							</button>
						</div>
						<div className="p-3.5 space-y-2.5 max-h-[70vh] overflow-y-auto">
							<div className="space-y-0.5">
								<label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">选择主播 *</label>
								<select
									value={currentSession.anchor_id || ""}
									onChange={(e) => setCurrentSession({ ...currentSession, anchor_id: parseInt(e.target.value) })}
									className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg font-bold text-sm appearance-none outline-none"
								>
									<option value="">请选择主播</option>
									{data.anchors.map((anchor) => (
										<option key={anchor.id} value={anchor.id}>
											{anchor.name}
										</option>
									))}
								</select>
							</div>
							<div className="space-y-0.5">
								<label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">日期 *</label>
								<input
									type="date"
									value={currentSession.live_date || ""}
									onChange={(e) => setCurrentSession({ ...currentSession, live_date: e.target.value })}
									className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg outline-none font-bold text-sm"
								/>
							</div>
							<div className="space-y-0.5">
								<label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">班次 *</label>
								<select
									value={currentSession.shift || "day"}
									onChange={(e) => setCurrentSession({ ...currentSession, shift: e.target.value as "day" | "night" })}
									className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg font-bold text-sm appearance-none outline-none"
								>
									<option value="day">白班 (15元/小时)</option>
									<option value="night">晚班 (20元/小时)</option>
								</select>
							</div>
							<div className="space-y-0.5">
								<label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">直播时长（小时）*</label>
								<input
									type="number"
									step="0.1"
									value={currentSession.duration_hours || ""}
									onChange={(e) => setCurrentSession({ ...currentSession, duration_hours: parseFloat(e.target.value) || 0 })}
									className="w-full px-3 py-2 bg-blue-50 border border-blue-50 text-blue-700 rounded-lg outline-none font-black text-base"
								/>
							</div>
							<div className="space-y-0.5">
								<label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">GMV（元）</label>
								<input
									type="number"
									step="0.01"
									value={currentSession.gmv || ""}
									onChange={(e) => setCurrentSession({ ...currentSession, gmv: parseFloat(e.target.value) || 0 })}
									className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg outline-none font-bold text-sm"
								/>
							</div>

							{/* 计算预览 */}
							{currentSession.duration_hours !== undefined && currentSession.duration_hours > 0 && (
								<div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-3 rounded-lg border border-blue-100">
									<div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">工资预览</div>
									<div className="space-y-1 text-[10px]">
										<div className="flex justify-between">
											<span className="text-slate-500">
												时薪 ({currentSession.duration_hours}h × ¥
												{currentSession.shift === "night" ? NIGHT_SHIFT_RATE : DAY_SHIFT_RATE})
											</span>
											<span className="font-bold">
												¥
												{(
													(currentSession.duration_hours || 0) *
													(currentSession.shift === "night" ? NIGHT_SHIFT_RATE : DAY_SHIFT_RATE)
												).toFixed(2)}
											</span>
										</div>
										<div className="flex justify-between">
											<span className="text-slate-500">GMV提成 ({GMV_COMMISSION_RATE * 100}%)</span>
											<span className="font-bold">¥{((currentSession.gmv || 0) * GMV_COMMISSION_RATE).toFixed(2)}</span>
										</div>

										<div className="flex justify-between pt-1.5 border-t border-blue-200">
											<span className="font-black text-slate-700">合计</span>
											<span className="font-black text-blue-600 text-sm">
												¥
												{(
													(currentSession.duration_hours || 0) *
														(currentSession.shift === "night" ? NIGHT_SHIFT_RATE : DAY_SHIFT_RATE) +
													(currentSession.gmv || 0) * GMV_COMMISSION_RATE
												).toFixed(2)}
											</span>
										</div>
									</div>
								</div>
							)}
						</div>
						<div className="p-3.5 bg-slate-50 flex gap-2.5">
							<button onClick={() => setShowModal(false)} className="flex-1 text-slate-400 font-bold text-xs">
								取消
							</button>
							<button
								onClick={handleSave}
								disabled={isSaving}
								className="flex-[2] py-2.5 bg-blue-600 text-white text-xs font-black rounded-lg active:scale-95 transition-all"
							>
								{isSaving ? "保存中..." : "保存"}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* 主播直播明细弹窗 */}
			{showDetailModal && selectedAnchorId && (
				<div className="fixed inset-0 z-[100] flex items-end lg:items-center justify-center bg-slate-900/40 backdrop-blur-sm">
					<div className="bg-white w-full max-w-4xl rounded-t-[1.5rem] lg:rounded-2xl shadow-2xl animate-in slide-in-from-bottom-10 duration-500 overflow-hidden max-h-[85vh] flex flex-col">
						<div className="p-3.5 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
							<div>
								<h3 className="text-sm font-black text-slate-800">
									{weeklyStats.find((s) => s.anchorId === selectedAnchorId)?.anchorName} - 本周直播明细
								</h3>
								<p className="text-[9px] text-slate-400 mt-0.5">
									共{weeklyStats.find((s) => s.anchorId === selectedAnchorId)?.sessionCount}场 ·{" "}
									{weeklyStats.find((s) => s.anchorId === selectedAnchorId)?.totalHours}小时
								</p>
							</div>
							<button onClick={() => setShowDetailModal(false)} className="text-slate-400 hover:text-slate-600">
								<X size={18} />
							</button>
						</div>
						<div className="overflow-x-auto overflow-y-auto flex-1 p-1">
							<table className="w-full text-left text-[10px] whitespace-nowrap">
								<thead className="bg-slate-50 text-[8px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200 sticky top-0">
									<tr>
										<th className="px-2 py-1.5 whitespace-nowrap">日期</th>
										<th className="px-2 py-1.5 text-center whitespace-nowrap">班次</th>
										<th className="px-2 py-1.5 text-right whitespace-nowrap">时长</th>
										<th className="px-2 py-1.5 text-right whitespace-nowrap">时薪</th>
										<th className="px-2 py-1.5 text-right whitespace-nowrap">GMV</th>
										<th className="px-2 py-1.5 text-right whitespace-nowrap">提成</th>
										<th className="px-2 py-1.5 text-right font-black whitespace-nowrap">工资</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-slate-100">
									{weeklyStats
										.find((s) => s.anchorId === selectedAnchorId)
										?.sessions.sort((a, b) => new Date(b.live_date).getTime() - new Date(a.live_date).getTime())
										.map((session) => {
											const salary = calculateSessionSalary(session);
											const hourlyRate = session.shift === "night" ? NIGHT_SHIFT_RATE : DAY_SHIFT_RATE;
											const hourlyPay = session.duration_hours * hourlyRate;
											const commission = session.gmv * GMV_COMMISSION_RATE;
											return (
												<tr key={session.id} className="hover:bg-slate-50">
													<td className="px-2 py-1.5 text-slate-600 font-medium whitespace-nowrap">
														{session.live_date.substring(5)}
													</td>
													<td className="px-2 py-1.5 text-center whitespace-nowrap">
														<span
															className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
																session.shift === "night" ? "bg-indigo-100 text-indigo-700" : "bg-amber-100 text-amber-700"
															}`}
														>
															{session.shift === "night" ? "晚" : "白"}
														</span>
													</td>
													<td className="px-2 py-1.5 text-right text-slate-700 whitespace-nowrap">{session.duration_hours}h</td>
													<td className="px-2 py-1.5 text-right text-slate-600 whitespace-nowrap">
														<div className="flex flex-col items-end">
															<span className="text-[8px] text-slate-400">{hourlyRate}元×</span>
															<span>¥{hourlyPay.toFixed(0)}</span>
														</div>
													</td>
													<td className="px-2 py-1.5 text-right font-bold text-emerald-600 whitespace-nowrap">
														¥{session.gmv.toFixed(0)}
													</td>
													<td className="px-2 py-1.5 text-right font-bold text-orange-600 whitespace-nowrap">
														¥{commission.toFixed(2)}
													</td>

													<td className="px-2 py-1.5 text-right font-black text-blue-600 whitespace-nowrap">
														¥{salary.toFixed(2)}
													</td>
												</tr>
											);
										})}
								</tbody>
							</table>
						</div>
						<div className="p-3.5 bg-gradient-to-r from-blue-50 to-indigo-50 border-t border-blue-100 flex-shrink-0">
							<div className="flex justify-between items-center">
								<div className="space-y-0.5">
									<div className="text-[9px] text-slate-500">
										时薪: ¥
										{(
											weeklyStats.find((s) => s.anchorId === selectedAnchorId)?.totalSalary! -
											weeklyStats.find((s) => s.anchorId === selectedAnchorId)?.totalGMV! * GMV_COMMISSION_RATE
										).toFixed(2)}{" "}
										+ 提成: ¥
										{(weeklyStats.find((s) => s.anchorId === selectedAnchorId)?.totalGMV! * GMV_COMMISSION_RATE).toFixed(2)}
									</div>
								</div>
								<div className="text-right">
									<div className="text-[9px] text-slate-500 mb-0.5">本周应发工资</div>
									<div className="font-black text-blue-600 text-xl">
										¥{weeklyStats.find((s) => s.anchorId === selectedAnchorId)?.totalSalary.toFixed(2)}
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default AnchorSalary;
