import { getSettings, saveSettings, savePrayerTimesCache } from './storage.js';
import { APP_EVENTS, PRAYER_NAMES } from './prayerConstants.js';
import { toWesternDigits } from './timeUtils.js';
import { logError } from './errorLogger.js';
import { calculateOfflinePrayerTimes } from './adhanCalculator.js';
import { fetchAladhanPrayerTimesByCoordinates as fetchAladhanCoords } from './aladhanApiService.js';
import {
  getLocalizedCountryName,
  cleanAdministrativePrefixesAndDirections,
  getCuratedCitiesForCountry,
} from './countryLocalization.js';

// 1. Notification Permission Status & Request
export function getNotificationPermission() {
  if (typeof window === 'undefined') {
    return 'unsupported';
  }
  const NotifClass = typeof Notification !== 'undefined' ? Notification : window.Notification;
  if (!NotifClass) {
    return 'unsupported';
  }
  return NotifClass.permission || 'default';
}

export async function requestNotificationsPermission() {
  if (typeof window === 'undefined') {
    return 'unsupported';
  }
  const NotifClass = typeof Notification !== 'undefined' ? Notification : window.Notification;
  if (!NotifClass) {
    return 'unsupported';
  }

  if (NotifClass.permission === 'granted') {
    return 'granted';
  }

  try {
    let permission;
    if (typeof NotifClass.requestPermission === 'function') {
      const res = NotifClass.requestPermission();
      if (res && typeof res.then === 'function') {
        permission = await res;
      } else {
        permission = await new Promise((resolve) => {
          NotifClass.requestPermission(resolve);
        });
      }
    } else {
      permission = NotifClass.permission;
    }

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
    return NotifClass ? NotifClass.permission : 'unsupported';
  }
}

// Helper to determine if user is outside the website (different tab, minimized, or window unfocused)
export function isUserOutsideApp() {
  if (typeof document === 'undefined') return true;
  const isHidden = document.visibilityState === 'hidden';
  const hasFocus = typeof document.hasFocus === 'function' ? document.hasFocus() : true;
  return isHidden || !hasFocus;
}

// 2. Send Prominent External Web Notification (via direct Notification constructor with ServiceWorker backup)
// Only dispatched externally when the user is outside the site (unless explicitly forced via forceExternal)
export function sendBrowserNotification(title, body, options = {}) {
  if (typeof window === 'undefined') {
    return { success: false, reason: 'unsupported' };
  }
  const NotifClass = typeof Notification !== 'undefined' ? Notification : window.Notification;
  if (!NotifClass) {
    return { success: false, reason: 'unsupported' };
  }

  if (NotifClass.permission !== 'granted') {
    return { success: false, reason: NotifClass.permission };
  }

  // STRICT USER RULE: External desktop notifications only dispatch when user is outside the site
  if (!options.forceExternal && !isUserOutsideApp()) {
    return { success: false, reason: 'user_active_inside_app' };
  }

  const origin = typeof window !== 'undefined' && window.location && window.location.origin
    ? window.location.origin
    : '';

  const toAbsoluteUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) {
      return url;
    }
    const cleanPath = url.startsWith('/') ? url : `/${url}`;
    return origin ? `${origin}${cleanPath}` : cleanPath;
  };

  const defaultIcon = toAbsoluteUrl('/pwa-192x192.png');
  const defaultBadge = toAbsoluteUrl('/pwa-192x192.png');

  const notifOptions = {
    body: body || '',
    icon: options.icon ? toAbsoluteUrl(options.icon) : defaultIcon,
    badge: options.badge ? toAbsoluteUrl(options.badge) : defaultBadge,
    tag: options.tag || `habit-tracker-${Date.now()}`,
    renotify: options.renotify ?? true,
    requireInteraction: options.requireInteraction ?? true, // Prominent notification on OS desktop
    silent: options.silent ?? false,
    dir: options.dir || (typeof document !== 'undefined' && document.documentElement.dir === 'rtl' ? 'rtl' : 'auto'),
    lang: options.lang || (typeof document !== 'undefined' && document.documentElement.lang ? document.documentElement.lang : 'ar'),
    ...options,
  };

  // Ensure absolute urls even if overridden in options
  if (notifOptions.icon) notifOptions.icon = toAbsoluteUrl(notifOptions.icon);
  if (notifOptions.badge) notifOptions.badge = toAbsoluteUrl(notifOptions.badge);

  // 1. Direct window Notification constructor (Standard & immediate on Windows/Mac desktop)
  try {
    const notif = new NotifClass(title, notifOptions);
    notif.onclick = (event) => {
      try {
        if (typeof window !== 'undefined') {
          window.focus();
        }
      } catch {}
      try {
        if (event && event.target && typeof event.target.close === 'function') {
          event.target.close();
        } else if (typeof notif.close === 'function') {
          notif.close();
        }
      } catch {}
    };

    return { success: true, method: 'window' };
  } catch (winErr) {
    console.warn('[Notifications] Rich constructor failed, trying minimal constructor:', winErr);
    try {
      const notifSimple = new NotifClass(title, { body: body || '' });
      notifSimple.onclick = (event) => {
        try {
          if (typeof window !== 'undefined') {
            window.focus();
          }
        } catch {}
        try {
          if (event && event.target && typeof event.target.close === 'function') {
            event.target.close();
          } else if (typeof notifSimple.close === 'function') {
            notifSimple.close();
          }
        } catch {}
      };
      return { success: true, method: 'window_simple' };
    } catch (simpleErr) {
      console.warn('[Notifications] Simple constructor failed:', simpleErr);
    }
  }

  // 2. Fallback for environments where window constructor throws (e.g. ServiceWorker-only contexts)
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const dispatchViaReg = (reg) => {
        if (reg && typeof reg.showNotification === 'function') {
          return reg.showNotification(title, notifOptions).catch(() => {
            return reg.showNotification(title, { body: body || '' }).catch(() => {});
          });
        }
      };

      if (typeof navigator.serviceWorker.getRegistration === 'function') {
        navigator.serviceWorker.getRegistration().then((reg) => {
          if (reg) {
            dispatchViaReg(reg);
          } else if (navigator.serviceWorker.ready) {
            Promise.race([
              navigator.serviceWorker.ready,
              new Promise((_, reject) => setTimeout(() => reject(new Error('SW ready timeout')), 1000)),
            ]).then((readyReg) => {
              dispatchViaReg(readyReg);
            }).catch(() => {});
          }
        }).catch((swErr) => {
          console.warn('[Notifications] ServiceWorker fallback dispatch error:', swErr);
        });
      } else if (navigator.serviceWorker.ready) {
        Promise.resolve(navigator.serviceWorker.ready).then((reg) => {
          dispatchViaReg(reg);
        }).catch(() => {});
      }

      return { success: true, method: 'serviceWorker' };
    } catch (e) {
      console.warn('[Notifications] ServiceWorker fallback dispatch failed:', e);
    }
  }

  return { success: false, reason: 'dispatch_failed' };
}

