import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import {
  Key,
  Globe,
  CheckCircle,
  Eye,
  EyeOff,
  MapPin,
  RefreshCw,
  Search,
  ChevronDown,
  Check,
  Building2,
  Image as ImageIcon,
  XCircle,
  Upload,
  Trash2,
  Video,
  AlertCircle,
  Clock,
  Keyboard,
  Info,
  Navigation,
  Bell,
  Download,
  UploadCloud,
  FileJson,
  Compass,
  BookOpen,
  Table,
} from 'lucide-react';
import {
  getSettings,
  saveSettings,
  clearAllRecords,
  getPrayerTimesCache,
  savePrayerTimesCache,
  toWesternDigits,
  exportFullUserDataJSON,
  importFullUserDataJSON,
  clearEntireAppData,
  compressImageFile,
  getSourceScheduleCache,
  clearSourceScheduleCache,
  APP_EVENTS,
} from '../services/storage';
import { CALCULATION_METHODS, getPrayerTimesForLocation } from '../services/adhanCalculator';
import { syncFullMonthFromAladhanApi } from '../services/aladhanApiService';
import { requestNotificationsPermission, requestFreshLocationFromScratch } from '../services/permissionService';
import { getLocalizedCountryName, getLocalizedCityName, PALESTINIAN_CITIES, matchesStrictPrefix } from '../services/countryLocalization';
import ScheduleTableModal from './ScheduleTableModal';

