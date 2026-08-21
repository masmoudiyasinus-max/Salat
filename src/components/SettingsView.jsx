import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom';
import {
  MapPin,
  Globe,
  Video,
  Image as ImageIcon,
  Key,
  Download,
  UploadCloud,
  Trash2,
  Eye,
  EyeOff,
  Navigation,
  Upload,
  AlertTriangle,
  FileJson,
  Check,
  Keyboard,
  X,
  BellRing,
  WifiOff,
  Lock,
} from 'lucide-react';
import {
  getSettings,
  saveSettings,
  clearAllRecords,
  exportFullUserDataJSON,
  importFullUserDataJSON,
  clearEntireAppData,
  compressImageFile,
} from '../services/storage';
import { syncFullMonthFromAladhanApi } from '../services/aladhanApiService';
import {
  requestFreshLocationFromScratch,
  requestNotificationsPermission,
  getNotificationPermission,
} from '../services/permissionService';
import {
  getLocalizedCountryName,
  getLocalizedCityName,
  getCuratedCitiesForCountry,
} from '../services/countryLocalization';
import SearchableSelect from './settings/SearchableSelect';

export default function SettingsView({ settings: propSettings, onSettingsSaved, isOnline: propIsOnline }) {
  const [settings, setSettingsState] = useState(() => propSettings || getSettings());
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [countriesList, setCountriesList] = useState([]);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [resetType, setResetType] = useState('prayers'); // 'prayers' | 'all'
  const fileInputRef = useRef(null);
  const importInputRef = useRef(null);

  // Browser Notifications Permission state
  const [notifPermission, setNotifPermission] = useState(() => getNotificationPermission());

  useEffect(() => {
    if (propSettings) {
      setSettingsState(propSettings);
    }
  }, [propSettings]);

  const [isOnline, setIsOnline] = useState(() => (propIsOnline !== undefined ? propIsOnline : (typeof navigator !== 'undefined' ? navigator.onLine : true)));

  useEffect(() => {
    if (propIsOnline !== undefined) {
      setIsOnline(propIsOnline);
    }
  }, [propIsOnline]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Sync live browser permission updates (address bar clicks, focus, visibility, query events)
  useEffect(() => {
    let permQuery = null;
    const updatePerm = () => {
      setNotifPermission(getNotificationPermission());
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', updatePerm);
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', updatePerm);
    }

    if (typeof navigator !== 'undefined' && navigator.permissions && typeof navigator.permissions.query === 'function') {
      navigator.permissions.query({ name: 'notifications' })
        .then((permStatus) => {
          permQuery = permStatus;
          permStatus.onchange = updatePerm;
        })
        .catch(() => {});
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', updatePerm);
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', updatePerm);
      }
      if (permQuery) {
        permQuery.onchange = null;
      }
    };
  }, []);

  const lang = settings.language || 'ar';
  const isEn = lang === 'en';

  useEffect(() => {
    let isMounted = true;
    async function fetchCountries() {
      try {
        const res = await fetch('https://countriesnow.space/api/v0.1/countries');
        if (res.ok) {
          const data = await res.json();
          if (data && !data.error && Array.isArray(data.data) && isMounted) {
            setCountriesList(data.data);
          }
        }
      } catch (err) {
        console.warn('Failed to fetch dynamic country list:', err);
      }
    }
    fetchCountries();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleUpdateSettings = (changes) => {
    setSettingsState((prev) => {
      const fresh = getSettings();
      const updated = {
        ...fresh,
        ...prev,
        ...changes,
        // Strictly protect background & wallpaper settings from being unintentionally reset
        bgMode: changes.bgMode !== undefined ? changes.bgMode : (prev.bgMode || fresh.bgMode),
        activeCustomBgImage: changes.activeCustomBgImage !== undefined ? changes.activeCustomBgImage : (prev.activeCustomBgImage || fresh.activeCustomBgImage),
        customBgImages: changes.customBgImages !== undefined ? changes.customBgImages : (prev.customBgImages || fresh.customBgImages),
      };
      saveSettings(updated);
      if (onSettingsSaved) onSettingsSaved(updated);
      return updated;
    });
  };

  const handleInputChange = (field, value) => {
    handleUpdateSettings({ [field]: value });
  };

  const handleCountryChange = (newCountry) => {
    if (!newCountry) return;
    const countryObj = Array.isArray(countriesList)
      ? countriesList.find((c) => c.country.toLowerCase() === newCountry.toLowerCase())
      : null;
    let defaultCity = countryObj && Array.isArray(countryObj.cities) && countryObj.cities.length > 0
      ? countryObj.cities[0]
      : '';

    if (!defaultCity) {
      const cLower = newCountry.toLowerCase();
      if (cLower.includes('saudi') || cLower.includes('سعودية')) defaultCity = 'Riyadh';
      else if (cLower.includes('egypt') || cLower.includes('مصر')) defaultCity = 'Cairo';
      else if (cLower.includes('palestin') || cLower.includes('فلسطين')) defaultCity = 'Jerusalem';
      else if (cLower.includes('tunis') || cLower.includes('تونس')) defaultCity = 'Tunis';
      else if (cLower.includes('alger') || cLower.includes('جزائر')) defaultCity = 'Algiers';
      else if (cLower.includes('morocco') || cLower.includes('مغرب')) defaultCity = 'Casablanca';
      else if (cLower.includes('emirates') || cLower.includes('إمارات')) defaultCity = 'Dubai';
      else if (cLower.includes('france') || cLower.includes('فرنسا')) defaultCity = 'Paris';
      else if (cLower.includes('turkey') || cLower.includes('تركيا')) defaultCity = 'Istanbul';
      else if (cLower.includes('jordan') || cLower.includes('أردن')) defaultCity = 'Amman';
    }

    handleUpdateSettings({ country: newCountry, city: defaultCity });
    if (defaultCity) {
      syncFullMonthFromAladhanApi(defaultCity, newCountry).catch(() => {});
    }
  };

  const handleCityChange = (newCity) => {
    handleUpdateSettings({ city: newCity });
    if (newCity && settings.country) {
      syncFullMonthFromAladhanApi(newCity, settings.country).catch(() => {});
    }
  };

  // Auto GPS Location Detection
  const handleAutoDetectLocation = async () => {
    setIsDetectingLocation(true);
    try {
      const loc = await requestFreshLocationFromScratch();
      if (loc && loc.city && loc.country) {
        handleUpdateSettings({
          city: loc.city,
          country: loc.country,
          timezone: loc.timezone,
        });
        syncFullMonthFromAladhanApi(loc.city, loc.country).catch(() => {});
      }
    } catch (err) {
      console.warn('GPS error:', err);
    } finally {
      setIsDetectingLocation(false);
    }
  };

  // Custom Image Upload Handlers
  const handleImageUpload = async (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    try {
      const base64 = await compressImageFile(file);
      const existing = settings.customBgImages || [];
      const updatedList = [base64, ...existing.filter((img) => img !== base64)].slice(0, 10);
      const fresh = getSettings();
      const updated = {
        ...fresh,
        ...settings,
        customBgImages: updatedList,
        activeCustomBgImage: base64,
        bgMode: 'custom_image',
      };
      setSettingsState(updated);
      saveSettings(updated);
      if (onSettingsSaved) onSettingsSaved(updated);
    } catch (err) {
      console.error('Image upload error:', err);
    }
  };

  const handleDeleteImage = (imgToDelete, e) => {
    e.stopPropagation();
    const existing = settings.customBgImages || [];
    const updatedList = existing.filter((img) => img !== imgToDelete);
    const newActive = updatedList[0] || '';
    const fresh = getSettings();
    const updated = {
      ...fresh,
      ...settings,
      customBgImages: updatedList,
      activeCustomBgImage: newActive,
      bgMode: newActive ? settings.bgMode : 'makkah',
    };
    setSettingsState(updated);
    saveSettings(updated);
    if (onSettingsSaved) onSettingsSaved(updated);
  };

  // Country & City Options List
  const countryOptions = useMemo(() => {
    if (!Array.isArray(countriesList) || countriesList.length === 0) {
      return [
        { value: 'Saudi Arabia', label: getLocalizedCountryName('Saudi Arabia', isEn ? 'en' : 'ar') },
        { value: 'Egypt', label: getLocalizedCountryName('Egypt', isEn ? 'en' : 'ar') },
        { value: 'Palestine', label: getLocalizedCountryName('Palestine', isEn ? 'en' : 'ar') },
        { value: 'Morocco', label: getLocalizedCountryName('Morocco', isEn ? 'en' : 'ar') },
        { value: 'Algeria', label: getLocalizedCountryName('Algeria', isEn ? 'en' : 'ar') },
        { value: 'Tunisia', label: getLocalizedCountryName('Tunisia', isEn ? 'en' : 'ar') },
        { value: 'United Arab Emirates', label: getLocalizedCountryName('United Arab Emirates', isEn ? 'en' : 'ar') },
      ];
    }
    return countriesList
      .map((c) => ({
        value: c.country,
        label: getLocalizedCountryName(c.country, isEn ? 'en' : 'ar'),
      }))
      .sort((a, b) => a.label.localeCompare(b.label, isEn ? 'en' : 'ar'));
  }, [countriesList, isEn]);

  const selectedCountryObj = useMemo(() => {
    if (!Array.isArray(countriesList) || !settings.country) return null;
    return countriesList.find((c) => c.country.toLowerCase() === settings.country.toLowerCase());
  }, [countriesList, settings.country]);

  const cityOptions = useMemo(() => {
    const curated = getCuratedCitiesForCountry(settings.country);
    const apiCities = selectedCountryObj?.cities || [];
    const rawCities = Array.from(
      new Set([
        ...curated,
        ...apiCities,
        ...(settings.city ? [settings.city] : []),
      ])
    );

    return rawCities
      .map((city) => ({
        value: city,
        label: getLocalizedCityName(city, isEn ? 'en' : 'ar'),
      }))
      .sort((a, b) => a.label.localeCompare(b.label, isEn ? 'en' : 'ar'));
  }, [settings.country, selectedCountryObj, settings.city, isEn]);

  // Backup handlers
  const handleExportBackup = () => {
    const jsonStr = exportFullUserDataJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
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
      const result = importFullUserDataJSON(event.target.result);
      if (result.success) {
        window.location.reload();
      } else {
        alert('فشل استيراد الملف: ' + (result.error || 'صيغة ملف غير صالحة'));
      }
    };
    reader.readAsText(file);
    if (importInputRef.current) importInputRef.current.value = '';
  };

  const handleExecuteReset = () => {
    if (resetType === 'prayers') {
      clearAllRecords();
    } else {
      clearEntireAppData();
    }
    setShowResetModal(false);
    window.location.reload();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Global Offline Status Banner */}
      {!isOnline && (
        <div
          style={{
            padding: '14px 20px',
            borderRadius: '16px',
            backgroundColor: 'rgba(234, 179, 8, 0.14)',
            border: '1px solid rgba(234, 179, 8, 0.35)',
            color: '#fde047',
            fontSize: '0.88rem',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            lineHeight: '1.6',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          }}
        >
          <WifiOff size={22} style={{ flexShrink: 0 }} />
          <div>
            <strong style={{ color: '#ffffff' }}>{isEn ? 'Offline Mode Active:' : 'وضع العمل دون إنترنت نشط:'}</strong>{' '}
            {isEn
              ? 'Cloud features (live streams, AI chat, map GPS) are temporarily locked. All prayer calculations, tasbeeh, Quran reading, and notifications work 100% locally.'
              : 'تم قفل الميزات السحابية (البث المباشر، محادثة الذكاء الاصطناعي، وتحديد الموقع عبر الخرائط). بينما تعمل جميع ميزات تتبع الصلوات، المسبحة، الورد القرآني، والتنبيهات محلياً بنسبة 100%.'}
          </div>
        </div>
      )}

      {/* SECTION 1: Location & Aladhan API */}
      <div className="bento-card" style={{ padding: '24px', borderRadius: '20px', position: 'relative', zIndex: 9 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <MapPin size={22} style={{ color: 'var(--accent-gold)' }} />
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                {isEn ? 'Location & Aladhan Timings' : 'الموقع ومواقيت الصلاة الرسمية'}
              </h3>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                {isEn
                  ? 'Official prayer times powered directly by Aladhan API with offline astronomical calculation'
                  : 'مواقيت صلاة رسمية دقيقة 100% مع حساب فلكي محلي يعمل دون إنترنت'}
              </p>
            </div>
          </div>

          <button
            type="button"
            className="btn-secondary"
            onClick={isOnline ? handleAutoDetectLocation : undefined}
            disabled={isDetectingLocation || !isOnline}
            title={!isOnline ? (isEn ? 'GPS map resolution requires internet' : 'تحديد الموقع التلقائي يتطلب اتصالاً بالإنترنت') : ''}
            style={{
              padding: '8px 16px',
              fontSize: '0.85rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: !isOnline ? 'not-allowed' : (isDetectingLocation ? 'wait' : 'pointer'),
              opacity: !isOnline ? 0.45 : 1,
            }}
          >
            {!isOnline ? <Lock size={14} /> : <Navigation size={14} className={isDetectingLocation ? 'spin-icon' : ''} />}
            <span>
              {isDetectingLocation
                ? (isEn ? 'Detecting...' : 'جاري التحديد...')
                : (!isOnline
                    ? (isEn ? 'GPS (Requires Internet)' : 'تحديد الموقع (يتطلب إنترنت)')
                    : (isEn ? 'Auto Detect (GPS)' : 'تحديد الموقع تلقائياً (GPS)'))}
            </span>
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          <SearchableSelect
            label="الدولة"
            value={settings.country}
            options={countryOptions}
            onChange={handleCountryChange}
            placeholder="اختر الدولة..."
            isEn={isEn}
            icon={Globe}
          />

          <SearchableSelect
            label="المدينة"
            value={settings.city}
            options={cityOptions}
            onChange={handleCityChange}
            placeholder={settings.country ? 'اختر المدينة...' : 'يرجى اختيار الدولة أولاً'}
            disabled={!settings.country}
            isEn={isEn}
            icon={MapPin}
          />
        </div>
      </div>

      {/* SECTION 2: Backgrounds & Theme */}
      <div className="bento-card" style={{ padding: '24px', borderRadius: '20px', position: 'relative', zIndex: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <Video size={22} style={{ color: '#ffffff' }} />
          <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '700', color: '#ffffff' }}>
            المظهر وخلفية الموقع الحية
          </h3>
        </div>

        {!isOnline && (
          <div
            style={{
              padding: '10px 16px',
              borderRadius: '12px',
              marginBottom: '16px',
              fontSize: '0.84rem',
              backgroundColor: 'rgba(234, 179, 8, 0.12)',
              border: '1px solid rgba(234, 179, 8, 0.25)',
              color: '#fde047',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>{isEn ? 'Offline mode active: Image wallpapers are automatically used because live video streams require an internet connection.' : 'أنت في وضع عدم الاتصال: تم تفعيل خلفية الصور تلقائياً نظراً لأن البث المباشر يتطلب اتصالاً بالإنترنت.'}</span>
          </div>
        )}

        {/* Background Mode Selector Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '20px' }}>
          {/* Makkah Stream Card */}
          <div
            onClick={isOnline ? () => handleInputChange('bgMode', 'makkah') : undefined}
            className={`option-tile ${settings.bgMode === 'makkah' && isOnline ? 'active' : ''}`}
            title={!isOnline ? (isEn ? 'Live stream requires internet connection' : 'البث المباشر يتطلب اتصالاً بالإنترنت') : ''}
            style={{
              padding: '16px',
              borderRadius: '14px',
              cursor: isOnline ? 'pointer' : 'not-allowed',
              opacity: isOnline ? 1 : 0.45,
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            {isOnline ? (
              <Video size={20} style={{ color: settings.bgMode === 'makkah' ? '#ffffff' : '#a3a3a3' }} />
            ) : (
              <Lock size={20} style={{ color: '#eab308' }} />
            )}
            <div>
              <div style={{ fontWeight: '700', color: '#ffffff', fontSize: '0.95rem' }}>
                {isEn ? 'Makkah Live Stream' : 'بث الحرم المكي'}
              </div>
              <div style={{ fontSize: '0.78rem', color: isOnline ? (settings.bgMode === 'makkah' ? '#e5e5e5' : '#a3a3a3') : '#fde047' }}>
                {isOnline
                  ? (isEn ? 'High definition live stream' : 'بث مباشر عالي الدقة للكعبة المشرفة')
                  : (isEn ? 'Locked offline (Requires Internet)' : 'مقفل في وضع عدم الاتصال (يتطلب إنترنت)')}
              </div>
            </div>
          </div>

          {/* Madinah Stream Card */}
          <div
            onClick={isOnline ? () => handleInputChange('bgMode', 'madinah') : undefined}
            className={`option-tile ${settings.bgMode === 'madinah' && isOnline ? 'active' : ''}`}
            title={!isOnline ? (isEn ? 'Live stream requires internet connection' : 'البث المباشر يتطلب اتصالاً بالإنترنت') : ''}
            style={{
              padding: '16px',
              borderRadius: '14px',
              cursor: isOnline ? 'pointer' : 'not-allowed',
              opacity: isOnline ? 1 : 0.45,
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            {isOnline ? (
              <Video size={20} style={{ color: settings.bgMode === 'madinah' ? '#ffffff' : '#a3a3a3' }} />
            ) : (
              <Lock size={20} style={{ color: '#eab308' }} />
            )}
            <div>
              <div style={{ fontWeight: '700', color: '#ffffff', fontSize: '0.95rem' }}>
                {isEn ? 'Madinah Live Stream' : 'بث المسجد النبوي'}
              </div>
              <div style={{ fontSize: '0.78rem', color: isOnline ? (settings.bgMode === 'madinah' ? '#e5e5e5' : '#a3a3a3') : '#fde047' }}>
                {isOnline
                  ? (isEn ? 'High definition live stream' : 'بث مباشر للحرم المدني الشريف')
                  : (isEn ? 'Locked offline (Requires Internet)' : 'مقفل في وضع عدم الاتصال (يتطلب إنترنت)')}
              </div>
            </div>
          </div>

          {/* Custom Image Card */}
          <div
            onClick={() => handleInputChange('bgMode', 'custom_image')}
            className={`option-tile ${settings.bgMode === 'custom_image' ? 'active' : ''}`}
            style={{
              padding: '16px',
              borderRadius: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <ImageIcon size={20} style={{ color: settings.bgMode === 'custom_image' ? '#ffffff' : '#a3a3a3' }} />
            <div>
              <div style={{ fontWeight: '700', color: '#ffffff', fontSize: '0.95rem' }}>{isEn ? 'Nature & Custom Wallpaper' : 'خلفية الطبيعة والصور'}</div>
              <div style={{ fontSize: '0.78rem', color: settings.bgMode === 'custom_image' ? '#e5e5e5' : '#a3a3a3' }}>{isEn ? 'Built-in nature meadow and custom photos' : 'صورة طبيعية افتراضية وصور من جهازك'}</div>
            </div>
          </div>
        </div>

        {/* Custom Image Uploader & Gallery (Shown when Custom Image mode is active) */}
        {settings.bgMode === 'custom_image' && (
          <div
            className="sub-glass-card"
            style={{
              padding: '18px',
              borderRadius: '14px',
              marginBottom: '20px',
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files?.[0]) handleImageUpload(e.target.files[0]);
                e.target.value = '';
              }}
            />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: '600', color: '#e5e5e5' }}>{isEn ? 'Saved Wallpapers' : 'الصور المحفوظة'}</span>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {!(settings.customBgImages || []).includes('/nature-meadow.jpg') && (
                  <button
                    type="button"
                    onClick={() => {
                      const updatedList = ['/nature-meadow.jpg', ...(settings.customBgImages || [])];
                      const fresh = getSettings();
                      const updated = {
                        ...fresh,
                        ...settings,
                        customBgImages: updatedList,
                        activeCustomBgImage: '/nature-meadow.jpg',
                        bgMode: 'custom_image',
                      };
                      setSettingsState(updated);
                      saveSettings(updated);
                      if (onSettingsSaved) onSettingsSaved(updated);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-pill)',
                      backgroundColor: 'rgba(18, 18, 18, 0.75)',
                      color: '#ffffff',
                      border: '1px solid rgba(255, 255, 255, 0.18)',
                      fontWeight: '600',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                    }}
                  >
                    <span>{isEn ? 'Add Nature Wallpaper' : 'إضافة صورة الطبيعة الافتراضية'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-pill)',
                    backgroundColor: '#ffffff',
                    color: '#000000',
                    border: 'none',
                    fontWeight: '700',
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                  }}
                >
                  <Upload size={14} />
                  <span>{isEn ? 'Upload New Image' : 'رفع صورة جديدة'}</span>
                </button>
              </div>
            </div>

            {/* Gallery Grid */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {(settings.customBgImages || []).length === 0 ? (
                <div style={{ width: '100%', textAlign: 'center', padding: '24px', color: '#737373', fontSize: '0.88rem' }}>
                  {isEn ? 'No images uploaded yet.' : 'لم ترفع أي صور بعد. اضغط على "رفع صورة جديدة" لاختيار صورة من جهازك.'}
                </div>
              ) : (
                settings.customBgImages.map((img, i) => {
                  const isSelected = settings.activeCustomBgImage === img;
                  return (
                    <div
                      key={i}
                      onClick={() => handleInputChange('activeCustomBgImage', img)}
                      style={{
                        position: 'relative',
                        width: '110px',
                        height: '74px',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        border: isSelected ? '2.5px solid #ffffff' : '1px solid rgba(255, 255, 255, 0.25)',
                        boxShadow: isSelected ? '0 0 0 2px rgba(255, 255, 255, 0.4), 0 8px 24px rgba(0, 0, 0, 0.7)' : 'none',
                        transform: isSelected ? 'scale(1.03)' : 'scale(1)',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <img src={img} alt="Bg option" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      
                      {/* Active Selection Checkmark Badge */}
                      {isSelected && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '5px',
                            left: '5px',
                            backgroundColor: '#ffffff',
                            color: '#000000',
                            borderRadius: '50%',
                            width: '20px',
                            height: '20px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.6)',
                            zIndex: 3,
                          }}
                        >
                          <Check size={12} strokeWidth={3} />
                        </div>
                      )}

                      {img === '/nature-meadow.jpg' && (
                        <div
                          style={{
                            position: 'absolute',
                            bottom: '3px',
                            left: '3px',
                            right: '3px',
                            backgroundColor: 'rgba(0, 0, 0, 0.75)',
                            color: '#ffffff',
                            fontSize: '0.66rem',
                            fontWeight: '700',
                            textAlign: 'center',
                            borderRadius: '4px',
                            padding: '2px',
                          }}
                        >
                          {isEn ? 'Nature Meadow' : 'طبيعة وورود'}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={(e) => handleDeleteImage(img, e)}
                        style={{
                          position: 'absolute',
                          top: '4px',
                          right: '4px',
                          backgroundColor: 'rgba(239, 68, 68, 0.85)',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '50%',
                          width: '20px',
                          height: '20px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                        title={isEn ? 'Delete image' : 'حذف الصورة'}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Secondary Options: Time Format & Language */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: '600', color: '#e5e5e5', marginBottom: '8px' }}>
              نظام عرض الوقت
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {['12', '24'].map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => handleInputChange('timeFormat', fmt)}
                  className="option-tile"
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '10px',
                    backgroundColor: settings.timeFormat === fmt ? 'rgba(255, 255, 255, 0.2) !important' : 'rgba(18, 18, 18, 0.75) !important',
                    border: `1px solid ${settings.timeFormat === fmt ? '#ffffff' : 'rgba(255, 255, 255, 0.14)'} !important`,
                    color: settings.timeFormat === fmt ? '#ffffff' : '#d4d4d4',
                    fontWeight: '700',
                    cursor: 'pointer',
                    fontSize: '0.88rem',
                  }}
                >
                  {fmt === '12' ? '12 ساعة (ص / م)' : '24 ساعة'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: '600', color: '#e5e5e5', marginBottom: '8px' }}>
              لغة الواجهة
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[
                { id: 'ar', label: 'العربية' },
                { id: 'en', label: 'English' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleInputChange('language', item.id)}
                  className="option-tile"
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '10px',
                    backgroundColor: settings.language === item.id ? 'rgba(255, 255, 255, 0.2) !important' : 'rgba(18, 18, 18, 0.75) !important',
                    border: `1px solid ${settings.language === item.id ? '#ffffff' : 'rgba(255, 255, 255, 0.14)'} !important`,
                    color: settings.language === item.id ? '#ffffff' : '#d4d4d4',
                    fontWeight: '700',
                    cursor: 'pointer',
                    fontSize: '0.88rem',
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3: Sheikh Muneer Gemini API Key */}
      <div className="bento-card" style={{ padding: '24px', borderRadius: '20px', position: 'relative', zIndex: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <Key size={22} style={{ color: '#ffffff' }} />
          <div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '700', color: '#ffffff' }}>
              مفتاح الذكاء الاصطناعي (الشيخ منير)
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: '#a3a3a3' }}>
              لتفعيل الردود الذكية والفتاوى والأذكار الشخصية
            </p>
          </div>
        </div>

        <div style={{ position: 'relative', width: '100%', marginBottom: '10px' }}>
          <input
            type={showGeminiKey ? 'text' : 'password'}
            value={settings.geminiApiKey || ''}
            onChange={(e) => handleInputChange('geminiApiKey', e.target.value)}
            placeholder="AIzaSy..."
            className="sub-glass-card"
            style={{
              width: '100%',
              padding: '12px 44px 12px 16px',
              borderRadius: '12px',
              color: '#ffffff',
              fontSize: '0.92rem',
              outline: 'none',
              fontFamily: 'monospace',
              boxSizing: 'border-box',
            }}
          />
          <button
            type="button"
            onClick={() => setShowGeminiKey((prev) => !prev)}
            style={{
              position: 'absolute',
              top: '50%',
              left: '12px',
              transform: 'translateY(-50%)',
              background: 'transparent',
              border: 'none',
              color: '#a3a3a3',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            {showGeminiKey ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        <div style={{ fontSize: '0.82rem', color: '#a3a3a3' }}>
          يمكنك الحصول على مفتاح Gemini مجاناً بنقرة واحدة من{' '}
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#ffffff', textDecoration: 'underline', fontWeight: '700' }}
          >
            Google AI Studio
          </a>
          . يُحفظ المفتاح محلياً على جهازك فقط.
        </div>
      </div>

      {/* SECTION: Browser Notifications & Alerts (Test Notification) */}
      <div className="bento-card" style={{ padding: '24px', borderRadius: '20px', position: 'relative', zIndex: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BellRing size={22} style={{ color: '#ffffff' }} />
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '700', color: '#ffffff' }}>
              {isEn ? 'Browser Notifications & External Alerts' : 'إشعارات المتصفح والتنبيهات البارزة'}
            </h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={async () => {
                if (notifPermission === 'default') {
                  const perm = await requestNotificationsPermission();
                  setNotifPermission(perm);
                }
              }}
              style={{
                fontSize: '0.78rem',
                padding: '4px 12px',
                borderRadius: 'var(--radius-pill)',
                backgroundColor:
                  notifPermission === 'granted'
                    ? 'rgba(34, 197, 94, 0.15)'
                    : notifPermission === 'denied'
                    ? 'rgba(239, 68, 68, 0.15)'
                    : notifPermission === 'unsupported'
                    ? 'rgba(115, 115, 115, 0.15)'
                    : 'rgba(234, 179, 8, 0.15)',
                color:
                  notifPermission === 'granted'
                    ? '#4ade80'
                    : notifPermission === 'denied'
                    ? '#f87171'
                    : notifPermission === 'unsupported'
                    ? '#a3a3a3'
                    : '#fde047',
                border: `1px solid ${
                  notifPermission === 'granted'
                    ? 'rgba(34, 197, 94, 0.3)'
                    : notifPermission === 'denied'
                    ? 'rgba(239, 68, 68, 0.3)'
                    : notifPermission === 'unsupported'
                    ? 'rgba(115, 115, 115, 0.3)'
                    : 'rgba(234, 179, 8, 0.3)'
                }`,
                fontWeight: '600',
                cursor: notifPermission === 'default' ? 'pointer' : 'default',
              }}
            >
              {notifPermission === 'granted'
                ? (isEn ? '● Active & Allowed' : '● مفعلة ومسموح بها')
                : notifPermission === 'denied'
                ? (isEn ? '● Blocked in Browser' : '● محظورة في إعدادات المتصفح')
                : notifPermission === 'unsupported'
                ? (isEn ? '● Unsupported' : '● غير مدعومة بالمتصفح')
                : (isEn ? '● Click to Enable' : '● بانتظار الموافقة')}
            </button>
          </div>
        </div>

        <p style={{ margin: 0, fontSize: '0.85rem', color: '#a3a3a3', lineHeight: '1.6' }}>
          {isEn
            ? 'Receive live alerts for adhan times and high-priority prayer reminders directly on your device when outside the website.'
            : 'استلام تنبيهات حية لأوقات الأذان والتحذيرات عالية الأهمية لفوات الصلاة على جهازك عند تواجدك خارج الموقع.'}
        </p>
      </div>

      {/* SECTION 4: Data Management & Backup */}
      <div className="bento-card" style={{ padding: '24px', borderRadius: '20px', position: 'relative', zIndex: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <FileJson size={22} style={{ color: '#ffffff' }} />
          <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '700', color: '#ffffff' }}>
            النسخ الاحتياطي وإدارة البيانات
          </h3>
        </div>

        <input
          ref={importInputRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={handleImportBackup}
        />

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
          <button
            type="button"
            onClick={handleExportBackup}
            className="sub-glass-card"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              borderRadius: '12px',
              color: '#ffffff',
              fontWeight: '600',
              fontSize: '0.88rem',
              cursor: 'pointer',
            }}
          >
            <Download size={16} />
            <span>تصدير نسخة احتياطية (JSON)</span>
          </button>

          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            className="sub-glass-card"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              borderRadius: '12px',
              color: '#ffffff',
              fontWeight: '600',
              fontSize: '0.88rem',
              cursor: 'pointer',
            }}
          >
            <UploadCloud size={16} />
            <span>استيراد نسخة احتياطية</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setResetType('prayers');
              setShowResetModal(true);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              borderRadius: '12px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#ef4444',
              fontWeight: '600',
              fontSize: '0.88rem',
              cursor: 'pointer',
              marginRight: 'auto',
            }}
          >
            <Trash2 size={16} />
            <span>مسح سجل الصلوات</span>
          </button>
        </div>
      </div>

      {/* SECTION 5: Keyboard Shortcuts & Quick Controls */}
      <div className="bento-card" style={{ padding: '24px', borderRadius: '20px', position: 'relative', zIndex: 3 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Keyboard size={22} style={{ color: '#ffffff' }} />
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '700', color: '#ffffff' }}>
                {isEn ? 'Keyboard Shortcuts & Quick Controls' : 'اختصارات لوحة المفاتيح والتحكم السريع'}
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: '#a3a3a3' }}>
                {isEn
                  ? 'Direct shortcuts for quick navigation (1-5), live scenes, audio, and focus mode without mouse.'
                  : 'دليل اختصارات الكيبورد المباشرة للتنقل بين الصفحات (1-5)، والتبديل بين المشاهد، والتحكم بالصوت ووضع التركيز.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowShortcutsModal(true)}
            className="sub-glass-card"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 22px',
              borderRadius: '12px',
              color: '#ffffff',
              fontWeight: '600',
              fontSize: '0.88rem',
              cursor: 'pointer',
            }}
            id="btn-open-keyboard-shortcuts-modal"
          >
            <Keyboard size={16} />
            <span>{isEn ? 'View Shortcuts Map' : 'عرض خريطة الاختصارات'}</span>
          </button>
        </div>
      </div>

      {/* Keyboard Shortcuts Map Modal */}
      {showShortcutsModal &&
        ReactDOM.createPortal(
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              backgroundColor: 'rgba(5, 6, 10, 0.85)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
            }}
            onClick={() => setShowShortcutsModal(false)}
          >
            <div
              style={{
                position: 'relative',
                width: 'min(94%, 620px)',
                maxHeight: '90vh',
                overflowY: 'auto',
                backgroundColor: 'rgba(18, 20, 28, 0.96)',
                border: '1px solid rgba(255, 255, 255, 0.14)',
                borderRadius: '24px',
                padding: '28px',
                boxShadow: '0 30px 80px rgba(0, 0, 0, 0.85)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '20px',
                  paddingBottom: '14px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Keyboard size={22} style={{ color: 'var(--status-on-time, #ffffff)' }} />
                  <div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: '800', margin: 0, color: '#ffffff' }}>
                      {isEn ? 'Control Map & Keyboard Shortcuts' : 'دليل لوحة التحكم والمفاتيح السريعة'}
                    </h3>
                    <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: '#9ca3af' }}>
                      {isEn ? 'Universal quick shortcuts available throughout the app' : 'اختصارات سريعة ومتاحة في جميع شاشات التطبيق'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowShortcutsModal(false)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '50%',
                    width: '34px',
                    height: '34px',
                    color: '#ffffff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Category 1: Direct Page Navigation */}
              <div style={{ marginBottom: '20px' }}>
                <div
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: '800',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'var(--status-on-time, #ffffff)',
                    marginBottom: '10px',
                  }}
                >
                  {isEn ? 'Direct Page & Section Navigation' : 'التنقل المباشر بين الصفحات والأقسام'}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 16px',
                      backgroundColor: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: '12px',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                    }}
                  >
                    <span style={{ fontSize: '0.88rem', color: '#e5e7eb', fontWeight: '600' }}>
                      {isEn ? '1. Five Daily Prayers Tracker' : '١. تتبع الصلوات الخمس والمواقيت'}
                    </span>
                    <kbd className="kbd-badge">1</kbd>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 16px',
                      backgroundColor: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: '12px',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                    }}
                  >
                    <span style={{ fontSize: '0.88rem', color: '#e5e7eb', fontWeight: '600' }}>
                      {isEn ? '2. Smart Assistant (Sheikh Muneer)' : '٢. الدردشة الذكية — الشيخ منير'}
                    </span>
                    <kbd className="kbd-badge">2</kbd>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 16px',
                      backgroundColor: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: '12px',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                    }}
                  >
                    <span style={{ fontSize: '0.88rem', color: '#e5e7eb', fontWeight: '600' }}>
                      {isEn ? '3. Book Reader & Daily Ward' : '٣. ورد القراءة وقارئ الكتب'}
                    </span>
                    <kbd className="kbd-badge">3</kbd>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 16px',
                      backgroundColor: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: '12px',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                    }}
                  >
                    <span style={{ fontSize: '0.88rem', color: '#e5e7eb', fontWeight: '600' }}>
                      {isEn ? '4. Electronic Tasbeeh & Adhkar' : '٤. المسبحة الإلكترونية والأذكار'}
                    </span>
                    <kbd className="kbd-badge">4</kbd>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 16px',
                      backgroundColor: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: '12px',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                    }}
                  >
                    <span style={{ fontSize: '0.88rem', color: '#e5e7eb', fontWeight: '600' }}>
                      {isEn ? '5. Audio Library & Player' : '٥. مشغل الصوتيات والمكتبة'}
                    </span>
                    <kbd className="kbd-badge">5</kbd>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 16px',
                      backgroundColor: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: '12px',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                    }}
                  >
                    <span style={{ fontSize: '0.88rem', color: '#e5e7eb', fontWeight: '600' }}>
                      {isEn ? '6. Settings & Location' : '٦. الإعدادات والموقع الجغرافي'}
                    </span>
                    <kbd className="kbd-badge">6</kbd>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 16px',
                      backgroundColor: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: '12px',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                    }}
                  >
                    <span style={{ fontSize: '0.88rem', color: '#e5e7eb', fontWeight: '600' }}>
                      {isEn ? 'Cycle forward / backward between tabs' : 'التنقل المتسلسل للأمام أو الخلف بين الأقسام'}
                    </span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <kbd className="kbd-badge">UP</kbd>
                      <kbd className="kbd-badge">DOWN</kbd>
                    </div>
                  </div>
                </div>
              </div>

              {/* Category 2: Live Streams & Scenes */}
              <div style={{ marginBottom: '20px' }}>
                <div
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: '800',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'var(--status-on-time, #ffffff)',
                    marginBottom: '10px',
                  }}
                >
                  {isEn ? 'Live Streams & Scene Controls' : 'المشاهد الحية والبث المباشر'}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 16px',
                      backgroundColor: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: '12px',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                    }}
                  >
                    <span style={{ fontSize: '0.88rem', color: '#e5e7eb', fontWeight: '600' }}>
                      {isEn ? 'Switch between live scenes & backgrounds' : 'التبديل الفوري بين المشاهد والخلفيات الحية'}
                    </span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <kbd className="kbd-badge">LEFT</kbd>
                      <kbd className="kbd-badge">RIGHT</kbd>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 16px',
                      backgroundColor: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: '12px',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                    }}
                  >
                    <span style={{ fontSize: '0.88rem', color: '#e5e7eb', fontWeight: '600' }}>
                      {isEn ? 'Instant Re-sync live stream to present moment' : 'المزامنة الفورية مع نقطة البث المباشر'}
                    </span>
                    <kbd className="kbd-badge">L</kbd>
                  </div>
                </div>
              </div>

              {/* Category 3: Audio & Visual Controls */}
              <div>
                <div
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: '800',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'var(--status-on-time, #ffffff)',
                    marginBottom: '10px',
                  }}
                >
                  {isEn ? 'Audio & Visual Controls' : 'التحكم بالصوت والعرض'}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 16px',
                      backgroundColor: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: '12px',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                    }}
                  >
                    <span style={{ fontSize: '0.88rem', color: '#e5e7eb', fontWeight: '600' }}>
                      {isEn ? 'Smooth Audio Mute / Unmute' : 'كتم / تشغيل صوت البثوث بنعومة'}
                    </span>
                    <kbd className="kbd-badge">M</kbd>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 16px',
                      backgroundColor: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: '12px',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                    }}
                  >
                    <span style={{ fontSize: '0.88rem', color: '#e5e7eb', fontWeight: '600' }}>
                      {isEn ? 'Toggle Wallpaper Focus Mode' : 'وضع التركيز الكامل ومشاهدة البث دون عناصر'}
                    </span>
                    <kbd className="kbd-badge">F</kbd>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Reset Confirmation Modal */}
      {typeof document !== 'undefined' && showResetModal && ReactDOM.createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            backgroundColor: 'rgba(0, 0, 0, 0.80)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            animation: 'fadeIn 0.2s ease-out',
          }}
          onClick={() => setShowResetModal(false)}
        >
          <div
            style={{
              width: 'min(90%, 460px)',
              backgroundColor: '#121212',
              borderRadius: '18px',
              padding: '24px',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
              textAlign: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <AlertTriangle size={36} style={{ color: '#ef4444', margin: '0 auto 12px auto' }} />
            <h3 style={{ color: '#ffffff', fontSize: '1.2rem', fontWeight: '700', marginBottom: '8px' }}>
              تأكيد مسح البيانات
            </h3>
            <p style={{ color: '#a3a3a3', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '24px' }}>
              هل أنت متأكد من رغبتك في مسح سجل الصلوات؟ لا يمكن التراجع عن هذا الإجراء إلا إذا كنت تحتفظ بنسخة احتياطية.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={handleExecuteReset}
                style={{
                  padding: '10px 24px',
                  borderRadius: 'var(--radius-pill)',
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: '700',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                }}
              >
                نعم، مسح البيانات
              </button>
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                style={{
                  padding: '10px 24px',
                  borderRadius: 'var(--radius-pill)',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: '600',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                }}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
