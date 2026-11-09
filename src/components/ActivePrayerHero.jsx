import {
	CheckCircle,
	Clock,
	Lock,
	Navigation,
	Settings,
	XCircle,
} from "lucide-react";
import { Button } from "open-glass-ui";
import React from "react";
import { GlassHero } from "../theme/OpenGlassEngine";
import { DATA_STATUS } from "../services/dataReadiness";
import {
	formatTimeDisplay,
	getRecords,
	saveRecords,
} from "../services/storage";
import LiveClock from "./LiveClock";
import LiveCountdown from "./LiveCountdown";
import LiveProgressBar from "./LiveProgressBar";

export default function ActivePrayerHero({
	isDataReady,
	prayerTimes,
	settings,
	selectedDate,
	activeObligatoryId,
	activePrayerObj,
	activeAdhanStr,
	isActiveCompleted,
	activeRec,
	activeStatus,
	nextOblId,
	nextPrayerObj,
	nextAdhanStr,
	currentOblDateObj,
	nextOblDateObj,
	timerInfo,
	isNextPrayerTimeArrived,
	isMissedAndLocked,
	isReToggleLocked,
	getToggleHistory,
	saveToggleHistory,
	onRecordUpdated,
	setRecords,
	handleMarkPerformed,
	onOpenModal,
	onQuickAutoDetect,
	isDetectingLocation,
	onNavigateToSettings,
	t,
}) {
	const isEn = settings?.language === "en";
	const dataStatus = isDetectingLocation
		? DATA_STATUS.LOADING
		: isDataReady && activePrayerObj
			? DATA_STATUS.READY
			: DATA_STATUS.UNAVAILABLE;

	return (
		<GlassHero className="active-prayer-hero-card">
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					gap: "22px",
					alignItems: "center",
					textAlign: "center",
				}}
			>
				{/* 1. Reception Row: Clock, Hijri/Gregorian Date & Streak Flame in a Single Row */}
				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						flexWrap: "nowrap",
						whiteSpace: "nowrap",
						gap: "24px",
						textAlign: "center",
						width: "100%",
						overflowX: "auto",
						scrollbarWidth: "none",
						msOverflowStyle: "none",
					}}
				>
					{/* Large Clock & Date Stack */}
					<LiveClock
						timezone={prayerTimes?.timezone}
						city={settings?.city}
						country={settings?.country}
						timeFormat={settings?.timeFormat}
						language={settings?.language}
					/>
				</div>

				{/* Divider Line */}
				<div
					style={{
						width: "100%",
						height: "1px",
						backgroundColor: "rgba(255, 255, 255, 0.10)",
					}}
				/>

				{/* 2. Active Prayer Main Info (Centered - Fit Height) */}
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						justifyContent: "center",
						textAlign: "center",
						width: "100%",
						padding: "4px 0",
					}}
				>
					{dataStatus === DATA_STATUS.READY ? (
						<>
							{/* Top Info (Collapsible Fit-Height on Hover) */}
							<div className="hero-collapsible-wrapper hero-top-wrapper">
								<div className="hero-collapsible-inner">
									<div
										className="hero-top-info"
										style={{
											fontSize: "0.85rem",
											fontWeight: "700",
											color: isActiveCompleted
												? "#ffffff"
												: "var(--text-secondary)",
											paddingBottom: "10px",
											display: "flex",
											alignItems: "center",
											justifyContent: "center",
											gap: "8px",
										}}
									>
										<span>
											{isActiveCompleted
												? isEn
													? "Current Prayer"
													: "الصلاة الحالية"
												: isEn
													? "Current Active Prayer"
													: "الصلاة الحالية الآن"}
										</span>
										{isActiveCompleted && (
											<span className="badge-pill badge-pill-success">
												<CheckCircle size={13} />
												<span>{isEn ? "Prayed" : "أُدِّيت"}</span>
											</span>
										)}
										<span className="badge-pill badge-pill-neutral">
											{isEn ? "Adhan" : "أذان"}{" "}
											{formatTimeDisplay(activeAdhanStr, settings?.timeFormat)}
										</span>
									</div>
								</div>
							</div>

							{/* Main Prayer Name */}
							<h2
								className="hero-prayer-title"
								style={{
									fontSize: "1.75rem",
									fontWeight: "700",
									color: isActiveCompleted ? "#ffffff" : "var(--text-primary)",
									margin: "4px 0",
									lineHeight: 1.2,
									letterSpacing: "-0.02em",
									textAlign: "center",
								}}
							>
								{isEn
									? `${t(activeObligatoryId, activePrayerObj?.nameAr)} Prayer`
									: `صلاة ${activePrayerObj?.nameAr}`}
							</h2>

							{/* Bottom Info (Collapsible Fit-Height on Hover) */}
							{nextPrayerObj && nextAdhanStr && (
								<div className="hero-collapsible-wrapper hero-bottom-wrapper">
									<div className="hero-collapsible-inner">
										<div
											className="hero-bottom-info"
											style={{
												paddingTop: "8px",
												fontSize: "0.9rem",
												fontWeight: "600",
												color: isActiveCompleted
													? "#ffffff"
													: "var(--text-secondary)",
												display: "flex",
												alignItems: "center",
												justifyContent: "center",
												gap: "8px",
												flexWrap: "wrap",
												textAlign: "center",
											}}
										>
											<span>
												{isEn
													? `Next: ${t(nextOblId, nextPrayerObj?.nameAr)}`
													: `الصلاة القادمة: ${nextPrayerObj?.nameAr}`}
											</span>
											<span
												style={{
													fontWeight: "700",
													color: isActiveCompleted
														? "#ffffff"
														: "var(--text-primary)",
												}}
											>
												{isEn ? "Adhan" : "أذان"}{" "}
												{formatTimeDisplay(nextAdhanStr, settings?.timeFormat)}
											</span>
											<LiveCountdown
												nextDateObj={nextOblDateObj}
												timezone={prayerTimes?.timezone}
												language={settings?.language}
											/>
										</div>
									</div>
								</div>
							)}
						</>
					) : (
						<div
							style={{
								display: "flex",
								flexDirection: "column",
								alignItems: "center",
								gap: "12px",
								margin: "8px 0 0 0",
								textAlign: "center",
							}}
						>
							<h2
								style={{
									fontSize: "1.35rem",
									fontWeight: "700",
									color: "#ffffff",
									margin: "4px 0",
									lineHeight: 1.3,
									letterSpacing: "-0.01em",
									textAlign: "center",
								}}
							>
								{dataStatus === DATA_STATUS.LOADING
									? isEn
										? "Fetching Prayer Times..."
										: "جاري جلب مواقيت الصلاة..."
									: isEn
										? "Prayer Times Unavailable"
										: "مواقيت الصلاة غير معروفة"}
							</h2>
							<p
								style={{
									fontSize: "0.86rem",
									color: "rgba(255, 255, 255, 0.72)",
									maxWidth: "380px",
									lineHeight: 1.5,
									margin: "0 auto",
									textAlign: "center",
								}}
							>
								{dataStatus === DATA_STATUS.LOADING
									? isEn
										? "Connecting to official Aladhan API to fetch exact timings for your city..."
										: "يتم الآن جلب مواقيت الصلاة المعتمدة لمدينتك عبر واجهة Aladhan الرسمية (api.aladhan.com)..."
									: isEn
										? "Please select your city in Settings or auto-detect your location to calculate prayer times."
										: "يرجى اختيار مدينتك في الإعدادات أو النقر على تحديد الموقع لبدء حساب مواقيت الصلاة بدقة."}
							</p>
							<div
								style={{
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									gap: "10px",
									flexWrap: "wrap",
								}}
							>
								<Button
									variant="primary"
									size="small"
									onClick={onQuickAutoDetect}
									disabled={isDetectingLocation}
									leadingIcon={<Navigation size={15} style={{ color: "var(--ogui-color-accent-ink, #030712)" }} />}
									id="btn-quick-detect-location"
								>
									{isDetectingLocation
										? isEn
											? "Detecting Location..."
											: "جاري تحديد الموقع..."
										: isEn
											? "Auto-Detect My Location"
											: "تحديد موقعي الحالي تلقائياً"}
								</Button>

								{onNavigateToSettings && (
									<Button
										variant="secondary"
										size="small"
										onClick={onNavigateToSettings}
										leadingIcon={<Settings size={15} />}
										id="btn-quick-open-settings"
									>
										{isEn ? "Open Settings" : "فتح الإعدادات"}
									</Button>
								)}
							</div>
						</div>
					)}
				</div>

				{/* Dynamic Progress Bar Separator - STRICTLY ONLY WHEN DATA IS READY */}
				{dataStatus === DATA_STATUS.READY &&
					currentOblDateObj &&
					nextOblDateObj && (
						<LiveProgressBar
							currentDateObj={currentOblDateObj}
							nextDateObj={nextOblDateObj}
							timezone={prayerTimes?.timezone}
							isActiveCompleted={isActiveCompleted}
						/>
					)}

				{/* 3. Bottom Row: Smart Action Button + Details Link - STRICTLY ONLY WHEN DATA IS READY */}
				{isDataReady && activeObligatoryId && activePrayerObj && (
					<div
						style={{
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							gap: "16px",
							flexWrap: "wrap",
							width: "100%",
							textAlign: "center",
						}}
					>
						<div
							style={{
								display: "flex",
								flexDirection: "column",
								alignItems: "center",
								gap: "8px",
							}}
						>
							{/* Single Unified Smart Performance Button */}
							{(() => {
								const isActiveNextArrived = isNextPrayerTimeArrived
									? isNextPrayerTimeArrived(activeObligatoryId)
									: false;
								const isActiveMissedLocked = isMissedAndLocked
									? isMissedAndLocked(activeObligatoryId)
									: false;
								const isWithin15MinsOfAdhan = timerInfo?.elapsedSecs <= 15 * 60;

								const isDoneOnTime = activeRec && activeStatus === "on_time";
								const isDoneLate =
									activeRec &&
									(activeStatus === "late" || activeStatus === "qada");
								const isMissed =
									activeStatus === "missed" ||
									isActiveNextArrived ||
									isActiveMissedLocked;

								const isFinalReToggleLocked = isReToggleLocked
									? isReToggleLocked(activeObligatoryId)
									: false;

								let BtnIcon = CheckCircle;
								let btnText = isEn
									? `Record ${t(activeObligatoryId, activePrayerObj.nameAr)}`
									: `تسجيل أداء صلاة ${activePrayerObj.nameAr}`;

								if (isFinalReToggleLocked && (isDoneOnTime || isDoneLate)) {
									BtnIcon = Lock;
									btnText = isEn ? "Locked" : "مقفلة نهائياً";
								} else if (isDoneOnTime) {
									BtnIcon = CheckCircle;
									btnText = isEn ? "Prayed on time" : "أُدِّيت في الوقت";
								} else if (isDoneLate) {
									BtnIcon = Clock;
									btnText = isEn ? "Prayed Qada" : "أُدِّيت قضاءً";
								} else if (isMissed) {
									BtnIcon = XCircle;
									btnText = isEn
										? `${t(activeObligatoryId, activePrayerObj.nameAr)} Missed`
										: `صلاة ${activePrayerObj.nameAr} متروكة`;
								} else if (!isWithin15MinsOfAdhan) {
									BtnIcon = Clock;
									btnText = isEn
										? `Record ${t(activeObligatoryId, activePrayerObj.nameAr)} Qada`
										: `تسجيل صلاة ${activePrayerObj.nameAr} قضاءً`;
								}

								return (
									<div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
										<Button
											variant={isDoneOnTime ? "primary" : isMissed ? "danger" : "secondary"}
											size="large"
											leadingIcon={<BtnIcon size={18} style={{ color: "var(--status-on-time)" }} />}
											id={`btn-hero-action-${activeObligatoryId}`}
											disabled={isFinalReToggleLocked && (isDoneOnTime || isDoneLate)}
											onClick={() => {
												if (isMissed) {
													alert(
														isEn
															? `${t(activeObligatoryId, activePrayerObj.nameAr)} prayer was recorded as missed because next prayer adhan has arrived.`
															: `صلاة ${activePrayerObj.nameAr} سُجّلت كمتروكة لعدم أدائها قبل أذان الصلاة التالية، ولا يمكن تحويلها إلى (تم).`,
													);
													return;
												}
												if (isFinalReToggleLocked) return;
												if (activeRec && (isDoneOnTime || isDoneLate)) {
													const toggleKey = `${selectedDate}_${activeObligatoryId}`;
													const history = getToggleHistory ? getToggleHistory() : {};
													history[toggleKey] = Math.max(history[toggleKey] || 0, 1);
													if (saveToggleHistory) saveToggleHistory(history);

													const allRecords = getRecords();
													const updated = allRecords.filter(
														(r) => !(r.date === selectedDate && r.prayer_name === activeObligatoryId),
													);
													saveRecords(updated);
													if (setRecords) setRecords([...updated]);
													if (onRecordUpdated) onRecordUpdated();
													return;
												}
												if (handleMarkPerformed) {
													handleMarkPerformed(activeObligatoryId);
												}
											}}
										>
											{btnText}
										</Button>

										<Button
											variant="quiet"
											size="small"
											onClick={() => onOpenModal(activeObligatoryId)}
											id={`btn-hero-details-${activeObligatoryId}`}
										>
											{isEn ? "Prayer Details & Adjustments" : "تفاصيل وضبط أداء الصلاة"}
										</Button>
									</div>
								);
							})()}
						</div>
					</div>
				)}
			</div>
		</GlassHero>
	);
}
