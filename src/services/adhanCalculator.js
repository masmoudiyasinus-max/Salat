import { Coordinates, CalculationMethod, PrayerTimes, Madhab, HighLatitudeRule, Qibla, SunnahTimes } from 'adhan';
import { toWesternDigits } from './timeUtils.js';
import { getSettings, saveSettings, savePrayerTimesCache, getSourceScheduleCache } from './storage.js';

export const CALCULATION_METHODS = [
  { id: 'auto', nameAr: 'تلقائي (حسب الدولة المحددة)', nameEn: 'Automatic (Based on Selected Country)' },
  { id: '4', nameAr: 'تقويم أم القرى - مكة المكرمة (السعودية ودول الخليج)', nameEn: 'Umm Al-Qura University, Makkah (Saudi Arabia & Gulf)' },
  { id: '5', nameAr: 'الهيئة المصرية العامة للمساحة (مصر، السودان، وبلاد الشام)', nameEn: 'Egyptian General Authority of Survey (Egypt & Levant)' },
  { id: '13', nameAr: 'رئاسة الشؤون الدينية التركية والمغرب العربي (تونس، الجزائر، المغرب)', nameEn: 'Diyanet & Maghreb (Turkey, Tunisia, Algeria, Morocco)' },
  { id: '3', nameAr: 'رابطة العالم الإسلامي (أوروبا وباقي دول العالم)', nameEn: 'Muslim World League (Europe & Global)' },
  { id: '2', nameAr: 'الجمعية الإسلامية لأمريكا الشمالية - ISNA (أمريكا وكندا)', nameEn: 'Islamic Society of North America - ISNA (USA & Canada)' },
  { id: '1', nameAr: 'جامعة العلوم الإسلامية بكراتشي (باكستان، الهند، بنغلاديش)', nameEn: 'University of Islamic Sciences, Karachi' },
  { id: '16', nameAr: 'دائرة الشؤون الإسلامية والعمل الخيري بدبي (الإمارات)', nameEn: 'Dubai, UAE' },
  { id: '9', nameAr: 'وزارة الأوقاف والشؤون الإسلامية (الكويت)', nameEn: 'Ministry of Awqaf, Kuwait' },
  { id: '10', nameAr: 'وزارة الأوقاف والشؤون الإسلامية (قطر)', nameEn: 'Ministry of Awqaf, Qatar' },
  { id: '11', nameAr: 'مجلس أوغاما الإسلامي (سنغافورة)', nameEn: 'Majlis Ugama Islam Singapura, Singapore' },
  { id: 'tehran', nameAr: 'معهد ليفا، قم (الشيعة الإمامية الاثنا عشرية)', nameEn: 'Shia Ithna-Ashari, Leva Institute, Qum' },
  { id: 'moonsighting', nameAr: 'لجنة رؤية الهلال العالمية (Moonsighting Committee)', nameEn: 'Moonsighting Committee Worldwide' },
];

const CITY_COORDS_CACHE_KEY = 'prayer_tracker_city_coords_cache';

