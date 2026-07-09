import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { AppData, ExpenseRecord, LiveSession } from "../types";
import { db } from "../db";
import Pagination from "../components/Pagination";
import {
	Plus,
	Search,
	Edit2,
	Trash2,
	Clock,
	TrendingUp,
	X,
	ShieldAlert,
	CalendarDays,
	ChevronLeft,
	ChevronRight,
	CheckCircle2,
	Tv,
	Info,
} from "lucide-react";

const DAY_SHIFT_RATE = 15;
const NIGHT_SHIFT_RATE = 20;

/** 本周场均指标 = 总GMV ÷ 总时长 × 3 */
const getWeeklyCommissionMetric = (totalGMV: number, totalHours: number) =>
	totalHours > 0 ? (totalGMV / totalHours) * 3 : 0;

/** 根据场均指标确定提点比例（与界面展示的整数场均保持一致） */
const getCommissionRateFromMetric = (metric: number): number => {
	const m = Math.round(metric);
	if (m >= 4000) return 0.15;
	if (m >= 3000) return 0.13;
	if (m >= 2000) return 0.1;
	if (m >= 1500) return 0.07;
	if (m >= 1000) return 0.05;
	if (m >= 500) return 0.03;
	return 0.02;
};

const getWeeklyCommissionRate = (totalGMV: number, totalHours: number) =>
	getCommissionRateFromMetric(getWeeklyCommissionMetric(totalGMV, totalHours));

const formatCommissionRate = (rate: number) => `${Math.round(rate * 100)}%`;

const getWeekRangeForDate = (date: Date) => {
	const d = new Date(date);
	const daysSinceMonday = (d.getDay() + 6) % 7;
	const weekStart = new Date(d);
	weekStart.setDate(d.getDate() - daysSinceMonday);
	weekStart.setHours(0, 0, 0, 0);
	const weekEnd = new Date(weekStart);
	weekEnd.setDate(weekStart.getDate() + 6);
	weekEnd.setHours(23, 59, 59, 999);
	return { weekStart, weekEnd };
};

const getSessionCommissionRate = (session: LiveSession, allSessions: LiveSession[]) => {
	const { weekStart, weekEnd } = getWeekRangeForDate(new Date(session.live_date));
	const weekSessions = allSessions.filter(
		(s) =>
			s.anchor_id === session.anchor_id &&
			new Date(s.live_date) >= weekStart &&
			new Date(s.live_date) <= weekEnd
	);
	const totalGMV = weekSessions.reduce((sum, s) => sum + (s.gmv || 0), 0);
	const totalHours = weekSessions.reduce((sum, s) => sum + (s.duration_hours || 0), 0);
	return getWeeklyCommissionRate(totalGMV, totalHours);
};

const getSessionSalaryBreakdown = (session: Partial<LiveSession>, commissionRate: number) => {
	const duration = session.duration_hours || 0;
	const gmv = session.gmv || 0;
	const hourlyRate = session.shift === "night" ? NIGHT_SHIFT_RATE : DAY_SHIFT_RATE;
	const hourlyPay = duration * hourlyRate;
	const commission = gmv * commissionRate;
	return { hourlyPay, commission, salary: hourlyPay + commission };
};

const calculateSessionSalary = (session: LiveSession, allSessions: LiveSession[]) => {
	const commissionRate = getSessionCommissionRate(session, allSessions);
	return getSessionSalaryBreakdown(session, commissionRate).salary;
};

const aggregateSessionsStats = (sessions: LiveSession[]) => {
	let totalHours = 0;
	let totalGMV = 0;
	sessions.forEach((s) => {
		totalHours += s.duration_hours || 0;
		totalGMV += s.gmv || 0;
	});
	const commissionRate = getWeeklyCommissionRate(totalGMV, totalHours);
	let totalHourly = 0;
	let totalCommission = 0;
	let totalSalary = 0;
	sessions.forEach((s) => {
		const { hourlyPay, commission, salary } = getSessionSalaryBreakdown(s, commissionRate);
		totalHourly += hourlyPay;
		totalCommission += commission;
		totalSalary += salary;
	});
	return {
		sessionCount: sessions.length,
		totalHours,
		totalGMV,
		totalHourly,
		totalCommission,
		totalSalary,
		commissionRate,
		commissionMetric: getWeeklyCommissionMetric(totalGMV, totalHours),
	};
};

