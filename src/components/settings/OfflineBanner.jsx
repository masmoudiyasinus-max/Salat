import { WifiOff } from "lucide-react";
import React from "react";

export default function OfflineBanner({ isOnline, isEn }) {
	if (isOnline) return null;

	return (
		<div
			style={{
				padding: "14px 20px",
				borderRadius: "16px",
				backgroundColor: "rgba(234, 179, 8, 0.14)",
				border: "1px solid rgba(234, 179, 8, 0.35)",
				color: "#fde047",
				fontSize: "0.88rem",
				display: "flex",
				alignItems: "center",
				gap: "12px",
				lineHeight: "1.6",
				boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
			}}
		>
			<WifiOff size={22} style={{ flexShrink: 0 }} />
			<div>
				<strong style={{ color: "#ffffff" }}>
					{isEn ? "Offline Mode Active:" : "وضع العمل دون إنترنت نشط:"}
				</strong>{" "}
				{isEn
					? "Cloud features (live streams, AI chat, map GPS) are temporarily locked. All prayer calculations, tasbeeh, Quran reading, and notifications work 100% locally."
					: "تم قفل الميزات السحابية (البث المباشر، محادثة الذكاء الاصطناعي، وتحديد الموقع عبر الخرائط). بينما تعمل جميع ميزات تتبع الصلوات، المسبحة، الورد القرآني، والتنبيهات محلياً بنسبة 100%."}
			</div>
		</div>
	);
}
