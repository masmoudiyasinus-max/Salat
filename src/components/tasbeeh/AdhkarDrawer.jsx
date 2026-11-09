import {
	CheckCircle,
	PanelLeftClose,
	PanelLeftOpen,
	PanelRightClose,
	PanelRightOpen,
	Plus,
	SlidersHorizontal,
	Trash2,
} from "lucide-react";
import { Badge, Button, Glass, IconButton } from "open-glass-ui";
import React from "react";

export default function AdhkarDrawer({
	visibleAdhkar,
	activeDhikrId,
	isSidebarExpanded,
	isEn,
	onToggleSidebar,
	onOpenSettings,
	onOpenAddModal,
	onSelectDhikr,
	onDeleteCustomDhikr,
}) {
	return (
		<Glass
			as="aside"
			material="regular"
			look="liquid"
			style={{
				width: isSidebarExpanded ? "340px" : "58px",
				minWidth: isSidebarExpanded ? "280px" : "58px",
				maxWidth: isSidebarExpanded ? "380px" : "58px",
				height: "100%",
				borderRadius: "20px",
				padding: isSidebarExpanded ? "14px" : "10px 6px",
				display: "flex",
				flexDirection: "column",
				gap: "12px",
				transition:
					"width 0.25s cubic-bezier(0.16, 1, 0.3, 1), min-width 0.25s cubic-bezier(0.16, 1, 0.3, 1), max-width 0.25s cubic-bezier(0.16, 1, 0.3, 1), padding 0.25s ease",
				overflow: "hidden",
				flexShrink: 0,
			}}
		>
			{/* Top Control Header */}
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: isSidebarExpanded ? "space-between" : "center",
					width: "100%",
					gap: "8px",
					paddingBottom: isSidebarExpanded ? "10px" : "6px",
					borderBottom: "1px solid var(--ogui-hairline, rgba(255, 255, 255, 0.12))",
					flexShrink: 0,
				}}
			>
				{isSidebarExpanded ? (
					<>
						<div
							style={{
								display: "flex",
								alignItems: "center",
								gap: "8px",
								overflow: "hidden",
							}}
						>
							<IconButton
								aria-label={isEn ? "Collapse sidebar" : "طي الشريط الجانبي"}
								variant="quiet"
								size="small"
								onClick={onToggleSidebar}
							>
								{isEn ? <PanelLeftClose size={18} /> : <PanelRightClose size={18} />}
							</IconButton>
							<span
								style={{
									fontWeight: "700",
									fontSize: "0.96rem",
									color: "#ffffff",
									whiteSpace: "nowrap",
									overflow: "hidden",
									textOverflow: "ellipsis",
								}}
							>
								{isEn ? "Adhkar Collection" : "باقة الأذكار"}
							</span>
						</div>

						<div
							style={{
								display: "flex",
								alignItems: "center",
								gap: "6px",
								flexShrink: 0,
							}}
						>
							<IconButton
								aria-label={isEn ? "Dhikr & Ward Settings" : "إعدادات وتخصيص الأذكار والأوراد"}
								variant="quiet"
								size="small"
								onClick={onOpenSettings}
							>
								<SlidersHorizontal size={15} />
							</IconButton>
							<Button
								variant="primary"
								size="small"
								leadingIcon={<Plus size={14} />}
								onClick={onOpenAddModal}
							>
								{isEn ? "New" : "إضافة ذكر"}
							</Button>
						</div>
					</>
				) : (
					<div
						style={{
							display: "flex",
							flexDirection: "column",
							alignItems: "center",
							gap: "8px",
							width: "100%",
						}}
					>
						<IconButton
							aria-label={isEn ? "Expand sidebar" : "توسيع الشريط الجانبي"}
							variant="quiet"
							size="small"
							onClick={onToggleSidebar}
						>
							{isEn ? <PanelLeftOpen size={18} /> : <PanelRightOpen size={18} />}
						</IconButton>
						<IconButton
							aria-label={isEn ? "Dhikr & Ward Settings" : "إعدادات وتخصيص الأذكار والأوراد"}
							variant="quiet"
							size="small"
							onClick={onOpenSettings}
						>
							<SlidersHorizontal size={15} />
						</IconButton>
						<IconButton
							aria-label={isEn ? "Add custom dhikr" : "إضافة ذكر خاص"}
							variant="primary"
							size="small"
							onClick={onOpenAddModal}
						>
							<Plus size={16} />
						</IconButton>
					</div>
				)}
			</div>

			{/* Adhkar Items Rail / List */}
			<div
				style={{
					flex: 1,
					overflowY: "auto",
					display: "flex",
					flexDirection: "column",
					gap: "8px",
					paddingRight: isSidebarExpanded ? "2px" : "0",
					scrollbarWidth: "none",
				}}
			>
				{visibleAdhkar.map((dhikr) => {
					const isActive = dhikr.id === activeDhikrId;
					const dCount = dhikr.count || 0;
					const dTarget = dhikr.target || 33;
					const isAchieved = dCount >= dTarget;

					if (!isSidebarExpanded) {
						return (
							<button
								key={dhikr.id}
								type="button"
								onClick={() => onSelectDhikr(dhikr.id)}
								className="openglass-row"
								style={{
									width: "100%",
									height: "44px",
									borderRadius: "14px",
									display: "flex",
									flexDirection: "column",
									alignItems: "center",
									justifyContent: "center",
									backgroundColor: isActive
										? "rgba(56, 189, 248, 0.18)"
										: "rgba(255, 255, 255, 0.05)",
									border: isActive
										? "1px solid var(--ogui-color-accent, #38bdf8)"
										: "1px solid rgba(255, 255, 255, 0.10)",
									cursor: "pointer",
									color: "#ffffff",
									transition: "all 0.18s ease",
									padding: 0,
								}}
								title={dhikr.textAr}
							>
								<span
									style={{
										fontSize: "0.85rem",
										fontWeight: "700",
										color: isAchieved ? "var(--status-on-time, #38bdf8)" : "#ffffff",
									}}
								>
									{dCount}
								</span>
							</button>
						);
					}

					return (
						<div
							key={dhikr.id}
							onClick={() => onSelectDhikr(dhikr.id)}
							className="openglass-row"
							style={{
								padding: "12px 14px",
								borderRadius: "16px",
								backgroundColor: isActive
									? "rgba(56, 189, 248, 0.18)"
									: "rgba(255, 255, 255, 0.05)",
								border: isActive
									? "1px solid var(--ogui-color-accent, #38bdf8)"
									: "1px solid rgba(255, 255, 255, 0.10)",
								cursor: "pointer",
								display: "flex",
								alignItems: "center",
								justifyContent: "space-between",
								gap: "10px",
								transition: "all 0.18s ease",
							}}
						>
							<div style={{ flex: 1, minWidth: 0 }}>
								<div
									style={{
										display: "flex",
										alignItems: "center",
										gap: "6px",
										flexWrap: "wrap",
									}}
								>
									<span
										style={{
											fontWeight: isActive ? "800" : "600",
											fontSize: "0.90rem",
											color: "#ffffff",
											whiteSpace: "nowrap",
											overflow: "hidden",
											textOverflow: "ellipsis",
										}}
									>
										{dhikr.textAr}
									</span>
									{dhikr.isCustom && (
										<Badge tone="accent">
											{isEn ? "Custom" : "مخصص"}
										</Badge>
									)}
								</div>
								{dhikr.virtueAr && (
									<div
										style={{
											fontSize: "0.74rem",
											color: "var(--ogui-color-muted, rgba(255, 255, 255, 0.65))",
											marginTop: "3px",
											whiteSpace: "nowrap",
											overflow: "hidden",
											textOverflow: "ellipsis",
										}}
									>
										{dhikr.virtueAr}
									</div>
								)}
							</div>

							<div
								style={{
									display: "flex",
									alignItems: "center",
									gap: "8px",
									flexShrink: 0,
								}}
							>
								<Badge tone={isAchieved ? "positive" : "neutral"}>
									<span>
										{dCount} / {dTarget}
									</span>
									{isAchieved && <CheckCircle size={11} style={{ marginLeft: "4px" }} />}
								</Badge>

								{dhikr.isCustom && (
									<IconButton
										aria-label={isEn ? "Delete custom dhikr" : "حذف الذكر المخصص"}
										variant="danger"
										size="small"
										onClick={(e) => onDeleteCustomDhikr(e, dhikr.id)}
									>
										<Trash2 size={13} />
									</IconButton>
								)}
							</div>
						</div>
					);
				})}
			</div>
		</Glass>
	);
}
