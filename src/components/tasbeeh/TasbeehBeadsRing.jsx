import {
	CheckCircle,
	ChevronLeft,
	ChevronRight,
	RotateCcw,
} from "lucide-react";
import { Button, IconButton } from "open-glass-ui";
import React from "react";
import { OPEN_GLASS_CONFIG } from "../../theme/OpenGlassEngine";

export default function TasbeehBeadsRing({
	activeDhikr,
	currentCount,
	currentTarget,
	progressPct,
	isTargetAchieved,
	isClicking,
	isCompletedAnim,
	isEn,
	onIncrement,
	onReset,
	onPrevDhikr,
	onNextDhikr,
}) {
	// Circular SVG dimensions
	const circleRadius = 110;
	const strokeWidth = 10;
	const normalizedRadius = circleRadius - strokeWidth * 0.5;
	const circumference = normalizedRadius * 2 * Math.PI;
	const strokeDashoffset = circumference - (progressPct / 100) * circumference;

	return (
		<div
			style={{
				flex: 1,
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				padding: "8px 12px",
				textAlign: "center",
				position: "relative",
				userSelect: "none",
				minWidth: 0,
				transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
			}}
		>
			{/* Active Dhikr Title & Navigation Arrows */}
			<div
				style={{
					width: "100%",
					maxWidth: "480px",
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					gap: "8px",
					marginBottom: "12px",
				}}
			>
				{/* Previous Dhikr Button */}
				<IconButton
					type="button"
					variant="secondary"
					size="md"
					onClick={onPrevDhikr}
					aria-label={
						isEn ? "Previous dhikr (Right Arrow)" : "الذكر السابق (سهم يمين)"
					}
					style={{
						flexShrink: 0,
					}}
				>
					<ChevronRight size={20} />
				</IconButton>

				{/* Dhikr Title & Virtue */}
				<div
					style={{
						flex: 1,
						minHeight: "68px",
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					<h2
						style={{
							fontSize: "clamp(1.3rem, 2.8vw, 1.85rem)",
							fontWeight: "700",
							color: "#ffffff",
							margin: 0,
							lineHeight: 1.3,
							textShadow: "0 2px 14px rgba(0, 0, 0, 0.85)",
						}}
					>
						{isEn && activeDhikr?.textEn
							? activeDhikr.textEn
							: activeDhikr?.textAr}
					</h2>
					{activeDhikr?.virtueAr && (
						<p
							style={{
								fontSize: "0.82rem",
								color: "var(--text-muted)",
								marginTop: "6px",
								maxWidth: "360px",
								marginInline: "auto",
							}}
						>
							{isEn && activeDhikr?.virtueEn
								? activeDhikr.virtueEn
								: activeDhikr.virtueAr}
						</p>
					)}
				</div>

				{/* Next Dhikr Button */}
				<IconButton
					type="button"
					variant="secondary"
					size="md"
					onClick={onNextDhikr}
					aria-label={isEn ? "Next dhikr (Left Arrow)" : "الذكر التالي (سهم يسار)"}
					style={{
						flexShrink: 0,
					}}
				>
					<ChevronLeft size={20} />
				</IconButton>
			</div>

			{/* Giant Circular Touch Counter Area */}
			<div
				onClick={onIncrement}
				role="button"
				tabIndex={0}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						onIncrement();
					}
				}}
				aria-label={
					isEn ? `Count ${currentCount}` : `العدد الحالي ${currentCount}`
				}
				style={{
					position: "relative",
					width: `${circleRadius * 2}px`,
					height: `${circleRadius * 2}px`,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					cursor: "pointer",
					borderRadius: OPEN_GLASS_CONFIG.counter.radius,
					background: OPEN_GLASS_CONFIG.counter.background,
					border: OPEN_GLASS_CONFIG.counter.border,
					boxShadow: OPEN_GLASS_CONFIG.counter.boxShadow,
					backdropFilter: OPEN_GLASS_CONFIG.counter.backdropFilter,
					WebkitBackdropFilter: OPEN_GLASS_CONFIG.counter.backdropFilter,
					margin: "8px auto 20px auto",
					transform: isClicking
						? "scale(0.95)"
						: isCompletedAnim
							? "scale(1.06)"
							: "scale(1)",
					transition: "transform 0.12s cubic-bezier(0.16, 1, 0.3, 1)",
					outline: "none",
				}}
			>
				{/* SVG Circular Progress Ring */}
				<svg
					width={circleRadius * 2}
					height={circleRadius * 2}
					style={{
						position: "absolute",
						top: 0,
						left: 0,
						transform: "rotate(-90deg)",
					}}
				>
					{/* Background Track Ring */}
					<circle
						stroke="rgba(255, 255, 255, 0.10)"
						fill="transparent"
						strokeWidth={strokeWidth}
						r={normalizedRadius}
						cx={circleRadius}
						cy={circleRadius}
					/>
					{/* Animated Progress Ring */}
					<circle
						stroke={isTargetAchieved ? "var(--status-on-time, #38bdf8)" : "#ffffff"}
						fill="transparent"
						strokeWidth={strokeWidth}
						strokeDasharray={`${circumference} ${circumference}`}
						style={{
							strokeDashoffset,
							transition:
								"stroke-dashoffset 0.18s cubic-bezier(0.16, 1, 0.3, 1), stroke 0.3s ease",
						}}
						r={normalizedRadius}
						cx={circleRadius}
						cy={circleRadius}
					/>
				</svg>

				{/* Counter Numeric Display */}
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						justifyContent: "center",
						zIndex: 2,
						pointerEvents: "none",
					}}
				>
					<div
						style={{
							fontSize: "clamp(2.5rem, 5vw, 3.4rem)",
							fontWeight: "700",
							color: isTargetAchieved ? "var(--status-on-time)" : "#ffffff",
							lineHeight: 1,
							fontVariantNumeric: "tabular-nums",
							textShadow: "0 4px 18px rgba(0, 0, 0, 0.9)",
						}}
					>
						{currentCount}
					</div>
					<div
						style={{
							fontSize: "0.82rem",
							fontWeight: "700",
							color: "var(--text-secondary)",
							marginTop: "6px",
							display: "flex",
							alignItems: "center",
							gap: "4px",
						}}
					>
						<span>
							{isEn ? "Target" : "الهدف"}: {currentTarget}
						</span>
						{isTargetAchieved && (
							<CheckCircle
								size={14}
								style={{ color: "var(--status-on-time)" }}
							/>
						)}
					</div>
				</div>
			</div>

			{/* Action Button: Instant 1-Click Reset Counter */}
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					marginTop: "8px",
				}}
			>
				<Button
					type="button"
					variant="secondary"
					size="md"
					onClick={onReset}
					disabled={currentCount <= 0}
					title={
						isEn ? "Reset counter (Backspace)" : "تصفير العداد (Backspace)"
					}
					style={{
						borderRadius: "var(--radius-pill)",
					}}
				>
					<RotateCcw size={15} />
					<span>{isEn ? "Reset" : "تصفير العداد"}</span>
				</Button>
			</div>
		</div>
	);
}
