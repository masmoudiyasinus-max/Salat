import { Music, Upload } from "lucide-react";
import React from "react";

export default function AudioDropzoneEmptyState({
	isDragging,
	isEn,
	onSelectFilesClick,
}) {
	return (
		<div
			onClick={onSelectFilesClick}
			style={{
				flex: 1,
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				gap: "16px",
				border: isDragging
					? "var(--card-border-width) dashed var(--card-border-highlight)"
					: "var(--card-border-width) dashed var(--card-border-color)",
				borderRadius: "var(--card-radius)",
				backgroundColor: isDragging
					? "rgba(255, 255, 255, 0.08)"
					: "rgba(0, 0, 0, 0.20)",
				cursor: "pointer",
				padding: "40px 20px",
				textAlign: "center",
				transition: "all 0.2s ease",
			}}
		>
			<div
				style={{
					width: "72px",
					height: "72px",
					borderRadius: "50%",
					backgroundColor: "rgba(255, 255, 255, 0.08)",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					border: "1px solid rgba(255, 255, 255, 0.15)",
					color: "var(--text-secondary)",
				}}
			>
				<Music size={36} />
			</div>

			<div>
				<h2
					style={{
						fontSize: "1.2rem",
						fontWeight: "700",
						color: "#ffffff",
						margin: "0 0 6px 0",
					}}
				>
					{isEn ? "No Audio Files Selected" : "لم يتم اختيار ملفات صوتية بعد"}
				</h2>
				<p
					style={{
						fontSize: "0.88rem",
						color: "var(--text-muted)",
						margin: 0,
						maxWidth: "420px",
					}}
				>
					{isEn
						? "Click here or drag & drop audio files (MP3, WAV, M4A, FLAC) from any folder to start playing instantly."
						: "انقر هنا لاختيار ملفات صوتية من جهازك أو اسحب وأفلت مقاطعك الصوتية (MP3، WAV، M4A، FLAC) لتشغيلها محلياً."}
				</p>
			</div>

			<div
				style={{
					display: "inline-flex",
					alignItems: "center",
					gap: "8px",
					padding: "10px 22px",
					borderRadius: "var(--radius-pill)",
					backgroundColor: "var(--accent)",
					color: "#000000",
					fontWeight: "700",
					fontSize: "0.90rem",
				}}
			>
				<Upload size={16} />
				<span>{isEn ? "Select Audio Files" : "تحديد ملفات صوتية"}</span>
			</div>
		</div>
	);
}
