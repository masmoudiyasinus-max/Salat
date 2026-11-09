import {
	AlertCircle,
	Check,
	Clock,
	Copy,
	Edit2,
	Info,
	RotateCcw,
	RotateCw,
	Send,
	SpellCheck,
	ThumbsDown,
	ThumbsUp,
	Trash2,
	User,
	X,
} from "lucide-react";
import { Button } from "open-glass-ui";
import React from "react";
import {
	formatMarkdownText,
	parseInlineMarkdown,
} from "../../services/markdownFormatter.jsx";
import { extractMuneerAction } from "../../services/muneerActions";
import { FilePreviewItem } from "./FileAttachmentList";

export default function ChatMessageList({
	messages = [],
	typingState = "hidden",
	isLoading = false,
	isStreaming = false,
	errorMessage = null,
	editingMessageId = null,
	setEditingMessageId,
	editText = "",
	setEditText,
	correctingMsgId = null,
	copiedMsgId = null,
	feedbackMap = {},
	hoveredInfoMsgId = null,
	setHoveredInfoMsgId,
	messagesEndRef,
	handleCancelPendingMessage,
	handleSaveEditedMessage,
	handleStartEditMessage,
	handleCorrectSpelling,
	handleResendUserMessage,
	handleCopyMessage,
	handleDeleteMessage,
	handleToggleFeedback,
	handleRegenerateResponse,
	settings = {},
	isEn = false,
}) {
	return (
		<div className="chat-messages">
			{messages.map((msg) => {
				if (!msg) return null;
				const safeText =
					typeof msg.text === "string" ? msg.text : String(msg.text || "");

				return (
					<div
						key={msg.id}
						className={`message-bubble ${msg.sender === "user" ? "user" : "assistant"} ${msg.status === "pending" ? "is-pending" : ""}`}
					>
						{/* User Indicator (Icon + Name) + Pending Status Badge */}
						{msg.sender === "user" && (
							<div
								style={{
									display: "flex",
									alignItems: "center",
									justifyContent: "space-between",
									marginBottom: "6px",
									opacity: 0.9,
									color: "var(--text-muted, #a3a3a3)",
									fontSize: "0.78rem",
									fontWeight: "600",
									flexWrap: "wrap",
									gap: "6px",
								}}
							>
								<div
									style={{ display: "flex", alignItems: "center", gap: "6px" }}
								>
									<User size={13} />
									<span>
										{(settings && settings.userName) || (isEn ? "You" : "أنت")}
									</span>
								</div>

								{msg.status === "pending" && (
									<div
										style={{
											display: "inline-flex",
											alignItems: "center",
											gap: "6px",
											backgroundColor: "rgba(255, 255, 255, 0.12)",
											border: "1px solid rgba(255, 255, 255, 0.25)",
											borderRadius: "var(--radius-pill)",
											padding: "2px 8px",
											fontSize: "0.72rem",
											fontWeight: "600",
											color: "#ffffff",
										}}
									>
										<Clock size={11} className="spin-slow" />
										<span>
											{isEn ? "Pending in Queue" : "رسالة معلقة (في الانتظار)"}
										</span>
										<button
											type="button"
											onClick={() => handleCancelPendingMessage(msg.id)}
											style={{
												background: "none",
												border: "none",
												color: "#ef4444",
												cursor: "pointer",
												padding: 0,
												display: "inline-flex",
												alignItems: "center",
											}}
											title={
												isEn
													? "Cancel pending message"
													: "إلغاء الرسالة المعلقة"
											}
										>
											<X size={11} />
										</button>
									</div>
								)}
							</div>
						)}

						{/* Message Content: Editing vs Segments vs Normal Text */}
						{editingMessageId === msg.id ? (
							<div
								style={{
									display: "flex",
									flexDirection: "column",
									gap: "10px",
									marginTop: "6px",
								}}
							>
								{/* Warning notice indicating truncation after this point */}
								<div
									style={{
										display: "flex",
										alignItems: "center",
										gap: "8px",
										backgroundColor: "rgba(255, 255, 255, 0.08)",
										border: "1px solid rgba(255, 255, 255, 0.2)",
										color: "#ffffff",
										padding: "8px 12px",
										borderRadius: "8px",
										fontSize: "0.8rem",
										lineHeight: "1.4",
									}}
								>
									<AlertCircle size={15} style={{ flexShrink: 0 }} />
									<span>
										{isEn
											? "All messages and responses after this point will be removed, starting fresh with your edited prompt."
											: "سيتم مسح جميع الرسائل والردود بعد هذه النقطة والبدء من جديد بالسؤال المعدل."}
									</span>
								</div>

								{/* Text input and action buttons */}
								<div
									style={{ display: "flex", gap: "8px", alignItems: "center" }}
								>
									<input
										type="search"
										className="form-input"
										value={editText}
										onChange={(e) => setEditText(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === "Enter" && !e.shiftKey) {
												e.preventDefault();
												handleSaveEditedMessage(msg.id);
											} else if (e.key === "Escape") {
												setEditingMessageId(null);
											}
										}}
										style={{ fontSize: "0.9rem", padding: "8px 14px", flex: 1 }}
										autoFocus
										autoComplete="off"
										autoCorrect="off"
										autoCapitalize="off"
										spellCheck="false"
										data-lpignore="true"
										data-1p-ignore="true"
										data-form-type="other"
										name="chat_message_edit_field"
									/>
									<Button
										variant="primary"
										size="small"
										onClick={() => handleSaveEditedMessage(msg.id)}
										disabled={!editText.trim() || isLoading || isStreaming}
										title={isEn ? "Save and Resend" : "حفظ وإعادة الإرسال"}
									>
										<Send size={13} />
										<span>{isEn ? "Send" : "إرسال"}</span>
									</Button>
									<Button
										variant="secondary"
										size="small"
										onClick={() => setEditingMessageId(null)}
										title={isEn ? "Cancel Edit" : "إلغاء التعديل"}
									>
										<X size={14} />
										<span>{isEn ? "Cancel" : "إلغاء"}</span>
									</Button>
								</div>
							</div>
						) : Array.isArray(msg.segments) && msg.segments.length > 0 ? (
							<div
								style={{
									lineHeight: "1.7",
									position: "relative",
									display: "flex",
									alignItems: "center",
									flexWrap: "wrap",
									gap: "6px",
								}}
							>
								{msg.segments.map((seg, sIdx) => {
									if (seg.type === "text") {
										return (
											<span key={sIdx}>{parseInlineMarkdown(seg.value)}</span>
										);
									}
									if (seg.type === "file") {
										return (
											<FilePreviewItem
												key={sIdx}
												file={seg.file}
												compact={true}
											/>
										);
									}
									return null;
								})}
							</div>
						) : (
							(() => {
								const extracted = msg.action
									? { cleanText: safeText, action: msg.action }
									: extractMuneerAction(safeText);
								const displayCleanText = extracted.cleanText || safeText;

								return (
									<div style={{ lineHeight: "1.7", position: "relative" }}>
										{formatMarkdownText(displayCleanText, msg.isTyping)}
									</div>
								);
							})()
						)}

						{/* User Message Bottom Action Toolbar */}
						{msg.sender === "user" && editingMessageId !== msg.id && (
							<div
								className={`message-action-toolbar ${hoveredInfoMsgId === msg.id ? "is-active" : ""}`}
							>
								<div
									className="message-action-toolbar-inner"
									style={{
										display: "flex",
										alignItems: "center",
										gap: "10px",
										color: "var(--text-muted, #a3a3a3)",
										fontSize: "0.75rem",
										flexWrap: "wrap",
									}}
								>
									{/* 1. Edit */}
									<button
										type="button"
										className="assistant-action-btn"
										onClick={() => handleStartEditMessage(msg)}
										title={isEn ? "Edit Prompt" : "تعديل الطلب"}
										style={{
											background: "none",
											border: "none",
											color: "inherit",
											cursor: "pointer",
											padding: "4px",
											display: "inline-flex",
											alignItems: "center",
											justifyContent: "center",
											borderRadius: "6px",
										}}
									>
										<Edit2 size={15} />
									</button>

									{/* 2. Spellcheck / Fix Typos */}
									<button
										type="button"
										className="assistant-action-btn"
										onClick={() => handleCorrectSpelling(msg)}
										disabled={correctingMsgId === msg.id}
										title={
											correctingMsgId === msg.id
												? isEn
													? "Correcting spelling..."
													: "جاري تدقيق وتصحيح الأخطاء الإملائية..."
												: isEn
													? "AI Spelling Correction"
													: "تصحيح الأخطاء الإملائية بالذكاء الاصطناعي دون تغيير الكلمات"
										}
										style={{
											background: "none",
											border: "none",
											color: correctingMsgId === msg.id ? "#ffffff" : "inherit",
											cursor: correctingMsgId === msg.id ? "wait" : "pointer",
											padding: "4px",
											display: "inline-flex",
											alignItems: "center",
											justifyContent: "center",
											borderRadius: "6px",
											opacity: correctingMsgId === msg.id ? 0.7 : 1,
											transition: "all 0.2s ease",
										}}
									>
										<SpellCheck
											size={15}
											style={{
												animation:
													correctingMsgId === msg.id
														? "spin 1s linear infinite"
														: "none",
											}}
										/>
									</button>

									{/* 3. Resend */}
									<button
										type="button"
										className="assistant-action-btn"
										onClick={() => handleResendUserMessage(msg)}
										disabled={isLoading || isStreaming}
										title={isEn ? "Resend Prompt" : "إعادة إرسال هذا الطلب"}
										style={{
											background: "none",
											border: "none",
											color: "inherit",
											cursor:
												isLoading || isStreaming ? "not-allowed" : "pointer",
											padding: "4px",
											display: "inline-flex",
											alignItems: "center",
											justifyContent: "center",
											borderRadius: "6px",
										}}
									>
										<RotateCcw size={15} />
									</button>

									{/* 4. Copy */}
									<button
										type="button"
										className="assistant-action-btn"
										onClick={() => handleCopyMessage(msg.id, safeText)}
										title={isEn ? "Copy Text" : "نسخ النص"}
										style={{
											background: "none",
											border: "none",
											color:
												copiedMsgId === msg.id
													? "var(--status-on-time, #ffffff)"
													: "inherit",
											cursor: "pointer",
											padding: "4px",
											display: "inline-flex",
											alignItems: "center",
											justifyContent: "center",
											borderRadius: "6px",
										}}
									>
										{copiedMsgId === msg.id ? (
											<Check size={15} />
										) : (
											<Copy size={15} />
										)}
									</button>

									{/* 5. Delete */}
									<button
										type="button"
										className="assistant-action-btn"
										onClick={() => handleDeleteMessage(msg.id)}
										title={isEn ? "Delete Message" : "حذف هذه الرسالة"}
										style={{
											background: "none",
											border: "none",
											color: "inherit",
											cursor: "pointer",
											padding: "4px",
											display: "inline-flex",
											alignItems: "center",
											justifyContent: "center",
											borderRadius: "6px",
										}}
									>
										<Trash2 size={15} />
									</button>

									{/* 6. Info on hover */}
									<div
										style={{
											position: "relative",
											display: "inline-flex",
											alignItems: "center",
										}}
										onMouseEnter={() =>
											setHoveredInfoMsgId && setHoveredInfoMsgId(msg.id)
										}
										onMouseLeave={() =>
											setHoveredInfoMsgId && setHoveredInfoMsgId(null)
										}
									>
										<button
											type="button"
											className="assistant-action-btn"
											style={{
												background: "none",
												border: "none",
												color:
													hoveredInfoMsgId === msg.id ? "#ffffff" : "inherit",
												cursor: "pointer",
												padding: "4px",
												display: "inline-flex",
												alignItems: "center",
												justifyContent: "center",
												borderRadius: "6px",
											}}
										>
											<Info size={15} />
										</button>

										{hoveredInfoMsgId === msg.id && (
											<div
												style={{
													position: "absolute",
													bottom: "100%",
													right: isEn ? "auto" : "-10px",
													left: isEn ? "-10px" : "auto",
													marginBottom: "8px",
													backgroundColor: "rgba(10, 10, 10, 0.88)",
													backdropFilter: "blur(12px)",
													border: "1px solid rgba(255, 255, 255, 0.15)",
													borderRadius: "8px",
													padding: "8px 14px",
													boxShadow: "0 10px 28px rgba(0, 0, 0, 0.7)",
													display: "flex",
													flexDirection: "column",
													gap: "6px",
													width: "max-content",
													minWidth: "140px",
													whiteSpace: "nowrap",
													zIndex: 60,
													pointerEvents: "none",
													animation: "previewFadeIn 0.15s ease-out",
													textAlign: isEn ? "left" : "right",
													direction: isEn ? "ltr" : "rtl",
													fontSize: "0.75rem",
													color: "var(--text-secondary, #d4d4d4)",
													fontWeight: "400",
												}}
											>
												{msg.timestamp && (
													<div
														style={{
															display: "flex",
															alignItems: "center",
															justifyContent: "space-between",
															gap: "16px",
															whiteSpace: "nowrap",
														}}
													>
														<span style={{ whiteSpace: "nowrap" }}>
															{isEn ? "Time" : "الوقت"}
														</span>
														<span style={{ whiteSpace: "nowrap" }}>
															{msg.timestamp}
														</span>
													</div>
												)}

												{msg.isEdited && (
													<div
														style={{
															display: "flex",
															alignItems: "center",
															justifyContent: "space-between",
															gap: "16px",
															whiteSpace: "nowrap",
														}}
													>
														<span style={{ whiteSpace: "nowrap" }}>
															{isEn ? "Status" : "الحالة"}
														</span>
														<span
															style={{
																whiteSpace: "nowrap",
																color: "var(--status-on-time, #ffffff)",
															}}
														>
															{isEn ? "Edited" : "معدلة"}
														</span>
													</div>
												)}
											</div>
										)}
									</div>
								</div>
							</div>
						)}

						{/* Assistant Message Bottom Action & Meta Bar */}
						{msg.sender === "assistant" && !msg.isTyping && (
							<div
								className={`message-action-toolbar ${hoveredInfoMsgId === msg.id || feedbackMap[msg.id] ? "is-active" : ""}`}
							>
								<div
									className="message-action-toolbar-inner"
									style={{
										display: "flex",
										alignItems: "center",
										justifyContent: "space-between",
										width: "100%",
										color: "var(--text-muted, #a3a3a3)",
										fontSize: "0.75rem",
										gap: "12px",
										flexWrap: "wrap",
									}}
								>
									<div
										style={{
											display: "flex",
											alignItems: "center",
											gap: "10px",
										}}
									>
										{/* 1. Thumbs Up */}
										<button
											type="button"
											className="assistant-action-btn"
											onClick={() => handleToggleFeedback(msg.id, "up")}
											title={isEn ? "Good response" : "إعجاب بالإجابة"}
											style={{
												background: "none",
												border: "none",
												color:
													feedbackMap[msg.id] === "up"
														? "var(--status-on-time, #ffffff)"
														: "inherit",
												cursor: "pointer",
												padding: "4px",
												display: "inline-flex",
												alignItems: "center",
												justifyContent: "center",
												borderRadius: "6px",
											}}
										>
											<ThumbsUp
												size={15}
												fill={
													feedbackMap[msg.id] === "up" ? "currentColor" : "none"
												}
											/>
										</button>

										{/* 2. Thumbs Down */}
										<button
											type="button"
											className="assistant-action-btn"
											onClick={() => handleToggleFeedback(msg.id, "down")}
											title={isEn ? "Bad response" : "عدم إعجاب"}
											style={{
												background: "none",
												border: "none",
												color:
													feedbackMap[msg.id] === "down"
														? "#ef4444"
														: "inherit",
												cursor: "pointer",
												padding: "4px",
												display: "inline-flex",
												alignItems: "center",
												justifyContent: "center",
												borderRadius: "6px",
											}}
										>
											<ThumbsDown
												size={15}
												fill={
													feedbackMap[msg.id] === "down"
														? "currentColor"
														: "none"
												}
											/>
										</button>

										{/* 3. Regenerate */}
										<button
											type="button"
											className="assistant-action-btn"
											onClick={() => handleRegenerateResponse(msg.id)}
											disabled={isLoading || isStreaming}
											title={isEn ? "Regenerate response" : "إعادة توليد الرد"}
											style={{
												background: "none",
												border: "none",
												color: "inherit",
												cursor:
													isLoading || isStreaming ? "not-allowed" : "pointer",
												padding: "4px",
												display: "inline-flex",
												alignItems: "center",
												justifyContent: "center",
												borderRadius: "6px",
											}}
										>
											<RotateCw size={15} className={isLoading ? "spin" : ""} />
										</button>

										{/* 4. Copy */}
										<button
											type="button"
											className="assistant-action-btn"
											onClick={() => handleCopyMessage(msg.id, safeText)}
											title={isEn ? "Copy response" : "نسخ الرد"}
											style={{
												background: "none",
												border: "none",
												color:
													copiedMsgId === msg.id
														? "var(--status-on-time, #ffffff)"
														: "inherit",
												cursor: "pointer",
												padding: "4px",
												display: "inline-flex",
												alignItems: "center",
												justifyContent: "center",
												borderRadius: "6px",
											}}
										>
											{copiedMsgId === msg.id ? (
												<Check size={15} />
											) : (
												<Copy size={15} />
											)}
										</button>

										{/* 5. Delete */}
										<button
											type="button"
											className="assistant-action-btn"
											onClick={() => handleDeleteMessage(msg.id)}
											title={isEn ? "Delete response" : "حذف هذا الرد"}
											style={{
												background: "none",
												border: "none",
												color: "inherit",
												cursor: "pointer",
												padding: "4px",
												display: "inline-flex",
												alignItems: "center",
												justifyContent: "center",
												borderRadius: "6px",
											}}
										>
											<Trash2 size={15} />
										</button>

										{/* 6. Info with hover */}
										{msg.durationSeconds && (
											<div
												style={{
													position: "relative",
													display: "inline-flex",
													alignItems: "center",
												}}
												onMouseEnter={() =>
													setHoveredInfoMsgId && setHoveredInfoMsgId(msg.id)
												}
												onMouseLeave={() =>
													setHoveredInfoMsgId && setHoveredInfoMsgId(null)
												}
											>
												<button
													type="button"
													className="assistant-action-btn"
													style={{
														background: "none",
														border: "none",
														color:
															hoveredInfoMsgId === msg.id
																? "#ffffff"
																: "inherit",
														cursor: "pointer",
														padding: "4px",
														display: "inline-flex",
														alignItems: "center",
														justifyContent: "center",
														borderRadius: "6px",
													}}
												>
													<Info size={15} />
												</button>

												{hoveredInfoMsgId === msg.id && (
													<div
														style={{
															position: "absolute",
															bottom: "100%",
															right: isEn ? "auto" : "-10px",
															left: isEn ? "-10px" : "auto",
															marginBottom: "8px",
															backgroundColor: "rgba(10, 10, 10, 0.88)",
															backdropFilter: "blur(12px)",
															border: "1px solid rgba(255, 255, 255, 0.15)",
															borderRadius: "8px",
															padding: "8px 14px",
															boxShadow: "0 10px 28px rgba(0, 0, 0, 0.7)",
															display: "flex",
															flexDirection: "column",
															gap: "6px",
															width: "max-content",
															minWidth: "160px",
															whiteSpace: "nowrap",
															zIndex: 60,
															pointerEvents: "none",
															animation: "previewFadeIn 0.15s ease-out",
															textAlign: isEn ? "left" : "right",
															direction: isEn ? "ltr" : "rtl",
															fontSize: "0.75rem",
															color: "var(--text-secondary, #d4d4d4)",
															fontWeight: "400",
														}}
													>
														<div
															style={{
																display: "flex",
																alignItems: "center",
																justifyContent: "space-between",
																gap: "16px",
																whiteSpace: "nowrap",
															}}
														>
															<span style={{ whiteSpace: "nowrap" }}>
																{isEn ? "Response Time" : "سرعة الاستجابة"}
															</span>
															<span
																style={{
																	direction: "ltr",
																	fontVariantNumeric: "tabular-nums",
																	whiteSpace: "nowrap",
																}}
															>
																{msg.durationSeconds}s
															</span>
														</div>

														{msg.usedSearch && (
															<div
																style={{
																	display: "flex",
																	alignItems: "center",
																	justifyContent: "space-between",
																	gap: "16px",
																	whiteSpace: "nowrap",
																}}
															>
																<span style={{ whiteSpace: "nowrap" }}>
																	{isEn ? "Source" : "المصدر"}
																</span>
																<span style={{ whiteSpace: "nowrap" }}>
																	{isEn ? "Live Web Search" : "بحث ويب حي"}
																</span>
															</div>
														)}

														{msg.timestamp && (
															<div
																style={{
																	display: "flex",
																	alignItems: "center",
																	justifyContent: "space-between",
																	gap: "16px",
																	whiteSpace: "nowrap",
																}}
															>
																<span style={{ whiteSpace: "nowrap" }}>
																	{isEn ? "Time" : "الوقت"}
																</span>
																<span style={{ whiteSpace: "nowrap" }}>
																	{msg.timestamp}
																</span>
															</div>
														)}
													</div>
												)}
											</div>
										)}
									</div>

									{/* Meta: Live Search Badge if active */}
									{msg.usedSearch && (
										<div
											style={{
												display: "flex",
												alignItems: "center",
												gap: "8px",
												opacity: 0.85,
											}}
										>
											<span
												style={{
													backgroundColor:
														"var(--status-on-time-bg, rgba(255, 255, 255, 0.12))",
													color: "var(--status-on-time, #ffffff)",
													padding: "2px 8px",
													borderRadius: "var(--radius-pill, 9999px)",
													fontSize: "0.7rem",
													fontWeight: "600",
												}}
											>
												بحث ويب حي
											</span>
										</div>
									)}
								</div>
							</div>
						)}

						{/* Attached Files rendering for legacy messages */}
						{!Array.isArray(msg.segments) &&
							Array.isArray(msg.attachedFiles) &&
							msg.attachedFiles.length > 0 && (
								<div
									style={{
										display: "flex",
										flexWrap: "wrap",
										gap: "10px",
										marginTop: "10px",
									}}
								>
									{msg.attachedFiles.map((f, idx) => (
										<FilePreviewItem key={idx} file={f} />
									))}
								</div>
							)}
					</div>
				);
			})}

			{/* Live Loading State (Three Animated Dots with Pure Smoothness - AGENTS.md Invariant 13) */}
			{typingState !== "hidden" && (
				<div
					className={`typing-indicator-container ${typingState === "exiting" ? "exiting" : ""}`}
				>
					<div
						className={`typing-indicator-pill ${typingState === "exiting" ? "exiting" : ""}`}
						id="ai-typing-indicator"
						aria-label={isEn ? "Thinking..." : "جاري التفكير..."}
					>
						<span className="typing-dot" />
						<span className="typing-dot" />
						<span className="typing-dot" />
					</div>
				</div>
			)}

			{errorMessage && (
				<div
					style={{
						backgroundColor: "var(--status-qada-bg)",
						color: "var(--status-qada)",
						padding: "12px 16px",
						borderRadius: "var(--radius-md)",
						fontSize: "0.85rem",
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						gap: "12px",
					}}
				>
					<span>{errorMessage}</span>
					{messages.filter((m) => m && m.sender === "user").length > 0 && (
						<Button
							variant="secondary"
							size="small"
							onClick={() => {
								const userMsgs = messages.filter(
									(m) => m && m.sender === "user",
								);
								const lastUserMsg = userMsgs[userMsgs.length - 1];
								if (lastUserMsg) handleResendUserMessage(lastUserMsg);
							}}
						>
							<RotateCcw size={12} />
							<span>{isEn ? "Retry" : "إعادة المحاولة"}</span>
						</Button>
					)}
				</div>
			)}

			<div ref={messagesEndRef} />
		</div>
	);
}
