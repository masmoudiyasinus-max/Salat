import { Table } from "lucide-react";
import { Badge, Button, Dialog, SearchField } from "open-glass-ui";
import React, { useMemo, useState } from "react";
import { formatTimeDisplay, getCityTodayDateStr } from "../services/timeUtils";

export default function ScheduleTableModal({
	isOpen,
	onClose,
	scheduleData,
	isEn,
	is12HourFormat = false,
	timezone,
}) {
	const [searchQuery, setSearchQuery] = useState("");

	const effectiveTz = timezone || scheduleData?.timezone;
	const todayISO = useMemo(
		() => getCityTodayDateStr(effectiveTz),
		[effectiveTz],
	);

	const scheduleEntries = useMemo(() => {
		if (!scheduleData || !scheduleData.schedule) return [];
		const raw = scheduleData.schedule || {};
		const entries = Object.entries(raw)
			.filter(([_, times]) => times && typeof times === "object")
			.map(([dateStr, times]) => ({
				dateStr,
				times: times || {},
				isToday: dateStr === todayISO,
			}));

		// Sort chronologically
		entries.sort((a, b) => a.dateStr.localeCompare(b.dateStr));

		if (!searchQuery.trim()) return entries;
		const q = searchQuery.toLowerCase().trim();
		return entries.filter((e) => e.dateStr.toLowerCase().startsWith(q));
	}, [scheduleData, todayISO, searchQuery]);

	if (!isOpen || !scheduleData || !scheduleData.schedule) return null;

	const prayerColumns = [
		{ key: "Fajr", labelAr: "الفجر", labelEn: "Fajr" },
		{ key: "Sunrise", labelAr: "الشروق", labelEn: "Sunrise" },
		{ key: "Dhuhr", labelAr: "الظهر", labelEn: "Dhuhr" },
		{ key: "Asr", labelAr: "العصر", labelEn: "Asr" },
		{ key: "Maghrib", labelAr: "المغرب", labelEn: "Maghrib" },
		{ key: "Isha", labelAr: "العشاء", labelEn: "Isha" },
	];

	return (
		<Dialog
			open={isOpen}
			onOpenChange={(open) => !open && onClose()}
			title={isEn ? "Prayer Times Schedule Table" : "جدول مواقيت الصلاة المستخرج"}
			description={
				isEn
					? `${scheduleData.totalDays || scheduleEntries.length} days cached locally from ${scheduleData.domain || "Source Website"}`
					: `تم تخزين ${scheduleData.totalDays || scheduleEntries.length} يوماً محلياً من موقع: ${scheduleData.domain || "الموقع المصدر"}`
			}
			closeOnBackdrop={true}
		>
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					gap: "16px",
					width: "100%",
					maxHeight: "75vh",
				}}
			>
				{/* Search Bar & Stats */}
				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						flexWrap: "wrap",
						gap: "12px",
					}}
				>
					<div style={{ flex: "1", maxWidth: "320px" }}>
						<SearchField
							label={isEn ? "Search by date (YYYY-MM-DD)..." : "بحث بالتاريخ (YYYY-MM-DD)..."}
							value={searchQuery}
							onValueChange={setSearchQuery}
						/>
					</div>

					<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
						<Badge tone="accent">
							{isEn
								? `${scheduleEntries.length} Days Showing`
								: `المعروض: ${scheduleEntries.length} يوماً`}
						</Badge>
					</div>
				</div>

				{/* Table Container */}
				<div
					style={{
						overflowX: "auto",
						overflowY: "auto",
						flex: "1",
						maxHeight: "52vh",
						borderRadius: "12px",
						border: "1px solid var(--ogui-hairline, rgba(255, 255, 255, 0.15))",
					}}
				>
					<table
						style={{
							width: "100%",
							borderCollapse: "collapse",
							textAlign: isEn ? "left" : "right",
							fontSize: "0.85rem",
						}}
					>
						<thead>
							<tr
								style={{
									backgroundColor: "rgba(255, 255, 255, 0.06)",
									borderBottom: "1px solid var(--ogui-hairline, rgba(255, 255, 255, 0.15))",
									position: "sticky",
									top: 0,
									zIndex: 2,
								}}
							>
								<th style={{ padding: "12px 16px" }}>{isEn ? "Date" : "التاريخ"}</th>
								{prayerColumns.map((col) => (
									<th key={col.key} style={{ padding: "12px 14px", textAlign: "center" }}>
										{isEn ? col.labelEn : col.labelAr}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{scheduleEntries.length === 0 ? (
								<tr>
									<td
										colSpan={7}
										style={{
											textAlign: "center",
											padding: "36px",
											color: "var(--ogui-color-muted, rgba(255,255,255,0.7))",
										}}
									>
										{isEn
											? "No matching prayer dates found."
											: "لم يتم العثور على تواريخ مطابقة لبحثك."}
									</td>
								</tr>
							) : (
								scheduleEntries.map((row) => (
									<tr
										key={row.dateStr}
										style={{
											borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
											backgroundColor: row.isToday
												? "rgba(56, 189, 248, 0.12)"
												: "transparent",
											fontWeight: row.isToday ? "700" : "normal",
										}}
									>
										<td
											style={{
												padding: "10px 16px",
												fontFamily: "monospace",
												whiteSpace: "nowrap",
											}}
										>
											<div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
												<span>{row.dateStr}</span>
												{row.isToday && (
													<Badge tone="positive">
														{isEn ? "Today" : "اليوم"}
													</Badge>
												)}
											</div>
										</td>

										{prayerColumns.map((col) => {
											const rawVal = row.times[col.key];
											const displayVal = rawVal
												? formatTimeDisplay(
														rawVal,
														is12HourFormat ? "12h" : "24h",
													)
												: "—";
											return (
												<td
													key={col.key}
													style={{
														padding: "10px 14px",
														textAlign: "center",
														fontFamily: "monospace",
														whiteSpace: "nowrap",
													}}
												>
													{displayVal}
												</td>
											);
										})}
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>

				{/* Footer */}
				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						paddingTop: "8px",
						flexWrap: "wrap",
						gap: "12px",
					}}
				>
					<span
						style={{
							fontSize: "0.8rem",
							color: "var(--ogui-color-muted, rgba(255, 255, 255, 0.7))",
						}}
					>
						{isEn
							? "All times are stored offline in your browser."
							: "جميع المواقيت مخزنة محلياً في متصفحك وتعمل تلقائياً بدون اتصال بالإنترنت."}
					</span>

					<Button variant="primary" size="small" onClick={onClose}>
						{isEn ? "Close" : "إغلاق"}
					</Button>
				</div>
			</div>
		</Dialog>
	);
}
