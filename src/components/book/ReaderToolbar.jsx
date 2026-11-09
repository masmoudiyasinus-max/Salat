import { Lock, Maximize2, Minimize2, Moon, Sun, Unlock, X } from "lucide-react";
import { Button, Glass } from "open-glass-ui";
import React from "react";

export default function ReaderToolbar({
	activeBook = null,
	wardDayTitle = "",
	readingTheme = "default",
	isHoverLocked = false,
	showControls = true,
	isMouseOverDock = false,
	showUnlockTrigger = false,
	isFullscreen = false,
	onCycleTheme,
	onLockHover,
	onUnlockHover,
	onToggleFullscreen,
	onCloseReader,
	onMouseEnterDock,
	onMouseLeaveDock,
	isEn = false,
}) {
	const isDockVisible = !isHoverLocked && (showControls || isMouseOverDock);

	return (
		<>
			{/* Unified Floating Frosted Glass Dock */}
			<Glass
				as="div"
				material="regular"
				look="liquid"
				className="floating-vertical-dock ogui-dock ogui-card"
				onMouseEnter={onMouseEnterDock}
				onMouseLeave={onMouseLeaveDock}
				style={{
					position: "fixed",
					bottom: "24px",
					left: "50%",
					transform: isDockVisible
						? "translateX(-50%) translateY(0)"
						: "translateX(-50%) translateY(14px)",
					zIndex: 1000,
					borderRadius: "var(--modal-radius)",
					padding: "10px 18px",
					display: "inline-flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					gap: "8px",
					whiteSpace: "nowrap",
					opacity: isDockVisible ? 1 : 0,
					pointerEvents: isDockVisible ? "auto" : "none",
					transition: "opacity 0.28s ease, transform 0.28s ease",
				}}
			>
				{/* Row 1: Dedicated Clean Book Name & Ward Day Info */}
				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						gap: "8px",
						padding: "2px 8px",
					}}
				>
					<span
						style={{
							fontSize: "0.96rem",
							fontWeight: "700",
							color: "#ffffff",
							letterSpacing: "0.2px",
						}}
					>
						{activeBook?.name || (isEn ? "Reading Book" : "قراءة الكتاب")}
					</span>
					<span
						style={{ color: "rgba(255, 255, 255, 0.35)", fontSize: "0.90rem" }}
					>
						•
					</span>
					<span
						style={{
							fontSize: "0.86rem",
							fontWeight: "600",
							color: "rgba(255, 255, 255, 0.75)",
						}}
					>
						{wardDayTitle}
					</span>
				</div>

				{/* Row 2: Action Buttons */}
				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						gap: "8px",
					}}
				>
					{/* Reading Theme Toggle */}
					<Button
						type="button"
						variant="secondary"
						size="small"
						onClick={onCycleTheme}
						title={
							isEn
								? "Toggle reading mode (Warm Night Mode / Original)"
								: "تبديل نمط الإضاءة (نمط ليلي دافئ / أصلي)"
						}
					>
						{readingTheme === "dark" ? (
							<Moon size={14} style={{ color: "#f59e0b", flexShrink: 0 }} />
						) : (
							<Sun size={14} style={{ color: "#f59e0b", flexShrink: 0 }} />
						)}
						<span>
							{readingTheme === "dark"
								? isEn
									? "Warm Night"
									: "ليلي دافئ"
								: isEn
									? "Original"
									: "أصلي"}
						</span>
					</Button>

					{/* Lock Hover Button */}
					<Button
						type="button"
						variant="secondary"
						size="small"
						onClick={onLockHover}
						title={
							isEn
								? "Lock hover (hide all elements for distraction-free reading)"
								: "قفل الهوفر (إخفاء كافة العناصر لمنع أي تشويش أثناء القراءة)"
						}
					>
						<Lock size={14} />
						<span>{isEn ? "Lock Hover" : "قفل الهوفر"}</span>
					</Button>

					{/* Native Fullscreen Button */}
					<Button
						type="button"
						variant="secondary"
						size="small"
						onClick={onToggleFullscreen}
						title={
							isFullscreen
								? isEn
									? "Exit Fullscreen"
									: "إنهاء ملء الشاشة"
								: isEn
									? "Native Browser Fullscreen"
									: "ملء شاشة المتصفح"
						}
					>
						{isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
						<span>
							{isFullscreen
								? isEn
									? "Exit Fullscreen"
									: "تصغير الشاشة"
								: isEn
									? "Fullscreen"
									: "ملء الشاشة"}
						</span>
					</Button>

					{/* Exit Reader Button */}
					<Button
						type="button"
						variant="danger"
						size="small"
						onClick={onCloseReader}
						title={isEn ? "Exit Reader" : "إغلاق القراءة والعودة"}
					>
						<X size={14} />
						<span>{isEn ? "Exit Reader" : "إغلاق القراءة والعودة"}</span>
					</Button>
				</div>
			</Glass>

			{/* Subtle Floating Unlock Button */}
			{isHoverLocked && (
				<div
					style={{
						position: "fixed",
						bottom: "24px",
						left: "50%",
						transform: showUnlockTrigger
							? "translateX(-50%) translateY(0)"
							: "translateX(-50%) translateY(14px)",
						zIndex: 1000,
						opacity: showUnlockTrigger ? 1 : 0,
						pointerEvents: showUnlockTrigger ? "auto" : "none",
						transition: "opacity 0.25s ease, transform 0.25s ease",
					}}
				>
					<Button
						type="button"
						variant="secondary"
						size="medium"
						onClick={onUnlockHover}
						style={{
							borderRadius: "var(--radius-pill)",
						}}
						title={
							isEn
								? "Unlock Hover (Restore Controls)"
								: "إلغاء قفل الهوفر (استعادة الأزرار)"
						}
					>
						<Unlock size={15} />
						<span>{isEn ? "Unlock Hover" : "إلغاء قفل الهوفر"}</span>
					</Button>
				</div>
			)}
		</>
	);
}