export default function SettingsView({ onSettingsSaved }) {
  const [settings, setSettingsState] = useState(getSettings);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showTavilyKey, setShowTavilyKey] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isSyncingTimes, setIsSyncingTimes] = useState(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [notifPermission, setNotifPermission] = useState(() => (typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'));
  const [syncStatus, setSyncStatus] = useState('');
  const [cachedTimes, setCachedTimes] = useState(() => getPrayerTimesCache());
  const [scheduleCache, setScheduleCache] = useState(getSourceScheduleCache);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  const lang = settings.language || 'ar';
  const isEn = lang === 'en';

  // Dynamic Countries and Cities API State
  const [countriesList, setCountriesList] = useState([]);
  const [isLoadingCountries, setIsLoadingCountries] = useState(true);

  useEffect(() => {
    const handleSettingsUpdated = (e) => {
      if (e.detail) {
        setSettingsState(e.detail);
      }
    };
    window.addEventListener(APP_EVENTS.SETTINGS_UPDATED, handleSettingsUpdated);
    return () => window.removeEventListener(APP_EVENTS.SETTINGS_UPDATED, handleSettingsUpdated);
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function fetchCountriesAndCities() {
      try {
        const response = await fetch('https://countriesnow.space/api/v0.1/countries');
        if (response.ok) {
          const result = await response.json();
          if (result && !result.error && Array.isArray(result.data) && isMounted) {
            setCountriesList(result.data);
          }
        }
      } catch (err) {
        console.warn('Countries API error:', err);
      } finally {
        if (isMounted) setIsLoadingCountries(false);
      }
    }

    fetchCountriesAndCities();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const handleGlobalSettingsUpdate = (e) => {
      if (e.detail) {
        setSettingsState(e.detail);
      }
    };
    window.addEventListener(APP_EVENTS.SETTINGS_UPDATED, handleGlobalSettingsUpdate);
    return () => window.removeEventListener(APP_EVENTS.SETTINGS_UPDATED, handleGlobalSettingsUpdate);
  }, []);

  // Instant Auto-Save Handlers
  const handleInputChange = (field, value) => {
    const fresh = getSettings();
    const updated = { ...fresh, ...settings, [field]: value };
    setSettingsState(updated);
    saveSettings(updated);
    if (onSettingsSaved) onSettingsSaved(updated);
    setSaveSuccessMsg(isEn ? 'Saved automatically' : 'تم الحفظ الفوري تلقائياً');
    setTimeout(() => setSaveSuccessMsg(''), 2500);
  };

  const handlePrayerOffsetChange = (prayerId, deltaValue) => {
    const validNum = Math.max(-60, Math.min(60, Number(deltaValue) || 0));
    const currentOffsets = settings.prayerOffsets || { Fajr: 0, Sunrise: 0, Dhuhr: 0, Asr: 0, Maghrib: 0, Isha: 0 };
    const updatedOffsets = { ...currentOffsets, [prayerId]: validNum };
    handleInputChange('prayerOffsets', updatedOffsets);
  };

  const autoSyncLocationPrayerTimes = async (targetCity, targetCountry, targetMethod) => {
    const fresh = getSettings();
    const city = (targetCity || fresh.city || settings.city || '').trim();
    const country = (targetCountry || fresh.country || settings.country || '').trim();
    const method = targetMethod || fresh.calculationMethod || settings.calculationMethod || 'auto';
    if (!city && !country) return;

    const locCity = getLocalizedCityName(city, isEn ? 'en' : 'ar') || city;
    const locCountry = getLocalizedCountryName(country, isEn ? 'en' : 'ar') || country;
    const fullLoc = locCity ? (locCountry ? `${locCity} (${locCountry})` : locCity) : locCountry;

    setIsSyncingTimes(true);
    setSyncStatus(isEn ? `Syncing accurate schedule for ${fullLoc}...` : `جاري مزامنة الجدول بدقة لـ ${fullLoc}...`);
    setSaveSuccessMsg(isEn ? `Syncing prayer times for ${fullLoc}...` : `جاري مزامنة وتحديث مواقيت الصلاة لـ ${fullLoc}...`);

    try {
      // 1. Try instant sync from Aladhan API (stores full 60-day schedule offline)
      const apiRes = await syncFullMonthFromAladhanApi(city, country, method);
      if (apiRes && apiRes.success && apiRes.totalDays > 0) {
        setScheduleCache(getSourceScheduleCache());
        const freshTimes = getPrayerTimesCache();
        setCachedTimes(freshTimes);
        setSyncStatus(isEn ? `Synced automatically for ${fullLoc}` : `تمت المزامنة التلقائية لـ ${fullLoc}`);
        setSaveSuccessMsg(isEn ? `✓ Prayer times synced successfully for ${fullLoc}` : `✓ تمت مزامنة وتحديث مواقيت الصلاة لـ ${fullLoc} بنجاح`);
        setTimeout(() => setSaveSuccessMsg(''), 4500);
        setIsSyncingTimes(false);
        return;
      }
    } catch (e) {
      console.warn('Background Aladhan API sync fallback to astronomical calculation:', e);
    }

    // 2. Fallback to client-side astronomical calculation via adhan-js
    try {
      const today = new Date();
      const targetDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const res = await getPrayerTimesForLocation(city, country, targetDateStr, { calculationMethod: method });

      if (res && res.success && res.times) {
        const hh = String(today.getHours()).padStart(2, '0');
        const mm = String(today.getMinutes()).padStart(2, '0');
        const timeNow = toWesternDigits(`${hh}:${mm}`);

        const mergedTimes = {
          ...res.times,
          timezone: res.timezone || resolveTimezoneForLocation(city, country),
          lastSyncedDate: targetDateStr,
          lastSyncedTime: timeNow,
          source: res.source || (isEn ? 'Astronomical Calculation (adhan-js)' : 'حساب فلكي محلي (adhan-js)'),
        };

        savePrayerTimesCache(mergedTimes);
        setCachedTimes(mergedTimes);
        setSyncStatus(isEn ? `Calculated accurately at ${timeNow}` : `تم الحساب بدقة في ${timeNow}`);
        setSaveSuccessMsg(isEn ? `✓ Prayer times updated accurately for ${fullLoc}` : `✓ تمت مزامنة وحساب مواقيت الصلاة لـ ${fullLoc} بدقة`);
        setTimeout(() => setSaveSuccessMsg(''), 4500);
      }
    } catch (err) {
      console.error('Error during automatic prayer calculation:', err);
    } finally {
      setIsSyncingTimes(false);
    }
  };

  const handleCountrySelect = (selectedCountry) => {
    const countryObj = Array.isArray(countriesList)
      ? countriesList.find((c) => c.country.toLowerCase() === selectedCountry.toLowerCase())
      : null;
    const firstCity = countryObj && countryObj.cities.length > 0 ? countryObj.cities[0] : '';
    const locCountry = getLocalizedCountryName(selectedCountry, isEn ? 'en' : 'ar') || selectedCountry;
    const locCity = getLocalizedCityName(firstCity, isEn ? 'en' : 'ar') || firstCity;
    const fullLoc = locCity ? `${locCity} (${locCountry})` : locCountry;

    setSettingsState((prev) => {
      const updated = {
        ...prev,
        country: selectedCountry,
        city: firstCity,
      };
      saveSettings(updated);
      if (onSettingsSaved) onSettingsSaved(updated);
      return updated;
    });
    setSaveSuccessMsg(isEn ? `Syncing prayer times for ${fullLoc}...` : `جاري مزامنة وتحديث مواقيت الصلاة لـ ${fullLoc}...`);
    setTimeout(() => autoSyncLocationPrayerTimes(firstCity, selectedCountry, settings.calculationMethod), 60);
  };

  const handleEnableNotifications = async () => {
    const res = await requestNotificationsPermission();
    setNotifPermission(res);
    if (res === 'granted') {
      setSaveSuccessMsg(isEn ? 'Notifications enabled successfully' : 'تم تفعيل تنبيهات الصلاة بنجاح');
      setTimeout(() => setSaveSuccessMsg(''), 3000);
    }
  };

  const handleAutoDetectLocation = async () => {
    setIsDetectingLocation(true);
    const res = await requestFreshLocationFromScratch((detected) => {
      const freshSettings = getSettings();
      setSettingsState(freshSettings);
      if (onSettingsSaved) onSettingsSaved(freshSettings);
      setCachedTimes(getPrayerTimesCache());
      const locText = detected.city ? `${detected.city}, ${detected.country}` : detected.country;
      setSaveSuccessMsg(isEn ? `Live location detected: ${locText}` : `تم تحديد الموقع المباشر: ${locText}`);
      setTimeout(() => setSaveSuccessMsg(''), 4000);
      if (detected.city || detected.country) {
        autoSyncLocationPrayerTimes(detected.city, detected.country, freshSettings.calculationMethod);
      }
    });
    setIsDetectingLocation(false);
    if (!res.success) {
      if (res.error === 'denied') {
        alert(isEn ? 'Location access was denied or disabled in your browser settings. You can enable it in the browser bar or select your city manually below.' : 'تم رفض أو تعطيل إذن الوصول للموقع في المتصفح. يمكنك تفعيله من إعدادات المتصفح أو اختيار المدينة يدوياً من القائمة.');
      } else {
        alert(isEn ? 'Could not detect live location. Please select your city manually.' : 'تعذر استقبال إشارة الموقع المباشرة، يرجى اختيار المدينة والدولة يدوياً.');
      }
    }
  };





  const handleClearScheduleCache = () => {
    clearSourceScheduleCache();
    setScheduleCache(null);
    setSaveSuccessMsg(isEn ? 'Source schedule cache cleared.' : 'تم مسح الجدول المخزن محلياً.');
    setTimeout(() => setSaveSuccessMsg(''), 3000);
  };

  const processFiles = async (files) => {
    if (!files || files.length === 0) return;
    const validFiles = Array.from(files).filter((file) => file.type && file.type.startsWith('image/'));
    if (validFiles.length === 0) return;

    let updatedList = Array.isArray(settings.customBgImages) ? [...settings.customBgImages] : [];
    let lastLoadedUrl = '';

    for (const file of validFiles) {
      // Compress wallpaper to standard resolution & quality (reduces size by ~95%)
      const compressedDataUrl = await compressImageFile(file, 1920, 1080, 0.75);
      if (compressedDataUrl && !updatedList.includes(compressedDataUrl)) {
        updatedList.push(compressedDataUrl);
        lastLoadedUrl = compressedDataUrl;
      }
    }

    // Limit custom wallpapers to a safe maximum of 5 images
    if (updatedList.length > 5) {
      updatedList = updatedList.slice(-5);
    }

    handleInputChange('customBgImages', updatedList);
    if (lastLoadedUrl) {
      handleInputChange('activeCustomBgImage', lastLoadedUrl);
      handleInputChange('bgMode', 'custom_image');
    }
  };

  const handleFileUpload = (e) => {
    processFiles(e.target.files);
    e.target.value = '';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    if (e.dataTransfer && e.dataTransfer.files) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleRemoveCustomImage = (imgUrl) => {
    const currentList = Array.isArray(settings.customBgImages) ? settings.customBgImages : [];
    const updatedList = currentList.filter((item) => item !== imgUrl);
    handleInputChange('customBgImages', updatedList);
    if (settings.activeCustomBgImage === imgUrl) {
      handleInputChange('activeCustomBgImage', updatedList.length > 0 ? updatedList[0] : '');
    }
  };

  const handleSelectActiveBg = (imgUrl) => {
    handleInputChange('activeCustomBgImage', imgUrl);
    handleInputChange('bgMode', 'custom_image');
  };

  // Selected Country Object & Cities (Localized according to active language)
  const countryOptions = Array.isArray(countriesList)
    ? countriesList.map((c) => {
        const rawName = c.country;
        return {
          value: rawName,
          label: getLocalizedCountryName(rawName, isEn ? 'en' : 'ar'),
        };
      }).sort((a, b) => a.label.localeCompare(b.label, isEn ? 'en' : 'ar'))
    : [];
  const selectedCountryObj = (Array.isArray(countriesList) && settings.country)
    ? countriesList.find((c) => c.country.toLowerCase() === settings.country.toLowerCase())
    : null;
  const isPalestineSelected = settings.country && (
    settings.country.toLowerCase() === 'israel' ||
    settings.country.toLowerCase() === 'palestine' ||
    settings.country.toLowerCase() === 'state of palestine' ||
    settings.country === 'فلسطين'
  );

  const rawCities = isPalestineSelected
    ? Array.from(new Set([...PALESTINIAN_CITIES, ...(selectedCountryObj?.cities || [])]))
    : (selectedCountryObj?.cities || []);

  const cityOptions = Array.isArray(rawCities)
    ? rawCities.map((cityName) => ({
        value: cityName,
        label: getLocalizedCityName(cityName, isEn ? 'en' : 'ar'),
      })).sort((a, b) => a.label.localeCompare(b.label, isEn ? 'en' : 'ar'))
    : [];
  const calculationMethodOptions = CALCULATION_METHODS.map((m) => ({
    id: m.id,
    label: isEn ? m.nameEn : m.nameAr,
  }));
  const madhabOptions = [
    { id: 'shafi', label: isEn ? 'Standard (Shafi, Maliki, Hanbali - 1x shadow)' : 'جمهور الفقهاء (الشافعي، المالكي، الحنبلي - الظل الواحد)' },
    { id: 'hanafi', label: isEn ? 'Hanafi School (2x shadow length)' : 'المذهب الحنفي (مِثلي ظل الشيء)' },
  ];

  return (
    <div className="settings-view">
      {/* Floating Notification Toast for Location & Prayer Times Sync */}
      {saveSuccessMsg && (
        <div
          style={{
            position: 'fixed',
            top: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 99999,
            backgroundColor: isSyncingTimes ? 'rgba(15, 23, 42, 0.95)' : '#ffffff',
            color: isSyncingTimes ? '#f8fafc' : '#000000',
            border: '1px solid rgba(255, 255, 255, 0.4)',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.6), 0 0 20px rgba(255, 255, 255, 0.25)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            padding: '10px 24px',
            borderRadius: 'var(--radius-pill)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.9rem',
            fontWeight: '700',
            animation: 'slideDown 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            pointerEvents: 'none',
          }}
        >
          {isSyncingTimes ? (
            <RefreshCw size={17} style={{ animation: 'spin 1s linear infinite', color: '#60a5fa' }} />
          ) : (
            <CheckCircle size={18} style={{ color: '#000000' }} />
          )}
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', marginBottom: '16px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'var(--status-on-time-bg)',
            color: 'var(--status-on-time)',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            padding: '8px 16px',
            borderRadius: 'var(--radius-pill)',
            fontSize: '0.85rem',
            fontWeight: '700',
          }}
        >
          <CheckCircle size={16} />
          <span>{saveSuccessMsg || (isEn ? 'Auto-save active' : 'حفظ تلقائي فوري مفعّل')}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        {/* Unified Background Mode Selector Card */}
        <div className="bento-card" style={{ gridColumn: '1 / -1' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: '700', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Video size={20} style={{ color: 'var(--status-on-time)' }} />
            <span>{isEn ? 'Live Scene Background' : 'تخصيص نمط ونوع خلفية الموقع الحية'}</span>
          </h3>

          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '18px' }}>
            {isEn ? 'Choose live stream or upload custom wallpapers behind frosted cards:' : 'اختر نوع ونمط الخلفية التي ترغب بعرضها خلف البطاقات الزجاجية:'}
          </p>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
            <button
              type="button"
              onClick={() => handleInputChange('bgMode', 'makkah')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: 'var(--radius-pill)',
                backgroundColor: (settings.bgMode || 'makkah') === 'makkah' ? 'rgba(255, 255, 255, 0.15)' : 'var(--bg-primary)',
                border: (settings.bgMode || 'makkah') === 'makkah' ? '1px solid var(--status-on-time)' : '1px solid var(--border-subtle)',
                color: (settings.bgMode || 'makkah') === 'makkah' ? 'var(--status-on-time)' : 'var(--text-secondary)',
                fontWeight: '700',
                fontSize: '0.82rem',
                cursor: 'pointer',
                transition: 'all 0.18s ease',
              }}
            >
              <Video size={15} />
              <span>{isEn ? 'Makkah Live Stream' : 'بث مباشر للحرم المكي'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleInputChange('bgMode', 'madinah')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: 'var(--radius-pill)',
                backgroundColor: settings.bgMode === 'madinah' ? 'rgba(255, 255, 255, 0.15)' : 'var(--bg-primary)',
                border: settings.bgMode === 'madinah' ? '1px solid var(--status-on-time)' : '1px solid var(--border-subtle)',
                color: settings.bgMode === 'madinah' ? 'var(--status-on-time)' : 'var(--text-secondary)',
                fontWeight: '700',
                fontSize: '0.82rem',
                cursor: 'pointer',
                transition: 'all 0.18s ease',
              }}
            >
              <Video size={15} />
              <span>{isEn ? 'Madinah Live Stream' : 'بث مباشر للمدينة النبوية'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                handleInputChange('bgMode', 'custom_image');
                if (Array.isArray(settings.customBgImages) && settings.customBgImages.length > 0 && !settings.activeCustomBgImage) {
                  handleInputChange('activeCustomBgImage', settings.customBgImages[0]);
                }
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: 'var(--radius-pill)',
                backgroundColor: settings.bgMode === 'custom_image' ? 'rgba(255, 255, 255, 0.15)' : 'var(--bg-primary)',
                border: settings.bgMode === 'custom_image' ? '1px solid var(--status-on-time)' : '1px solid var(--border-subtle)',
                color: settings.bgMode === 'custom_image' ? 'var(--status-on-time)' : 'var(--text-secondary)',
                fontWeight: '700',
                fontSize: '0.82rem',
                cursor: 'pointer',
                transition: 'all 0.18s ease',
              }}
            >
              <ImageIcon size={15} />
              <span>{isEn ? 'Custom Images from Device' : 'صورة مخصصة من حاسوبك'}</span>
            </button>
          </div>

          {(settings.bgMode || 'makkah') === 'makkah' && (
            <div style={{ backgroundColor: 'var(--bg-primary)', padding: '14px 18px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255, 255, 255, 0.25)', fontSize: '0.85rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CheckCircle size={18} style={{ color: 'var(--status-on-time)', flexShrink: 0 }} />
              <span>{isEn ? 'Holy Makkah Live Stream is now active as primary background.' : 'البث المباشر المكرّم للحرم المكي الشريف يعمل الآن كفيديو أساسي افتراضي في خلفية الموقع.'}</span>
            </div>
          )}

          {settings.bgMode === 'madinah' && (
            <div style={{ backgroundColor: 'var(--bg-primary)', padding: '14px 18px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255, 255, 255, 0.25)', fontSize: '0.85rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CheckCircle size={18} style={{ color: 'var(--status-on-time)', flexShrink: 0 }} />
              <span>{isEn ? 'Holy Madinah Live Stream is now active as primary background.' : 'البث المباشر المكرّم للمدينة النبوية والمسجد النبوي الشريف يعمل الآن كفيديو حي في خلفية الموقع.'}</span>
            </div>
          )}

          {settings.bgMode === 'custom_image' && (
            <div>
              {(!settings.customBgImages || settings.customBgImages.length === 0 || !settings.activeCustomBgImage) && (
                <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.12)', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(245, 158, 11, 0.3)', color: 'var(--status-late)', fontSize: '0.85rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />
                  <span>{isEn ? 'Please upload or select an image to activate custom background.' : 'تنبيه: لم تدرج أو تحدد صورة بعد. تظل الخلفية السابقة كما هي حتى تقوم برفع أو اختيار صورة.'}</span>
                </div>
              )}
              <div style={{ marginBottom: '20px' }}>
                <label
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '32px 20px',
                    borderRadius: 'var(--radius-lg)',
                    border: isDraggingOver
                      ? '2px dashed var(--status-on-time)'
                      : '2px dashed rgba(255, 255, 255, 0.25)',
                    backgroundColor: isDraggingOver
                      ? 'rgba(255, 255, 255, 0.15)'
                      : 'rgba(0, 0, 0, 0.35)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.2s ease',
                    boxShadow: isDraggingOver ? '0 4px 12px rgba(0, 0, 0, 0.25)' : 'none',
                  }}
                >
                  <Upload
                    size={34}
                    style={{
                      color: isDraggingOver ? 'var(--status-on-time)' : 'var(--text-secondary)',
                      marginBottom: '10px',
                      transition: 'color 0.2s ease, transform 0.2s ease',
                      transform: isDraggingOver ? 'scale(1.18)' : 'scale(1)',
                    }}
                  />
                  <span style={{ fontSize: '0.98rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>
                    {isDraggingOver ? (isEn ? 'Drop images here' : 'أسقط ملفات الصور هنا فورياً') : (isEn ? 'Drag & drop image files here' : 'قم بسحب وإسقاط ملفات الصور هنا')}
                  </span>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    {isEn ? 'Or click here to browse images from your device' : 'أو انقر هنا لاستعراض واختيار الصور من جهازك'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>

              {Array.isArray(settings.customBgImages) && settings.customBgImages.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '12px' }}>
                    {isEn ? 'Uploaded Wallpapers:' : 'الصور المضافة:'}
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                      gap: '12px',
                    }}
                  >
                    {settings.customBgImages.map((imgUrl, index) => {
                      const isActive = settings.activeCustomBgImage === imgUrl;
                      return (
                        <div
                          key={index}
                          onClick={() => handleSelectActiveBg(imgUrl)}
                          style={{
                            position: 'relative',
                            borderRadius: 'var(--radius-md)',
                            overflow: 'hidden',
                            height: '90px',
                            border: isActive ? '2px solid var(--status-on-time)' : '1px solid var(--border-subtle)',
                            cursor: 'pointer',
                            boxShadow: isActive ? '0 4px 12px rgba(0, 0, 0, 0.25)' : 'none',
                            transition: 'all 0.2s ease',
                          }}
                        >
                          <img
                            src={imgUrl}
                            alt={`bg ${index + 1}`}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                          {isActive && (
                            <div
                              style={{
                                position: 'absolute',
                                top: '6px',
                                right: '6px',
                                backgroundColor: 'var(--status-on-time)',
                                color: '#000',
                                borderRadius: '50%',
                                padding: '3px',
                                display: 'flex',
                              }}
                            >
                              <Check size={12} strokeWidth={3} />
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveCustomImage(imgUrl);
                            }}
                            style={{
                              position: 'absolute',
                              bottom: '6px',
                              left: '6px',
                              backgroundColor: 'rgba(239, 68, 68, 0.85)',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 'var(--radius-pill)',
                              padding: '4px 6px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                            }}
                            title={isEn ? 'Delete image' : 'حذف هذه الصورة'}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Interface Language Card */}
        <div className="bento-card">
          <h3 style={{ fontSize: '1.15rem', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Globe size={20} style={{ color: 'var(--status-on-time)' }} />
            <span>{isEn ? 'Interface Language' : 'لغة الواجهة'}</span>
            <span title={isEn ? 'Choose application interface language' : 'اختيار لغة العرض المناسبة للتطبيق'} style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-muted)', cursor: 'help' }}>
              <Info size={15} />
            </span>
          </h3>

          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => handleInputChange('language', 'ar')}
              style={{
                padding: '12px 22px',
                borderRadius: 'var(--radius-pill)',
                border: (settings.language || 'ar') === 'ar' ? '1.5px solid var(--status-on-time)' : '1px solid var(--border-subtle)',
                backgroundColor: (settings.language || 'ar') === 'ar' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                color: (settings.language || 'ar') === 'ar' ? '#ffffff' : 'var(--text-secondary)',
                fontSize: '0.92rem',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s ease',
              }}
              id="btn-lang-ar"
            >
              {(settings.language || 'ar') === 'ar' && <Check size={16} style={{ color: 'var(--status-on-time)' }} />}
              <span>العربية</span>
            </button>

            <button
              type="button"
              onClick={() => handleInputChange('language', 'en')}
              style={{
                padding: '12px 22px',
                borderRadius: 'var(--radius-pill)',
                border: settings.language === 'en' ? '1.5px solid var(--status-on-time)' : '1px solid var(--border-subtle)',
                backgroundColor: settings.language === 'en' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                color: settings.language === 'en' ? '#ffffff' : 'var(--text-secondary)',
                fontSize: '0.92rem',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s ease',
              }}
              id="btn-lang-en"
            >
              {settings.language === 'en' && <Check size={16} style={{ color: 'var(--status-on-time)' }} />}
              <span>English</span>
            </button>
          </div>
        </div>

        {/* City and Country Card */}
        <div className="bento-card">
          <h3 style={{ fontSize: '1.15rem', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MapPin size={20} style={{ color: 'var(--status-on-time)' }} />
            <span>{isEn ? 'City & Country' : 'المدينة والدولة'}</span>
            <span title={isEn ? 'Set your location for accurate automated prayer timings' : 'تحديد موقعك تلقائياً لضبط مواقيت الصلاة بدقة'} style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-muted)', cursor: 'help' }}>
              <Info size={15} />
            </span>
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <SearchableSelect
              label={isEn ? 'Country' : 'الدولة'}
              value={settings.country || ''}
              options={countryOptions}
              onChange={handleCountrySelect}
              placeholder={isLoadingCountries ? (isEn ? 'Loading countries...' : 'جاري تحميل قائمة الدول...') : (isEn ? 'Select Country...' : 'اختر الدولة...')}
              searchPlaceholder={isEn ? 'Search Country...' : 'ابحث عن الدولة...'}
              icon={Globe}
              isEn={isEn}
              isLoading={isLoadingCountries}
            />

            <SearchableSelect
              label={isEn ? 'City' : 'المدينة'}
              value={settings.city || ''}
              options={cityOptions}
              onChange={(city) => {
                handleInputChange('city', city);
                const locCity = getLocalizedCityName(city, isEn ? 'en' : 'ar') || city;
                const locCountry = getLocalizedCountryName(settings.country, isEn ? 'en' : 'ar') || settings.country;
                const fullLoc = locCountry ? `${locCity} (${locCountry})` : locCity;
                setSaveSuccessMsg(isEn ? `Syncing prayer times for ${fullLoc}...` : `جاري مزامنة وتحديث مواقيت الصلاة لـ ${fullLoc}...`);
                setTimeout(() => autoSyncLocationPrayerTimes(city, settings.country, settings.calculationMethod), 60);
              }}
              placeholder={isEn ? 'Select City...' : 'اختر المدينة...'}
              searchPlaceholder={isEn ? 'Search City...' : 'ابحث عن المدينة...'}
              icon={Building2}
              isEn={isEn}
            />

            <SearchableSelect
              label={isEn ? 'Official Calculation Authority' : 'هيئة الحساب الرسمية للمواقيت'}
              value={settings.calculationMethod || 'auto'}
              options={calculationMethodOptions}
              onChange={(methodId) => {
                handleInputChange('calculationMethod', methodId);
                setTimeout(() => autoSyncLocationPrayerTimes(settings.city, settings.country, methodId), 60);
              }}
              placeholder={isEn ? 'Select Calculation Authority...' : 'اختر هيئة الحساب المعتمدة...'}
              searchPlaceholder={isEn ? 'Search Authority...' : 'ابحث عن الهيئة...'}
              icon={Compass}
              isEn={isEn}
            />

            <SearchableSelect
              label={isEn ? 'Asr Jurisprudential School (Madhab)' : 'المذهب الفقهي لصلاة العصر'}
              value={settings.asrMadhab || 'shafi'}
              options={madhabOptions}
              onChange={(mId) => {
                handleInputChange('asrMadhab', mId);
                setTimeout(() => autoSyncLocationPrayerTimes(settings.city, settings.country, settings.calculationMethod), 60);
              }}
              placeholder={isEn ? 'Select Asr Madhab...' : 'اختر المذهب الفقهي...'}
              searchPlaceholder={isEn ? 'Search Madhab...' : 'ابحث عن المذهب...'}
              icon={BookOpen}
              isEn={isEn}
            />

            <button
              type="button"
              className="btn-secondary"
              onClick={handleAutoDetectLocation}
              disabled={isDetectingLocation}
              style={{
                padding: '9px 18px',
                fontSize: '0.84rem',
                borderRadius: 'var(--radius-pill)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                alignSelf: 'flex-start',
                cursor: isDetectingLocation ? 'not-allowed' : 'pointer',
              }}
              id="btn-auto-detect-location"
            >
              <Navigation size={15} style={{ color: 'var(--status-on-time)' }} />
              <span>{isDetectingLocation ? (isEn ? 'Detecting Location...' : 'جاري تحديد الموقع...') : (isEn ? 'Auto-Detect Current Location' : 'تحديد موقعي الحالي تلقائياً')}</span>
            </button>
          </div>
        </div>

        {/* Prayer Times Sync & Daily Auto-Update Card */}
        <div className="bento-card">
          <h3 style={{ fontSize: '1.15rem', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <RefreshCw size={20} style={{ color: 'var(--status-on-time)' }} />
            <span>{isEn ? 'Prayer Times Sync & Daily Auto-Update' : 'تحديث مواقيت الصلاة والمزامنة اليومية'}</span>
            <span title={isEn ? 'Manage manual synchronization and daily automated background updates' : 'إدارة المزامنة اليدوية والتحديث التلقائي اليومي في الخلفية'} style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-muted)', cursor: 'help' }}>
              <Info size={15} />
            </span>
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Sync Status Banner */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 18px',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '0.86rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                  {isEn ? 'Current Sync Status' : 'حالة المزامنة الحالية'}
                </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {syncStatus || (cachedTimes?.lastSyncedTime ? (isEn ? `Last updated: ${cachedTimes.lastSyncedTime}` : `آخر تحديث مسجل: ${cachedTimes.lastSyncedTime}`) : (isEn ? 'Ready to sync' : 'جاهز للمزامنة الفورية'))}
                  {cachedTimes?.source ? ` • ${cachedTimes.source}` : ''}
                </span>
              </div>

              <button
                type="button"
                className="btn-primary"
                onClick={() => autoSyncLocationPrayerTimes(settings.city, settings.country, settings.calculationMethod)}
                disabled={isSyncingTimes}
                style={{
                  padding: '10px 22px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: '0.86rem',
                  fontWeight: '700',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: isSyncingTimes ? 'not-allowed' : 'pointer',
                  opacity: isSyncingTimes ? 0.7 : 1,
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
                }}
                id="btn-manual-sync-prayer-times"
              >
                <RefreshCw size={15} className={isSyncingTimes ? 'spin-icon' : ''} style={{ animation: isSyncingTimes ? 'spin 1s linear infinite' : 'none' }} />
                <span>{isSyncingTimes ? (isEn ? 'Syncing...' : 'جاري التحديث...') : (isEn ? 'Sync Prayer Times Now' : 'تحديث ومزامنة المواقيت الآن')}</span>
              </button>
            </div>

            {/* Schedule Status & Cached Days Banner (Aladhan API Cache) */}
            {scheduleCache && scheduleCache.totalDays > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: 'var(--radius-md)',
                  flexWrap: 'wrap',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Table size={18} style={{ color: 'var(--status-on-time)', flexShrink: 0 }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '0.84rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                      {isEn
                        ? `Multi-day Table Cached: ${scheduleCache.totalDays} Days Available (Offline)`
                        : `تم تخزين جدول محلي لـ ${scheduleCache.totalDays} يوماً بنجاح (للعمل بدون نت)`}
                    </span>
                    <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                      {isEn ? `Source: ${scheduleCache.domain || 'Aladhan API (Official)'}` : `المصدر: ${scheduleCache.domain || 'Aladhan API (الرسمي)'}`}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setShowScheduleModal(true)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 14px',
                      borderRadius: 'var(--radius-pill)',
                      backgroundColor: 'rgba(255, 255, 255, 0.12)',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      color: 'var(--status-on-time)',
                      fontSize: '0.78rem',
                      fontWeight: '700',
                      cursor: 'pointer',
                    }}
                    id="btn-view-schedule-table"
                  >
                    <Eye size={13} />
                    <span>{isEn ? 'View Schedule Table' : 'الإطلاع على الجدول الكامل'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleClearScheduleCache}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-pill)',
                      backgroundColor: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      color: 'var(--status-missed)',
                      fontSize: '0.78rem',
                      fontWeight: '700',
                      cursor: 'pointer',
                    }}
                  >
                    <Trash2 size={13} />
                    <span>{isEn ? 'Clear Cache' : 'مسح الجدول المخزن'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Daily Auto-Sync Rule Info */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <CheckCircle size={18} style={{ color: 'var(--status-on-time)', flexShrink: 0 }} />
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                <span style={{ fontWeight: '700', color: 'var(--text-primary)', marginInlineEnd: '6px' }}>
                  {isEn ? 'Daily Automatic Sync Active:' : 'المزامنة التلقائية اليومية نشطة:'}
                </span>
                <span>
                  {isEn
                    ? 'The app automatically verifies and refreshes prayer calculations every 24 hours at midnight and dawn.'
                    : 'يقوم التطبيق تلقائياً بالتحقق من مواقيت الصلوات وتحديثها يومياً عند منتصف الليل ومطلع الفجر لضمان الدقة المستمرة.'}
                </span>
              </div>
            </div>

            {/* Notification Permission Control */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                flexWrap: 'wrap',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Bell size={18} style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.84rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                    {isEn ? 'Adhan Browser Notifications' : 'تنبيهات الأذان في المتصفح'}
                  </span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {notifPermission === 'granted'
                      ? (isEn ? 'Active: Notifications enabled for prayer times' : 'نشط: التنبيهات مفعلة عند حلول أوقات الصلاة')
                      : (isEn ? 'Disabled: Click to grant permission' : 'معطل: انقر لتفعيل إذن الإشعارات')}
                  </span>
                </div>
              </div>
              {notifPermission !== 'granted' && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleEnableNotifications}
                  style={{
                    padding: '7px 16px',
                    fontSize: '0.8rem',
                    borderRadius: 'var(--radius-pill)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                  id="btn-enable-notifications"
                >
                  <Bell size={14} />
                  <span>{isEn ? 'Enable Notifications' : 'تفعيل التنبيهات'}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Manual Prayer Offsets & Minute Fine-Tuning Card */}
        <div className="bento-card" style={{ gridColumn: '1 / -1' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: '700', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={20} style={{ color: 'var(--status-on-time)' }} />
            <span>{isEn ? 'Manual Prayer Offsets (Minute Fine-Tuning)' : 'ضبط وتعديل الفارق الزمني لمواقيت الصلوات (بالدقائق)'}</span>
            <span title={isEn ? 'Fine-tune minutes for each prayer to match your local mosque adhan exactly' : 'تعديل الدقائق بالزيادة أو النقصان لمطابقة أذان مسجدك المحلي بدقة'} style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-muted)', cursor: 'help' }}>
              <Info size={15} />
            </span>
          </h3>

          <div
            style={{
              padding: '12px 16px',
              backgroundColor: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.22)',
              borderRadius: 'var(--radius-md)',
              marginBottom: '18px',
              fontSize: '0.84rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <Info size={18} style={{ color: 'var(--status-late)', flexShrink: 0 }} />
            <span>
              {isEn
                ? 'Notice: Prayer times are astronomical estimates according to the selected calculation authority. If your local mosque adhan differs by a few minutes, you can enter the minute difference (+ or -) below to align the times perfectly.'
                : 'تنبيه وإيضاح: مواقيت الصلاة معتمدة على الحسابات الفلكية للهيئة الرسمية المختارة وتعد أوقاتاً تقريبية بالنسبة لمسجدك. إذا كان أذان المسجد يتقدم أو يتأخر بعدة دقائق، يمكنك إدخال الفارق (+ أو - بالدقائق) لمطابقة أذان المسجد بدقة تامة.'}
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: '12px',
            }}
          >
            {[
              { id: 'Fajr', nameAr: 'الفجر', nameEn: 'Fajr' },
              { id: 'Sunrise', nameAr: 'الشروق', nameEn: 'Sunrise' },
              { id: 'Dhuhr', nameAr: 'الظهر', nameEn: 'Dhuhr' },
              { id: 'Asr', nameAr: 'العصر', nameEn: 'Asr' },
              { id: 'Maghrib', nameAr: 'المغرب', nameEn: 'Maghrib' },
              { id: 'Isha', nameAr: 'العشاء', nameEn: 'Isha' },
            ].map((p) => {
              const currentOffset = Number(settings.prayerOffsets?.[p.id]) || 0;
              return (
                <div
                  key={p.id}
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <span style={{ fontSize: '0.88rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                    {isEn ? p.nameEn : p.nameAr}
                  </span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => handlePrayerOffsetChange(p.id, currentOffset - 1)}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-primary)',
                        fontWeight: '700',
                        fontSize: '1rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      title={isEn ? 'Decrease by 1 minute' : 'إنقاص دقيقة'}
                    >
                      -
                    </button>

                    <span
                      style={{
                        minWidth: '42px',
                        textAlign: 'center',
                        fontSize: '0.92rem',
                        fontWeight: '800',
                        color: currentOffset === 0 ? 'var(--text-muted)' : (currentOffset > 0 ? 'var(--status-on-time)' : 'var(--status-late)'),
                        fontFamily: 'monospace',
                      }}
                    >
                      {currentOffset > 0 ? `+${currentOffset}` : currentOffset} {isEn ? 'm' : 'د'}
                    </span>

                    <button
                      type="button"
                      onClick={() => handlePrayerOffsetChange(p.id, currentOffset + 1)}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-primary)',
                        fontWeight: '700',
                        fontSize: '1rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      title={isEn ? 'Increase by 1 minute' : 'زيادة دقيقة'}
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Time Format Settings Card */}
        <div className="bento-card">
          <h3 style={{ fontSize: '1.15rem', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={20} style={{ color: 'var(--accent-blue)' }} />
            <span>{isEn ? 'Time Display Format' : 'نظام عرض الوقت'}</span>
            <span title={isEn ? 'Switch between 12-hour and 24-hour time format' : 'التبديل بين تنسيق 12 ساعة وتنسيق 24 ساعة'} style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-muted)', cursor: 'help' }}>
              <Info size={15} />
            </span>
          </h3>

          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => handleInputChange('timeFormat', '12')}
              style={{
                padding: '12px 22px',
                borderRadius: 'var(--radius-pill)',
                border: (settings.timeFormat || '12') === '12' ? '1.5px solid var(--accent-blue)' : '1px solid var(--border-subtle)',
                backgroundColor: (settings.timeFormat || '12') === '12' ? 'rgba(59, 130, 246, 0.18)' : 'rgba(255, 255, 255, 0.05)',
                color: (settings.timeFormat || '12') === '12' ? '#ffffff' : 'var(--text-secondary)',
                fontSize: '0.92rem',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s ease',
              }}
            >
              {(settings.timeFormat || '12') === '12' && <Check size={16} style={{ color: 'var(--accent-blue)' }} />}
              <span>{isEn ? '12-Hour Format' : 'نظام 12 ساعة'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleInputChange('timeFormat', '24')}
              style={{
                padding: '12px 22px',
                borderRadius: 'var(--radius-pill)',
                border: settings.timeFormat === '24' ? '1.5px solid var(--accent-blue)' : '1px solid var(--border-subtle)',
                backgroundColor: settings.timeFormat === '24' ? 'rgba(59, 130, 246, 0.18)' : 'rgba(255, 255, 255, 0.05)',
                color: settings.timeFormat === '24' ? '#ffffff' : 'var(--text-secondary)',
                fontSize: '0.92rem',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s ease',
              }}
            >
              {settings.timeFormat === '24' && <Check size={16} style={{ color: 'var(--accent-blue)' }} />}
              <span>{isEn ? '24-Hour Format' : 'نظام 24 ساعة'}</span>
            </button>
          </div>
        </div>

        {/* API Keys Card */}
        <div className="bento-card">
          <h3 style={{ fontSize: '1.15rem', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Key size={20} style={{ color: 'var(--status-on-time)' }} />
            <span>{isEn ? 'Smart API Keys' : 'مفاتيح API الذكية'}</span>
          </h3>

          {/* Gemini API Key */}
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>{isEn ? 'Gemini API Key' : 'مفتاح Gemini API'}</span>
              <span title={isEn ? 'Used for Sheikh Muneer AI smart chat companion' : 'مخصص لتشغيل الدردشة الذكية وتحليل الروتين اليومي'} style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-muted)', cursor: 'help' }}>
                <Info size={14} />
              </span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="search"
                className="form-input"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
                data-lpignore="true"
                data-1p-ignore="true"
                data-form-type="other"
                name="gemini_key_token_query"
                placeholder="AIzaSy..."
                value={showGeminiKey ? (settings.geminiApiKey || '') : (settings.geminiApiKey ? '••••••••••••••••••••••••••••••••' : '')}
                onFocus={() => {
                  if (!showGeminiKey && settings.geminiApiKey) setShowGeminiKey(true);
                }}
                onChange={(e) => {
                  const val = e.target.value;
                  handleInputChange('geminiApiKey', val);
                }}
                id="input-gemini-key"
              />
              <button
                type="button"
                style={{
                  position: 'absolute',
                  [isEn ? 'right' : 'left']: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
                onClick={() => setShowGeminiKey(!showGeminiKey)}
              >
                {showGeminiKey ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
              {isEn ? 'Your key is stored locally in your browser and only sent directly to Google Gemini.' : 'يُحفظ المفتاح محليًا في المتصفح فقط ولن يُرسل لأي خادم خارجي سوى Google Gemini.'}
            </span>
          </div>

          {/* Tavily Search API Key */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>{isEn ? 'Tavily API Key' : 'مفتاح Tavily API'}</span>
              <span title={isEn ? 'Used for automated real-time web search for prayer times' : 'مخصص للبحث الذكي المباشر وتحديث مواقيت الصلاة لمدينتك بدقة فائقة'} style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-muted)', cursor: 'help' }}>
                <Info size={14} />
              </span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="search"
                className="form-input"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
                data-lpignore="true"
                data-1p-ignore="true"
                data-form-type="other"
                name="tavily_key_token_query"
                placeholder="tvly-..."
                value={showTavilyKey ? (settings.tavilyApiKey || '') : (settings.tavilyApiKey ? '••••••••••••••••••••••••••••••••' : '')}
                onFocus={() => {
                  if (!showTavilyKey && settings.tavilyApiKey) setShowTavilyKey(true);
                }}
                onChange={(e) => {
                  const val = e.target.value;
                  handleInputChange('tavilyApiKey', val);
                }}
                id="input-tavily-key"
              />
              <button
                type="button"
                style={{
                  position: 'absolute',
                  [isEn ? 'right' : 'left']: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
                onClick={() => setShowTavilyKey(!showTavilyKey)}
              >
                {showTavilyKey ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
              {isEn ? 'Tavily key to fetch accurate live prayer times for your city automatically.' : 'مفتاح خادم Tavily للبحث المباشر في الويب وجلب أحدث مواقيت الصلاة لمدينتك تلقائياً وبدقة فائقة.'}
            </span>
          </div>
        </div>

        {/* Manual Source Link Card */}
        <div className="bento-card">
          <h3 style={{ fontSize: '1.15rem', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Globe size={20} />
            <span>{isEn ? 'Custom Prayer Times Source URL' : 'رابط موقع مواقيت الصلاة المصدر'}</span>
            <span title={isEn ? 'Optional custom prayer website link' : 'إدخال يدوي اختياري - يُترك فارغاً افتراضياً'} style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-muted)', cursor: 'help' }}>
              <Info size={15} />
            </span>
          </h3>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{isEn ? 'Source Page URL:' : 'رابط الصفحة المصدر:'}</label>
            <input
              type="text"
              className="form-input"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              data-lpignore="true"
              data-form-type="other"
              name="prayer_source_url_field"
              value={settings.prayerSourceUrl || ''}
              onChange={(e) => handleInputChange('prayerSourceUrl', e.target.value)}
              placeholder={isEn ? 'e.g. https://timesprayer.com/' : 'مثال: https://timesprayer.com/'}
              id="input-prayer-source-url"
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px', display: 'block' }}>
              {isEn ? 'Optional. If left blank, prayer times are fetched automatically via web search or official source.' : 'اختياري. إذا تُرِك فارغاً، يتم جلب مواقيت الصلاة عبر البحث العام في الويب أو الخدمة الرسمية مباشرة.'}
            </span>
          </div>
        </div>

        {/* Compact Shortcuts Trigger Card */}
        <div className="bento-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: '700', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Keyboard size={20} style={{ color: 'var(--status-on-time)' }} />
              <span>{isEn ? 'Keyboard Shortcuts & Controls' : 'اختصارات لوحة المفاتيح والتحكم السريع'}</span>
            </h3>

            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '18px' }}>
              {isEn ? 'Direct shortcuts for quick navigation, live scenes, audio, and focus mode without mouse.' : 'دليل اختصارات الكيبورد المباشرة للتنقل والتغيير السريع بين المشاهد الحية والتحكم بالصوت ووضع التركيز بدون ماوس.'}
            </p>
          </div>

          <div>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowShortcutsModal(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 20px',
                borderRadius: 'var(--radius-pill)',
                fontWeight: '700',
                fontSize: '0.84rem',
                borderColor: 'rgba(255, 255, 255, 0.16)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              id="btn-open-keyboard-shortcuts-modal"
            >
              <Keyboard size={16} />
              <span>{isEn ? 'View Shortcuts Map' : 'عرض خريطة الاختصارات'}</span>
            </button>
          </div>
        </div>

        {/* Ultra-Modern Keyboard Shortcuts Modal */}
        {showShortcutsModal &&
          ReactDOM.createPortal(
            <div
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 9999,
                backgroundColor: 'rgba(5, 6, 10, 0.82)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '24px',
                animation: 'fadeIn 0.2s ease-out',
              }}
              onClick={() => setShowShortcutsModal(false)}
            >
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  maxWidth: '600px',
                  maxHeight: '90vh',
                  overflowY: 'auto',
                  backgroundColor: 'rgba(18, 20, 28, 0.95)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '24px',
                  padding: '32px',
                  boxShadow: '0 30px 80px rgba(0, 0, 0, 0.85)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--status-on-time)' }} />
                      <span style={{ fontSize: '0.7rem', fontWeight: '800', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                        SHORTCUTS & COMMAND NAV
                      </span>
                    </div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0, color: '#ffffff' }}>
                      {isEn ? 'Control Map & Keyboard Shortcuts' : 'دليل لوحة التحكم والمفاتيح السريعة'}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowShortcutsModal(false)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '50%',
                      width: '36px',
                      height: '36px',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <XCircle size={18} />
                  </button>
                </div>

                {/* Category 1: Live Stream & Scene Controls */}
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--status-on-time)', marginBottom: '12px' }}>
                    {isEn ? 'Live Stream & Scene Controls' : 'التحكم في المشاهد والبث الحي'}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', backgroundColor: 'rgba(255, 255, 255, 0.025)', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                      <span style={{ fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: '600' }}>
                        {isEn ? 'Switch between live scenes & backgrounds' : 'التبديل الفوري بين المشاهد والخلفيات الحية'}
                      </span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <kbd className="kbd-badge">RIGHT</kbd>
                        <kbd className="kbd-badge">LEFT</kbd>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', backgroundColor: 'rgba(255, 255, 255, 0.025)', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                      <span style={{ fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: '600' }}>
                        {isEn ? 'Mute / Unmute Live Holy Stream Audio' : 'تفعيل أو كتم صوت البث الحي تدريجياً'}
                      </span>
                      <kbd className="kbd-badge">M</kbd>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', backgroundColor: 'rgba(255, 255, 255, 0.025)', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                      <span style={{ fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: '600' }}>
                        {isEn ? 'Instant Re-sync live stream to present moment' : 'إعادة مزامنة البث المباشر لأحدث لحظة'}
                      </span>
                      <kbd className="kbd-badge">L</kbd>
                    </div>
                  </div>
                </div>

                {/* Category 2: App Navigation & Focus View */}
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '12px' }}>
                    {isEn ? 'App Navigation & Focus Mode' : 'الواجهة ونموذج التركيز'}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', backgroundColor: 'rgba(255, 255, 255, 0.025)', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                      <span style={{ fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: '600' }}>
                        {isEn ? 'Vertical navigation between tabs and pages' : 'التنقل الرأسي بين صفحات وتبويبات التطبيق'}
                      </span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <kbd className="kbd-badge">UP</kbd>
                        <kbd className="kbd-badge">DOWN</kbd>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', backgroundColor: 'rgba(255, 255, 255, 0.025)', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                      <span style={{ fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: '600' }}>
                        {isEn ? 'Toggle Full Focus Mode' : 'تفعيل أو إخفاء وضع التركيز والشفافية'}
                      </span>
                      <kbd className="kbd-badge">F</kbd>
                    </div>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )}

        {/* Full Comprehensive Data Backup & Restore Card */}
        <div className="bento-card">
          <h3 style={{ fontSize: '1.15rem', fontWeight: '700', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileJson size={20} style={{ color: 'var(--status-on-time)' }} />
            <span>{isEn ? 'Full Data Backup & Restore' : 'النسخ الاحتياطي الشامل واسترجاع البيانات'}</span>
          </h3>

          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
            {isEn
              ? 'Export a complete backup containing 100% of your data (Settings, All Prayer Logs, Sunnahs, and AI Conversations) to a single JSON file, or restore it on any device.'
              : 'قم بتصدير نسخة احتياطية شاملة تحتوي على 100% من بياناتك (الإعدادات، سجلات الصلوات الخمس والسنن، ومحادثات الشيخ منير) في ملف JSON موحد، أو استرجعها بسهولة على أي جهاز.'}
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
            {/* Export Button */}
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                try {
                  const jsonStr = exportFullUserDataJSON();
                  const blob = new Blob([jsonStr], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  const dStr = new Date().toISOString().split('T')[0];
                  a.href = url;
                  a.download = `prayer_tracker_backup_${dStr}.json`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                  setSaveSuccessMsg(isEn ? 'Full backup exported successfully' : 'تم تصدير النسخة الاحتياطية بنجاح');
                  setTimeout(() => setSaveSuccessMsg(''), 3000);
                } catch (e) {
                  alert(isEn ? 'Failed to export backup' : 'تعذر تصدير النسخة الاحتياطية');
                }
              }}
              id="btn-export-full-backup"
            >
              <Download size={15} style={{ color: 'var(--status-on-time)' }} />
              <span>{isEn ? 'Export Full Backup (JSON)' : 'تصدير نسخة احتياطية كاملة (JSON)'}</span>
            </button>

            {/* Import Button */}
            <label
              className="btn-secondary"
              style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              id="btn-import-full-backup-label"
            >
              <UploadCloud size={15} style={{ color: 'var(--accent-blue)' }} />
              <span>{isEn ? 'Restore from Backup (JSON)' : 'استرجاع نسخة احتياطية (JSON)'}</span>
              <input
                type="file"
                accept=".json,application/json"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (event) => {
                    try {
                      const content = event.target?.result;
                      if (typeof content === 'string') {
                        importFullUserDataJSON(content);
                        setSettingsState(getSettings());
                        setSaveSuccessMsg(isEn ? 'Data restored successfully' : 'تم استرجاع كافة البيانات بنجاح وتحديث الواجهة');
                        setTimeout(() => setSaveSuccessMsg(''), 3500);
                      }
                    } catch (err) {
                      alert(isEn ? `Failed to restore backup: ${err.message}` : `فشل استرجاع النسخة: ${err.message}`);
                    }
                  };
                  reader.readAsText(file);
                  e.target.value = '';
                }}
              />
            </label>
          </div>

          <div style={{ width: '100%', height: '1px', backgroundColor: 'var(--border-subtle)', margin: '16px 0' }} />

          {/* Wipe & Reset Options */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                if (window.confirm(isEn ? 'Warning: Are you sure you want to clear all prayer logs?' : 'تحذير: هل أنت متأكد من مسح وتصفير جميع سجلات الصلوات؟')) {
                  clearAllRecords();
                  setSaveSuccessMsg(isEn ? 'All prayer records cleared' : 'تم مسح وتصفير سجلات الصلوات بنجاح');
                  setTimeout(() => setSaveSuccessMsg(''), 3000);
                }
              }}
              style={{ color: 'var(--status-late)', borderColor: 'rgba(245, 158, 11, 0.3)' }}
              id="btn-clear-demo-records"
            >
              <Trash2 size={14} />
              <span>{isEn ? 'Clear Prayer Logs Only' : 'تصفير سجلات الصلوات فقط'}</span>
            </button>

            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                if (window.confirm(isEn ? 'DANGER: This will permanently delete ALL settings, prayer logs, and AI conversations! Proceed?' : 'تحذير شديد: سيتم مسح كافة البيانات والإعدادات والمحادثات نهائياً وإعادة ضبط المصنع! هل تريد المتابعة؟')) {
                  clearEntireAppData();
                  setSettingsState(getSettings());
                  setSaveSuccessMsg(isEn ? 'Application reset completely' : 'تمت إعادة ضبط المصنع ومسح كافة البيانات بنجاح');
                  setTimeout(() => setSaveSuccessMsg(''), 3000);
                }
              }}
              style={{ color: 'var(--status-qada)', borderColor: 'rgba(239, 68, 68, 0.4)' }}
              id="btn-factory-reset-all"
            >
              <Trash2 size={14} />
              <span>{isEn ? 'Factory Reset (Wipe All Data)' : 'إعادة ضبط المصنع وحذف كافة البيانات'}</span>
            </button>
          </div>
        </div>

        {/* Full Schedule Table Modal */}
        <ScheduleTableModal
          isOpen={showScheduleModal}
          onClose={() => setShowScheduleModal(false)}
          scheduleData={scheduleCache}
          isEn={isEn}
          is12HourFormat={(settings.timeFormat || '12') === '12'}
        />
      </div>
    </div>
  );
}

function SearchableSelect({ label, value, options, onChange, placeholder, searchPlaceholder, icon: IconComp, isEn, isLoading }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Find displayed label if value is an id/value in an object list
  const currentObj = (Array.isArray(options) ? options : []).find((opt) => {
    if (typeof opt === 'object' && opt !== null) {
      const optVal = opt.id ?? opt.value;
      const optLbl = opt.label ?? opt.name;
      if (optVal === value || optLbl === value) return true;
      if (typeof optVal === 'string' && typeof value === 'string' && optVal.toLowerCase() === value.toLowerCase()) return true;
      if (typeof optLbl === 'string' && typeof value === 'string' && optLbl.toLowerCase() === value.toLowerCase()) return true;
      return false;
    }
    return opt === value || (typeof opt === 'string' && typeof value === 'string' && opt.toLowerCase() === value.toLowerCase());
  });

  const displayLabel = currentObj
    ? (typeof currentObj === 'object' ? (currentObj.label || currentObj.name || currentObj.id) : currentObj)
    : (value || placeholder);

  const filteredOptions = (Array.isArray(options) ? options : []).filter((opt) => matchesStrictPrefix(opt, searchTerm));

  return (
    <div className="form-group" style={{ marginBottom: 0 }}>
      {label && <label className="form-label">{label}:</label>}
      <div className="custom-select-container">
        <div
          className="custom-select-trigger"
          onClick={() => {
            if (!isLoading) setIsOpen(!isOpen);
          }}
          style={{ opacity: isLoading ? 0.7 : 1, cursor: isLoading ? 'wait' : 'pointer' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {IconComp && <IconComp size={16} style={{ color: 'var(--status-on-time)', flexShrink: 0 }} />}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayLabel}</span>
          </div>
          <ChevronDown
            size={16}
            style={{
              transform: isOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.18s ease',
              color: 'var(--text-secondary)',
              flexShrink: 0,
            }}
          />
        </div>

        {isOpen && !isLoading && (
          <div className="custom-select-menu">
            <div style={{ position: 'relative', marginBottom: '8px' }}>
              <input
                type="search"
                className="form-input"
                style={{ [isEn ? 'paddingLeft' : 'paddingRight']: '32px', fontSize: '0.85rem' }}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
                data-lpignore="true"
                data-1p-ignore="true"
                data-form-type="other"
                name="search"
                aria-autocomplete="none"
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
              />
              <Search size={14} style={{ position: 'absolute', [isEn ? 'left' : 'right']: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            </div>

            <div className="custom-select-options" style={{ maxHeight: '220px', overflowY: 'auto' }}>
              {filteredOptions.length > 0 ? (
                filteredOptions.map((opt, idx) => {
                  const optVal = typeof opt === 'object' && opt !== null ? (opt.id ?? opt.value) : opt;
                  const optText = typeof opt === 'object' && opt !== null ? (opt.label ?? opt.name) : opt;
                  const isSelected = value === optVal;
                  return (
                    <div
                      key={typeof optVal === 'string' ? optVal : idx}
                      className={`custom-select-option ${isSelected ? 'active' : ''}`}
                      onClick={() => {
                        onChange(optVal);
                        setIsOpen(false);
                        setSearchTerm('');
                      }}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '8px 12px', fontSize: '0.84rem' }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{optText}</span>
                      {isSelected && <Check size={14} style={{ color: 'var(--status-on-time)', flexShrink: 0 }} />}
                    </div>
                  );
                })
              ) : (
                <div style={{ padding: '12px', fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                  {isEn ? 'No matching results' : 'لا توجد نتائج مطابقة'}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