// Backward-compatible wrapper for Adhan alerts
export function sendAdhanNotification(title, body, options = {}) {
  return sendBrowserNotification(title, body, { tag: 'adhan-reminder', ...options });
}

// 3. Reverse Geocode Coordinates via OpenStreetMap Nominatim
export async function reverseGeocodeCoords(latitude, longitude) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1&accept-language=en`;
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};
      const rawCountry = addr.country || '';
      const stdCountry = getLocalizedCountryName(rawCountry, 'en') || rawCountry;

      const candidates = [
        addr.city,
        addr.town,
        addr.municipality,
        addr.county,
        addr.state,
      ].filter(Boolean);

      const curatedCities = getCuratedCitiesForCountry(stdCountry);
      let resolvedCity = '';

      // 1. Try to match candidate against curated major cities/governorates in that country
      for (const cand of candidates) {
        const parsed = cleanAdministrativePrefixesAndDirections(cand);
        const candBase = (parsed.base || '').toLowerCase();
        if (!candBase) continue;

        const match = curatedCities.find((c) => {
          const cLower = c.toLowerCase();
          return cLower === candBase || cLower.includes(candBase) || candBase.includes(cLower);
        });

        if (match) {
          resolvedCity = match;
          break;
        }
      }

      // 2. Fallback to clean base of primary candidate
      if (!resolvedCity) {
        const primary = addr.city || addr.town || addr.municipality || addr.county || addr.state || '';
        const parsed = cleanAdministrativePrefixesAndDirections(primary);
        resolvedCity = parsed.base
          ? (parsed.base.charAt(0).toUpperCase() + parsed.base.slice(1))
          : primary;
      }

      return { success: true, city: resolvedCity, country: stdCountry };
    }
  } catch (err) {
    console.warn('Reverse geocoding error:', err);
  }
  return { success: false };
}

// 4. Fetch Accurate Prayer Times by Coordinates (Aladhan API with local fallback)
export async function fetchPrayerTimesByCoordinates(latitude, longitude, targetDateStr = '', countryName = '') {
  try {
    const aladhanRes = await fetchAladhanCoords(latitude, longitude, targetDateStr);
    if (aladhanRes && aladhanRes.success && aladhanRes.times) {
      return aladhanRes;
    }

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
  if (typeof window === 'undefined') return;
  if (getNotificationPermission() !== 'granted') return;
  if (!prayerTimes) return;

  const now = new Date();
  const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const isEn = language === 'en';

  const todayDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  PRAYER_NAMES.forEach((pObj) => {
    const id = pObj.id;
    const rawTime = prayerTimes[id];
    if (!rawTime) return;
    const adhanTime = toWesternDigits(String(rawTime).trim()).slice(0, 5);
    if (adhanTime === currentHHMM) {
      const notifiedKey = `adhan_notified_${todayDateStr}_${id}_${currentHHMM}`;
      try {
        if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(notifiedKey)) {
          return;
        }
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem(notifiedKey, 'true');
        }
      } catch {}

      const pName = isEn ? pObj.nameEn : pObj.nameAr;
      const title = isEn ? `Time for ${pName} Prayer` : `حان الآن موعد أذان صلاة ${pName}`;
      const body = isEn ? `Adhan for ${pName} prayer has arrived at ${adhanTime}.` : `دخول وقت صلاة ${pName}، تقبل الله منا ومنكم صالح الأعمال.`;
      sendAdhanNotification(title, body);
    }
  });
}
