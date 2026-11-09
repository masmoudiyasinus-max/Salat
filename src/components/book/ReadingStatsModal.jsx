import {
	BookOpen,
	Flame,
	Settings as SettingsIcon,
} from "lucide-react";
import { Alert, Badge, Button, Card, Dialog, Progress, TextField } from "open-glass-ui";
import React, { useEffect, useState } from "react";

export function HabitProgressionHero({
	habitState = {},
	currentDailyTarget = 10,
	todayLog = { pagesRead: 0, completed: false },
	onOpenCustomModal,
	isEn = false,
}) {
	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				gap: "16px",
				marginBottom: "0px",
			}}
		>
			{/* Missed Grace Day Warning Banner */}
			{habitState.missedGraceWarning && (
				<Alert
					tone="warning"
					title={isEn ? "Streak Alert" : "تنبيه انقطاع"}
				>
					{isEn
						? "You missed yesterday! Read today’s ward to preserve your streak and progress."
						: "لقد انقطعت بالأمس! اقرأ ورد اليوم للحفاظ على سلسلتك ومستواك وتفادي إعادة الضبط."}
				</Alert>
			)}

			{/* Unified Card: Daily Reading Habit Ward */}
			<Card
				eyebrow={isEn ? "Daily Habit" : "الورد اليومي"}
				title={
					<div
						style={{
							display: "flex",
							justifyContent: "space-between",
							alignItems: "center",
							width: "100%",
							flexWrap: "wrap",
							gap: "12px",
						}}
					>
						<div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
							<BookOpen size={22} style={{ color: "var(--ogui-color-accent, #38bdf8)" }} />
							<span>{isEn ? "Reading Ward & Habit Progression" : "ورد القراءة وتطور العادة"}</span>
						</div>

						<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
							<Badge tone="accent">
								<span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
									<Flame size={14} style={{ color: "#f97316" }} />
									<span>
										{habitState.currentStreak || 0} {isEn ? "Days Streak" : "يوم متواصل"}
									</span>
								</span>
							</Badge>

							<Button
								variant="quiet"
								size="small"
								onClick={onOpenCustomModal}
								leadingIcon={<SettingsIcon size={15} />}
								id="btn-edit-daily-target"
							>
								{isEn ? "Adjust Ward" : "تعديل الورد"}
							</Button>
						</div>
					</div>
				}
			>
				{/* Streak & Stats Row */}
				<div
					style={{
						display: "grid",
						gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
						gap: "12px",
						margin: "16px 0",
					}}
				>
					<div
						style={{
							padding: "12px",
							backgroundColor: "rgba(255, 255, 255, 0.04)",
							borderRadius: "12px",
							border: "1px solid var(--ogui-hairline, rgba(255, 255, 255, 0.15))",
						}}
					>
						<div style={{ fontSize: "0.78rem", color: "var(--ogui-color-muted, rgba(255, 255, 255, 0.7))" }}>
							{isEn ? "Current Habit Level" : "المستوى الحالي"}
						</div>
						<div style={{ fontSize: "1.2rem", fontWeight: "700", color: "#ffffff", marginTop: "4px" }}>
							{habitState.stageName || (isEn ? "Beginner" : "المرحلة الأولى")}
						</div>
					</div>

					<div
						style={{
							padding: "12px",
							backgroundColor: "rgba(255, 255, 255, 0.04)",
							borderRadius: "12px",
							border: "1px solid var(--ogui-hairline, rgba(255, 255, 255, 0.15))",
						}}
					>
						<div style={{ fontSize: "0.78rem", color: "var(--ogui-color-muted, rgba(255, 255, 255, 0.7))" }}>
							{isEn ? "Daily Ward Target" : "المستهدف اليومي"}
						</div>
						<div style={{ fontSize: "1.2rem", fontWeight: "700", color: "#ffffff", marginTop: "4px" }}>
							{currentDailyTarget} {isEn ? "pages" : "صفحة"}
						</div>
					</div>

					<div
						style={{
							padding: "12px",
							backgroundColor: "rgba(255, 255, 255, 0.04)",
							borderRadius: "12px",
							border: "1px solid var(--ogui-hairline, rgba(255, 255, 255, 0.15))",
						}}
					>
						<div style={{ fontSize: "0.78rem", color: "var(--ogui-color-muted, rgba(255, 255, 255, 0.7))" }}>
							{isEn ? "Pages Read Today" : "صفحات مقروءة اليوم"}
						</div>
						<div style={{ fontSize: "1.2rem", fontWeight: "700", color: "#ffffff", marginTop: "4px" }}>
							{todayLog.pagesRead} {isEn ? "pages" : "صفحة"}
						</div>
					</div>
				</div>

				{/* Progress Readout */}
				<div style={{ marginTop: "12px" }}>
					<Progress
						label={
							isEn
								? `Today's Progress: ${todayLog.pagesRead} / ${currentDailyTarget} pages${todayLog.completed ? " (Completed)" : ""}`
								: `إنجاز اليوم: ${todayLog.pagesRead} من ${currentDailyTarget} صفحة${todayLog.completed ? " (تم الإنجاز)" : ""}`
						}
						value={todayLog.pagesRead}
						max={currentDailyTarget}
					/>
				</div>
			</Card>
		</div>
	);
}

export function ReadingStatsModal({
	isOpen,
	onClose,
	initialTarget = 30,
	onSaveTarget,
	isEn = false,
}) {
	const [targetInput, setTargetInput] = useState(String(initialTarget));

	useEffect(() => {
		setTargetInput(String(initialTarget));
	}, [initialTarget, isOpen]);

	if (!isOpen) return null;

	const handleSave = () => {
		const val = parseInt(targetInput, 10);
		if (!isNaN(val) && val > 0) {
			onSaveTarget(val);
		}
	};

	return (
		<Dialog
			open={isOpen}
			onOpenChange={(open) => !open && onClose()}
			title={isEn ? "Customize Daily Reading Target" : "تحديد الورد اليومي يدوياً"}
			description={
				isEn
					? "Choose your desired number of pages to read every day:"
					: "حدد عدد الصفحات التي ترغب في قراءتها يومياً:"
			}
			closeOnBackdrop={true}
		>
			<div style={{ display: "flex", flexDirection: "column", gap: "18px", paddingTop: "8px" }}>
				<TextField
					label={isEn ? "Pages per day" : "عدد الصفحات يومياً"}
					type="number"
					value={targetInput}
					onChange={(e) => setTargetInput(e.target.value)}
					hint={isEn ? "Recommended: 10 - 50 pages" : "المعدل الشائع: 10 إلى 50 صفحة"}
				/>

				<div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
					<Button variant="secondary" onClick={onClose}>
						{isEn ? "Cancel" : "إلغاء"}
					</Button>
					<Button variant="primary" onClick={handleSave}>
						{isEn ? "Save Target" : "حفظ الورد"}
					</Button>
				</div>
			</div>
		</Dialog>
	);
}
