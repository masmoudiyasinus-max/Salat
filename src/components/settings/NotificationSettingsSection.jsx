import { BellRing } from "lucide-react";
import { Badge, Button, Card } from "open-glass-ui";
import React from "react";

export default function NotificationSettingsSection({
	notifPermission,
	onRequestPermission,
	isEn,
}) {
	const tone =
		notifPermission === "granted"
			? "positive"
			: notifPermission === "denied"
				? "danger"
				: notifPermission === "unsupported"
					? "neutral"
					: "warning";

	return (
		<Card
			eyebrow={isEn ? "System Notifications" : "إشعارات النظام"}
			title={
				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						width: "100%",
						flexWrap: "wrap",
						gap: "10px",
					}}
				>
					<div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
						<BellRing size={22} style={{ color: "#ffffff" }} />
						<span>
							{isEn
								? "Browser Notifications & External Alerts"
								: "إشعارات المتصفح والتنبيهات البارزة"}
						</span>
					</div>

					<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
						<Badge tone={tone}>
							{notifPermission === "granted"
								? isEn ? "Active & Allowed" : "مفعلة ومسموح بها"
								: notifPermission === "denied"
									? isEn ? "Blocked in Browser" : "محظورة بالمتصفح"
									: notifPermission === "unsupported"
										? isEn ? "Unsupported" : "غير مدعومة"
										: isEn ? "Permission Needed" : "بانتظار الموافقة"}
						</Badge>

						{notifPermission === "default" && (
							<Button variant="primary" size="small" onClick={onRequestPermission}>
								{isEn ? "Enable" : "تفعيل"}
							</Button>
						)}
					</div>
				</div>
			}
		>
			<p
				style={{
					margin: 0,
					fontSize: "0.85rem",
					color: "var(--ogui-color-muted, rgba(255, 255, 255, 0.75))",
					lineHeight: "1.6",
				}}
			>
				{isEn
					? "Receive live alerts for adhan times and high-priority prayer reminders directly on your device when outside the website."
					: "استلام تنبيهات حية لأوقات الأذان والتحذيرات عالية الأهمية لفوات الصلاة على جهازك عند تواجدك خارج الموقع."}
			</p>
		</Card>
	);
}
