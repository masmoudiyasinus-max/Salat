import { Keyboard } from "lucide-react";
import { Button, Card, Dialog } from "open-glass-ui";
import React from "react";
import { getNavigationShortcutsList } from "../../config/viewsConfig.jsx";

export function KeyboardShortcutsCard({ onOpen, isEn }) {
	return (
		<Card
			eyebrow={isEn ? "Quick Controls" : "التحكم السريع"}
			title={
				<div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
					<Keyboard size={22} style={{ color: "#ffffff" }} />
					<span>
						{isEn
							? "Keyboard Shortcuts & Quick Controls"
							: "اختصارات لوحة المفاتيح والتحكم السريع"}
					</span>
				</div>
			}
			footer={
				<Button
					variant="secondary"
					size="small"
					onClick={onOpen}
					leadingIcon={<Keyboard size={16} />}
					id="btn-open-keyboard-shortcuts-modal"
				>
					{isEn ? "View Shortcuts Map" : "عرض خريطة الاختصارات"}
				</Button>
			}
		>
			<p
				style={{
					margin: 0,
					fontSize: "0.85rem",
					color: "var(--ogui-color-muted, rgba(255, 255, 255, 0.75))",
				}}
			>
				{isEn
					? "Direct shortcuts for quick navigation (1-6), live scenes, audio, and focus mode without mouse."
					: "دليل اختصارات الكيبورد المباشرة للتنقل بين الصفحات (1-6)، والتبديل بين المشاهد، والتحكم بالصوت ووضع التركيز."}
			</p>
		</Card>
	);
}

export default function KeyboardShortcutsModal({ isOpen, onClose, isEn }) {
	if (!isOpen) return null;

	const navigationShortcuts = getNavigationShortcutsList(isEn);

	const scenesShortcuts = [
		{ labelAr: "التبديل إلى بث الحرم المكي الشريف", labelEn: "Switch to Makkah Live Stream", key: "M" },
		{ labelAr: "التبديل إلى بث المسجد النبوي الشريف", labelEn: "Switch to Madinah Live Stream", key: "N" },
		{ labelAr: "التبديل إلى مشهد الطبيعة الهادئ", labelEn: "Switch to Nature Meadow Scene", key: "L" },
		{ labelAr: "عرض الصورة المخصصة المحملة", labelEn: "Switch to Uploaded Custom Image", key: "U" },
	];

	const controlsShortcuts = [
		{ labelAr: "كتم / تشغيل صوت البثوث بنعومة", labelEn: "Smooth Audio Mute / Unmute", key: "A" },
		{ labelAr: "وضع التركيز الكامل ومشاهدة البث دون عناصر", labelEn: "Toggle Wallpaper Focus Mode", key: "F" },
	];

	const renderShortcutSection = (title, items) => (
		<div style={{ marginBottom: "20px" }}>
			<div
				style={{
					fontSize: "0.75rem",
					fontWeight: "700",
					letterSpacing: "0.08em",
					textTransform: "uppercase",
					color: "var(--ogui-color-accent, #38bdf8)",
					marginBottom: "10px",
				}}
			>
				{title}
			</div>

			<div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
				{items.map((item, idx) => (
					<div
						key={idx}
						style={{
							display: "flex",
							alignItems: "center",
							justifyContent: "space-between",
							padding: "10px 16px",
							backgroundColor: "rgba(255, 255, 255, 0.04)",
							borderRadius: "12px",
							border: "1px solid var(--ogui-hairline, rgba(255, 255, 255, 0.15))",
						}}
					>
						<span
							style={{
								fontSize: "0.88rem",
								color: "#e5e7eb",
								fontWeight: "600",
							}}
						>
							{isEn ? item.labelEn : item.labelAr}
						</span>
						<kbd
							style={{
								display: "inline-flex",
								alignItems: "center",
								justifyContent: "center",
								minWidth: "26px",
								height: "26px",
								padding: "0 8px",
								fontSize: "0.8rem",
								fontWeight: "700",
								fontFamily: "monospace",
								color: "#ffffff",
								backgroundColor: "rgba(255, 255, 255, 0.12)",
								border: "1px solid rgba(255, 255, 255, 0.25)",
								borderRadius: "6px",
							}}
						>
							{item.key}
						</kbd>
					</div>
				))}
			</div>
		</div>
	);

	return (
		<Dialog
			open={isOpen}
			onOpenChange={(open) => !open && onClose()}
			title={isEn ? "Control Map & Keyboard Shortcuts" : "دليل لوحة التحكم والمفاتيح السريعة"}
			description={isEn ? "Universal quick shortcuts available throughout the app" : "اختصارات سريعة ومتاحة في جميع شاشات التطبيق"}
			closeOnBackdrop={true}
		>
			<div style={{ maxHeight: "70vh", overflowY: "auto", paddingRight: "4px" }}>
				{renderShortcutSection(
					isEn ? "Direct Page & Section Navigation" : "التنقل المباشر بين الصفحات والأقسام",
					navigationShortcuts,
				)}
				{renderShortcutSection(
					isEn ? "Instant Scene & Wallpaper Switch" : "التبديل الفوري بين المشاهد والخلفيات الحية",
					scenesShortcuts,
				)}
				{renderShortcutSection(
					isEn ? "Audio & Screen View Controls" : "التحكم بالصوت ووضع التركيز",
					controlsShortcuts,
				)}
			</div>

			<div style={{ display: "flex", justifyContent: "flex-end", paddingTop: "12px" }}>
				<Button variant="primary" size="small" onClick={onClose}>
					{isEn ? "Done" : "تم"}
				</Button>
			</div>
		</Dialog>
	);
}
