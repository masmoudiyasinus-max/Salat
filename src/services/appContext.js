import { getQiblaBearing } from "./adhanCalculator.js";
import {
	formatFileSize,
	getAudioPlayerState,
	getStoredAudioTracks,
} from "./audioStorage.js";
import {
	getActiveBookId,
	getAllBooksMetadata,
	getCumulativeWardCeiling,
	getDailyTargetForLevel,
	getPastCompletedDays,
	getReadingHabitState,
	getTodayDateString,
} from "./bookStorage.js";
import {
	calculateNightTimes,
	computeSummaryStats,
	getChatSessions,
	getCityTodayDateStr,
	getPrayerTimesCache,
	getRecords,
	getSettings,
	OBLIGATORY_PRAYER_IDS,
	toWesternDigits,
} from "./storage.js";
import {
	getGrandTotalTasbeehCount,
	getTasbeehState,
	getTodayTotalTasbeehCount,
} from "./tasbeehStorage.js";

/**
 * Builds an exhaustive, comprehensive, real-time read-only snapshot of the entire
 * application state and all user data across all pages and databases.
 * 100% genuine data, zero dead features, zero hardcoded mocks.
 */
export async function getLiveAppContext() {
	// 1. Site Architecture & Available Sections
	const siteArchitecture = {
		appName: "تطبيق تتبع العادات والصلوات (Habit Tracker)",
		prayerTimesProvider: "واجهة Aladhan API الرسمية المباشرة (api.aladhan.com)",
		sections: [
			{
				id: "tracker",
				nameAr: "متابعة الصلوات الخمس",
				descriptionAr:
					"تتبع الصلوات الخمس المفروضة (الفجر، الظهر، العصر، المغرب، العشاء)، تسجيل أوقات الأداء والتأخير والقضاء، سلاسل الالتزام المتصلة، ومواقيت الصلاة الرسمية عبر api.aladhan.com.",
			},
			{
				id: "chat",
				nameAr: "المساعد الذكي (الشيخ منير)",
				descriptionAr:
					"مستشار ومرشد إسلامي ذكي يستند إلى القرآن والسنة، يقرأ كامل سجلات وعادات المستخدم لتقديم التوجيه والدعم المخصص والإجابة عن الفتاوى.",
			},
			{
				id: "books",
				nameAr: "مكتبة وقارئ الكتب والورد اليومي",
				descriptionAr:
					"قارئ PDF متقدم بصفحتين متجاورتين RTL، برنامج بناء عادة القراءة لـ 21 يوماً (10 ثم 20 ثم 30 صفحة/يوم)، حفظ تلقائي للعلامات المرجعية والورد اليومي.",
			},
			{
				id: "tasbeeh",
				nameAr: "المسبحة الإلكترونية والأذكار",
				descriptionAr:
					"مسبحة إلكترونية بحلقة خرز واقعية، اهتزاز وأصوات لمسية، تدوير تلقائي للأذكار، عدادات للأشواط واليوم والإجمالي الكلي، مع إمكانية إضافة أذكار مخصصة.",
			},
			{
				id: "audio",
				nameAr: "مشغل الصوتيات والمكتبة الصوتية",
				descriptionAr:
					"مشغل ومكتبة صوتية محلية تتيح استيراد مجلدات الصوتيات، الاستماع إلى الدروس والتلاوات والمقاطع، تكرار وتشغيل عشوائي، واختزال أنيق.",
			},
			{
				id: "settings",
				nameAr: "الإعدادات والموقع",
				descriptionAr:
					"تحديد الدولة والمدينة وجلب المواقيت الرسمية من api.aladhan.com، كشف الموقع التلقائي GPS، وخلفيات البث المباشر (الحرم المكي والمسجد النبوي وصور الجهاز).",
			},
		],
	};

	// 2. User Settings
	const rawSettings = getSettings() || {};
	const settings = {
		city: rawSettings.city || null,
		country: rawSettings.country || null,
		latitude:
			typeof rawSettings.latitude === "number" && !isNaN(rawSettings.latitude)
				? rawSettings.latitude
				: null,
		longitude:
			typeof rawSettings.longitude === "number" && !isNaN(rawSettings.longitude)
				? rawSettings.longitude
				: null,
		timezone: rawSettings.timezone || null,
		timeFormat: rawSettings.timeFormat === "24" ? "24" : "12",
		language: rawSettings.language === "en" ? "en" : "ar",
		bgMode: rawSettings.bgMode || "makkah",
		prayerTimesSource: "api.aladhan.com",
	};

	// 3. Current Live Clock & Date
	const now = new Date();
	const todayStr = getCityTodayDateStr(settings.timezone);
	const currentTimeStr = toWesternDigits(
		now.toLocaleTimeString("ar-EG-u-nu-latn", {
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		}),
	);

	// 4. Official Prayer Times & Night Milestones (from api.aladhan.com)
	const prayerTimes = getPrayerTimesCache();
	const astronomy = {
		hasTimes: Boolean(
			prayerTimes &&
				prayerTimes.Fajr &&
				prayerTimes.Dhuhr &&
				prayerTimes.Maghrib &&
				prayerTimes.Isha,
		),
		source: "api.aladhan.com",
		prayerTimes: prayerTimes || null,
		nightTimes: null,
		qiblaBearing: null,
	};
	if (astronomy.hasTimes) {
		const night = calculateNightTimes(prayerTimes.Maghrib, prayerTimes.Fajr);
		astronomy.nightTimes = {
			midnight: night ? night.midnight12 : null,
			lastThird: night ? night.lastThird12 : null,
		};
	}
	if (settings.latitude !== null && settings.longitude !== null) {
		try {
			const deg = getQiblaBearing(settings.latitude, settings.longitude);
			astronomy.qiblaBearing = `${Math.round(deg)}°`;
		} catch {
			astronomy.qiblaBearing = null;
		}
	}

	// 5. Obligatory Prayer Tracking (Today + Complete Historical Records)
	const allPrayerRecords = getRecords() || [];
	const todayPrayerRecords = allPrayerRecords.filter(
		(r) => r && r.date === todayStr,
	);
	const prayerStats = computeSummaryStats(allPrayerRecords);

	const todayObligatoryStatus = {};
	OBLIGATORY_PRAYER_IDS.forEach((id) => {
		todayObligatoryStatus[id] = { status: "لم تُسجل بعد", delayMinutes: 0 };
	});
	todayPrayerRecords.forEach((r) => {
		const pId = r.prayer_name || r.prayer_id;
		if (pId && todayObligatoryStatus[pId]) {
			todayObligatoryStatus[pId] = {
				status: r.status,
				delayMinutes: r.delay_minutes || 0,
				performedTime: r.performed_time || null,
				adhanTime: r.adhan_time || null,
			};
		}
	});

	// 6. Electronic Tasbeeh & Dhikr (Complete Database)
	let tasbeehData = null;
	try {
		const tasbeehState = getTasbeehState();
		if (tasbeehState && Array.isArray(tasbeehState.adhkar)) {
			const activeDhikr =
				tasbeehState.adhkar.find((d) => d.id === tasbeehState.activeDhikrId) ||
				tasbeehState.adhkar[0];
			tasbeehData = {
				activeDhikr: activeDhikr
					? {
							id: activeDhikr.id,
							text: activeDhikr.text,
							count: activeDhikr.count || 0,
							target: activeDhikr.target || 33,
							totalCount: activeDhikr.totalCount || 0,
						}
					: null,
				currentRound: tasbeehState.currentRound || 1,
				todayTotal: getTodayTotalTasbeehCount(),
				grandTotal: getGrandTotalTasbeehCount(),
				autoCycle: Boolean(tasbeehState.autoCycle),
				soundEnabled: Boolean(tasbeehState.soundEnabled),
				vibrationEnabled: Boolean(tasbeehState.vibrationEnabled),
				allAdhkar: tasbeehState.adhkar.map((d) => ({
					id: d.id,
					text: d.text,
					count: d.count || 0,
					target: d.target || 33,
					totalCount: d.totalCount || 0,
					isCustom: Boolean(d.isCustom),
				})),
			};
		}
	} catch (err) {
		console.warn("Error fetching tasbeeh state:", err);
	}

	// 8. Book Reader & Daily Reading Ward (Complete Database: IndexedDB + localStorage)
	const booksData = {
		libraryBooks: [],
		activeBook: null,
		readingHabit: null,
	};
	try {
		const savedBooks = await getAllBooksMetadata();
		const activeBookId = getActiveBookId();
		const readingState = getReadingHabitState();
		const todayDate = getTodayDateString();

		booksData.libraryBooks = (savedBooks || []).map((b) => ({
			id: b.id,
			name: b.name,
			sizeBytes: b.size,
			totalPages: b.totalPages || 0,
			bookmarkPage: readingState.bookmarks?.[b.id] || 1,
		}));

		if (booksData.libraryBooks.length > 0) {
			const active =
				booksData.libraryBooks.find((b) => b.id === activeBookId) ||
				booksData.libraryBooks[0];
			booksData.activeBook = active;

			const pastDays = getPastCompletedDays(readingState, todayDate);
			const target = getDailyTargetForLevel(
				readingState.activeLevel,
				readingState.isCustomUnlocked,
				readingState.customTarget,
			);
			const ceiling = getCumulativeWardCeiling(readingState, todayDate);
			const todayLog = readingState.dailyLogs?.[todayDate];

			booksData.readingHabit = {
				activeLevel: readingState.activeLevel,
				dailyTarget: target,
				pagesReadToday: todayLog?.pagesRead || 0,
				completedDays: pastDays + (todayLog?.completed ? 1 : 0),
				isWardCompletedToday: Boolean(todayLog?.completed),
				wardCeiling: ceiling,
				streakDays: readingState.streakDays || 0,
				isCustomUnlocked: Boolean(readingState.isCustomUnlocked),
				customTarget: readingState.customTarget || 30,
				missedGraceWarning: Boolean(readingState.missedGraceWarning),
				allBookmarks: readingState.bookmarks || {},
				dailyLogs: readingState.dailyLogs || {},
			};
		}
	} catch (err) {
		console.warn("Error fetching books data:", err);
	}

	// 7. Audio Player & Local Audio Library (IndexedDB + localStorage)
	let audioData = {
		folderName: "",
		tracksCount: 0,
		activeTrack: null,
		repeatMode: "all",
		isShuffle: false,
		allTracks: [],
	};
	try {
		const storedAudioTracks = await getStoredAudioTracks();
		const playerState = getAudioPlayerState();
		const activeTrack =
			storedAudioTracks.find((t) => t.id === playerState.activeTrackId) ||
			storedAudioTracks[0] ||
			null;

		audioData = {
			folderName: playerState.folderName || "",
			tracksCount: storedAudioTracks.length,
			activeTrack: activeTrack
				? {
						id: activeTrack.id,
						title: activeTrack.title || activeTrack.name,
						sizeFormatted: formatFileSize(activeTrack.size),
					}
				: null,
			repeatMode: playerState.repeatMode || "all",
			isShuffle: Boolean(playerState.isShuffle),
			allTracks: storedAudioTracks.map((t) => ({
				id: t.id,
				title: t.title || t.name,
				sizeFormatted: formatFileSize(t.size),
			})),
		};
	} catch (err) {
		console.warn("Error fetching audio player state:", err);
	}

	// 8. Chat Sessions Metadata
	let chatSessions = [];
	try {
		const sessions = getChatSessions();
		chatSessions = (sessions || []).map((s) => ({
			id: s.id,
			title: s.title,
			createdAt: s.createdAt,
			messagesCount: Array.isArray(s.messages) ? s.messages.length : 0,
		}));
	} catch {
		chatSessions = [];
	}

	return {
		siteArchitecture,
		currentTime: {
			date: todayStr,
			dayArabic: now.toLocaleDateString("ar-SA", { weekday: "long" }),
			time: currentTimeStr,
		},
		settings,
		astronomy,
		prayerTracking: {
			todayObligatoryStatus,
			todayRecords: todayPrayerRecords,
			allHistoricalRecordsCount: allPrayerRecords.length,
			allHistoricalRecords: allPrayerRecords,
			summaryStatistics: prayerStats,
		},
		tasbeeh: tasbeehData,
		booksAndWard: booksData,
		audioLibrary: audioData,
		chatSessions,
	};
}

