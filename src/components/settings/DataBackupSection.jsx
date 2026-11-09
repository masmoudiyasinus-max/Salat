import { Download, FileJson, Trash2, UploadCloud } from "lucide-react";
import { Button, Card } from "open-glass-ui";
import React from "react";
import {
	exportFullUserDataJSON,
	importFullUserDataJSON,
} from "../../services/storage";

export default function DataBackupSection({
	onOpenResetModal,
	importInputRef,
	isEn,
}) {
	const handleExportBackup = () => {
		const jsonStr = exportFullUserDataJSON();
		const blob = new Blob([jsonStr], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `habit-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
		a.click();
		URL.revokeObjectURL(url);
	};

	const handleImportBackup = (e) => {
		const file = e.target.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (event) => {
			try {
				const rawText = event.target?.result;
				if (!rawText || typeof rawText !== "string") {
					alert(
						isEn
							? "Invalid or empty backup file"
							: "ملف النسخة الاحتياطية فارغ أو غير صالح",
					);
					return;
				}

				const result = importFullUserDataJSON(rawText);

				if (result === true || result?.success) {
					window.location.reload();
				} else {
					alert(
						(isEn ? "Failed to import backup: " : "فشل استيراد الملف: ") +
							(result?.error ||
								(isEn ? "Invalid format" : "صيغة ملف غير صالحة")),
					);
				}
			} catch (err) {
				alert(
					(isEn ? "Failed to import backup: " : "فشل استيراد الملف: ") +
						(err?.message || (isEn ? "Invalid format" : "صيغة ملف غير صالحة")),
				);
			}
		};

		reader.readAsText(file);
		if (importInputRef.current) importInputRef.current.value = "";
	};

	return (
		<Card
			eyebrow={isEn ? "Data Security" : "أمان البيانات"}
			title={
				<div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
					<FileJson size={22} style={{ color: "#ffffff" }} />
					<span>
						{isEn
							? "Data Management & Backup"
							: "النسخ الاحتياطي وإدارة البيانات"}
					</span>
				</div>
			}
		>
			<input
				ref={importInputRef}
				type="file"
				accept=".json"
				style={{ display: "none" }}
				onChange={handleImportBackup}
			/>

			<div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginTop: "8px" }}>
				<Button
					variant="secondary"
					leadingIcon={<Download size={16} />}
					onClick={handleExportBackup}
				>
					{isEn ? "Export Backup (JSON)" : "تصدير نسخة احتياطية (JSON)"}
				</Button>

				<Button
					variant="secondary"
					leadingIcon={<UploadCloud size={16} />}
					onClick={() => importInputRef.current?.click()}
				>
					{isEn ? "Import Backup" : "استيراد نسخة احتياطية"}
				</Button>

				<Button
					variant="danger"
					leadingIcon={<Trash2 size={16} />}
					onClick={() => onOpenResetModal("prayers")}
				>
					{isEn ? "Clear Prayer Records" : "مسح سجل الصلوات"}
				</Button>
			</div>
		</Card>
	);
}