// Built-in coordinates for major capitals & Islamic cities for instant 0-latency resolution
const KNOWN_CITY_COORDINATES = {
  'makkah': { lat: 21.4225, lng: 39.8262, tz: 'Asia/Riyadh' },
  'mecca': { lat: 21.4225, lng: 39.8262, tz: 'Asia/Riyadh' },
  'مكة': { lat: 21.4225, lng: 39.8262, tz: 'Asia/Riyadh' },
  'مكة المكرمة': { lat: 21.4225, lng: 39.8262, tz: 'Asia/Riyadh' },
  'madinah': { lat: 24.4672, lng: 39.6111, tz: 'Asia/Riyadh' },
  'medina': { lat: 24.4672, lng: 39.6111, tz: 'Asia/Riyadh' },
  'المدينة المنورة': { lat: 24.4672, lng: 39.6111, tz: 'Asia/Riyadh' },
  'riyadh': { lat: 24.7136, lng: 46.6753, tz: 'Asia/Riyadh' },
  'الرياض': { lat: 24.7136, lng: 46.6753, tz: 'Asia/Riyadh' },
  'jeddah': { lat: 21.5433, lng: 39.1728, tz: 'Asia/Riyadh' },
  'جدة': { lat: 21.5433, lng: 39.1728, tz: 'Asia/Riyadh' },
  'dammam': { lat: 26.4207, lng: 50.0888, tz: 'Asia/Riyadh' },
  'الدمام': { lat: 26.4207, lng: 50.0888, tz: 'Asia/Riyadh' },
  'cairo': { lat: 30.0444, lng: 31.2357, tz: 'Africa/Cairo' },
  'القاهرة': { lat: 30.0444, lng: 31.2357, tz: 'Africa/Cairo' },
  'alexandria': { lat: 31.2001, lng: 29.9187, tz: 'Africa/Cairo' },
  'الإسكندرية': { lat: 31.2001, lng: 29.9187, tz: 'Africa/Cairo' },
  'giza': { lat: 30.0131, lng: 31.2089, tz: 'Africa/Cairo' },
  'الجيزة': { lat: 30.0131, lng: 31.2089, tz: 'Africa/Cairo' },
  'tunis': { lat: 36.8065, lng: 10.1815, tz: 'Africa/Tunis' },
  'تونس': { lat: 36.8065, lng: 10.1815, tz: 'Africa/Tunis' },
  'sfax': { lat: 34.7406, lng: 10.7603, tz: 'Africa/Tunis' },
  'صفاقس': { lat: 34.7406, lng: 10.7603, tz: 'Africa/Tunis' },
  'sousse': { lat: 35.8256, lng: 10.6369, tz: 'Africa/Tunis' },
  'سوسة': { lat: 35.8256, lng: 10.6369, tz: 'Africa/Tunis' },
  'kairouan': { lat: 35.6781, lng: 10.0963, tz: 'Africa/Tunis' },
  'القيروان': { lat: 35.6781, lng: 10.0963, tz: 'Africa/Tunis' },
  'bizerte': { lat: 37.2744, lng: 9.8739, tz: 'Africa/Tunis' },
  'بنزرت': { lat: 37.2744, lng: 9.8739, tz: 'Africa/Tunis' },
  'gabes': { lat: 33.8815, lng: 10.0982, tz: 'Africa/Tunis' },
  'قابس': { lat: 33.8815, lng: 10.0982, tz: 'Africa/Tunis' },
  'monastir': { lat: 35.7780, lng: 10.8262, tz: 'Africa/Tunis' },
  'المنستير': { lat: 35.7780, lng: 10.8262, tz: 'Africa/Tunis' },
  'algiers': { lat: 36.7538, lng: 3.0588, tz: 'Africa/Algiers' },
  'الجزائر': { lat: 36.7538, lng: 3.0588, tz: 'Africa/Algiers' },
  'oran': { lat: 35.6987, lng: -0.6349, tz: 'Africa/Algiers' },
  'وهران': { lat: 35.6987, lng: -0.6349, tz: 'Africa/Algiers' },
  'constantine': { lat: 36.3650, lng: 6.6147, tz: 'Africa/Algiers' },
  'قسنطينة': { lat: 36.3650, lng: 6.6147, tz: 'Africa/Algiers' },
  'casablanca': { lat: 33.5731, lng: -7.5898, tz: 'Africa/Casablanca' },
  'الدار البيضاء': { lat: 33.5731, lng: -7.5898, tz: 'Africa/Casablanca' },
  'rabat': { lat: 34.0209, lng: -6.8416, tz: 'Africa/Casablanca' },
  'الرباط': { lat: 34.0209, lng: -6.8416, tz: 'Africa/Casablanca' },
  'marrakech': { lat: 31.6295, lng: -7.9811, tz: 'Africa/Casablanca' },
  'مراكش': { lat: 31.6295, lng: -7.9811, tz: 'Africa/Casablanca' },
  'fez': { lat: 34.0331, lng: -5.0003, tz: 'Africa/Casablanca' },
  'فاس': { lat: 34.0331, lng: -5.0003, tz: 'Africa/Casablanca' },
  'tangier': { lat: 35.7595, lng: -5.8340, tz: 'Africa/Casablanca' },
  'طنجة': { lat: 35.7595, lng: -5.8340, tz: 'Africa/Casablanca' },
  'dubai': { lat: 25.2048, lng: 55.2708, tz: 'Asia/Dubai' },
  'دبي': { lat: 25.2048, lng: 55.2708, tz: 'Asia/Dubai' },
  'abu dhabi': { lat: 24.4539, lng: 54.3773, tz: 'Asia/Dubai' },
  'أبو ظبي': { lat: 24.4539, lng: 54.3773, tz: 'Asia/Dubai' },
  'doha': { lat: 25.2854, lng: 51.5310, tz: 'Asia/Qatar' },
  'الدوحة': { lat: 25.2854, lng: 51.5310, tz: 'Asia/Qatar' },
  'kuwait': { lat: 29.3759, lng: 47.9774, tz: 'Asia/Kuwait' },
  'الكويت': { lat: 29.3759, lng: 47.9774, tz: 'Asia/Kuwait' },
  'manama': { lat: 26.2285, lng: 50.5860, tz: 'Asia/Bahrain' },
  'المنامة': { lat: 26.2285, lng: 50.5860, tz: 'Asia/Bahrain' },
  'muscat': { lat: 23.5880, lng: 58.3829, tz: 'Asia/Muscat' },
  'مسقط': { lat: 23.5880, lng: 58.3829, tz: 'Asia/Muscat' },
  'amman': { lat: 31.9454, lng: 35.9284, tz: 'Asia/Amman' },
  'عمان': { lat: 31.9454, lng: 35.9284, tz: 'Asia/Amman' },
  'jerusalem': { lat: 31.7683, lng: 35.2137, tz: 'Asia/Jerusalem' },
  'القدس': { lat: 31.7683, lng: 35.2137, tz: 'Asia/Jerusalem' },
  'القدس الشريف': { lat: 31.7683, lng: 35.2137, tz: 'Asia/Jerusalem' },
  'gaza': { lat: 31.5017, lng: 34.4668, tz: 'Asia/Gaza' },
  'غزة': { lat: 31.5017, lng: 34.4668, tz: 'Asia/Gaza' },
  'gaza city': { lat: 31.5017, lng: 34.4668, tz: 'Asia/Gaza' },
  'مدينة غزة': { lat: 31.5017, lng: 34.4668, tz: 'Asia/Gaza' },
  'hebron': { lat: 31.5326, lng: 35.0998, tz: 'Asia/Jerusalem' },
  'الخليل': { lat: 31.5326, lng: 35.0998, tz: 'Asia/Jerusalem' },
  'nablus': { lat: 32.2211, lng: 35.2544, tz: 'Asia/Jerusalem' },
  'نابلس': { lat: 32.2211, lng: 35.2544, tz: 'Asia/Jerusalem' },
  'ramallah': { lat: 31.9038, lng: 35.2034, tz: 'Asia/Jerusalem' },
  'رام الله': { lat: 31.9038, lng: 35.2034, tz: 'Asia/Jerusalem' },
  'jenin': { lat: 32.4599, lng: 35.2974, tz: 'Asia/Jerusalem' },
  'جنين': { lat: 32.4599, lng: 35.2974, tz: 'Asia/Jerusalem' },
  'khan yunis': { lat: 31.3462, lng: 34.3063, tz: 'Asia/Gaza' },
  'خان يونس': { lat: 31.3462, lng: 34.3063, tz: 'Asia/Gaza' },
  'rafah': { lat: 31.2825, lng: 34.2589, tz: 'Asia/Gaza' },
  'رفح': { lat: 31.2825, lng: 34.2589, tz: 'Asia/Gaza' },
  'beirut': { lat: 33.8938, lng: 35.5018, tz: 'Asia/Beirut' },
  'بيروت': { lat: 33.8938, lng: 35.5018, tz: 'Asia/Beirut' },
  'damascus': { lat: 33.5138, lng: 36.2765, tz: 'Asia/Damascus' },
  'دمشق': { lat: 33.5138, lng: 36.2765, tz: 'Asia/Damascus' },
  'baghdad': { lat: 33.3152, lng: 44.3661, tz: 'Asia/Baghdad' },
  'بغداد': { lat: 33.3152, lng: 44.3661, tz: 'Asia/Baghdad' },
  'tripoli': { lat: 32.8872, lng: 13.1913, tz: 'Africa/Tripoli' },
  'طرابلس': { lat: 32.8872, lng: 13.1913, tz: 'Africa/Tripoli' },
  'khartoum': { lat: 15.5007, lng: 32.5599, tz: 'Africa/Khartoum' },
  'الخرطوم': { lat: 15.5007, lng: 32.5599, tz: 'Africa/Khartoum' },
  'istanbul': { lat: 41.0082, lng: 28.9784, tz: 'Europe/Istanbul' },
  'إسطنبول': { lat: 41.0082, lng: 28.9784, tz: 'Europe/Istanbul' },
  'ankara': { lat: 39.9334, lng: 32.8597, tz: 'Europe/Istanbul' },
  'أنقرة': { lat: 39.9334, lng: 32.8597, tz: 'Europe/Istanbul' },
  'london': { lat: 51.5074, lng: -0.1278, tz: 'Europe/London' },
  'لندن': { lat: 51.5074, lng: -0.1278, tz: 'Europe/London' },
  'paris': { lat: 48.8566, lng: 2.3522, tz: 'Europe/Paris' },
  'باريس': { lat: 48.8566, lng: 2.3522, tz: 'Europe/Paris' },
  'new york': { lat: 40.7128, lng: -74.0060, tz: 'America/New_York' },
  'نيويورك': { lat: 40.7128, lng: -74.0060, tz: 'America/New_York' },
  'karachi': { lat: 24.8607, lng: 67.0011, tz: 'Asia/Karachi' },
  'كراتشي': { lat: 24.8607, lng: 67.0011, tz: 'Asia/Karachi' },
  'jakarta': { lat: -6.2088, lng: 106.8456, tz: 'Asia/Jakarta' },
  'جاكرتا': { lat: -6.2088, lng: 106.8456, tz: 'Asia/Jakarta' },
  'kuala lumpur': { lat: 3.1390, lng: 101.6869, tz: 'Asia/Kuala_Lumpur' },
  'كوالالمبور': { lat: 3.1390, lng: 101.6869, tz: 'Asia/Kuala_Lumpur' },
  'tokyo': { lat: 35.6762, lng: 139.6503, tz: 'Asia/Tokyo' },
  'طوكيو': { lat: 35.6762, lng: 139.6503, tz: 'Asia/Tokyo' },
};

