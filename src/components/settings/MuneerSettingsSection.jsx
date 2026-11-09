import { Eye, EyeOff, Key } from "lucide-react";
import { Card, IconButton, TextField } from "open-glass-ui";
import React from "react";

export default function MuneerSettingsSection({
	geminiApiKey,
	showGeminiKey,
	setShowGeminiKey,
	onInputChange,
	isEn,
}) {
	return (
		<Card
			eyebrow={isEn ? "AI Configuration" : "إعدادات الذكاء الاصطناعي"}
			title={
				<div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
					<Key size={22} style={{ color: "#ffffff" }} />
					<span>
						{isEn
							? "AI Assistant Key (Sheikh Muneer)"
							: "مفتاح الذكاء الاصطناعي (الشيخ منير)"}
					</span>
				</div>
			}
		>
			<p
				style={{
					margin: "0 0 16px 0",
					fontSize: "0.85rem",
					color: "var(--ogui-color-muted, rgba(255, 255, 255, 0.75))",
				}}
			>
				{isEn
					? "To enable smart responses, rulings, and personalized remembrances"
					: "لتفعيل الردود الذكية والفتاوى والأذكار الشخصية"}
			</p>

			<div style={{ position: "relative", width: "100%", marginBottom: "12px" }}>
				<TextField
					label={isEn ? "Gemini API Key" : "مفتاح Gemini API"}
					type={showGeminiKey ? "text" : "password"}
					value={geminiApiKey || ""}
					onChange={(e) => onInputChange("geminiApiKey", e.target.value)}
					placeholder="AIzaSy..."
				/>
				<div
					style={{
						position: "absolute",
						top: "32px",
						[isEn ? "right" : "left"]: "8px",
						zIndex: 2,
					}}
				>
					<IconButton
						aria-label={showGeminiKey ? "Hide key" : "Show key"}
						variant="quiet"
						size="small"
						onClick={() => setShowGeminiKey((prev) => !prev)}
					>
						{showGeminiKey ? <EyeOff size={16} /> : <Eye size={16} />}
					</IconButton>
				</div>
			</div>

			<div
				style={{
					fontSize: "0.82rem",
					color: "var(--ogui-color-muted, rgba(255, 255, 255, 0.7))",
					lineHeight: 1.5,
				}}
			>
				{isEn
					? "Get your free Gemini API key with one click from "
					: "يمكنك الحصول على مفتاح Gemini مجاناً بنقرة واحدة من "}
				<a
					href="https://aistudio.google.com/app/apikey"
					target="_blank"
					rel="noopener noreferrer"
					style={{
						color: "var(--ogui-color-accent, #38bdf8)",
						textDecoration: "underline",
						fontWeight: "700",
					}}
				>
					Google AI Studio
				</a>
				{isEn
					? ". The key is saved locally on your device only."
					: ". يُحفظ المفتاح محلياً على جهازك فقط."}
			</div>
		</Card>
	);
}
