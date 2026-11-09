import {
	ChevronDown,
	ChevronUp,
	Eye,
	EyeOff,
	GripVertical,
	Plus,
	RotateCcw,
	SlidersHorizontal,
	Trash2,
} from "lucide-react";
import { Badge, Button, IconButton } from "open-glass-ui";
import React from "react";
import { GlassModal, GlassRow, OPEN_GLASS_CONFIG } from "../../theme/OpenGlassEngine";

export default function DhikrSettingsModal({
	isOpen,
	adhkar,
	isEn,
	onClose,
	onOpenAddModal,
	onMoveDhikr,
	onToggleVisibility,
	onUpdateTarget,
	onDeleteCustom,
	onResetDefaults,
	onDragStart,
	onDragOver,
	onDragLeave,
	onDrop,
	onDragEnd,
	draggedDhikrIndex,
	dragOverDhikrIndex,
}) {
	if (!isOpen) return null;

	return (
		<GlassModal
			open={isOpen}
			onOpenChange={(open) => !open && onClose()}
			title={isEn ? "Dhikr & Ward Customization" : "تخصيص وإعدادات الأذكار والأوراد"}
			description={
				isEn
					? "Control visibility, customize target count (ward) per dhikr, or add new ones"
					: "تحكم بإظهار وإخفاء الأذكار، حدد الورد المستهدف لكل ذكر، أو أضف أذكاراً جديدة"
			}
		>
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					gap: "16px",
					maxHeight: "75vh",
					width: "100%",
				}}
			>
				{/* Top Action: Add Custom Dhikr */}
				<div style={{ display: "flex", justifyContent: "flex-end" }}>
					<Button
						variant="primary"
						size="small"
						onClick={onOpenAddModal}
						leadingIcon={<Plus size={16} />}
						id="btn-open-custom-dhikr-modal"
					>
						{isEn ? "Add Custom Dhikr" : "إضافة ذكر مخصص"}
					</Button>
				</div>

				{/* Scrollable Dhikr List */}
				<div
					style={{
						overflowY: "auto",
						display: "flex",
						flexDirection: "column",
						gap: "10px",
						paddingRight: "4px",
						maxHeight: "50vh",
					}}
				>
					{adhkar.map((item, idx) => {
						const isHidden = Boolean(item.hidden);
						const isBeingDragged = draggedDhikrIndex === idx;
						const isTargetDrop = dragOverDhikrIndex === idx;

						return (
							<div
								key={item.id}
								draggable
								onDragStart={(e) => onDragStart(e, idx)}
								onDragOver={(e) => onDragOver(e, idx)}
								onDragLeave={onDragLeave}
								onDrop={(e) => onDrop(e, idx)}
								onDragEnd={onDragEnd}
								className="openglass-row"
								style={{
									display: "flex",
									alignItems: "center",
									justifyContent: "space-between",
									gap: "12px",
									padding: "12px 16px",
									backgroundColor: isTargetDrop
										? "rgba(56, 189, 248, 0.18)"
										: isHidden
											? "rgba(255, 255, 255, 0.02)"
											: "rgba(255, 255, 255, 0.05)",
									borderRadius: "16px",
									border: isTargetDrop
										? "1px dashed var(--ogui-color-accent, #38bdf8)"
										: "1px solid rgba(255, 255, 255, 0.12)",
									opacity: isBeingDragged ? 0.4 : isHidden ? 0.6 : 1,
									transition: "all 0.18s ease",
								}}
							>
								{/* Left: Drag Handle & Reorder */}
								<div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
									<div
										style={{
											cursor: "grab",
											color: "var(--ogui-color-muted, rgba(255, 255, 255, 0.5))",
											display: "flex",
											alignItems: "center",
										}}
										title={isEn ? "Drag to reorder" : "اسحب لإعادة الترتيب"}
									>
										<GripVertical size={18} />
									</div>

									<div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
										<IconButton
											aria-label={isEn ? "Move Up" : "تحريك لأعلى"}
											size="small"
											variant="quiet"
											disabled={idx === 0}
											onClick={() => onMoveDhikr(idx, -1)}
										>
											<ChevronUp size={14} />
										</IconButton>
										<IconButton
											aria-label={isEn ? "Move Down" : "تحريك لأسفل"}
											size="small"
											variant="quiet"
											disabled={idx === adhkar.length - 1}
											onClick={() => onMoveDhikr(idx, 1)}
										>
											<ChevronDown size={14} />
										</IconButton>
									</div>
								</div>

								{/* Center: Dhikr Info */}
								<div style={{ flex: "1", minWidth: 0 }}>
									<div
										style={{
											fontSize: "0.92rem",
											fontWeight: "700",
											color: isHidden ? "rgba(255, 255, 255, 0.6)" : "#ffffff",
											textDecoration: isHidden ? "line-through" : "none",
											overflow: "hidden",
											textOverflow: "ellipsis",
											whiteSpace: "nowrap",
										}}
									>
										{item.textAr}
									</div>
									{item.isCustom && (
										<div style={{ marginTop: "2px" }}>
											<Badge tone="accent">
												{isEn ? "Custom" : "مخصص"}
											</Badge>
										</div>
									)}
								</div>

								{/* Right: Target & Actions */}
								<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
									<div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
										<span style={{ fontSize: "0.75rem", color: "var(--ogui-color-muted, rgba(255, 255, 255, 0.7))" }}>
											{isEn ? "Target:" : "الهدف:"}
										</span>
										<input
											type="number"
											min="1"
											max="100000"
											value={item.target}
											onChange={(e) =>
												onUpdateTarget(item.id, parseInt(e.target.value, 10) || 1)
											}
											style={{
												width: "60px",
												padding: "6px 8px",
												fontSize: "0.88rem",
												fontWeight: "700",
												fontFamily: "monospace",
												textAlign: "center",
												borderRadius: "10px",
												backgroundColor: "rgba(255, 255, 255, 0.08)",
												border: "1px solid rgba(255, 255, 255, 0.20)",
												color: "#ffffff",
											}}
										/>
									</div>

									<IconButton
										aria-label={
											isHidden
												? isEn ? "Show dhikr" : "إظهار الذكر"
												: isEn ? "Hide dhikr" : "إخفاء الذكر"
										}
										size="small"
										variant="quiet"
										onClick={() => onToggleVisibility(item.id)}
									>
										{isHidden ? <EyeOff size={16} /> : <Eye size={16} />}
									</IconButton>

									{item.isCustom && (
										<IconButton
											aria-label={isEn ? "Delete custom dhikr" : "حذف الذكر المخصص"}
											size="small"
											variant="danger"
											onClick={() => onDeleteCustom(item.id)}
										>
											<Trash2 size={15} />
										</IconButton>
									)}
								</div>
							</div>
						);
					})}
				</div>

				{/* Footer */}
				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						borderTop: "1px solid var(--ogui-hairline, rgba(255, 255, 255, 0.15))",
						paddingTop: "12px",
						flexWrap: "wrap",
						gap: "10px",
					}}
				>
					<Button
						variant="secondary"
						size="small"
						onClick={onResetDefaults}
						leadingIcon={<RotateCcw size={14} />}
					>
						{isEn ? "Restore Defaults" : "استعادة الأذكار الافتراضية"}
					</Button>

					<Button variant="primary" size="small" onClick={onClose}>
						{isEn ? "Done & Close" : "تم وحفظ"}
					</Button>
				</div>
			</div>
		</GlassModal>
	);
}
