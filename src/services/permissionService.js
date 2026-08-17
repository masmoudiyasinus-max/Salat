import { getSettings, saveSettings, savePrayerTimesCache } from './storage.js';
import { APP_EVENTS, PRAYER_NAMES } from './prayerConstants.js';
import { cleanTimeString, toWesternDigits } from './timeUtils.js';
import { logError } from './errorLogger.js';
import { calculateOfflinePrayerTimes } from './adhanCalculator.js';

// 1. Notification Permission Request
export async function requestNotificationsPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const currentSettings = getSettings();
      const isEn = currentSettings?.language === 'en';
      sendAdhanNotification(
        isEn ? 'Prayer Times Notifications Active' : 'تنبيهات مواقيت الصلاة نشطة',
        isEn ? 'You will receive alerts at each adhan time.' : 'سيتم إرسال تنبيهات عند حلول وقت كل أذان.'
      );
    }
    return permission;
  } catch (err) {
    console.warn('Notification permission error:', err);
    return Notification.permission;
  }
}

// 2. Send Native Browser Notification
export function sendAdhanNotification(title, body) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    const notif = new Notification(title, {
      body: body,
      icon: '/salam.svg',
      badge: '/salam.svg',
      tag: 'adhan-alert',
      renotify: true,
      silent: false,
    });
    notif.onclick = () => {
      window.focus();
      notif.close();
    };
  } catch (e) {
    console.warn('Failed to display notification:', e);
  }
}

function cleanMajorCityName(rawName) {
  if (!rawName || typeof rawName !== 'string') return '';
  return rawName
    .replace(/^(ولاية|محافظة|منطقة|بلدية|إقليم|دائرة|Gouvernorat de|Governorate of|Province of|Delegation of|Délégation de|City of|Municipality of)\s+/i, '')
    .replace(/\s+(Governorate|Province|Delegation|District|Municipality)$/i, '')
    .trim();
}

// 3. Live Reverse Geocoding from Fresh Coordinates (Zero Memory / Zero Cache)
export async function reverseGeocodeCoords(latitude, longitude) {
  // Provider 1: BigDataCloud Reverse Geocoding (Prioritizes principal administrative subdivision & major city)
  try {
    const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`;
    const response = await fetch(bdcUrl);
    if (response.ok) {
      const data = await response.json();
      const rawCity = data.city || cleanMajorCityName(data.principalSubdivision) || data.locality || '';
      const cleanCity = cleanMajorCityName(rawCity);
      const country = data.countryName || '';
      if (cleanCity && country) {
        return { city: cleanCity, country, success: true };
      }
    }
  } catch (e) {
    console.warn('BigDataCloud reverse geocode error:', e);
  }

  // Provider 2: OpenStreetMap Nominatim (Extracts major city/governorate, ignores sub-neighborhoods)
  try {
    const osmUrl = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=en`;
    const response = await fetch(osmUrl, { headers: { 'Accept': 'application/json' } });
    if (response.ok) {
      const data = await response.json();
      const addr = data.address || {};
      const rawCity = addr.city || addr.town || cleanMajorCityName(addr.state) || cleanMajorCityName(addr.county) || addr.municipality || '';
      const cleanCity = cleanMajorCityName(rawCity);
      const country = addr.country || '';
      if (cleanCity && country) {
        return { city: cleanCity, country, success: true };
      }
    }
  } catch (e) {
    console.warn('Nominatim reverse geocode error:', e);
  }

  return { city: '', country: '', success: false };
}

// 4. Fetch Accurate Prayer Times by Coordinates (Client-side adhan-js Engine)
export async function fetchPrayerTimesByCoordinates(latitude, longitude, targetDateStr = '', countryName = '') {
  try {
    const settings = typeof window !== 'undefined' ? getSettings() : {};
    let targetDateObj = new Date();
    if (targetDateStr) {
      const parts = targetDateStr.split('-');
      if (parts.length === 3) {
        targetDateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      }
    }

    const offlineResult = calculateOfflinePrayerTimes(latitude, longitude, targetDateObj, {
      calculationMethod: settings?.calculationMethod,
      asrMadhab: settings?.asrMadhab,
      highLatitudeRule: settings?.highLatitudeRule,
      countryName: countryName,
    });

    if (offlineResult && offlineResult.success && offlineResult.times) {
      return {
        success: true,
        times: offlineResult.times,
        timezone: offlineResult.timezone,
        qiblaDirection: offlineResult.qiblaDirection,
        source: offlineResult.source,
      };
    }
  } catch (e) {
    console.warn('Coordinates prayer times error:', e);
  }
  return { success: false };
}

