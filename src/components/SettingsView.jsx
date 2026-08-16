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
} from 'lucide-react';
import {
  getSettings,
  saveSettings,
  getCityNowDate,
  clearAllRecords,
  getPrayerTimesCache,
  savePrayerTimesCache,
  toWesternDigits,
} from '../services/storage';
import { fetchPrayerTimesFromTavily } from '../services/tavilyApi';
import { getTranslation } from '../services/i18n';

export default function SettingsView({ onSettingsSaved }) {
  const [settings, setSettingsState] = useState(getSettings);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showTavilyKey, setShowTavilyKey] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isSyncingTimes, setIsSyncingTimes] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');
  const [cachedTimes, setCachedTimes] = useState(() => getPrayerTimesCache());

  const lang = settings.language || 'ar';
  const isEn = lang === 'en';
  const t = (k, fb) => getTranslation(lang, k, fb);

  // Dynamic Countries and Cities API State
  const [countriesList, setCountriesList] = useState([]);
  const [isLoadingCountries, setIsLoadingCountries] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function fetchCountriesAndCities() {
      setIsLoadingCountries(true);
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

  // Instant Auto-Save Handlers
  const handleInputChange = (field, value) => {
    setSettingsState((prev) => {
      const updated = { ...prev, [field]: value };
      saveSettings(updated);
      if (onSettingsSaved) onSettingsSaved(updated);
      return updated;
    });
    setSaveSuccessMsg(isEn ? 'Saved automatically' : 'تم الحفظ الفوري تلقائياً');
    setTimeout(() => setSaveSuccessMsg(''), 2500);
  };

  const handleCountrySelect = (selectedCountry) => {
    const countryObj = Array.isArray(countriesList)
      ? countriesList.find((c) => c.country.toLowerCase() === selectedCountry.toLowerCase())
      : null;
    const firstCity = countryObj && countryObj.cities.length > 0 ? countryObj.cities[0] : '';
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
    setSaveSuccessMsg(isEn ? 'Location updated and prayer times synced' : 'تم تحديث الموقع وحفظ التوقيت فورياً');
    setTimeout(() => setSaveSuccessMsg(''), 3000);
  };

  const handleManualSyncPrayerTimes = async () => {
    if (isSyncingTimes) return;
    setIsSyncingTimes(true);
    setSyncStatus(isEn ? 'Syncing prayer times...' : 'جاري مزامنة المواقيت...');

    const today = new Date();
    const targetDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    try {
      const res = await fetchPrayerTimesFromTavily(
        settings.tavilyApiKey,
        settings.prayerSourceUrl,
        settings.city,
        settings.country,
        targetDateStr,
        settings.geminiApiKey
      );

      if (res && res.success && res.times) {
        const hh = String(today.getHours()).padStart(2, '0');
        const mm = String(today.getMinutes()).padStart(2, '0');
        const timeNow = toWesternDigits(`${hh}:${mm}`);

        const mergedTimes = {
          ...res.times,
          timezone: res.timezone || cachedTimes?.timezone || '',
          lastSyncedDate: targetDateStr,
          lastSyncedTime: timeNow,
          source: res.source || (isEn ? 'Official Prayer Times' : 'المواقيت الرسمية'),
        };

        savePrayerTimesCache(mergedTimes);
        setCachedTimes(mergedTimes);
        setSyncStatus(isEn ? `Synced successfully at ${timeNow}` : `تمت المزامنة بنجاح في ${timeNow}`);
        setSaveSuccessMsg(isEn ? 'Prayer times synced and saved' : 'تم تحديث ومزامنة مواقيت الصلاة وحفظها بنجاح');
        setTimeout(() => setSaveSuccessMsg(''), 3000);
      } else {
        setSyncStatus(isEn ? 'Sync failed. Please check city or API keys.' : 'تعذر التحديث، يرجى التحقق من مفاتيح API واسم المدينة.');
      }
    } catch (e) {
      setSyncStatus(isEn ? 'Connection error during sync.' : 'حدث خطأ أثناء الاتصال بمزود المواقيت.');
    } finally {
      setIsSyncingTimes(false);
    }
  };

  const processFiles = (files) => {
    if (!files || files.length === 0) return;
    const validFiles = Array.from(files).filter((file) => file.type.startsWith('image/'));
    if (validFiles.length === 0) return;

    let updatedList = Array.isArray(settings.customBgImages) ? [...settings.customBgImages] : [];
    let lastLoadedUrl = '';
    let processedCount = 0;

    validFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target.result;
        if (dataUrl && !updatedList.includes(dataUrl)) {
          updatedList.push(dataUrl);
          lastLoadedUrl = dataUrl;
        }
        processedCount++;
        if (processedCount === validFiles.length) {
          handleInputChange('customBgImages', updatedList);
          if (lastLoadedUrl) {
            handleInputChange('activeCustomBgImage', lastLoadedUrl);
          }
        }
      };
      reader.readAsDataURL(file);
    });
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
  };

  // Selected Country Object & Cities
  const countryOptions = Array.isArray(countriesList) ? countriesList.map((c) => c.country) : [];
  const selectedCountryObj = Array.isArray(countriesList)
    ? countriesList.find((c) => c.country.toLowerCase() === (settings.country || 'tunisia').toLowerCase())
    : null;
  const availableCities = selectedCountryObj?.cities || [];

  return (
    <div className="settings-view">
      <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', marginBottom: '16px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'var(--status-on-time-bg)',
            color: 'var(--status-on-time)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
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
                backgroundColor: (settings.bgMode || 'makkah') === 'makkah' ? 'rgba(16, 185, 129, 0.2)' : 'var(--bg-primary)',
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
                backgroundColor: settings.bgMode === 'madinah' ? 'rgba(16, 185, 129, 0.2)' : 'var(--bg-primary)',
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
                backgroundColor: settings.bgMode === 'custom_image' ? 'rgba(16, 185, 129, 0.2)' : 'var(--bg-primary)',
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
            <div style={{ backgroundColor: 'var(--bg-primary)', padding: '14px 18px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16, 185, 129, 0.3)', fontSize: '0.85rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CheckCircle size={18} style={{ color: 'var(--status-on-time)', flexShrink: 0 }} />
              <span>{isEn ? 'Holy Makkah Live Stream is now active as primary background.' : 'البث المباشر المكرّم للحرم المكي الشريف يعمل الآن كفيديو أساسي افتراضي في خلفية الموقع.'}</span>
            </div>
          )}

          {settings.bgMode === 'madinah' && (
            <div style={{ backgroundColor: 'var(--bg-primary)', padding: '14px 18px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16, 185, 129, 0.3)', fontSize: '0.85rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
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
                      ? 'rgba(16, 185, 129, 0.12)'
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
                backgroundColor: (settings.language || 'ar') === 'ar' ? 'rgba(16, 185, 129, 0.18)' : 'rgba(255, 255, 255, 0.05)',
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
                backgroundColor: settings.language === 'en' ? 'rgba(16, 185, 129, 0.18)' : 'rgba(255, 255, 255, 0.05)',
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
              value={settings.country || 'Tunisia'}
              options={countryOptions}
              onChange={handleCountrySelect}
              placeholder={isEn ? 'Select Country...' : 'اختر الدولة...'}
              searchPlaceholder={isEn ? 'Search Country...' : 'ابحث عن الدولة...'}
              icon={Globe}
              isEn={isEn}
            />

            <SearchableSelect
              label={isEn ? 'City' : 'المدينة'}
              value={settings.city || 'Sfax'}
              options={availableCities}
              onChange={(city) => handleInputChange('city', city)}
              placeholder={isEn ? 'Select City...' : 'اختر المدينة...'}
              searchPlaceholder={isEn ? 'Search City...' : 'ابحث عن المدينة...'}
              icon={Building2}
              isEn={isEn}
            />
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
                onClick={handleManualSyncPrayerTimes}
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

            {/* Daily Auto-Sync Rule Info */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                backgroundColor: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.22)',
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
                type={showGeminiKey ? 'text' : 'password'}
                className="form-input"
                placeholder="AIzaSy..."
                value={settings.geminiApiKey || ''}
                onChange={(e) => handleInputChange('geminiApiKey', e.target.value)}
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
                type={showTavilyKey ? 'text' : 'password'}
                className="form-input"
                placeholder="tvly-..."
                value={settings.tavilyApiKey || ''}
                onChange={(e) => handleInputChange('tavilyApiKey', e.target.value)}
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
              value={settings.prayerSourceUrl || ''}
              onChange={(e) => handleInputChange('prayerSourceUrl', e.target.value)}
              placeholder="e.g. https://timesprayer.com/prayer-times-in-sfax.html"
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

        {/* Data Reset Card */}
        <div className="bento-card">
          <h3 style={{ fontSize: '1.15rem', fontWeight: '700', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Trash2 size={20} style={{ color: 'var(--status-qada)' }} />
            <span>{isEn ? 'Data Management & Reset' : 'مسح البيانات والبدء من جديد'}</span>
          </h3>

          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            {isEn ? 'Click here to clear all recorded prayer history and start completely fresh.' : 'انقر هنا لمسح وتصفير كافة سجلات التتبع المحفوظة والبدء بسجلات جديدة 100%.'}
          </p>

          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              if (window.confirm(isEn ? 'Warning: Are you sure you want to clear all prayer records?' : 'تحذير: هل أنت متأكد من مسح وتصفير جميع سجلات الصلوات؟')) {
                clearAllRecords();
                setSaveSuccessMsg(isEn ? 'All prayer records cleared successfully' : 'تم مسح وتصفير كافة البيانات بنجاح');
                setTimeout(() => setSaveSuccessMsg(''), 3000);
              }
            }}
            style={{ fontSize: '0.84rem', padding: '8px 18px', color: 'var(--status-qada)', borderColor: 'rgba(239, 68, 68, 0.4)' }}
            id="btn-clear-demo-records"
          >
            <Trash2 size={15} />
            <span>{isEn ? 'Clear All Prayer Records' : 'تصفير سجلات الصلوات'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function SearchableSelect({ label, value, options, onChange, placeholder, searchPlaceholder, icon: IconComp, isEn }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredOptions = options.filter((opt) =>
    opt.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="form-group" style={{ marginBottom: 0 }}>
      <label className="form-label">{label}:</label>
      <div className="custom-select-container">
        <div
          className="custom-select-trigger"
          onClick={() => setIsOpen(!isOpen)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {IconComp && <IconComp size={16} style={{ color: 'var(--status-on-time)' }} />}
            <span>{value || placeholder}</span>
          </div>
          <ChevronDown
            size={16}
            style={{
              transform: isOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.18s ease',
              color: 'var(--text-secondary)',
            }}
          />
        </div>

        {isOpen && (
          <div className="custom-select-menu">
            <div style={{ position: 'relative', marginBottom: '8px' }}>
              <input
                type="text"
                className="form-input"
                style={{ [isEn ? 'paddingLeft' : 'paddingRight']: '32px', fontSize: '0.85rem' }}
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
              />
              <Search size={14} style={{ position: 'absolute', [isEn ? 'left' : 'right']: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            </div>

            <div className="custom-select-options">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((opt) => (
                  <div
                    key={opt}
                    className={`custom-select-option ${value === opt ? 'active' : ''}`}
                    onClick={() => {
                      onChange(opt);
                      setIsOpen(false);
                      setSearchTerm('');
                    }}
                  >
                    <span>{opt}</span>
                    {value === opt && <Check size={14} />}
                  </div>
                ))
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