/**
 * Serializes the complete application database and state into a comprehensive, transparent
 * markdown block for Gemini prompt. Covers 100% of the site and user data without omission.
 */
export async function formatAppContextForPrompt() {
	const ctx = await getLiveAppContext();

	const lines = [
		"<current_app_context>",
		"# قاعدة البيانات والحالة الكاملة لتطبيق تتبع العادات والصلوات (Habit Tracker):",
		"يحتوي هذا السياق على كافة بيانات الموقع وسجلات المستخدم الحقيقية بدقة 100% ودون أي اقتطاع.",
		"",
		`## 1. الوقت والتاريخ الحي:`,
		`- التاريخ الحالي: ${ctx.currentTime.date} (${ctx.currentTime.dayArabic})`,
		`- التوقيت المحلي: ${ctx.currentTime.time}`,
		"",
		`## 2. الإعدادات الشاملة والموقع الجغرافي:`,
		`- مصدر مواقيت الصلاة: واجهة Aladhan الرسمية المباشرة (api.aladhan.com)`,
		`- الموقع: ${ctx.settings.city ? `${ctx.settings.city}، ${ctx.settings.country}` : "لم يتم تحديد المدينة والدولة بعد"}`,
		`- الإحداثيات: ${ctx.settings.latitude !== null ? `خط عرض: ${ctx.settings.latitude} | خط طول: ${ctx.settings.longitude}` : "غير محددة"}`,
		`- المنطقة الزمنية: ${ctx.settings.timezone || "تلقائي بحسب المتصفح"}`,
		`- لغة التطبيق: ${ctx.settings.language === "en" ? "الإنجليزية (English)" : "العربية"}`,
		`- نظام عرض الوقت: نظام ${ctx.settings.timeFormat} ساعة`,
		`- وضع الخلفية الحية: ${
			ctx.settings.bgMode === "madinah"
				? "بث مباشر من المسجد النبوي الشريف"
				: ctx.settings.bgMode === "custom_image"
					? "صورة مخصصة مرفوعة من جهاز المستخدم"
					: "بث مباشر من الحرم المكي الشريف"
		}`,
		"",
		`## 3. الفلك ومواقيت الصلاة الرسمية (عبر api.aladhan.com) والقبلة:`,
	];

	if (ctx.astronomy.hasTimes) {
		const t = ctx.astronomy.prayerTimes;
		lines.push(
			`- مواقيت الصلاة: الفجر: ${t.Fajr} | الشروق: ${t.Sunrise} | الظهر: ${t.Dhuhr} | العصر: ${t.Asr} | المغرب: ${t.Maghrib} | العشاء: ${t.Isha}`,
		);
		if (ctx.astronomy.nightTimes) {
			lines.push(
				`- أوقات الليل الفقهية: منتصف الليل: ${ctx.astronomy.nightTimes.midnight} | بداية الثلث الأخير (قيام الليل والتهجد): ${ctx.astronomy.nightTimes.lastThird}`,
			);
		}
	} else {
		lines.push(
			"- مواقيت الصلاة: غير متوفرة بعد (يلزم تحديد الموقع وجلب المواقيت من api.aladhan.com).",
		);
	}
	if (ctx.astronomy.qiblaBearing) {
		lines.push(
			`- زاوية اتجاه القبلة من موقع المستخدم: ${ctx.astronomy.qiblaBearing}`,
		);
	}

	// 4. Obligatory Prayers
	lines.push(
		"",
		`## 4. سجل صلوات الفريضة الخمس (اليوم + السجل التراكمي الكامل):`,
	);
	lines.push("### صلوات اليوم الخمس:");
	OBLIGATORY_PRAYER_IDS.forEach((id) => {
		const item = ctx.prayerTracking.todayObligatoryStatus[id];
		let desc = item.status;
		if (item.status === "on_time") desc = "أُديت في وقتها";
		else if (item.status === "late")
			desc = `أُديت متأخرة (تأخير ${item.delayMinutes} دقيقة)`;
		else if (item.status === "qada") desc = "أُديت قضاءً";
		else if (item.status === "missed") desc = "فائتة";
		lines.push(`- صلاة ${id}: ${desc}`);
	});

	lines.push("");
	lines.push("### الإحصائيات التراكمية وسلاسل الالتزام:");
	lines.push(
		`- السلسلة الحالية المتصلة (أداء جميع الصلوات في وقتها): ${ctx.prayerTracking.summaryStatistics.currentStreak} يوم`,
	);
	lines.push(
		`- أطول سلسلة متصلة حققها المستخدم: ${ctx.prayerTracking.summaryStatistics.maxStreak} يوم`,
	);
	lines.push(
		`- إجمالي الأيام المسجلة في التطبيق: ${ctx.prayerTracking.summaryStatistics.total_days_tracked || ctx.prayerTracking.allHistoricalRecordsCount} صلاة مسجلة`,
	);
	lines.push(
		`- إجمالي الصلوات في وقتها: ${ctx.prayerTracking.summaryStatistics.onTime} صلاة`,
	);
	lines.push(
		`- إجمالي الصلوات المتأخرة: ${ctx.prayerTracking.summaryStatistics.late} صلاة (متوسط التأخير: ${ctx.prayerTracking.summaryStatistics.avgDelay} دقيقة)`,
	);
	lines.push(
		`- إجمالي الصلوات المقضية: ${ctx.prayerTracking.summaryStatistics.qada} صلاة`,
	);
	lines.push(
		`- إجمالي الصلوات الفائتة: ${ctx.prayerTracking.summaryStatistics.missed} صلاة`,
	);

	// Detailed Past Days Prayer Logs Breakdown
	const prayerDateGroups = {};
	(ctx.prayerTracking.allHistoricalRecords || []).forEach((r) => {
		if (!r || !r.date) return;
		if (!prayerDateGroups[r.date]) prayerDateGroups[r.date] = [];
		prayerDateGroups[r.date].push(r);
	});
	const pastPrayerDates = Object.keys(prayerDateGroups).sort().reverse();
	if (pastPrayerDates.length > 0) {
		lines.push("");
		lines.push("### تفاصيل السجل اليومي للصلوات في الأيام السابقة:");
		pastPrayerDates.slice(0, 30).forEach((d) => {
			const pList = prayerDateGroups[d];
			const details = pList
				.map((p) => {
					const st =
						p.status === "on_time"
							? "في وقتها"
							: p.status === "late"
								? `متأخرة (${p.delay_minutes || 0}د)`
								: p.status === "qada"
									? "قضاء"
									: "فائتة";
					return `${p.prayer_name || p.prayer_id}: ${st}`;
				})
				.join(" | ");
			lines.push(`- يوم ${d}: ${details}`);
		});
	}

	// 5. Tasbeeh
	lines.push("", `## 5. المسبحة الإلكترونية والأذكار:`);
	if (ctx.tasbeeh) {
		if (ctx.tasbeeh.activeDhikr) {
			lines.push(
				`- الذكر النشط حالياً: "${ctx.tasbeeh.activeDhikr.text}" (العدد الحالي: ${ctx.tasbeeh.activeDhikr.count} من الهدف: ${ctx.tasbeeh.activeDhikr.target} - الشوط رقم: ${ctx.tasbeeh.currentRound})`,
			);
		}
		lines.push(`- إجمالي تسبيحات اليوم: ${ctx.tasbeeh.todayTotal} تسبيحة`);
		lines.push(
			`- إجمالي التسبيحات الكلي على الإطلاق: ${ctx.tasbeeh.grandTotal} تسبيحة`,
		);
		lines.push(
			`- التدوير التلقائي: ${ctx.tasbeeh.autoCycle ? "مفعل" : "معطل"} | الصوت: ${ctx.tasbeeh.soundEnabled ? "مفعل" : "معطل"} | الاهتزاز: ${ctx.tasbeeh.vibrationEnabled ? "مفعل" : "معطل"}`,
		);
		lines.push("- جميع الأذكار المسجلة في المسبحة:");
		ctx.tasbeeh.allAdhkar.forEach((d) => {
			lines.push(
				`  * ${d.text} ${d.isCustom ? "(ذكر مخصص)" : ""}: إجمالي العدد الكلي: ${d.totalCount} | العدد في الشوط الحالي: ${d.count}/${d.target}`,
			);
		});
	} else {
		lines.push("- المسبحة الإلكترونية: لم يتم استخدامها بعد.");
	}

	// 6. Book Reader & Ward
	lines.push(
		"",
		`## 6. مكتبة الكتب والورد اليومي (برنامج بناء عادة القراءة 21 يوماً):`,
	);
	if (ctx.booksAndWard.libraryBooks.length > 0) {
		lines.push(
			`- عدد الكتب في المكتبة: ${ctx.booksAndWard.libraryBooks.length} كتاب:`,
		);
		ctx.booksAndWard.libraryBooks.forEach((b) => {
			lines.push(
				`  * "${b.name}" (${b.totalPages} صفحة - العلامة المرجعية الحالية: صفحة ${b.bookmarkPage})`,
			);
		});
		if (ctx.booksAndWard.activeBook && ctx.booksAndWard.readingHabit) {
			const rh = ctx.booksAndWard.readingHabit;
			lines.push(
				`- الكتاب المفتوح حالياً: "${ctx.booksAndWard.activeBook.name}"`,
			);
			lines.push(
				`- المستوى الحالي في برنامج الـ 21 يوماً: المستوى ${rh.activeLevel} (الهدف: ${rh.dailyTarget} صفحة/يوم)`,
			);
			lines.push(
				`- صفحات المقروءة اليوم: ${rh.pagesReadToday} صفحة (سقف الورد اليومي الأقصى المسموح لليوم: صفحة ${rh.wardCeiling})`,
			);
			lines.push(
				`- حالة ورد اليوم: ${rh.isWardCompletedToday ? "أُنجز الورد بنجاح" : "قيد الإنجاز"}`,
			);
			lines.push(
				`- عدد الأيام المكتملة في التحدي: ${rh.completedDays} من أصل 21 يوماً`,
			);
			lines.push(`- سلسلة أيام القراءة المتصلة: ${rh.streakDays} يوم`);
			if (rh.missedGraceWarning) {
				lines.push(
					`- تنبيه مهلة القراءة: تم تفعيل مهلة يوم واحد لتدارك الورد وحماية السلسلة.`,
				);
			}

			// Detailed Past Days Reading Logs Breakdown
			const readingLogs = rh.dailyLogs || {};
			const readingLogDates = Object.keys(readingLogs).sort().reverse();
			if (readingLogDates.length > 0) {
				lines.push("");
				lines.push("### تفاصيل قراءة الورد في الأيام السابقة:");
				readingLogDates.slice(0, 30).forEach((d) => {
					const log = readingLogs[d];
					lines.push(
						`- يوم ${d}: قراءة ${log.pagesRead || 0} صفحة (المستهدف: ${log.target || 10}) - ${log.completed ? "أُنجز الورد" : "لم يكتمل"}`,
					);
				});
			}
		}
	} else {
		lines.push("- مكتبة الكتب: لا توجد كتب مرفوعة حالياً في حساب المستخدم.");
	}

	// 7. Audio Player & Local Library
	lines.push("", `## 7. مشغل الصوتيات والمكتبة الصوتية:`);
	if (ctx.audioLibrary && ctx.audioLibrary.tracksCount > 0) {
		lines.push(
			`- المجلد الحالي: "${ctx.audioLibrary.folderName || "مجلد الصوتيات"}"`,
		);
		lines.push(
			`- إجمالي المقاطع الصوتية في المكتبة: ${ctx.audioLibrary.tracksCount} مقطع`,
		);
		if (ctx.audioLibrary.activeTrack) {
			lines.push(
				`- المقطع المحدد حالياً: "${ctx.audioLibrary.activeTrack.title}" (${ctx.audioLibrary.activeTrack.sizeFormatted})`,
			);
		}
		lines.push(
			`- وضع التكرار: ${ctx.audioLibrary.repeatMode === "all" ? "تكرار الكل" : ctx.audioLibrary.repeatMode === "one" ? "تكرار المقطع الحالي" : "إيقاف التكرار"} | التشغيل العشوائي: ${ctx.audioLibrary.isShuffle ? "مفعل" : "معطل"}`,
		);
		lines.push("- قائمة المقاطع الصوتية في المكتبة:");
		ctx.audioLibrary.allTracks.slice(0, 50).forEach((t, idx) => {
			lines.push(`  ${idx + 1}. "${t.title}" (${t.sizeFormatted})`);
		});
	} else {
		lines.push(
			"- مكتبة الصوتيات: لا توجد مقاطع صوتية مرفوعة حالياً في حساب المستخدم.",
		);
	}

	// 8. Previous Chat Sessions
	lines.push("", `## 8. جلسات المحادثة المحفوظة:`);
	if (ctx.chatSessions.length > 0) {
		lines.push(`- عدد الجلسات المحفوظة: ${ctx.chatSessions.length} جلسة:`);
		ctx.chatSessions.forEach((s, idx) => {
			lines.push(
				`  * جلسة ${idx + 1}: "${s.title}" (${s.messagesCount} رسالة)`,
			);
		});
	} else {
		lines.push("- لا توجد جلسات محادثة سابقة.");
	}

	// 9. Full Raw JSON Dump for deep programmatic reference
	lines.push(
		"",
		`## 9. البيانات البرمجية الخام لتطبيق المستخدم (Raw App State JSON):`,
	);
	lines.push("```json");
	lines.push(JSON.stringify(ctx, null, 2));
	lines.push("```");

	lines.push("</current_app_context>");

	return lines.join("\n");
}
