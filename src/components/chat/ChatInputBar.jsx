import {
	AlertCircle,
	AlertTriangle,
	Clock,
	Lock,
	Paperclip,
	Pause,
	Play,
	Send,
	Sparkles,
	Square,
} from "lucide-react";
import { Button, Glass } from "open-glass-ui";
import React from "react";
import { handleEditorPaste } from "./chatEditorUtils";

export default function ChatInputBar({
	variant = "active",
	isOnline = true,
	hasGeminiKey = true,
	isLoading = false,
	isStreaming = false,
	isPaused = false,
	hasInputContent = false,
	setHasInputContent,
	onSend,
	onStopGeneration,
	onTogglePauseResume,
	onFileUpload,
	onNavigateToSettings,
	editorRef,
	attachedFilesMapRef,
	fileInputRef,
	isEn = false,
}) {
	const isHero = variant === "hero";

	if (!isOnline) {
		return (
			<Glass
				as="div"
				material="regular"
				look="smoked"
				className="chat-input-capsule ogui-card"
				style={{
					width: isHero ? "min(100%, 740px)" : "100%",
					maxWidth: isHero ? "740px" : "860px",
					minHeight: isHero ? "54px" : "52px",
					borderRadius: "var(--radius-pill)",
					padding: "8px 20px",
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					gap: "12px",
					pointerEvents: "auto",
				}}
			>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: "10px",
						fontSize: "clamp(0.78rem, 1.4vw, 0.86rem)",
						color: "#fde047",
						fontWeight: "600",
						whiteSpace: "nowrap",
						overflow: "hidden",
						textOverflow: "ellipsis",
						flex: 1,
						minWidth: 0,
					}}
				>
					<AlertTriangle
						size={18}
						style={{ color: "#fde047", flexShrink: 0 }}
					/>
					<span
						style={{
							whiteSpace: "nowrap",
							overflow: "hidden",
							textOverflow: "ellipsis",
						}}
					>
						{isEn
							? "Warning: Internet disconnected — AI Chat is locked (History available)"
							: "تحذير: انقطع الاتصال بالإنترنت — المحادثة مقفلة (تصفح السجل متاح)"}
					</span>
				</div>
				<div
					style={{
						display: "inline-flex",
						alignItems: "center",
						gap: "6px",
						fontSize: "0.78rem",
						color: "#fde047",
						padding: "4px 12px",
						borderRadius: "var(--radius-pill)",
						backgroundColor: "rgba(234, 179, 8, 0.15)",
						border: "1px solid rgba(234, 179, 8, 0.3)",
						whiteSpace: "nowrap",
						fontWeight: "700",
					}}
				>
					<Lock size={13} />
					<span>{isEn ? "Offline" : "بدون إنترنت"}</span>
				</div>
			</Glass>
		);
	}

	if (!hasGeminiKey) {
		return (
			<Glass
				as="div"
				material="regular"
				look="liquid"
				className="chat-input-capsule ogui-card"
				style={{
					width: isHero ? "min(100%, 740px)" : "100%",
					maxWidth: isHero ? "740px" : "860px",
					minHeight: isHero ? "54px" : "52px",
					borderRadius: "var(--radius-pill)",
					padding: "8px 16px 8px 20px",
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					gap: "12px",
					pointerEvents: "auto",
				}}
			>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: "8px",
						fontSize: "0.85rem",
						color: "var(--status-late)",
						fontWeight: "600",
					}}
				>
					<AlertCircle size={16} style={{ flexShrink: 0 }} />
					<span>
						{isEn
							? "Gemini API Key is required to enable chat with Sheikh Muneer"
							: "يلزم إضافة مفتاح Gemini API لتفعيل الدردشة مع الشيخ منير"}
					</span>
				</div>
				<Button
					type="button"
					variant="secondary"
					size="small"
					style={{
						borderRadius: "var(--radius-pill)",
					}}
					onClick={onNavigateToSettings}
				>
					<span>{isEn ? "Go to Settings" : "الانتقال للإعدادات"}</span>
				</Button>
			</Glass>
		);
	}

	if (isHero) {
		return (
			<Glass
				as="div"
				material="regular"
				look="liquid"
				className="chat-input-capsule ogui-card"
				style={{
					width: "min(100%, 740px)",
					minHeight: "54px",
					borderRadius: "var(--radius-pill)",
					padding: "6px 8px 6px 14px",
					display: "flex",
					alignItems: "center",
					gap: "10px",
					transition: "all 0.2s ease",
					pointerEvents: "auto",
				}}
			>
				{/* Hidden file input */}
				<input
					type="file"
					ref={fileInputRef}
					style={{ display: "none" }}
					onChange={onFileUpload}
					multiple
				/>

				{/* 1. Model Icon when empty, or Send Button when active */}
				{hasInputContent ? (
					<Button
						type="button"
						variant="primary"
						size="medium"
						onClick={() => onSend()}
						style={{
							borderRadius: "var(--radius-pill)",
							flexShrink: 0,
						}}
						id="hero-send-btn"
					>
						<Send size={15} />
						<span>{isEn ? "Send" : "إرسال"}</span>
					</Button>
				) : (
					<div
						className="input-capsule-action"
						style={{
							width: "40px",
							height: "40px",
							borderRadius: "50%",
							backgroundColor: "rgba(255, 255, 255, 0.07)",
							border: "1px solid rgba(255, 255, 255, 0.12)",
							display: "inline-flex",
							alignItems: "center",
							justifyContent: "center",
							color: "#ffffff",
							flexShrink: 0,
						}}
						title={isEn ? "Sheikh Muneer AI" : "الشيخ منير الذكي"}
					>
						<Sparkles size={18} />
					</div>
				)}

				{/* 2. Inline Rich Input Editor */}
				<div
					ref={editorRef}
					contentEditable={true}
					dir={isEn ? "ltr" : "rtl"}
					className="rich-chat-input"
					data-placeholder={isEn ? "Ask Sheikh Muneer..." : "إسأل الشيخ منير…"}
					onInput={(e) => {
						const hasAny =
							e.currentTarget.innerText.trim().length > 0 ||
							e.currentTarget.querySelectorAll(".inline-file-chip").length > 0;
						if (setHasInputContent) setHasInputContent(hasAny);
					}}
					onPaste={(e) =>
						handleEditorPaste(
							e,
							editorRef?.current,
							attachedFilesMapRef,
							setHasInputContent,
						)
					}
					onKeyDown={(e) => {
						if (e.key === "Enter" && !e.shiftKey) {
							e.preventDefault();
							onSend();
						}
					}}
					id="hero-chat-input"
				/>

				{/* 3. Model Indicator Badge */}
				<div
					className="input-capsule-model"
					style={{
						height: "32px",
						display: "inline-flex",
						alignItems: "center",
						justifyContent: "center",
						gap: "6px",
						padding: "0 12px",
						borderRadius: "var(--radius-pill)",
						backgroundColor: "rgba(255, 255, 255, 0.06)",
						border: "1px solid rgba(255, 255, 255, 0.10)",
						fontSize: "0.78rem",
						color: "var(--text-secondary)",
						whiteSpace: "nowrap",
						flexShrink: 0,
					}}
				>
					<span>Muneer AI</span>
				</div>

				{/* 4. Attach File Button */}
				<button
					type="button"
					className="input-capsule-attach"
					style={{
						width: "38px",
						height: "38px",
						background: "rgba(255, 255, 255, 0.06)",
						border: "1px solid rgba(255, 255, 255, 0.10)",
						color: "var(--text-secondary)",
						cursor: "pointer",
						display: "inline-flex",
						alignItems: "center",
						justifyContent: "center",
						padding: 0,
						borderRadius: "50%",
						transition: "all 0.15s ease",
						flexShrink: 0,
					}}
					onClick={() => fileInputRef?.current?.click()}
					title={isEn ? "Attach files or images" : "إضافة ملفات"}
					id="hero-attach-file-btn"
				>
					<Paperclip size={16} />
				</button>
			</Glass>
		);
	}

	// Active Mode (Bottom pinned)
	return (
		<>
			<Glass
				as="div"
				material="regular"
				look="liquid"
				className="chat-input-capsule ogui-card"
				style={{
					pointerEvents: "auto",
					width: "100%",
					maxWidth: "860px",
					minHeight: "52px",
					borderRadius: "var(--radius-pill)",
					padding: "6px 8px 6px 14px",
					display: "flex",
					alignItems: "center",
					gap: "10px",
				}}
			>
				<input
					type="file"
					ref={fileInputRef}
					style={{ display: "none" }}
					onChange={onFileUpload}
					multiple
				/>

				{/* 1. Send / Pause / Resume / Stop Buttons / Model Icon */}
				{isLoading || isStreaming ? (
					<div
						className="input-capsule-action"
						style={{
							display: "flex",
							alignItems: "center",
							gap: "6px",
							flexShrink: 0,
						}}
					>
						{/* Queue Pending Message Button if user typed text */}
						{hasInputContent && (
							<Button
								type="button"
								variant="secondary"
								size="small"
								onClick={() => onSend()}
								style={{
									borderRadius: "var(--radius-pill)",
								}}
								title={
									isEn
										? "Queue pending message"
										: "إرسال رسالة معلقة (في الطابور)"
								}
								id="chat-queue-btn"
							>
								<Clock size={13} />
								<span>{isEn ? "Queue" : "تعليق"}</span>
							</Button>
						)}

						{/* Stop Button */}
						<button
							type="button"
							className="btn-danger"
							onClick={onStopGeneration}
							style={{
								width: "38px",
								height: "38px",
								display: "inline-flex",
								alignItems: "center",
								justifyContent: "center",
								padding: 0,
								backgroundColor: "rgba(239, 68, 68, 0.16)",
								color: "#ef4444",
								border: "1px solid rgba(239, 68, 68, 0.35)",
								borderRadius: "50%",
								cursor: "pointer",
								transition: "all 0.2s ease",
							}}
							id="chat-stop-btn"
							title={isEn ? "Stop response" : "إنهاء وإيقاف الرد"}
							aria-label={isEn ? "Stop response" : "إنهاء وإيقاف الرد"}
						>
							<Square size={13} style={{ fill: "currentColor" }} />
						</button>

						{/* Pause / Resume Button */}
						{isStreaming && (
							<button
								type="button"
								onClick={onTogglePauseResume}
								style={{
									width: "38px",
									height: "38px",
									display: "inline-flex",
									alignItems: "center",
									justifyContent: "center",
									padding: 0,
									backgroundColor: isPaused
										? "rgba(255, 255, 255, 0.22)"
										: "rgba(255, 255, 255, 0.16)",
									color: "#ffffff",
									border: isPaused
										? "1px solid rgba(255, 255, 255, 0.45)"
										: "1px solid rgba(255, 255, 255, 0.35)",
									borderRadius: "50%",
									cursor: "pointer",
									transition: "all 0.2s ease",
									boxShadow: isPaused
										? "0 4px 12px rgba(0, 0, 0, 0.25)"
										: "none",
								}}
								id="chat-pause-resume-btn"
								title={
									isPaused
										? isEn
											? "Resume response"
											: "استئناف كتابة الرد"
										: isEn
											? "Pause response"
											: "إيقاف الرد مؤقتاً"
								}
								aria-label={
									isPaused
										? isEn
											? "Resume response"
											: "استئناف كتابة الرد"
										: isEn
											? "Pause response"
											: "إيقاف الرد مؤقتاً"
								}
							>
								{isPaused ? (
									<Play size={14} style={{ fill: "currentColor" }} />
								) : (
									<Pause size={14} style={{ fill: "currentColor" }} />
								)}
							</button>
						)}
					</div>
				) : hasInputContent ? (
					<Button
						type="button"
						variant="primary"
						size="medium"
						onClick={() => onSend()}
						style={{
							borderRadius: "var(--radius-pill)",
							flexShrink: 0,
						}}
						id="chat-send-btn"
					>
						<Send size={15} />
						<span>{isEn ? "Send" : "إرسال"}</span>
					</Button>
				) : (
					<div
						className="input-capsule-action"
						style={{
							width: "38px",
							height: "38px",
							borderRadius: "50%",
							backgroundColor: "rgba(255, 255, 255, 0.07)",
							border: "1px solid rgba(255, 255, 255, 0.12)",
							display: "inline-flex",
							alignItems: "center",
							justifyContent: "center",
							color: "#ffffff",
							flexShrink: 0,
						}}
						title={isEn ? "Sheikh Muneer AI" : "الشيخ منير الذكي"}
					>
						<Sparkles size={17} />
					</div>
				)}

				{/* 2. Inline Rich Input Editor */}
				<div
					ref={editorRef}
					contentEditable={true}
					dir={isEn ? "ltr" : "rtl"}
					className="rich-chat-input"
					data-placeholder={isEn ? "Ask Sheikh Muneer..." : "إسأل الشيخ منير…"}
					onInput={(e) => {
						const hasAny =
							e.currentTarget.innerText.trim().length > 0 ||
							e.currentTarget.querySelectorAll(".inline-file-chip").length > 0;
						if (setHasInputContent) setHasInputContent(hasAny);
					}}
					onPaste={(e) =>
						handleEditorPaste(
							e,
							editorRef?.current,
							attachedFilesMapRef,
							setHasInputContent,
						)
					}
					onKeyDown={(e) => {
						if (e.key === "Enter" && !e.shiftKey) {
							e.preventDefault();
							onSend();
						}
					}}
					id="chat-text-input"
				/>

				{/* 3. Model Indicator Badge */}
				<div
					className="input-capsule-model"
					style={{
						height: "30px",
						display: "inline-flex",
						alignItems: "center",
						justifyContent: "center",
						gap: "6px",
						padding: "0 10px",
						borderRadius: "var(--radius-pill)",
						backgroundColor: "rgba(255, 255, 255, 0.06)",
						border: "1px solid rgba(255, 255, 255, 0.10)",
						fontSize: "0.75rem",
						color: "var(--text-secondary)",
						whiteSpace: "nowrap",
						flexShrink: 0,
					}}
				>
					<span>Muneer AI</span>
				</div>

				{/* 4. Attach File Button */}
				<button
					type="button"
					className="input-capsule-attach"
					style={{
						width: "36px",
						height: "36px",
						background: "rgba(255, 255, 255, 0.06)",
						border: "1px solid rgba(255, 255, 255, 0.10)",
						color: "var(--text-secondary)",
						cursor: "pointer",
						display: "inline-flex",
						alignItems: "center",
						justifyContent: "center",
						padding: 0,
						borderRadius: "50%",
						transition: "all 0.15s ease",
						flexShrink: 0,
					}}
					onClick={() => fileInputRef?.current?.click()}
					title={isEn ? "Attach files or images" : "إضافة ملفات"}
					id="attach-file-btn"
				>
					<Paperclip size={16} />
				</button>
			</Glass>

			{/* Disclaimer Note */}
			<div
				style={{
					pointerEvents: "auto",
					fontSize: "0.70rem",
					color: "var(--text-muted)",
					textAlign: "center",
					opacity: 0.85,
					userSelect: "none",
				}}
			>
				{isEn
					? "Sheikh Muneer may make mistakes. Please verify religious rulings."
					: "قد يرتكب الشيخ منير أخطاءً، لذا يُرجى التحقق من ردوده."}
			</div>
		</>
	);
}