export const COUNTRY_TIMEZONE_MAP = {
  'saudi arabia': 'Asia/Riyadh',
  'السعودية': 'Asia/Riyadh',
  'egypt': 'Africa/Cairo',
  'مصر': 'Africa/Cairo',
  'tunisia': 'Africa/Tunis',
  'تونس': 'Africa/Tunis',
  'algeria': 'Africa/Algiers',
  'الجزائر': 'Africa/Algiers',
  'morocco': 'Africa/Casablanca',
  'المغرب': 'Africa/Casablanca',
  'united arab emirates': 'Asia/Dubai',
  'الإمارات': 'Asia/Dubai',
  'uae': 'Asia/Dubai',
  'qatar': 'Asia/Qatar',
  'قطر': 'Asia/Qatar',
  'kuwait': 'Asia/Kuwait',
  'الكويت': 'Asia/Kuwait',
  'oman': 'Asia/Muscat',
  'عمان': 'Asia/Muscat',
  'jordan': 'Asia/Amman',
  'الأردن': 'Asia/Amman',
  'palestine': 'Asia/Hebron',
  'فلسطين': 'Asia/Hebron',
  'lebanon': 'Asia/Beirut',
  'لبنان': 'Asia/Beirut',
  'syria': 'Asia/Damascus',
  'سوريا': 'Asia/Damascus',
  'iraq': 'Asia/Baghdad',
  'العراق': 'Asia/Baghdad',
  'turkey': 'Europe/Istanbul',
  'تركيا': 'Europe/Istanbul',
  'united kingdom': 'Europe/London',
  'المملكة المتحدة': 'Europe/London',
  'uk': 'Europe/London',
  'france': 'Europe/Paris',
  'فرنسا': 'Europe/Paris',
  'germany': 'Europe/Berlin',
  'ألمانيا': 'Europe/Berlin',
  'united states': 'America/New_York',
  'امريكا': 'America/New_York',
  'usa': 'America/New_York',
  'canada': 'America/Toronto',
  'كندا': 'America/Toronto',
  'japan': 'Asia/Tokyo',
  'اليابان': 'Asia/Tokyo',
  'indonesia': 'Asia/Jakarta',
  'إندونيسيا': 'Asia/Jakarta',
  'malaysia': 'Asia/Kuala_Lumpur',
  'ماليزيا': 'Asia/Kuala_Lumpur',
  'pakistan': 'Asia/Karachi',
  'باكستان': 'Asia/Karachi',
  'india': 'Asia/Kolkata',
  'الهند': 'Asia/Kolkata',
  'bangladesh': 'Asia/Dhaka',
  'بنغلاديش': 'Asia/Dhaka',
  'sudan': 'Africa/Khartoum',
  'السودان': 'Africa/Khartoum',
  'libya': 'Africa/Tripoli',
  'ليبيا': 'Africa/Tripoli',
  'mauritania': 'Africa/Nouakchott',
  'موريتانيا': 'Africa/Nouakchott',
  'yemen': 'Asia/Aden',
  'اليمن': 'Asia/Aden',
  'bahrain': 'Asia/Bahrain',
  'البحرين': 'Asia/Bahrain',
};

