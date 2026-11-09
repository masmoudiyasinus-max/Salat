// Centralized Prayer Domain Constants & Application Event Names

export const OBLIGATORY_PRAYER_IDS = [
	"Fajr",
	"Dhuhr",
	"Asr",
	"Maghrib",
	"Isha",
];

export const PRAYER_NAMES = [
	{ id: "Fajr", nameAr: "الفجر", nameEn: "Fajr" },
	{ id: "Dhuhr", nameAr: "الظهر", nameEn: "Dhuhr" },
	{ id: "Asr", nameAr: "العصر", nameEn: "Asr" },
	{ id: "Maghrib", nameAr: "المغرب", nameEn: "Maghrib" },
	{ id: "Isha", nameAr: "العشاء", nameEn: "Isha" },
];

export const NAFL_PRAYERS = [
	{
		id: "Sunnah_Fajr",
		nameAr: "سنة الفجر",
		nameEn: "Fajr Sunnah",
		rakaat: "2 ركعة قبلية",
		timing: "قبل صلاة الفجر",
	},
	{
		id: "Duha",
		nameAr: "صلاة الضحى",
		nameEn: "Duha Prayer",
		rakaat: "2 - 8 ركعات",
		timing: "من الشروق+15د إلى قبل الظهر",
	},
	{
		id: "Sunnah_Dhuhr_Pre",
		nameAr: "سنة الظهر القبلية",
		nameEn: "Dhuhr Pre-Sunnah",
		rakaat: "4 ركعات (2+2)",
		timing: "بعد أذان الظهر وقبل الفريضة",
	},
	{
		id: "Sunnah_Dhuhr_Post",
		nameAr: "سنة الظهر البعدية",
		nameEn: "Dhuhr Post-Sunnah",
		rakaat: "2 ركعة بعدية",
		timing: "بعد أداء فريضة الظهر",
	},
	{
		id: "Sunnah_Maghrib",
		nameAr: "سنة المغرب",
		nameEn: "Maghrib Sunnah",
		rakaat: "2 ركعة بعدية",
		timing: "بعد أداء فريضة المغرب",
	},
	{
		id: "Sunnah_Isha",
		nameAr: "سنة العشاء",
		nameEn: "Isha Sunnah",
		rakaat: "2 ركعة بعدية",
		timing: "بعد أداء فريضة العشاء",
	},
	{
		id: "Witr",
		nameAr: "صلاة الوتر",
		nameEn: "Witr Prayer",
		rakaat: "1 - 3 ركعات",
		timing: "بعد العشاء إلى قبيل الفجر",
	},
	{
		id: "Qiyam",
		nameAr: "قيام الليل / التهجد",
		nameEn: "Qiyam al-Layl",
		rakaat: "2 - 8 ركعات مثنى مثنى",
		timing: "الثلث الأخير من الليل",
	},
];

export const PRAYER_STATUSES = {
	ON_TIME: "on_time",
	LATE: "late",
	QADA: "qada",
	MISSED: "missed",
};

export const PRAYER_STATUS_LABELS = {
	on_time: { ar: "في وقتها", en: "On Time", color: "#ffffff" },
	late: { ar: "متأخرة", en: "Late", color: "#ffffff" },
	qada: { ar: "قضاء", en: "Qada", color: "#ef4444" },
	missed: { ar: "فائتة", en: "Missed", color: "#737373" },
};

export const APP_EVENTS = {
	RECORDS_UPDATED: "records-updated",
	NAFL_RECORDS_UPDATED: "nafl-records-updated",
	SETTINGS_UPDATED: "settings-updated",
	PRAYER_TIMES_UPDATED: "prayer-times-updated",
	PREVIEW_CHAT_IMAGE: "preview-chat-image",
	MUNEER_PROACTIVE_MESSAGE: "muneer-proactive-message",
	MUNEER_PROACTIVE_START: "muneer-proactive-start",
};
