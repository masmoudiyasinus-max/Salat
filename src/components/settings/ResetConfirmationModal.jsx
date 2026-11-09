import { AlertTriangle } from "lucide-react";
import { Button, Dialog } from "open-glass-ui";
import React from "react";

export default function ResetConfirmationModal({
	isOpen,
	resetType,
	onConfirm,
	onCancel,
	isEn,
}) {
	if (!isOpen) return null;

	return (
		<Dialog
			open={isOpen}
			onOpenChange={(open) => !open && onCancel()}
			title={isEn ? "Confirm Data Reset" : "تأكيد مسح البيانات"}
			closeOnBackdrop={true}
		>
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					textAlign: "center",
					gap: "14px",
					padding: "8px 0",
				}}
			>
				<AlertTriangle
					size={40}
					style={{ color: "#ef4444" }}
				/>
				<p
					style={{
						color: "var(--ogui-color-muted, rgba(255, 255, 255, 0.75))",
						fontSize: "0.92rem",
						lineHeight: 1.6,
						margin: 0,
					}}
				>
					{resetType === "prayers"
						? isEn
							? "Are you sure you want to clear your prayer records? This action cannot be undone unless you have a backup."
							: "هل أنت متأكد من رغبتك في مسح سجل الصلوات؟ لا يمكن التراجع عن هذا الإجراء إلا إذا كنت تحتفظ بنسخة احتياطية."
						: isEn
							? "Are you sure you want to reset all app data? All your prayers, settings, and habits will be deleted."
							: "هل أنت متأكد من رغبتك في مسح كافة بيانات التطبيق؟ سيتم حذف سجل الصلوات والإعدادات والعادات بالكامل."}
				</p>

				<div
					style={{
						display: "flex",
						gap: "12px",
						justifyContent: "center",
						width: "100%",
						marginTop: "12px",
					}}
				>
					<Button variant="danger" onClick={onConfirm}>
						{isEn ? "Yes, Reset Data" : "نعم، مسح البيانات"}
					</Button>
					<Button variant="secondary" onClick={onCancel}>
						{isEn ? "Cancel" : "إلغاء"}
					</Button>
				</div>
			</div>
		</Dialog>
	);
}