/**
 * Accurately resolves the official IANA timezone identifier for any city and country in the world.
 */
export function resolveTimezoneForLocation(city, country, fallbackTz = '') {
  if (fallbackTz && typeof fallbackTz === 'string' && fallbackTz.includes('/')) {
    return fallbackTz.trim();
  }

  const cleanCity = (city || '').trim().toLowerCase();
  const cleanCountry = (country || '').trim().toLowerCase();

  // 1. Check known cities map
  if (KNOWN_CITY_COORDINATES[cleanCity]?.tz) {
    return KNOWN_CITY_COORDINATES[cleanCity].tz;
  }

  // 2. Check country mapping
  for (const [k, tz] of Object.entries(COUNTRY_TIMEZONE_MAP)) {
    if (cleanCountry.includes(k) || cleanCity.includes(k)) {
      return tz;
    }
  }

  return fallbackTz || (typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'Africa/Tunis');
}

/**
 * Resolves geographical coordinates for a city and country.
 */
export async function resolveCoordinatesForCity(city, country) {
  if (!city && !country) return null;
  const key = `${(city || '').trim().toLowerCase()}_${(country || '').trim().toLowerCase()}`;
  const cityKey = (city || '').trim().toLowerCase();

  // 1. Check direct predefined coordinates
  if (KNOWN_CITY_COORDINATES[cityKey]) {
    return KNOWN_CITY_COORDINATES[cityKey];
  }

  // 2. Check local storage cache
  try {
    const rawCache = localStorage.getItem(CITY_COORDS_CACHE_KEY);
    if (rawCache) {
      const cache = JSON.parse(rawCache);
      if (cache[key]) return cache[key];
    }
  } catch {}

  // 3. Forward geocode via OpenStreetMap Nominatim
  try {
    const q = encodeURIComponent(`${city || ''}, ${country || ''}`.trim());
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`, {
      headers: { 'Accept': 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const accurateTz = resolveTimezoneForLocation(city, country);
        const coords = {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
          tz: accurateTz,
        };

        // Cache coordinates locally
        try {
          const rawCache = localStorage.getItem(CITY_COORDS_CACHE_KEY) || '{}';
          const cache = JSON.parse(rawCache);
          cache[key] = coords;
          localStorage.setItem(CITY_COORDS_CACHE_KEY, JSON.stringify(cache));
        } catch {}

        return coords;
      }
    }
  } catch (err) {
    console.warn('Forward geocoding error:', err);
  }

  return null;
}

/**
 * Maps application calculation method identifiers to adhan CalculationMethod functions.
 */
export function getAdhanCalculationParameters(methodId, countryName = '') {
  const m = String(methodId || 'auto').toLowerCase();

  switch (m) {
    case '4':
    case 'ummalqura':
      return CalculationMethod.UmmAlQura();
    case '5':
    case 'egyptian':
      return CalculationMethod.Egyptian();
    case '13':
    case 'turkey':
      return CalculationMethod.Turkey();
    case '3':
    case 'muslimworldleague':
      return CalculationMethod.MuslimWorldLeague();
    case '2':
    case 'isna':
    case 'northamerica':
      return CalculationMethod.NorthAmerica();
    case '1':
    case 'karachi':
      return CalculationMethod.Karachi();
    case '16':
    case 'dubai':
      return CalculationMethod.Dubai();
    case '9':
    case 'kuwait':
      return CalculationMethod.Kuwait();
    case '10':
    case 'qatar':
      return CalculationMethod.Qatar();
    case '11':
    case 'singapore':
      return CalculationMethod.Singapore();
    case 'tehran':
    case '0':
      return CalculationMethod.Tehran();
    case 'moonsighting':
      return CalculationMethod.MoonsightingCommittee();
    case 'auto':
    default: {
      const c = (countryName || '').trim().toLowerCase();
      if (c.includes('saudi') || c.includes('سعودية') || c.includes('emirates') || c.includes('إمارات') || c.includes('qatar') || c.includes('قطر') || c.includes('kuwait') || c.includes('كويت') || c.includes('bahrain') || c.includes('بحرين') || c.includes('oman') || c.includes('عمان') || c.includes('yemen') || c.includes('يمن')) {
        return CalculationMethod.UmmAlQura();
      }
      if (c.includes('egypt') || c.includes('مصر') || c.includes('sudan') || c.includes('سودان') || c.includes('palestin') || c.includes('فلسطين') || c.includes('jordan') || c.includes('أردن') || c.includes('syria') || c.includes('سوريا') || c.includes('lebanon') || c.includes('لبنان') || c.includes('iraq') || c.includes('عراق')) {
        return CalculationMethod.Egyptian();
      }
      if (c.includes('tunis') || c.includes('تونس') || c.includes('alger') || c.includes('جزائر') || c.includes('morocco') || c.includes('مغرب') || c.includes('libya') || c.includes('ليبيا') || c.includes('mauritania') || c.includes('موريتانيا')) {
        return CalculationMethod.MuslimWorldLeague();
      }
      if (c.includes('turkey') || c.includes('تركيا') || c.includes('türkiye')) {
        return CalculationMethod.Turkey();
      }
      if (c.includes('united states') || c.includes('usa') || c.includes('أمريكا') || c.includes('canada') || c.includes('كندا')) {
        return CalculationMethod.NorthAmerica();
      }
      if (c.includes('pakistan') || c.includes('باكستان') || c.includes('india') || c.includes('هند') || c.includes('bangladesh') || c.includes('بنغلاديش') || c.includes('afghanistan') || c.includes('أفغانستان')) {
        return CalculationMethod.Karachi();
      }
      return CalculationMethod.MuslimWorldLeague();
    }
  }
}

/**
 * Formats a JavaScript Date object into an "HH:MM" 24h string.
 */
function formatDateToHHMM(date, timezone) {
  if (!date || isNaN(date.getTime())) return '';
  
  if (timezone) {
    try {
      const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        hourCycle: 'h23',
      });
      const parts = formatter.formatToParts(date);
      const h = parts.find((p) => p.type === 'hour')?.value || '00';
      const m = parts.find((p) => p.type === 'minute')?.value || '00';
      return toWesternDigits(`${h.padStart(2, '0')}:${m.padStart(2, '0')}`);
    } catch {
      // Fallback to local time
    }
  }

  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return toWesternDigits(`${h}:${m}`);
}

/**
 * Calculates high precision prayer times completely client-side (offline) from coordinates.
 */
export function calculateOfflinePrayerTimes(latitude, longitude, targetDate = new Date(), options = {}) {
  try {
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (isNaN(lat) || isNaN(lng)) return null;

    const coordinates = new Coordinates(lat, lng);
    const dateObj = targetDate instanceof Date ? targetDate : new Date(targetDate);
    const params = getAdhanCalculationParameters(options.calculationMethod, options.countryName);

    // Apply Asr Madhab preference
    if (options.asrMadhab === 'hanafi') {
      params.madhab = Madhab.Hanafi;
    } else {
      params.madhab = Madhab.Shafi;
    }

    // Apply High Latitude Rule if specified
    if (options.highLatitudeRule === 'seventhOfTheNight') {
      params.highLatitudeRule = HighLatitudeRule.SeventhOfTheNight;
    } else if (options.highLatitudeRule === 'twilightAngle') {
      params.highLatitudeRule = HighLatitudeRule.TwilightAngle;
    } else {
      params.highLatitudeRule = HighLatitudeRule.MiddleOfTheNight;
    }

    const prayerTimes = new PrayerTimes(coordinates, dateObj, params);
    const sunnahTimes = new SunnahTimes(prayerTimes);
    const qiblaAngle = Qibla(coordinates);
    const tz = options.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

    return {
      success: true,
      times: {
        Fajr: formatDateToHHMM(prayerTimes.fajr, tz),
        Sunrise: formatDateToHHMM(prayerTimes.sunrise, tz),
        Dhuhr: formatDateToHHMM(prayerTimes.dhuhr, tz),
        Asr: formatDateToHHMM(prayerTimes.asr, tz),
        Maghrib: formatDateToHHMM(prayerTimes.maghrib, tz),
        Isha: formatDateToHHMM(prayerTimes.isha, tz),
      },
      sunnah: {
        middleOfTheNight: formatDateToHHMM(sunnahTimes.middleOfTheNight, tz),
        lastThirdOfTheNight: formatDateToHHMM(sunnahTimes.lastThirdOfTheNight, tz),
      },
      rawDates: {
        fajr: prayerTimes.fajr,
        sunrise: prayerTimes.sunrise,
        dhuhr: prayerTimes.dhuhr,
        asr: prayerTimes.asr,
        maghrib: prayerTimes.maghrib,
        isha: prayerTimes.isha,
      },
      qiblaDirection: Math.round(qiblaAngle * 10) / 10,
      timezone: tz,
      source: 'حساب فلكي محلي (adhan-js Engine)',
    };
  } catch (err) {
    console.error('Error calculating offline prayer times:', err);
    return null;
  }
}

/**
 * Calculates prayer times for a city and country offline.
 */
export async function getPrayerTimesForLocation(city, country, targetDateStr = '', options = {}) {
  const targetDateFormatted = targetDateStr || (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  const cityTimezone = resolveTimezoneForLocation(city, country);

  // 1. Priority 1: If an Aladhan multi-day schedule is stored locally in cache, return it
  const cachedSchedule = getSourceScheduleCache();
  if (cachedSchedule?.schedule && cachedSchedule.schedule[targetDateFormatted]) {
    const tableTimes = cachedSchedule.schedule[targetDateFormatted];
    return {
      success: true,
      times: tableTimes,
      timezone: cityTimezone,
      source: cachedSchedule.source || 'جدول المواقيت المحفوظ محلياً (Aladhan API)',
      isImportedSchedule: true,
      domain: cachedSchedule.domain || 'Aladhan API',
      totalDaysCount: cachedSchedule.totalDays,
    };
  }

  // 2. High-precision client-side astronomical calculation via adhan-js (Offline)
  const coords = await resolveCoordinatesForCity(city, country);
  let targetDateObj = new Date();
  if (targetDateStr) {
    const p = targetDateStr.split('-');
    if (p.length === 3) targetDateObj = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }

  if (coords) {
    return calculateOfflinePrayerTimes(coords.lat, coords.lng, targetDateObj, {
      ...options,
      timezone: coords.tz,
      countryName: country,
    });
  }

  // Fallback to Makkah coordinates if city coordinates cannot be resolved
  const makkah = KNOWN_CITY_COORDINATES['makkah'];
  return calculateOfflinePrayerTimes(makkah.lat, makkah.lng, targetDateObj, {
    ...options,
    timezone: makkah.tz,
    countryName: country,
  });
}

/**
 * Comprehensive World Timezone-to-Location & Official Method Registry
 */
export const TIMEZONE_DEFAULTS = {
  // North Africa & Levant
  'Africa/Tunis': { country: 'Tunisia', city: 'Tunis', lat: 36.8065, lng: 10.1815, method: '3', tz: 'Africa/Tunis' },
  'Africa/Algiers': { country: 'Algeria', city: 'Algiers', lat: 36.7538, lng: 3.0588, method: '3', tz: 'Africa/Algiers' },
  'Africa/Casablanca': { country: 'Morocco', city: 'Casablanca', lat: 33.5731, lng: -7.5898, method: '3', tz: 'Africa/Casablanca' },
  'Africa/Tripoli': { country: 'Libya', city: 'Tripoli', lat: 32.8872, lng: 13.1913, method: '3', tz: 'Africa/Tripoli' },
  'Africa/Cairo': { country: 'Egypt', city: 'Cairo', lat: 30.0444, lng: 31.2357, method: '5', tz: 'Africa/Cairo' },
  'Africa/Khartoum': { country: 'Sudan', city: 'Khartoum', lat: 15.5007, lng: 32.5599, method: '5', tz: 'Africa/Khartoum' },

  // Gulf & Middle East
  'Asia/Riyadh': { country: 'Saudi Arabia', city: 'Riyadh', lat: 24.7136, lng: 46.6753, method: '4', tz: 'Asia/Riyadh' },
  'Asia/Dubai': { country: 'United Arab Emirates', city: 'Dubai', lat: 25.2048, lng: 55.2708, method: '16', tz: 'Asia/Dubai' },
  'Asia/Kuwait': { country: 'Kuwait', city: 'Kuwait', lat: 29.3759, lng: 47.9774, method: '9', tz: 'Asia/Kuwait' },
  'Asia/Qatar': { country: 'Qatar', city: 'Doha', lat: 25.2854, lng: 51.5310, method: '10', tz: 'Asia/Qatar' },
  'Asia/Bahrain': { country: 'Bahrain', city: 'Manama', lat: 26.2285, lng: 50.5860, method: '4', tz: 'Asia/Bahrain' },
  'Asia/Muscat': { country: 'Oman', city: 'Muscat', lat: 23.5880, lng: 58.3829, method: '4', tz: 'Asia/Muscat' },
  'Asia/Amman': { country: 'Jordan', city: 'Amman', lat: 31.9454, lng: 35.9284, method: '5', tz: 'Asia/Amman' },
  'Asia/Jerusalem': { country: 'Palestine', city: 'Jerusalem', lat: 31.7683, lng: 35.2137, method: '5', tz: 'Asia/Jerusalem' },
  'Asia/Gaza': { country: 'Palestine', city: 'Gaza', lat: 31.5017, lng: 34.4668, method: '5', tz: 'Asia/Gaza' },
  'Asia/Beirut': { country: 'Lebanon', city: 'Beirut', lat: 33.8938, lng: 35.5018, method: '5', tz: 'Asia/Beirut' },
  'Asia/Damascus': { country: 'Syria', city: 'Damascus', lat: 33.5138, lng: 36.2765, method: '5', tz: 'Asia/Damascus' },
  'Asia/Baghdad': { country: 'Iraq', city: 'Baghdad', lat: 33.3152, lng: 44.3661, method: '5', tz: 'Asia/Baghdad' },
  'Asia/Aden': { country: 'Yemen', city: 'Aden', lat: 12.7855, lng: 45.0187, method: '4', tz: 'Asia/Aden' },
  'Asia/Tehran': { country: 'Iran', city: 'Tehran', lat: 35.6892, lng: 51.3890, method: 'tehran', tz: 'Asia/Tehran' },

  // Turkey & Central Asia
  'Europe/Istanbul': { country: 'Turkey', city: 'Istanbul', lat: 41.0082, lng: 28.9784, method: '13', tz: 'Europe/Istanbul' },
  'Asia/Baku': { country: 'Azerbaijan', city: 'Baku', lat: 40.4093, lng: 49.8671, method: '3', tz: 'Asia/Baku' },
  'Asia/Tashkent': { country: 'Uzbekistan', city: 'Tashkent', lat: 41.2995, lng: 69.2401, method: '1', tz: 'Asia/Tashkent' },

  // South Asia
  'Asia/Karachi': { country: 'Pakistan', city: 'Karachi', lat: 24.8607, lng: 67.0011, method: '1', tz: 'Asia/Karachi' },
  'Asia/Kolkata': { country: 'India', city: 'New Delhi', lat: 28.6139, lng: 77.2090, method: '1', tz: 'Asia/Kolkata' },
  'Asia/Dhaka': { country: 'Bangladesh', city: 'Dhaka', lat: 23.8103, lng: 90.4125, method: '1', tz: 'Asia/Dhaka' },
  'Asia/Kabul': { country: 'Afghanistan', city: 'Kabul', lat: 34.5553, lng: 69.2075, method: '1', tz: 'Asia/Kabul' },

  // Southeast Asia & Far East
  'Asia/Jakarta': { country: 'Indonesia', city: 'Jakarta', lat: -6.2088, lng: 106.8456, method: '3', tz: 'Asia/Jakarta' },
  'Asia/Kuala_Lumpur': { country: 'Malaysia', city: 'Kuala Lumpur', lat: 3.1390, lng: 101.6869, method: '3', tz: 'Asia/Kuala_Lumpur' },
  'Asia/Singapore': { country: 'Singapore', city: 'Singapore', lat: 1.3521, lng: 103.8198, method: '11', tz: 'Asia/Singapore' },
  'Asia/Tokyo': { country: 'Japan', city: 'Tokyo', lat: 35.6762, lng: 139.6503, method: '3', tz: 'Asia/Tokyo' },

  // Europe & Americas & Australia
  'Europe/London': { country: 'United Kingdom', city: 'London', lat: 51.5074, lng: -0.1278, method: '3', tz: 'Europe/London' },
  'Europe/Paris': { country: 'France', city: 'Paris', lat: 48.8566, lng: 2.3522, method: '3', tz: 'Europe/Paris' },
  'Europe/Berlin': { country: 'Germany', city: 'Berlin', lat: 52.5200, lng: 13.4050, method: '3', tz: 'Europe/Berlin' },
  'Europe/Rome': { country: 'Italy', city: 'Rome', lat: 41.9028, lng: 12.4964, method: '3', tz: 'Europe/Rome' },
  'Europe/Madrid': { country: 'Spain', city: 'Madrid', lat: 40.4168, lng: -3.7038, method: '3', tz: 'Europe/Madrid' },
  'Europe/Moscow': { country: 'Russia', city: 'Moscow', lat: 55.7558, lng: 37.6173, method: '14', tz: 'Europe/Moscow' },
  'America/New_York': { country: 'United States', city: 'New York', lat: 40.7128, lng: -74.0060, method: '2', tz: 'America/New_York' },
  'America/Chicago': { country: 'United States', city: 'Chicago', lat: 41.8781, lng: -87.6298, method: '2', tz: 'America/Chicago' },
  'America/Denver': { country: 'United States', city: 'Denver', lat: 39.7392, lng: -104.9903, method: '2', tz: 'America/Denver' },
  'America/Los_Angeles': { country: 'United States', city: 'Los Angeles', lat: 34.0522, lng: -118.2437, method: '2', tz: 'America/Los_Angeles' },
  'America/Toronto': { country: 'Canada', city: 'Toronto', lat: 43.6532, lng: -79.3832, method: '2', tz: 'America/Toronto' },
  'Australia/Sydney': { country: 'Australia', city: 'Sydney', lat: -33.8688, lng: 151.2093, method: '3', tz: 'Australia/Sydney' },
};

/**
 * Resolves location defaults for a timezone identifier.
 */
export function getDefaultLocationForTimezone(tz) {
  const t = tz || (typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'Asia/Riyadh');
  return TIMEZONE_DEFAULTS[t] || TIMEZONE_DEFAULTS['Asia/Riyadh'];
}

/**
 * Calculates exact Qibla direction angle from coordinates.
 */
export function getQiblaBearing(latitude, longitude) {
  try {
    const coords = new Coordinates(Number(latitude), Number(longitude));
    return Math.round(Qibla(coords) * 10) / 10;
  } catch {
    return 0;
  }
}

/**
 * Automatically initializes location and prayer times for any user worldwide on first load.
 */
export function autoDetectAndInitializeWorldLocation() {
  try {
    const currentSettings = typeof getSettings === 'function' ? getSettings() : {};
    if (currentSettings?.city && currentSettings?.country) {
      return currentSettings;
    }

    const defaultLoc = getDefaultLocationForTimezone();
    const updatedSettings = {
      ...currentSettings,
      country: currentSettings?.country || defaultLoc.country,
      city: currentSettings?.city || defaultLoc.city,
    };

    saveSettings(updatedSettings);

    const today = new Date();
    const targetDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const res = calculateOfflinePrayerTimes(defaultLoc.lat, defaultLoc.lng, today, {
      calculationMethod: updatedSettings.calculationMethod,
      asrMadhab: updatedSettings.asrMadhab,
      timezone: defaultLoc.tz,
      countryName: updatedSettings.country,
    });

    if (res && res.success && res.times) {
      const hh = String(today.getHours()).padStart(2, '0');
      const mm = String(today.getMinutes()).padStart(2, '0');
      const timeNow = toWesternDigits(`${hh}:${mm}`);

      const mergedTimes = {
        ...res.times,
        timezone: defaultLoc.tz,
        lastSyncedDate: targetDateStr,
        lastSyncedTime: timeNow,
        calculationMethod: updatedSettings.calculationMethod || 'auto',
        asrMadhab: updatedSettings.asrMadhab || 'shafi',
        source: 'حساب فلكي دقيق (adhan-js)',
      };
      savePrayerTimesCache(mergedTimes);
    }
    return updatedSettings;
  } catch (err) {
    console.error('Error during auto location initialization:', err);
    return null;
  }
}
