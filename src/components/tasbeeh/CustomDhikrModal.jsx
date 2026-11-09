import { Button, Dialog, TextField } from "open-glass-ui";
import React from "react";

export default function CustomDhikrModal({
	isOpen,
	isEn,
	onClose,
	onSubmit,
	customTextAr,
	setCustomTextAr,
	customTarget,
	setCustomTarget,
	customVirtueAr,
	setCustomVirtueAr,
}) {
	if (!isOpen) return null;

	return (
		<Dialog
			open={isOpen}
			onOpenChange={(open) => !open && onClose()}
			title={isEn ? "Add Custom Dhikr or Dua" : "إضافة ذكر أو دعاء مخصص"}
			description={
				isEn
					? "Add your personal remembrance with custom target and reference"
					: "أضف ذكرك أو دعاءك الشخصي مع تحديد الهدف العددي والفضل"
			}
			closeOnBackdrop={true}
		>
			<form
				onSubmit={onSubmit}
				style={{ display: "flex", flexDirection: "column", gap: "16px", paddingTop: "8px" }}
			>
				<TextField
					label={
						isEn
							? "Dhikr / Dua Text (Arabic)"
							: "نص الذكر أو الدعاء (بالعربية)"
					}
					required
					value={customTextAr}
					onChange={(e) => setCustomTextAr(e.target.value)}
					placeholder={
						isEn ? "e.g. رَبِّ اغْفِرْ لِي" : "مثال: رَبِّ اغْفِرْ لِي وَتُبْ عَلَيَّ"
					}
				/>

				<TextField
					label={isEn ? "Target Count" : "الهدف العددي للتسبيح"}
					type="number"
					required
					value={customTarget}
					onChange={(e) => setCustomTarget(e.target.value)}
				/>

				<TextField
					label={
						isEn
							? "Virtue / Reference (Optional)"
							: "الفضل أو الدليل (اختياري)"
					}
					value={customVirtueAr}
					onChange={(e) => setCustomVirtueAr(e.target.value)}
					placeholder={
						isEn
							? "e.g. من قالها غفرت ذنوبه"
							: "مثال: من قالها غُفرت له ذنوبه وإن كانت مثل زبد البحر"
					}
				/>

				<div
					style={{
						display: "flex",
						gap: "12px",
						justifyContent: "flex-end",
						marginTop: "8px",
					}}
				>
					<Button type="button" variant="secondary" onClick={onClose}>
						{isEn ? "Cancel" : "إلغاء"}
					</Button>
					<Button type="submit" variant="primary">
						{isEn ? "Save Dhikr" : "حفظ الذكر"}
					</Button>
				</div>
			</form>
		</Dialog>
	);
}
