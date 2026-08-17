import {
  getSettings,
  getPrayerTimesCache,
  getRecords,
  getNaflRecords,
  calculateNightTimes,
  toWesternDigits,
  getCityTodayDateStr,
  NAFL_PRAYERS,
  OBLIGATORY_PRAYER_IDS,
} from './storage.js';

/**
 * Builds a structured, real-time snapshot of the user's application state,
 * including today's prayer times, current prayer tracking statuses, completed nafls,
 * current location, settings, and overall stats.
 */
export function getLiveAppContext() {
  const settings = getSettings();
  const prayerTimes = getPrayerTimesCache();
  const records = getRecords();
  const naflRecords = getNaflRecords();

  const now = new Date();
  const todayStr = getCityTodayDateStr(settings.timezone || prayerTimes?.timezone);
  const todayRecords = records.filter((r) => r.date === todayStr);
  const todayNafl = naflRecords.filter((r) => r.date === todayStr);

  const nightTimes = calculateNightTimes(prayerTimes?.Maghrib, prayerTimes?.Fajr);

  const prayerStatusMap = {};
  OBLIGATORY_PRAYER_IDS.forEach((id) => {
    prayerStatusMap[id] = 'لم تُسجل بعد';
  });

  todayRecords.forEach((r) => {
    const pId = r.prayer_name || r.prayer_id;
    if (pId && prayerStatusMap[pId] !== undefined) {
      if (r.status === 'on_time') prayerStatusMap[pId] = 'أُديت في وقتها';
      else if (r.status === 'late') prayerStatusMap[pId] = 'أُديت متأخرة';
      else if (r.status === 'qada') prayerStatusMap[pId] = 'أُديت قضاءً';
      else if (r.status === 'missed') prayerStatusMap[pId] = 'فائتة';
    }
  });

  const completedNaflList = todayNafl
    .filter((n) => n.status === 'completed')
    .map((n) => {
      const match = NAFL_PRAYERS.find((p) => p.id === n.nafl_id);
      return match ? match.nameAr : n.nafl_id;
    });

  const recordedDates = new Set(records.map((r) => r.date));

  return {
    current_time: toWesternDigits(
      now.toLocaleTimeString('ar-EG-u-nu-latn', {
        hour: '2-digit',
        minute: '2-digit',
      })
    ),
    current_date: todayStr,
    current_day_ar: now.toLocaleDateString('ar-SA', { weekday: 'long' }),
    location: {
      city: settings.city || 'غير محددة بعد',
      country: settings.country || 'غير محددة بعد',
      timezone: settings.timezone || 'التوقيت المحلي',
    },
    today_prayer_times: {
      Fajr: (prayerTimes && prayerTimes.Fajr) || 'غير متوفر',
      Sunrise: (prayerTimes && prayerTimes.Sunrise) || 'غير متوفر',
      Dhuhr: (prayerTimes && prayerTimes.Dhuhr) || 'غير متوفر',
      Asr: (prayerTimes && prayerTimes.Asr) || 'غير متوفر',
      Maghrib: (prayerTimes && prayerTimes.Maghrib) || 'غير متوفر',
      Isha: (prayerTimes && prayerTimes.Isha) || 'غير متوفر',
      Midnight_Half_Night: nightTimes ? nightTimes.midnight12 : 'غير متوفر',
      Last_Third_Night: nightTimes ? nightTimes.lastThird12 : 'غير متوفر',
    },
    today_prayer_status: prayerStatusMap,
    today_completed_nafl:
      completedNaflList.length > 0 ? completedNaflList : ['لم تُسجل نوافل اليوم بعد'],
    app_settings: {
      language: settings.language === 'en' ? 'en' : 'ar',
      languageLabel: settings.language === 'en' ? 'الإنجليزية (English)' : 'العربية (Arabic)',
      timeFormat: settings.timeFormat === '24' ? 'نظام 24 ساعة' : 'نظام 12 ساعة',
      gracePeriodMinutes: (settings.gracePeriodMinutes || 15) + ' دقيقة',
      bgMode: settings.bgMode || 'makkah',
      bgModeLabel:
        settings.bgMode === 'madinah'
          ? 'بث المسجد النبوي الشريف (المدينة المنورة)'
          : settings.bgMode === 'custom_image'
          ? 'صورة مخصصة من الجهاز'
          : 'بث الحرم المكي المباشر (مكة المكرمة)',
    },
    overall_statistics: {
      total_days_tracked: recordedDates.size,
      total_prayers_logged: records.length,
      on_time_prayers_count: records.filter((r) => r.status === 'on_time').length,
      late_prayers_count: records.filter((r) => r.status === 'late').length,
      qada_prayers_count: records.filter((r) => r.status === 'qada').length,
      missed_prayers_count: records.filter((r) => r.status === 'missed').length,
    },
  };
}

/**
 * Serializes the live app context into a clean markdown block for the Gemini API prompt.
 */
export function formatAppContextForPrompt() {
  const ctx = getLiveAppContext();
  return `
<current_app_context>
معلومات وبيانات الموقع الحية والمفعلة حالياً في حساب المستخدم:
- التاريخ اليوم: ${ctx.current_date} (${ctx.current_day_ar})
- الوقت الحالي: ${ctx.current_time}
- الموقع الجغرافي الحالي: المدينة: ${ctx.location.city} | الدولة: ${ctx.location.country} (${ctx.location.timezone})
- مواقيت الصلاة لليوم:
  * الفجر: ${ctx.today_prayer_times.Fajr}
  * الشروق: ${ctx.today_prayer_times.Sunrise}
  * الظهر: ${ctx.today_prayer_times.Dhuhr}
  * العصر: ${ctx.today_prayer_times.Asr}
  * المغرب: ${ctx.today_prayer_times.Maghrib}
  * العشاء: ${ctx.today_prayer_times.Isha}
  * منتصف الليل: ${ctx.today_prayer_times.Midnight_Half_Night}
  * ثلث الليل الأخير: ${ctx.today_prayer_times.Last_Third_Night}
- سجل صلوات اليوم:
  * الفجر: ${ctx.today_prayer_status.Fajr}
  * الظهر: ${ctx.today_prayer_status.Dhuhr}
  * العصر: ${ctx.today_prayer_status.Asr}
  * المغرب: ${ctx.today_prayer_status.Maghrib}
  * العشاء: ${ctx.today_prayer_status.Isha}
- النوافل المنجزة اليوم: ${ctx.today_completed_nafl.join('، ')}
- إعدادات الموقع الحالية والنشطة الآن:
  * وضع الخلفية الحالي: ${ctx.app_settings.bgModeLabel} (رمز الإعداد: ${ctx.app_settings.bgMode})
  * تنسيق الوقت الحالي: ${ctx.app_settings.timeFormat}
  * مهلة الصلاة في وقتها الحالية: ${ctx.app_settings.gracePeriodMinutes}
- الإحصائيات الإجمالية:
  * إجمالي الأيام المسجلة: ${ctx.overall_statistics.total_days_tracked}
  * إجمالي الصلوات في وقتها: ${ctx.overall_statistics.on_time_prayers_count}
</current_app_context>
`.trim();
}