const getWeekRange = (weekOffset: number) => {
	const now = new Date();
	const weekStart = new Date(now);
	// 周一为一周起始，周日为一周结束
	const daysSinceMonday = (now.getDay() + 6) % 7;
	weekStart.setDate(now.getDate() - daysSinceMonday - weekOffset * 7);
	weekStart.setHours(0, 0, 0, 0);
	const weekEnd = new Date(weekStart);
	weekEnd.setDate(weekStart.getDate() + 6);
	weekEnd.setHours(23, 59, 59, 999);
	return { weekStart, weekEnd };
};

const formatWeekLabel = (weekOffset: number) => {
	if (weekOffset === 0) return "本周应发工资";
	if (weekOffset === 1) return "上周应发工资";
	return `${weekOffset}周前应发工资`;
};

const formatDateRange = (weekStart: Date, weekEnd: Date) => {
	const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
	return `${fmt(weekStart)} - ${fmt(weekEnd)}`;
};

const getWeekSettlementLabel = (weekOffset: number) => {
	if (weekOffset === 0) return "本周";
	if (weekOffset === 1) return "上周";
	return `${weekOffset}周前`;
};

const getSettlementPurpose = (weekOffset: number, weekStart: Date, weekEnd: Date) => {
	return `主播工资-${getWeekSettlementLabel(weekOffset)}(${formatDateRange(weekStart, weekEnd)})`;
};

/** 与财务支出流水统一：用途含「主播工资」且括号内日期区间与当周一致即视为已结清 */
const findAnchorSalarySettlementExpense = (
	expenses: ExpenseRecord[],
	weekStart: Date,
	weekEnd: Date
): ExpenseRecord | undefined => {
	const dateRangeKey = formatDateRange(weekStart, weekEnd);
	return expenses.find((e) => e.purpose.includes("主播工资") && e.purpose.includes(`(${dateRangeKey})`));
};

