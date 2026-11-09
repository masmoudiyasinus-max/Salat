import { Flame } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { GlassCard } from "../theme/OpenGlassEngine";
import { recordTasbeehTapAndCheck } from "../services/muneerSignalService.js";
import {
	addCustomDhikr,
	deleteCustomDhikr,
	getTasbeehState,
	getTodayTotalTasbeehCount,
	incrementDhikrCount,
	moveDhikr,
	reorderDhikrByIndex,
	resetAdhkarToDefaults,
	resetDhikrCount,
	setActiveDhikrId,
	toggleDhikrHidden,
	updateDhikrTarget,
} from "../services/tasbeehStorage.js";
import TasbeehIcon from "./TasbeehIcon.jsx";
import AdhkarDrawer from "./tasbeeh/AdhkarDrawer";
import CustomDhikrModal from "./tasbeeh/CustomDhikrModal";
import DhikrSettingsModal from "./tasbeeh/DhikrSettingsModal";
import TasbeehBeadsRing from "./tasbeeh/TasbeehBeadsRing";
import GlassViewShell from "./layout/GlassViewShell";

export default function TasbeehView({ settings, isActive = true }) {
	const [tasbeehState, setTasbeehState] = useState(() => getTasbeehState());
	const [todayTotal, setTodayTotal] = useState(() =>
		getTodayTotalTasbeehCount(),
	);
	const [isClicking, setIsClicking] = useState(false);
	const [isCompletedAnim, setIsCompletedAnim] = useState(false);
	const [showAddModal, setShowAddModal] = useState(false);
	const [showSettingsModal, setShowSettingsModal] = useState(false);
	const [draggedDhikrIndex, setDraggedDhikrIndex] = useState(null);
	const [dragOverDhikrIndex, setDragOverDhikrIndex] = useState(null);
	const [customTextAr, setCustomTextAr] = useState("");
	const [customTextEn, setCustomTextEn] = useState("");
	const [customTarget, setCustomTarget] = useState("33");
	const [customVirtueAr, setCustomVirtueAr] = useState("");
	const [isSidebarExpanded, setIsSidebarExpanded] = useState(() => {
		try {
			const saved = localStorage.getItem(
				"prayer_tracker_tasbeeh_sidebar_expanded",
			);
			return saved !== null ? JSON.parse(saved) : true;
		} catch {
			return true;
		}
	});

	const handleToggleSidebar = () => {
		setIsSidebarExpanded((prev) => {
			const next = !prev;
			try {
				localStorage.setItem(
					"prayer_tracker_tasbeeh_sidebar_expanded",
					JSON.stringify(next),
				);
			} catch {}
			return next;
		});
	};

	const isEn = settings?.language === "en";

	// Sync state whenever storage changes
	useEffect(() => {
		const handleStorageUpdate = (e) => {
			if (e.detail) {
				setTasbeehState(e.detail);
				setTodayTotal(getTodayTotalTasbeehCount());
			}
		};
		window.addEventListener(
			"prayer_tracker_tasbeeh_updated",
			handleStorageUpdate,
		);
		return () => {
			window.removeEventListener(
				"prayer_tracker_tasbeeh_updated",
				handleStorageUpdate,
			);
		};
	}, []);

	// Filter visible adhkar for active cycling and dial
	const visibleAdhkar = (tasbeehState.adhkar || []).filter((d) => !d.isHidden);
	const currentVisibleIndex = Math.max(
		0,
		visibleAdhkar.findIndex((d) => d.id === tasbeehState.activeDhikrId),
	);
	const activeDhikr =
		visibleAdhkar[currentVisibleIndex] ||
		visibleAdhkar[0] ||
		(tasbeehState.adhkar && tasbeehState.adhkar[0]) ||
		null;

	const currentCount = activeDhikr?.count || 0;
	const currentTarget = activeDhikr?.target || 33;
	const progressPct =
		currentTarget > 0 ? Math.min(100, (currentCount / currentTarget) * 100) : 0;
	const isTargetAchieved = currentTarget > 0 && currentCount >= currentTarget;

	const lastTasbeehTapTimeRef = useRef(0);

	// Perform increment with visual and haptic feedback (strictly zero sound)
	const handleIncrement = useCallback(() => {
		if (!activeDhikr) return;
		const now = Date.now();
		if (now - lastTasbeehTapTimeRef.current < 1000) {
			return; // Enforce strictly 1 second between consecutive tasbeehs
		}
		lastTasbeehTapTimeRef.current = now;
		recordTasbeehTapAndCheck();

		// Visual feedback ripple
		setIsClicking(true);
		setTimeout(() => setIsClicking(false), 120);

		// Haptic vibration
		if (
			tasbeehState.vibrationEnabled &&
			typeof navigator !== "undefined" &&
			navigator.vibrate
		) {
			navigator.vibrate(isTargetAchieved ? [40, 60, 40] : 25);
		}

		if (currentCount + 1 >= currentTarget && currentCount < currentTarget) {
			setIsCompletedAnim(true);
			setTimeout(() => setIsCompletedAnim(false), 1200);
		}

		const updated = incrementDhikrCount(activeDhikr.id, 1);
		setTasbeehState(updated);
		setTodayTotal(getTodayTotalTasbeehCount());
	}, [
		activeDhikr,
		tasbeehState.vibrationEnabled,
		currentCount,
		currentTarget,
		isTargetAchieved,
	]);

	const handleNextDhikr = useCallback(
		(e) => {
			if (e) e.stopPropagation();
			if (visibleAdhkar.length === 0) return;
			const nextIdx = (currentVisibleIndex + 1) % visibleAdhkar.length;
			const updated = setActiveDhikrId(visibleAdhkar[nextIdx].id);
			setTasbeehState(updated);
		},
		[currentVisibleIndex, visibleAdhkar],
	);

	const handlePrevDhikr = useCallback(
		(e) => {
			if (e) e.stopPropagation();
			if (visibleAdhkar.length === 0) return;
			const prevIdx =
				(currentVisibleIndex - 1 + visibleAdhkar.length) % visibleAdhkar.length;
			const updated = setActiveDhikrId(visibleAdhkar[prevIdx].id);
			setTasbeehState(updated);
		},
		[currentVisibleIndex, visibleAdhkar],
	);

	const handleReset = useCallback(
		(e) => {
			if (e) e.stopPropagation();
			if (!activeDhikr || activeDhikr.count <= 0) return;
			const updated = resetDhikrCount(activeDhikr.id);
			setTasbeehState(updated);
			setTodayTotal(getTodayTotalTasbeehCount());
		},
		[activeDhikr],
	);

	// Handle Spacebar tap & Backspace reset (strictly when TasbeehView is active and NOT inside an input or editable field)
	useEffect(() => {
		if (!isActive) return;

		const handleKeyDown = (e) => {
			const target = e.target;
			const targetTag =
				target && target.tagName ? target.tagName.toLowerCase() : "";
			if (
				targetTag === "input" ||
				targetTag === "textarea" ||
				targetTag === "select" ||
				(target && target.isContentEditable) ||
				(target &&
					typeof target.closest === "function" &&
					target.closest('[contenteditable="true"]'))
			) {
				return;
			}
			if (e.code === "Space" || e.key === " ") {
				e.preventDefault();
				handleIncrement();
			} else if (e.code === "Backspace" || e.key === "Backspace") {
				e.preventDefault();
				handleReset();
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [isActive, handleIncrement, handleReset]);

	const handleSelectDhikr = (id) => {
		const updated = setActiveDhikrId(id);
		setTasbeehState(updated);
	};

	const handleMoveDhikr = (e, id, direction) => {
		if (e) e.stopPropagation();
		const updated = moveDhikr(id, direction);
		setTasbeehState(updated);
	};

	const handleDhikrDragStart = (e, index) => {
		setDraggedDhikrIndex(index);
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = "move";
			try {
				e.dataTransfer.setData("text/plain", String(index));
			} catch {}
		}
	};

	const handleDhikrDragOver = (e, index) => {
		e.preventDefault();
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = "move";
		}
		if (dragOverDhikrIndex !== index) {
			setDragOverDhikrIndex(index);
		}
	};

	const handleDhikrDragLeave = (e, index) => {
		e.preventDefault();
		if (dragOverDhikrIndex === index) {
			setDragOverDhikrIndex(null);
		}
	};

	const handleDhikrDrop = (e, targetIndex) => {
		e.preventDefault();
		if (draggedDhikrIndex !== null && draggedDhikrIndex !== targetIndex) {
			const updated = reorderDhikrByIndex(draggedDhikrIndex, targetIndex);
			setTasbeehState(updated);
		}
		setDraggedDhikrIndex(null);
		setDragOverDhikrIndex(null);
	};

	const handleDhikrDragEnd = () => {
		setDraggedDhikrIndex(null);
		setDragOverDhikrIndex(null);
	};

	const handleToggleDhikrVisibility = (e, id) => {
		if (e) e.stopPropagation();
		const updated = toggleDhikrHidden(id);
		setTasbeehState(updated);
	};

	const handleUpdateTarget = (id, newTarget) => {
		const val = Math.max(1, Number(newTarget) || 1);
		const updated = updateDhikrTarget(id, val);
		setTasbeehState(updated);
	};

	const handleResetDefaults = () => {
		const updated = resetAdhkarToDefaults();
		setTasbeehState(updated);
	};

	const handleAddCustomSubmit = (e) => {
		e.preventDefault();
		if (!customTextAr.trim()) return;
		const updated = addCustomDhikr({
			textAr: customTextAr,
			textEn: customTextEn,
			target: Number(customTarget) || 33,
			virtueAr: customVirtueAr,
			virtueEn: "",
		});
		if (updated) {
			setTasbeehState(updated);
			setCustomTextAr("");
			setCustomTextEn("");
			setCustomTarget("33");
			setCustomVirtueAr("");
			setShowAddModal(false);
		}
	};

	const handleDeleteCustom = (e, id) => {
		if (e) e.stopPropagation();
		const updated = deleteCustomDhikr(id);
		setTasbeehState(updated);
	};

	return (
		<GlassViewShell width="wide">
			<GlassCard
				as="section"
				style={{
					maxWidth: "1140px",
					height: "min(860px, calc(100dvh - 84px))",
					minHeight: "min(580px, calc(100dvh - 84px))",
					margin: "0 auto",
					display: "flex",
					flexDirection: "column",
					gap: "16px",
				}}
			>
			{/* 1. Integrated Header & Stats Row */}
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					flexWrap: "wrap",
					gap: "14px",
					flexShrink: 0,
				}}
			>
				<div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
					<div
						style={{
							width: "42px",
							height: "42px",
							borderRadius: "50%",
							backgroundColor: "rgba(255, 255, 255, 0.1)",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							border: "1px solid rgba(255, 255, 255, 0.18)",
							color: "#ffffff",
						}}
					>
						<TasbeehIcon
							size={24}
							style={{
								filter: "drop-shadow(0 0 6px rgba(255, 255, 255, 0.6))",
							}}
						/>
					</div>
					<div>
						<h1
							style={{
								fontSize: "1.3rem",
								fontWeight: "700",
								color: "#ffffff",
								margin: 0,
								lineHeight: 1.2,
							}}
						>
							{isEn
								? "Electronic Tasbeeh & Dhikr"
								: "المسبحة الإلكترونية والأذكار"}
						</h1>
						<p
							style={{
								fontSize: "0.80rem",
								color: "var(--text-muted)",
								margin: "2px 0 0 0",
							}}
						>
							{isEn
								? "Count your daily remembrances and earn rewards"
								: "ألا بذكر الله تطمئن القلوب • عداد أذكار وتسبيح يومي"}
						</p>
					</div>
				</div>

				{/* Today's Total Stat Badge */}
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: "10px",
						padding: "0 4px",
						whiteSpace: "nowrap",
					}}
				>
					<Flame
						size={20}
						style={{ color: "var(--status-on-time)", flexShrink: 0 }}
					/>
					<span
						style={{
							fontSize: "0.90rem",
							color: "var(--text-secondary)",
							fontWeight: "600",
						}}
					>
						{isEn ? "Today's Total:" : "تسبيحات اليوم:"}
					</span>
					<span
						style={{ fontSize: "1.2rem", fontWeight: "700", color: "#ffffff" }}
					>
						{todayTotal.toLocaleString()}
					</span>
				</div>
			</div>

			{/* Divider */}
			<div
				style={{
					width: "100%",
					height: "1px",
					backgroundColor: "var(--border-subtle)",
					flexShrink: 0,
				}}
			/>

			{/* 2. Main Area: Center Masbaha Dial + Gemini-Style Collapsible Adhkar Sidebar */}
			<div
				style={{
					display: "flex",
					gap: "20px",
					alignItems: "stretch",
					width: "100%",
					flex: 1,
					minHeight: 0,
					position: "relative",
				}}
			>
				{/* Center Interactive Dial */}
				<TasbeehBeadsRing
					activeDhikr={activeDhikr}
					currentCount={currentCount}
					currentTarget={currentTarget}
					progressPct={progressPct}
					isTargetAchieved={isTargetAchieved}
					isClicking={isClicking}
					isCompletedAnim={isCompletedAnim}
					isEn={isEn}
					onIncrement={handleIncrement}
					onReset={handleReset}
					onPrevDhikr={handlePrevDhikr}
					onNextDhikr={handleNextDhikr}
				/>

				{/* Gemini-Style Collapsible Adhkar Sidebar */}
				<AdhkarDrawer
					visibleAdhkar={visibleAdhkar}
					activeDhikrId={tasbeehState.activeDhikrId}
					isSidebarExpanded={isSidebarExpanded}
					isEn={isEn}
					onToggleSidebar={handleToggleSidebar}
					onOpenSettings={() => setShowSettingsModal(true)}
					onOpenAddModal={() => setShowAddModal(true)}
					onSelectDhikr={handleSelectDhikr}
					onDeleteCustomDhikr={handleDeleteCustom}
				/>
			</div>

			{/* Comprehensive In-Page Dhikr & Ward Settings Modal */}
			<DhikrSettingsModal
				isOpen={showSettingsModal}
				adhkar={tasbeehState.adhkar}
				isEn={isEn}
				onClose={() => setShowSettingsModal(false)}
				onOpenAddModal={() => {
					setShowSettingsModal(false);
					setShowAddModal(true);
				}}
				onMoveDhikr={handleMoveDhikr}
				onToggleVisibility={handleToggleDhikrVisibility}
				onUpdateTarget={handleUpdateTarget}
				onDeleteCustom={handleDeleteCustom}
				onResetDefaults={handleResetDefaults}
				onDragStart={handleDhikrDragStart}
				onDragOver={handleDhikrDragOver}
				onDragLeave={handleDhikrDragLeave}
				onDrop={handleDhikrDrop}
				onDragEnd={handleDhikrDragEnd}
				draggedDhikrIndex={draggedDhikrIndex}
				dragOverDhikrIndex={dragOverDhikrIndex}
			/>

			{/* Add Custom Dhikr Modal */}
			<CustomDhikrModal
				isOpen={showAddModal}
				isEn={isEn}
				onClose={() => setShowAddModal(false)}
				onSubmit={handleAddCustomSubmit}
				customTextAr={customTextAr}
				setCustomTextAr={setCustomTextAr}
				customTarget={customTarget}
				setCustomTarget={setCustomTarget}
				customVirtueAr={customVirtueAr}
				setCustomVirtueAr={setCustomVirtueAr}
			/>
			</GlassCard>
		</GlassViewShell>
	);
}
