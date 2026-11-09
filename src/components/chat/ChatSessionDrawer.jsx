import {
	Check,
	MessageSquare,
	Plus,
	RefreshCw,
	Trash2,
} from "lucide-react";
import { Badge, Button, Drawer, IconButton, SegmentedControl } from "open-glass-ui";
import React, { useState } from "react";

export default function ChatSessionDrawer({
	isOpen,
	onClose,
	sessions = [],
	activeSessionId,
	onSelectSession,
	onCreateNewSession,
	onDeleteSessionById,
	onDeleteCurrentSession,
	onResetAllChats,
	isEn = false,
}) {
	const [historyFilter, setHistoryFilter] = useState("complete");

	if (!isOpen) return null;

	const validSessions = Array.isArray(sessions) ? sessions : [];
	const nonNullSessions = validSessions.filter(
		(s) => s && Array.isArray(s.messages),
	);

	const completeSessionsCount = nonNullSessions.filter((s) => {
		const u = s.messages.filter((m) => m && m.sender === "user").length;
		const a = s.messages.filter(
			(m) => m && m.sender === "assistant" && !m.isTyping,
		).length;
		return u > 0 && a > 0;
	}).length;

	const pendingSessionsCount = nonNullSessions.filter((s) => {
		const u = s.messages.filter((m) => m && m.sender === "user").length;
		const a = s.messages.filter(
			(m) => m && m.sender === "assistant" && !m.isTyping,
		).length;
		return u > 0 && a === 0;
	}).length;

	const displayedSessions = nonNullSessions.filter((s) => {
		const u = s.messages.filter((m) => m && m.sender === "user").length;
		const a = s.messages.filter(
			(m) => m && m.sender === "assistant" && !m.isTyping,
		).length;
		if (historyFilter === "pending") return u > 0 && a === 0;
		return u > 0 && a > 0;
	});

	return (
		<Drawer
			open={isOpen}
			onOpenChange={(open) => !open && onClose()}
			title={isEn ? "Chat History" : "سجل المحادثات"}
			closeOnBackdrop={true}
		>
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					gap: "16px",
					height: "100%",
					maxHeight: "80vh",
				}}
			>
				{/* Top Action: New Chat */}
				<div style={{ display: "flex", justifyContent: "flex-end" }}>
					<Button
						variant="primary"
						size="small"
						leadingIcon={<Plus size={15} />}
						onClick={() => {
							onCreateNewSession();
							onClose();
						}}
						id="drawer-new-chat-btn"
					>
						{isEn ? "New Chat" : "محادثة جديدة"}
					</Button>
				</div>

				{/* Filter Tabs via SegmentedControl */}
				<SegmentedControl
					aria-label={isEn ? "Filter sessions" : "تصفية الجلسات"}
					value={historyFilter}
					onValueChange={setHistoryFilter}
					items={[
						{
							value: "complete",
							label: `${isEn ? "Answered" : "المكتملة"} (${completeSessionsCount})`,
						},
						{
							value: "pending",
							label: `${isEn ? "Pending" : "المعلقة"} (${pendingSessionsCount})`,
						},
					]}
				/>

				{/* Sessions List */}
				<div
					style={{
						flex: 1,
						overflowY: "auto",
						display: "flex",
						flexDirection: "column",
						gap: "8px",
						paddingRight: "4px",
					}}
				>
					{displayedSessions.length === 0 ? (
						<div
							style={{
								textAlign: "center",
								padding: "36px 12px",
								color: "var(--ogui-color-muted, rgba(255, 255, 255, 0.6))",
								fontSize: "0.88rem",
							}}
						>
							{isEn
								? "No conversations found in this category."
								: "لا توجد محادثات في هذا التصنيف."}
						</div>
					) : (
						displayedSessions.map((sess) => {
							const isActive = sess.id === activeSessionId;
							const userCount = (sess.messages || []).filter(
								(m) => m && m.sender === "user",
							).length;
							const aiCount = (sess.messages || []).filter(
								(m) => m && m.sender === "assistant" && !m.isTyping,
							).length;
							const isComplete = userCount > 0 && aiCount > 0;
							const isPending = userCount > 0 && aiCount === 0;
							const msgCount = Array.isArray(sess.messages)
								? sess.messages.length
								: 0;

							return (
								<div
									key={sess.id}
									onClick={() => {
										onSelectSession(sess.id);
										onClose();
									}}
									style={{
										padding: "10px 14px",
										borderRadius: "12px",
										backgroundColor: isActive
											? "rgba(56, 189, 248, 0.16)"
											: "rgba(255, 255, 255, 0.04)",
										border: isActive
											? "1px solid var(--ogui-color-accent, #38bdf8)"
											: "1px solid var(--ogui-hairline, rgba(255, 255, 255, 0.12))",
										cursor: "pointer",
										display: "flex",
										alignItems: "center",
										justifyContent: "space-between",
										gap: "10px",
										transition: "all 0.15s ease",
									}}
								>
									<div
										style={{
											display: "flex",
											alignItems: "center",
											gap: "10px",
											flex: 1,
											minWidth: 0,
										}}
									>
										<MessageSquare
											size={16}
											style={{
												flexShrink: 0,
												color: isComplete
													? "var(--status-on-time, #38bdf8)"
													: isPending
														? "#ffffff"
														: "var(--ogui-color-muted)",
											}}
										/>
										<span
											style={{
												fontSize: "0.90rem",
												fontWeight: isActive ? "700" : "500",
												color: "#ffffff",
												overflow: "hidden",
												textOverflow: "ellipsis",
												whiteSpace: "nowrap",
											}}
										>
											{typeof sess.title === "string"
												? sess.title
												: isEn
													? "Conversation"
													: "محادثة"}
										</span>
									</div>

									<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
										<Badge tone="neutral">
											{msgCount} {isEn ? "msgs" : "رسائل"}
										</Badge>

										{isActive && (
											<Check
												size={14}
												style={{ color: "var(--status-on-time, #38bdf8)" }}
											/>
										)}

										<IconButton
											aria-label={isEn ? "Delete conversation" : "حذف المحادثة"}
											size="small"
											variant="danger"
											onClick={(e) => onDeleteSessionById(e, sess.id)}
										>
											<Trash2 size={13} />
										</IconButton>
									</div>
								</div>
							);
						})
					)}
				</div>

				{/* Bottom Actions */}
				<div
					style={{
						display: "flex",
						gap: "10px",
						borderTop: "1px solid var(--ogui-hairline, rgba(255, 255, 255, 0.15))",
						paddingTop: "12px",
						flexWrap: "wrap",
					}}
				>
					<Button
						variant="danger"
						size="small"
						leadingIcon={<Trash2 size={15} />}
						onClick={() => {
							onDeleteCurrentSession();
							onClose();
						}}
						id="drawer-delete-current-chat-btn"
					>
						{isEn ? "Delete Current Chat" : "حذف المحادثة الحالية"}
					</Button>

					<Button
						variant="secondary"
						size="small"
						leadingIcon={<RefreshCw size={14} />}
						onClick={() => {
							onResetAllChats();
							onClose();
						}}
					>
						{isEn ? "Reset History" : "إعادة تهيئة السجل"}
					</Button>
				</div>
			</div>
		</Drawer>
	);
}