const AnchorSalary: React.FC<{ data: AppData; updateData: (fn: (d: AppData) => AppData) => void }> = ({ data, updateData }) => {
	const [showModal, setShowModal] = useState(false);
	const [searchTerm, setSearchTerm] = useState("");
	const [currentSession, setCurrentSession] = useState<Partial<LiveSession>>({});
	const [isSaving, setIsSaving] = useState(false);
	const [isSettling, setIsSettling] = useState(false);
	const [debugError, setDebugError] = useState<{ message: string; details?: string; hint?: string } | null>(null);
	const [showDetailModal, setShowDetailModal] = useState(false);
	const [showCommissionRuleModal, setShowCommissionRuleModal] = useState(false);
	const [selectedAnchorId, setSelectedAnchorId] = useState<number | null>(null);
	const [isDetailEditing, setIsDetailEditing] = useState(false);
	const [editingSessions, setEditingSessions] = useState<LiveSession[]>([]);
	const [weekOffset, setWeekOffset] = useState(0);

	const [currentPage, setCurrentPage] = useState(1);
	const itemsPerPage = 50;

	const { weekStart, weekEnd } = useMemo(() => getWeekRange(weekOffset), [weekOffset]);

	const filteredSessions = useMemo(() => {
		return data.liveSessions.filter((s) => {
			const anchor = data.anchors.find((a) => a.id === s.anchor_id);
			const anchorName = anchor?.name || "";
			return anchorName.toLowerCase().includes(searchTerm.toLowerCase());
		});
	}, [data.liveSessions, data.anchors, searchTerm]);

	const paginatedSessions = useMemo(() => {
		const startIndex = (currentPage - 1) * itemsPerPage;
		return filteredSessions.slice(startIndex, startIndex + itemsPerPage);
	}, [filteredSessions, currentPage, itemsPerPage]);

	useMemo(() => {
		setCurrentPage(1);
	}, [searchTerm]);

	const weeklyStats = useMemo(() => {
		const stats: Record<
			number,
			{
				anchorId: number;
				anchorName: string;
				totalHours: number;
				totalGMV: number;
				totalSalary: number;
				totalCommission: number;
				commissionRate: number;
				commissionMetric: number;
				sessionCount: number;
				sessions: LiveSession[];
			}
		> = {};

		data.liveSessions.forEach((session) => {
			const sessionDate = new Date(session.live_date);
			if (sessionDate >= weekStart && sessionDate <= weekEnd) {
				if (!stats[session.anchor_id]) {
					const anchor = data.anchors.find((a) => a.id === session.anchor_id);
					stats[session.anchor_id] = {
						anchorId: session.anchor_id,
						anchorName: anchor?.name || "未知",
						totalHours: 0,
						totalGMV: 0,
						totalSalary: 0,
						totalCommission: 0,
						commissionRate: 0.02,
						commissionMetric: 0,
						sessionCount: 0,
						sessions: [],
					};
				}
				stats[session.anchor_id].totalHours += session.duration_hours;
				stats[session.anchor_id].totalGMV += session.gmv;
				stats[session.anchor_id].sessionCount += 1;
				stats[session.anchor_id].sessions.push(session);
			}
		});

		Object.values(stats).forEach((stat) => {
			stat.commissionRate = getWeeklyCommissionRate(stat.totalGMV, stat.totalHours);
			stat.commissionMetric = getWeeklyCommissionMetric(stat.totalGMV, stat.totalHours);
			stat.totalCommission = stat.totalGMV * stat.commissionRate;
			stat.totalSalary = stat.sessions.reduce(
				(sum, s) => sum + getSessionSalaryBreakdown(s, stat.commissionRate).salary,
				0
			);
		});

		return Object.values(stats).sort((a, b) => b.totalSalary - a.totalSalary);
	}, [data.liveSessions, data.anchors, weekStart, weekEnd]);

	const weekTotalSalary = useMemo(() => weeklyStats.reduce((sum, s) => sum + s.totalSalary, 0), [weeklyStats]);

	const settlementPurpose = useMemo(
		() => getSettlementPurpose(weekOffset, weekStart, weekEnd),
		[weekOffset, weekStart, weekEnd]
	);

	const settlementExpense = useMemo(
		() => findAnchorSalarySettlementExpense(data.expenses, weekStart, weekEnd),
		[data.expenses, weekStart, weekEnd]
	);

	const isWeekSettled = !!settlementExpense;

	const settledDisplayAmount = settlementExpense?.amount ?? weekTotalSalary;

	const selectedStat = weeklyStats.find((s) => s.anchorId === selectedAnchorId);

	const previewCommissionRate = useMemo(() => {
		if (!currentSession.anchor_id) return 0.02;
		const { weekStart: ws, weekEnd: we } = getWeekRangeForDate(new Date(currentSession.live_date || new Date()));
		const weekSessions = data.liveSessions.filter((s) => {
			if (s.anchor_id !== currentSession.anchor_id) return false;
			if (currentSession.id && s.id === currentSession.id) return false;
			const d = new Date(s.live_date);
			return d >= ws && d <= we;
		});
		const totalGMV = weekSessions.reduce((sum, s) => sum + (s.gmv || 0), 0) + (currentSession.gmv || 0);
		const totalHours =
			weekSessions.reduce((sum, s) => sum + (s.duration_hours || 0), 0) + (currentSession.duration_hours || 0);
		return getWeeklyCommissionRate(totalGMV, totalHours);
	}, [currentSession, data.liveSessions]);

	const handleSettleWeek = async () => {
		if (isWeekSettled || isSettling) return;
		if (weeklyStats.length === 0 || weekTotalSalary <= 0) {
			alert("该周暂无工资可结清");
			return;
		}
		if (!confirm(`确认结清 ${settlementPurpose}，共 ¥${weekTotalSalary.toFixed(2)}？`)) return;

		setIsSettling(true);
		try {
			const result = await db.addExpenseRecord({
				date: new Date().toISOString().split("T")[0],
				purpose: settlementPurpose,
				amount: weekTotalSalary,
				quantity: weeklyStats.length,
				bank_card: "雪雪卡",
			});
			if (result.error) throw result.error;
			const freshData = await (await import("../db")).loadDataFromServer();
			updateData(() => freshData);
		} catch (err: any) {
			alert(`结清失败: ${err?.message || "请重试"}`);
		} finally {
			setIsSettling(false);
		}
	};

	const handleSave = async () => {
		if (!currentSession.anchor_id) return alert("请选择主播");
		if (!currentSession.live_date) return alert("请选择日期");
		if (currentSession.duration_hours === undefined || currentSession.duration_hours <= 0) return alert("请输入有效的直播时长");

		setIsSaving(true);
		setDebugError(null);
		try {
			const sessionData = { ...currentSession, gmv: currentSession.gmv || 0 };
			const result = currentSession.id
				? await db.updateLiveSession(sessionData)
				: await db.addLiveSession(sessionData);

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
			if (selectedAnchorId) {
				const stillHasSessions = freshData.liveSessions.some(
					(s) => s.anchor_id === selectedAnchorId && new Date(s.live_date) >= weekStart && new Date(s.live_date) <= weekEnd
				);
				if (!stillHasSessions) {
					closeDetailModal();
				} else if (isDetailEditing) {
					setEditingSessions((prev) => prev.filter((s) => s.id !== id));
				}
			}
		} catch (err: any) {
			console.error(err);
			alert("删除失败");
		}
	};

	const openAddModal = () => {
		setDebugError(null);
		setCurrentSession({
			live_date: new Date().toISOString().split("T")[0],
			shift: "day",
			duration_hours: 0,
			gmv: 0,
		});
		setShowModal(true);
	};

	const openDetailModal = (anchorId: number) => {
		setSelectedAnchorId(anchorId);
		setShowDetailModal(true);
		setIsDetailEditing(false);
		setEditingSessions([]);
	};

	const closeDetailModal = () => {
		setShowDetailModal(false);
		setSelectedAnchorId(null);
		setIsDetailEditing(false);
		setEditingSessions([]);
	};

	const startDetailEditing = () => {
		if (!selectedStat) return;
		setEditingSessions(selectedStat.sessions.map((s) => ({ ...s, offline_sales: s.offline_sales || 0 })));
		setIsDetailEditing(true);
	};

	const cancelDetailEditing = () => {
		setIsDetailEditing(false);
		setEditingSessions([]);
	};

	const updateEditingSession = (id: number, patch: Partial<LiveSession>) => {
		setEditingSessions((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
	};

	const handleSaveAllSessions = async () => {
		if (editingSessions.length === 0) return;
		for (const session of editingSessions) {
			if (!session.live_date) return alert("请填写日期");
			if (!session.duration_hours || session.duration_hours <= 0) return alert("请输入有效的直播时长");
		}

		setIsSaving(true);
		setDebugError(null);
		try {
			for (const session of editingSessions) {
				const result = await db.updateLiveSession({
					...session,
					gmv: session.gmv || 0,
					offline_sales: session.offline_sales || 0,
				});
				if (result.error) {
					setDebugError({ message: result.error.message });
					throw result.error;
				}
			}
			const freshData = await (await import("../db")).loadDataFromServer();
			updateData(() => freshData);
			setIsDetailEditing(false);
			setEditingSessions([]);
		} catch (err: any) {
			console.error(err);
		} finally {
			setIsSaving(false);
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

			<div className="flex items-center justify-between gap-2">
				<div>
					<h2 className="text-lg lg:text-xl font-black text-slate-800 tracking-tight">主播工资计算</h2>
					<p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Anchor Salary</p>
				</div>
				<div className="flex items-center gap-1.5">
					<Link
						to="/anchors"
						className="flex items-center gap-1 px-2.5 py-1.5 bg-purple-600 text-white rounded-lg font-bold shadow-md text-[10px] active:scale-95 transition-all"
					>
						<Tv size={11} />
						主播管理
					</Link>
					<button
						onClick={openAddModal}
						className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 text-white rounded-lg font-bold shadow-lg text-[10px] active:scale-95 transition-all"
					>
						<Plus size={11} />
						添加直播
					</button>
				</div>
			</div>

			{/* 周工资统计 */}
			<div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-3 lg:p-4 rounded-xl border border-blue-100 shadow-sm">
				<div className="flex items-center justify-between mb-3 gap-2">
					<div className="flex items-center gap-2 min-w-0">
						<CalendarDays size={16} className="text-blue-600 flex-shrink-0" />
						<div className="min-w-0">
							<div className="flex items-center gap-1">
								<h3 className="text-sm font-black text-slate-800 truncate">{formatWeekLabel(weekOffset)}</h3>
								<button
									type="button"
									onClick={() => setShowCommissionRuleModal(true)}
									className="p-0.5 text-slate-400 hover:text-blue-600 active:scale-95 transition-all flex-shrink-0"
									aria-label="提点规则说明"
								>
									<Info size={12} />
								</button>
							</div>
							<p className="text-[10px] text-slate-500 font-medium">{formatDateRange(weekStart, weekEnd)}</p>
						</div>
					</div>
					<div className="flex items-center gap-1 flex-shrink-0">
						<button
							onClick={() => setWeekOffset((o) => o + 1)}
							className="flex items-center gap-0.5 px-2 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 active:scale-95 transition-all"
						>
							<ChevronLeft size={12} />
							上周
						</button>
						<button
							onClick={() => setWeekOffset((o) => Math.max(0, o - 1))}
							disabled={weekOffset === 0}
							className="flex items-center gap-0.5 px-2 py-1 bg-blue-600 text-white rounded-lg text-[10px] font-bold active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
						>
							下周
							<ChevronRight size={12} />
						</button>
					</div>
				</div>

				{weeklyStats.length > 0 ? (
					<div className="space-y-2">
						{weeklyStats.map((stat) => (
								<div
									key={stat.anchorId}
									className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm cursor-pointer active:scale-[0.98] transition-all"
									onClick={() => openDetailModal(stat.anchorId)}
								>
									<div className="flex justify-between items-start mb-2">
										<h4 className="font-black text-slate-800 text-sm">{stat.anchorName}</h4>
										<span className="text-blue-600 font-black text-lg">¥{stat.totalSalary.toFixed(2)}</span>
									</div>
									<div className="flex items-start justify-between gap-2">
										<div className="space-y-1">
											<div className="flex items-center gap-1 text-[10px] text-slate-500">
												<Clock size={10} className="text-slate-400" />
												<span>{stat.totalHours.toFixed(1)}小时</span>
											</div>
											<div className="text-[10px] text-slate-500">
												场均 ¥{stat.commissionMetric.toFixed(0)} · 提点 {formatCommissionRate(stat.commissionRate)}
											</div>
											<button
												className="text-[10px] text-blue-500 font-bold hover:underline"
												onClick={(e) => {
													e.stopPropagation();
													openDetailModal(stat.anchorId);
												}}
											>
												{stat.sessionCount}场直播
											</button>
										</div>
										<div className="flex items-center gap-1 text-[10px] text-slate-500 text-right">
											<TrendingUp size={10} className="text-emerald-500 flex-shrink-0" />
											<span>
												GMV: ¥{stat.totalGMV.toFixed(0)}{" "}
												<span className="text-orange-500">(提成¥{stat.totalCommission.toFixed(2)})</span>
											</span>
										</div>
									</div>
								</div>
							))}
					</div>
				) : (
					<div className="text-center py-6 text-slate-400 text-xs">该周暂无直播记录</div>
				)}

				{weeklyStats.length > 0 && (
					<div className="mt-3 pt-3 border-t border-blue-100/80 flex items-center justify-between gap-2">
						<span className="text-[10px] font-bold text-slate-600">
							{formatWeekLabel(weekOffset).replace("应发工资", "应发工资总额")}
						</span>
						<button
							type="button"
							onClick={handleSettleWeek}
							disabled={isWeekSettled || isSettling}
							className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all flex-shrink-0 ${
								isWeekSettled
									? "bg-slate-100 text-slate-400 cursor-not-allowed"
									: "bg-emerald-500 text-white shadow-sm active:scale-95"
							} disabled:cursor-not-allowed`}
						>
							<CheckCircle2 size={14} />
							{isSettling
								? "处理中..."
								: isWeekSettled
									? `已结清 ¥${settledDisplayAmount.toFixed(2)}`
									: `结清工资 ¥${weekTotalSalary.toFixed(2)}`}
						</button>
					</div>
				)}
			</div>

			{/* 直播记录搜索与列表 - PC 端展示 */}
			<div className="hidden lg:block space-y-2">
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

				<div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
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
								const salary = calculateSessionSalary(session, data.liveSessions);
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
											<span className="text-slate-500">GMV提成 ({formatCommissionRate(previewCommissionRate)})</span>
											<span className="font-bold">
												¥{((currentSession.gmv || 0) * previewCommissionRate).toFixed(2)}
											</span>
										</div>
										<div className="flex justify-between pt-1.5 border-t border-blue-200">
											<span className="font-black text-slate-700">合计</span>
											<span className="font-black text-blue-600 text-sm">
												¥
												{(
													(currentSession.duration_hours || 0) *
														(currentSession.shift === "night" ? NIGHT_SHIFT_RATE : DAY_SHIFT_RATE) +
													(currentSession.gmv || 0) * previewCommissionRate
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
			{showDetailModal && selectedStat && (() => {
				const displaySessions = isDetailEditing
					? [...editingSessions].sort((a, b) => new Date(b.live_date).getTime() - new Date(a.live_date).getTime())
					: [...selectedStat.sessions].sort((a, b) => new Date(b.live_date).getTime() - new Date(a.live_date).getTime());
				const detailStats = isDetailEditing
					? aggregateSessionsStats(editingSessions)
					: {
							sessionCount: selectedStat.sessionCount,
							totalHours: selectedStat.totalHours,
							totalGMV: selectedStat.totalGMV,
							totalHourly: selectedStat.totalSalary - selectedStat.totalCommission,
							totalCommission: selectedStat.totalCommission,
							totalSalary: selectedStat.totalSalary,
							commissionRate: selectedStat.commissionRate,
							commissionMetric: selectedStat.commissionMetric,
						};
				const weekDetailLabel = weekOffset === 0 ? "本周" : formatWeekLabel(weekOffset).replace("应发工资", "");
				const cellInputClass =
					"w-full min-w-0 px-1.5 py-1 border border-slate-200 rounded-md text-[10px] font-medium outline-none focus:ring-1 focus:ring-blue-400 bg-white";

				return (
					<div className="fixed inset-0 z-[100] flex items-end lg:items-center justify-center bg-slate-900/40 backdrop-blur-sm">
						<div className="bg-white w-full max-w-4xl rounded-t-[1.5rem] lg:rounded-2xl shadow-2xl animate-in slide-in-from-bottom-10 duration-500 overflow-hidden max-h-[85vh] flex flex-col">
							<div className="p-3.5 border-b border-slate-100 flex items-center justify-between flex-shrink-0 gap-2">
								<div className="min-w-0">
									<h3 className="text-sm font-black text-slate-800">
										{selectedStat.anchorName} - {weekDetailLabel}直播明细
									</h3>
									<p className="text-[9px] text-slate-400 mt-0.5">
										共{detailStats.sessionCount}场 · {detailStats.totalHours.toFixed(1)}小时
										{isDetailEditing ? " (预览)" : ""} · 场均 ¥{detailStats.commissionMetric.toFixed(0)} · 提点{" "}
										{formatCommissionRate(detailStats.commissionRate)}
										{isDetailEditing && (
											<span className="text-orange-500 font-bold"> · 编辑中，保存后生效</span>
										)}
									</p>
								</div>
								<div className="flex items-center gap-1.5 flex-shrink-0">
									{isDetailEditing ? (
										<>
											<button
												type="button"
												onClick={cancelDetailEditing}
												disabled={isSaving}
												className="px-2 py-1 text-[10px] font-bold text-slate-500 hover:text-slate-700"
											>
												取消
											</button>
											<button
												type="button"
												onClick={handleSaveAllSessions}
												disabled={isSaving}
												className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-black active:scale-95 transition-all disabled:opacity-60"
											>
												{isSaving ? "保存中..." : "保存全部"}
											</button>
										</>
									) : (
										<button
											type="button"
											onClick={startDetailEditing}
											className="p-1.5 text-slate-400 hover:text-blue-600"
											aria-label="编辑直播明细"
										>
											<Edit2 size={16} />
										</button>
									)}
									<button type="button" onClick={closeDetailModal} className="text-slate-400 hover:text-slate-600">
										<X size={18} />
									</button>
								</div>
							</div>
							<div className="overflow-x-auto overflow-y-auto flex-1 p-1">
								<table className="w-full text-left text-[10px] whitespace-nowrap">
									<thead className="bg-slate-50 text-[8px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200 sticky top-0">
										<tr>
											<th className="px-2 py-1.5 whitespace-nowrap">日期</th>
											<th className="px-2 py-1.5 text-center whitespace-nowrap">班次</th>
											<th className="px-2 py-1.5 text-right whitespace-nowrap">时长</th>
											{!isDetailEditing && <th className="px-2 py-1.5 text-right whitespace-nowrap">时薪</th>}
											<th className="px-2 py-1.5 text-right whitespace-nowrap">GMV</th>
											{isDetailEditing && <th className="px-2 py-1.5 text-right whitespace-nowrap">线下</th>}
											<th className="px-2 py-1.5 text-right whitespace-nowrap">提成</th>
											<th className="px-2 py-1.5 text-right font-black whitespace-nowrap">工资</th>
											{!isDetailEditing && <th className="px-2 py-1.5 text-center whitespace-nowrap">操作</th>}
										</tr>
									</thead>
									<tbody className="divide-y divide-slate-100">
										{displaySessions.map((session) => {
											const { hourlyPay, commission, salary } = getSessionSalaryBreakdown(
												session,
												detailStats.commissionRate
											);
											const hourlyRate = session.shift === "night" ? NIGHT_SHIFT_RATE : DAY_SHIFT_RATE;

											if (isDetailEditing) {
												return (
													<tr key={session.id} className="bg-blue-50/30">
														<td className="px-2 py-1.5 whitespace-nowrap">
															<input
																type="date"
																value={session.live_date}
																onChange={(e) => updateEditingSession(session.id, { live_date: e.target.value })}
																className={`${cellInputClass} w-[118px]`}
															/>
														</td>
														<td className="px-2 py-1.5 text-center whitespace-nowrap">
															<select
																value={session.shift || "day"}
																onChange={(e) =>
																	updateEditingSession(session.id, { shift: e.target.value as "day" | "night" })
																}
																className={`${cellInputClass} w-12 text-center appearance-none`}
															>
																<option value="day">白</option>
																<option value="night">晚</option>
															</select>
														</td>
														<td className="px-2 py-1.5 text-right whitespace-nowrap">
															<input
																type="number"
																step="0.1"
																min="0"
																value={session.duration_hours}
																onChange={(e) =>
																	updateEditingSession(session.id, {
																		duration_hours: parseFloat(e.target.value) || 0,
																	})
																}
																className={`${cellInputClass} w-14 text-right`}
															/>
														</td>
														<td className="px-2 py-1.5 text-right whitespace-nowrap">
															<input
																type="number"
																step="1"
																min="0"
																value={session.gmv}
																onChange={(e) =>
																	updateEditingSession(session.id, { gmv: parseFloat(e.target.value) || 0 })
																}
																className={`${cellInputClass} w-16 text-right`}
															/>
														</td>
														<td className="px-2 py-1.5 text-right whitespace-nowrap">
															<input
																type="number"
																step="1"
																min="0"
																value={session.offline_sales || 0}
																onChange={(e) =>
																	updateEditingSession(session.id, {
																		offline_sales: parseFloat(e.target.value) || 0,
																	})
																}
																className={`${cellInputClass} w-16 text-right`}
															/>
														</td>
														<td className="px-2 py-1.5 text-right font-bold text-orange-600 whitespace-nowrap">
															¥{commission.toFixed(2)}
														</td>
														<td className="px-2 py-1.5 text-right font-black text-blue-600 whitespace-nowrap">
															¥{salary.toFixed(2)}
														</td>
													</tr>
												);
											}

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
													<td className="px-2 py-1.5 text-center whitespace-nowrap">
														<button
															type="button"
															onClick={() => handleDelete(session.id)}
															className="p-1 text-slate-300 hover:text-rose-600"
														>
															<Trash2 size={12} />
														</button>
													</td>
												</tr>
											);
										})}
									</tbody>
								</table>
							</div>
							<div className="p-3.5 bg-gradient-to-r from-blue-50 to-indigo-50 border-t border-blue-100 flex-shrink-0">
								<div className="flex justify-between items-center">
									<div className="text-[9px] text-slate-500">
										时薪: ¥{detailStats.totalHourly.toFixed(2)} + 提成: ¥{detailStats.totalCommission.toFixed(2)}
									</div>
									<div className="text-right">
										<div className="text-[9px] text-slate-500 mb-0.5">
											{weekOffset === 0 ? "本周应发" : formatWeekLabel(weekOffset).replace("应发工资", "应发")}
											{isDetailEditing ? " (预览)" : ""}
										</div>
										<div className="font-black text-blue-600 text-xl">¥{detailStats.totalSalary.toFixed(2)}</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				);
			})()}

			{showCommissionRuleModal && (
				<div className="fixed inset-0 z-[100] flex items-end lg:items-center justify-center bg-slate-900/40 backdrop-blur-sm">
					<div className="bg-white w-full max-w-md rounded-t-[1.5rem] lg:rounded-2xl shadow-2xl animate-in slide-in-from-bottom-10 duration-500 overflow-hidden">
						<div className="p-4 border-b border-slate-100 flex items-center justify-between">
							<h3 className="text-base font-black text-slate-800">提点规则说明</h3>
							<button
								type="button"
								onClick={() => setShowCommissionRuleModal(false)}
								className="text-slate-400 hover:text-slate-600"
							>
								<X size={18} />
							</button>
						</div>
						<div className="p-4 space-y-1 text-sm text-slate-700 leading-relaxed">
							<p>提点按本周场均：</p>
							<p>总GMV÷总时长×3;</p>
							<p>未达500为2%，</p>
							<p>≥500为3%，</p>
							<p>≥1000为5%，</p>
							<p>≥1500为7%，</p>
							<p>≥2000为10%，</p>
							<p>≥3000为13%，</p>
							<p>≥4000为15%</p>
						</div>
						<div className="p-4 border-t border-slate-100">
							<button
								type="button"
								onClick={() => setShowCommissionRuleModal(false)}
								className="w-full py-3 bg-blue-600 text-white text-sm font-black rounded-xl active:scale-95 transition-all"
							>
								知道了
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default AnchorSalary;