// 5. Fresh Location Request from Scratch (Triggered ONLY by User Click)
export async function requestFreshLocationFromScratch(onSuccessCallback = null) {
  if (typeof window === 'undefined' || !navigator.geolocation) {
    return { success: false, error: 'unsupported' };
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;

        // Perform live reverse geocoding
        const geoNames = await reverseGeocodeCoords(latitude, longitude);
        const resolvedCity = (geoNames.success && geoNames.city) ? geoNames.city : `${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°`;
        const resolvedCountry = (geoNames.success && geoNames.country) ? geoNames.country : '';

        const currentSettings = getSettings();
        const isEn = currentSettings?.language === 'en';
        const updatedSettings = {
          ...currentSettings,
          city: resolvedCity,
          country: resolvedCountry || currentSettings.country,
        };
        saveSettings(updatedSettings);

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent(APP_EVENTS.SETTINGS_UPDATED, { detail: updatedSettings }));
        }

        // Calculate exact astronomical prayer times for the fresh coordinates immediately
        const today = new Date();
        const targetDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const hh = String(today.getHours()).padStart(2, '0');
        const mm = String(today.getMinutes()).padStart(2, '0');
        const timeNow = toWesternDigits(`${hh}:${mm}`);

        const timesResult = await fetchPrayerTimesByCoordinates(latitude, longitude, targetDateStr, resolvedCountry);

        if (timesResult && timesResult.success && timesResult.times) {
          const mergedTimes = {
            ...timesResult.times,
            timezone: timesResult.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
            lastSyncedDate: targetDateStr,
            lastSyncedTime: timeNow,
            source: isEn ? 'Live GPS Astronomical Calculation' : 'حساب فلكي دقيق عبر GPS',
          };

          savePrayerTimesCache(mergedTimes);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent(APP_EVENTS.PRAYER_TIMES_UPDATED, { detail: mergedTimes }));
          }
        }

        const resultObj = {
          success: true,
          city: resolvedCity,
          country: resolvedCountry,
          timezone: timesResult?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        };

        if (onSuccessCallback) {
          onSuccessCallback(resultObj);
        }

        resolve(resultObj);
      },
      (err) => {
        // Strict: If user denied or disabled geolocation, DO NOT fallback or force any location
        console.warn('Browser geolocation denied or disabled by user:', err.message);
        if (err.code !== 1) {
          logError(err, 'PermissionService.Geolocation');
        }
        resolve({ success: false, error: err.code === 1 ? 'denied' : 'error', message: err.message });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0, // Force fresh hardware/browser lookup, no cache
      }
    );
  });
}

// 6. Background Adhan Real-Time Alerts
export function checkAndNotifyCurrentAdhan(prayerTimes, language = 'ar') {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  if (!prayerTimes) return;

  const now = new Date();
  const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const isEn = language === 'en';

  const todayDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  PRAYER_NAMES.forEach((pObj) => {
    const id = pObj.id;
    const adhanTime = prayerTimes[id];
    if (adhanTime && adhanTime === currentHHMM) {
      const notifiedKey = `adhan_notified_${todayDateStr}_${id}_${currentHHMM}`;
      if (!sessionStorage.getItem(notifiedKey)) {
        sessionStorage.setItem(notifiedKey, 'true');
        const pName = isEn ? pObj.nameEn : pObj.nameAr;
        const title = isEn ? `Time for ${pName} Prayer` : `حان الآن موعد أذان صلاة ${pName}`;
        const body = isEn ? `Adhan for ${pName} prayer has arrived at ${adhanTime}.` : `دخول وقت صلاة ${pName}، تقبل الله منا ومنكم صالح الأعمال.`;
        sendAdhanNotification(title, body);
      }
    }
  });
}
