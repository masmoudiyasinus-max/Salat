import { FileText, Image as ImageIcon, X } from "lucide-react";
import { Dialog, Glass } from "open-glass-ui";
import React from "react";

export function FilePreviewItem({
	file,
	onRemove,
	onPreview,
	compact = false,
}) {
	const isImage =
		(file.type && file.type.startsWith("image/")) ||
		(typeof file.content === "string" &&
			file.content.startsWith("data:image/"));

	const handlePreviewClick = (e) => {
		if (isImage) {
			e.stopPropagation();
			if (onPreview) {
				onPreview(file);
			} else {
				window.dispatchEvent(
					new CustomEvent("preview-chat-image", { detail: file }),
				);
			}
		}
	};

	if (compact) {
		if (isImage) {
			return (
				<div
					onClick={handlePreviewClick}
					style={{
						position: "relative",
						width: "38px",
						height: "38px",
						borderRadius: "8px",
						overflow: "hidden",
						border: "1px solid rgba(255, 255, 255, 0.25)",
						backgroundColor: "rgba(10, 10, 10, 0.88)",
						flexShrink: 0,
						display: "inline-flex",
						cursor: "pointer",
						transition: "transform 0.15s ease",
					}}
					title="انقر لتكبير ومعاينة الصورة"
				>
					<img
						src={file.content}
						alt={file.name}
						style={{ width: "100%", height: "100%", objectFit: "cover" }}
					/>
					{onRemove && (
						<button
							type="button"
							onClick={(e) => {
								e.stopPropagation();
								onRemove(file.id);
							}}
							style={{
								position: "absolute",
								top: "2px",
								left: "2px",
								width: "16px",
								height: "16px",
								borderRadius: "50%",
								backgroundColor: "rgba(0, 0, 0, 0.85)",
								border: "1px solid rgba(255, 255, 255, 0.40)",
								color: "#ffffff",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								cursor: "pointer",
								padding: 0,
								zIndex: 2,
							}}
							title="إزالة الصورة"
						>
							<X size={10} />
						</button>
					)}
				</div>
			);
		}

		return (
			<div
				style={{
					position: "relative",
					height: "38px",
					maxWidth: "140px",
					borderRadius: "8px",
					backgroundColor: "rgba(255, 255, 255, 0.08)",
					border: "1px solid rgba(255, 255, 255, 0.18)",
					padding: "0 8px",
					display: "inline-flex",
					alignItems: "center",
					gap: "6px",
					flexShrink: 0,
				}}
			>
				<FileText
					size={15}
					style={{ color: "var(--status-on-time)", flexShrink: 0 }}
				/>
				<span
					style={{
						fontSize: "0.72rem",
						color: "#ffffff",
						fontWeight: "600",
						whiteSpace: "nowrap",
						overflow: "hidden",
						textOverflow: "ellipsis",
					}}
					title={file.name}
				>
					{file.name}
				</span>
				{onRemove && (
					<button
						type="button"
						onClick={() => onRemove(file.id)}
						style={{
							background: "none",
							border: "none",
							color: "var(--text-secondary)",
							cursor: "pointer",
							display: "flex",
							alignItems: "center",
							padding: 0,
							flexShrink: 0,
						}}
						title="إزالة الملف"
					>
						<X size={12} />
					</button>
				)}
			</div>
		);
	}

	if (isImage) {
		return (
			<div
				onClick={handlePreviewClick}
				style={{
					position: "relative",
					width: "64px",
					height: "64px",
					borderRadius: "12px",
					overflow: "hidden",
					border: "1px solid rgba(255, 255, 255, 0.22)",
					boxShadow: "0 8px 20px rgba(0, 0, 0, 0.65)",
					backgroundColor: "rgba(10, 10, 10, 0.88)",
					flexShrink: 0,
					cursor: "pointer",
					transition: "all 0.15s ease",
				}}
				title="انقر لتكبير ومعاينة الصورة"
			>
				<img
					src={file.content}
					alt={file.name}
					style={{ width: "100%", height: "100%", objectFit: "cover" }}
				/>
				{onRemove && (
					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							onRemove(file.id);
						}}
						style={{
							position: "absolute",
							top: "3px",
							left: "3px",
							width: "20px",
							height: "20px",
							borderRadius: "50%",
							backgroundColor: "rgba(0, 0, 0, 0.85)",
							border: "1px solid rgba(255, 255, 255, 0.35)",
							color: "#ffffff",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							cursor: "pointer",
							padding: 0,
							transition: "all 0.15s ease",
							zIndex: 2,
						}}
						title="إزالة الصورة"
					>
						<X size={12} />
					</button>
				)}
			</div>
		);
	}

	return (
		<div
			style={{
				position: "relative",
				height: "56px",
				maxWidth: "190px",
				borderRadius: "12px",
				backgroundColor: "rgba(10, 10, 10, 0.88)",
				border: "1px solid rgba(255, 255, 255, 0.20)",
				boxShadow: "0 8px 20px rgba(0, 0, 0, 0.65)",
				padding: "8px 12px",
				display: "flex",
				alignItems: "center",
				gap: "10px",
				flexShrink: 0,
			}}
		>
			<div
				style={{
					width: "36px",
					height: "36px",
					borderRadius: "8px",
					backgroundColor: "rgba(255, 255, 255, 0.08)",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					color: "var(--status-on-time)",
					flexShrink: 0,
				}}
			>
				<FileText size={18} />
			</div>
			<div style={{ overflow: "hidden", flex: 1 }}>
				<div
					style={{
						fontSize: "0.78rem",
						color: "#ffffff",
						fontWeight: "600",
						whiteSpace: "nowrap",
						overflow: "hidden",
						textOverflow: "ellipsis",
					}}
					title={file.name}
				>
					{file.name}
				</div>
				<div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
					{file.size}
				</div>
			</div>
			{onRemove && (
				<button
					type="button"
					onClick={() => onRemove(file.id)}
					style={{
						position: "absolute",
						top: "-6px",
						left: "-6px",
						width: "20px",
						height: "20px",
						borderRadius: "50%",
						backgroundColor: "rgba(0, 0, 0, 0.85)",
						border: "1px solid rgba(255, 255, 255, 0.35)",
						color: "#ffffff",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						cursor: "pointer",
						padding: 0,
					}}
					title="إزالة الملف"
				>
					<X size={12} />
				</button>
			)}
		</div>
	);
}

export function ImagePreviewModal({ file, onClose, isEn = false }) {
	if (!file) return null;

	return (
		<Dialog
			open={Boolean(file)}
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
			title={file.name || (isEn ? "Image Preview" : "معاينة الصورة")}
			description={file.size ? `${file.size}` : undefined}
		>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					maxHeight: "75vh",
					overflow: "hidden",
				}}
			>
				<img
					src={file.content}
					alt={file.name || (isEn ? "Full image" : "صورة كبيرة")}
					style={{
						maxWidth: "100%",
						maxHeight: "70vh",
						borderRadius: "12px",
						objectFit: "contain",
					}}
				/>
			</div>
		</Dialog>
	);
}
