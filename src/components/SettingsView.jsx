import React, { useState, useEffect } from 'react';
import {
  Key,
  Globe,
  CheckCircle,
  Eye,
  EyeOff,
  ShieldCheck,
  MapPin,
  RefreshCw,
  Search,
  ChevronDown,
  Check,
  Building2,
  Image as ImageIcon,
  XCircle,
  Download,
  Upload,
  Plus,
  Trash2,
  Video,
  AlertCircle,
} from 'lucide-react';
import {
  getSettings,
  saveSettings,
  getCityNowDate,
  clearAllRecords,
} from '../services/storage';

export default function SettingsView({ onSettingsSaved }) {
  const [settings, setSettingsState] = useState(getSettings);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showTavilyKey, setShowTavilyKey] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Dynamic Countries and Cities API State (Zero Manual Entry)
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
    setSaveSuccessMsg('تم الحفظ الفوري تلقائياً ✓');
    setTimeout(() => setSaveSuccessMsg(''), 2500);
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

  const handleCountrySelect = (selectedCountry) => {
    const countryObj = Array.isArray(countriesList) ? countriesList.find(
      (c) => c.country.toLowerCase() === selectedCountry.toLowerCase()
    ) : null;
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
    setSaveSuccessMsg('تم تحديث الموقع وحفظ التوقيت فورياً ✓');
    setTimeout(() => setSaveSuccessMsg(''), 3000);
  };

  // Selected Country Object & Cities
  const countryOptions = Array.isArray(countriesList) ? countriesList.map((c) => c.country) : [];
  const selectedCountryObj = Array.isArray(countriesList) ? countriesList.find(
    (c) => c.country.toLowerCase() === (settings.country || 'tunisia').toLowerCase()
  ) : null;
  const availableCities = selectedCountryObj?.cities || [];

  return (
    <div className="settings-view">
      <div className="section-header">
        <div>
          <h2 className="section-title">إعدادات التطبيق وتدفق البيانات</h2>
          <p className="section-subtitle">
            إدارة مفاتيح API الخاصة بالذكاء الاصطناعي وتحديد الموقع الجغرافي.
          </p>
        </div>

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
          <span>{saveSuccessMsg || 'حفظ تلقائي فوري مفعّل'}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        {/* Automated API Country & City Searchable Selection Card */}
        <div className="bento-card" style={{ gridColumn: '1 / -1' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MapPin size={20} style={{ color: 'var(--status-on-time)' }} />
            <span>نظام القوائم التفاعلية الفاخرة للبلدان والمدن (حفظ تلقائي فوري)</span>
          </h3>

          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
            اختر دولتك ومدينتك عبر القوائم التفاعلية لترحيل وتحديث المواقيت والساعة فورياً دون الحاجة للضغط على أي زر.
          </p>

          {isLoadingCountries ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.9rem', padding: '16px 0' }}>
              <RefreshCw size={16} className="spin" />
              <span>جاري تحميل قائمة كافة دول ومدن العالم تلقائياً...</span>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
              {/* Country Custom Searchable Select */}
              <SearchableSelect
                label="اختر الدولة (Country)"
                value={settings.country || 'Tunisia'}
                options={countryOptions.length > 0 ? countryOptions : ['Tunisia', 'Saudi Arabia', 'Egypt', 'Algeria', 'Morocco']}
                onChange={handleCountrySelect}
                placeholder="اختر الدولة..."
                searchPlaceholder="ابحث عن اسم الدولة..."
                icon={Globe}
              />

              {/* City Custom Searchable Select */}
              <SearchableSelect
                label="اختر المدينة (City)"
                value={settings.city || (availableCities[0] || 'Sfax')}
                options={availableCities.length > 0 ? availableCities : [settings.city || 'Sfax']}
                onChange={(selectedCity) => handleInputChange('city', selectedCity)}
                placeholder="اختر المدينة..."
                searchPlaceholder="ابحث عن اسم المدينة..."
                icon={Building2}
              />
            </div>
          )}
        </div>

        {/* Unified Background Mode Selector Card (Full Width) */}
        <div className="bento-card" style={{ gridColumn: '1 / -1' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: '700', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Video size={20} style={{ color: 'var(--status-on-time)' }} />
            <span>تخصيص نمط ونوع خلفية الموقع الحية</span>
          </h3>

          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '18px' }}>
            اختر نوع ونمط الخلفية التي ترغب بعرضها خلف البطاقات الزجاجية (بث حي من الحرم المكي أو المدينة النبوية أو رفع صور مخصصة):
          </p>

          {/* 3 Main Background Options Small Pill Buttons */}
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
              <span>بث مباشر للحرم المكي (افتراضي)</span>
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
              <span>بث مباشر للمدينة النبوية</span>
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
              <span>صورة مخصصة من حاسوبك</span>
            </button>
          </div>

          {(settings.bgMode || 'makkah') === 'makkah' && (
            <div style={{ backgroundColor: 'var(--bg-primary)', padding: '14px 18px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16, 185, 129, 0.3)', fontSize: '0.85rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CheckCircle size={18} style={{ color: 'var(--status-on-time)', flexShrink: 0 }} />
              <span>البث المباشر المكرّم للحرم المكي الشريف يعمل الآن كفيديو أساسي افتراضي في خلفية الموقع.</span>
            </div>
          )}

          {settings.bgMode === 'madinah' && (
            <div style={{ backgroundColor: 'var(--bg-primary)', padding: '14px 18px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16, 185, 129, 0.3)', fontSize: '0.85rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CheckCircle size={18} style={{ color: 'var(--status-on-time)', flexShrink: 0 }} />
              <span>البث المباشر المكرّم للمدينة النبوية والمسجد النبوي الشريف يعمل الآن كفيديو حي في خلفية الموقع.</span>
            </div>
          )}

          {settings.bgMode === 'custom_image' && (
            <div>
              {(!settings.customBgImages || settings.customBgImages.length === 0 || !settings.activeCustomBgImage) && (
                <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.12)', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(245, 158, 11, 0.3)', color: 'var(--status-late)', fontSize: '0.85rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />
                  <span>تنبيه: لم تدرج أو تحدد صورة بعد. تظل الخلفية السابقة كما هي حتى تقوم برفع أو اختيار صورة فتتحول إليها بسلاسة (Fade).</span>
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
                    boxShadow: isDraggingOver ? '0 0 20px rgba(16, 185, 129, 0.3)' : 'none',
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
                    {isDraggingOver ? 'أسقط ملفات الصور هنا فورياً' : 'قم بسحب وإسقاط ملفات الصور هنا'}
                  </span>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    أو انقر هنا لاستعراض واختيار الصور من جهازك (JPG, PNG, WEBP)
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
                    الصور المضافة (انقر على أي صورة لتحديدها كخلفية نشطة):
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
                            boxShadow: isActive ? '0 0 16px rgba(16, 185, 129, 0.4)' : 'none',
                            transition: 'all 0.2s ease',
                          }}
                        >
                          <img
                            src={imgUrl}
                            alt={`خلفية ${index + 1}`}
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
                            title="حذف هذه الصورة"
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

        {/* API Keys Card */}
        <div className="bento-card">
          <h3 style={{ fontSize: '1.15rem', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Key size={20} style={{ color: 'var(--status-on-time)' }} />
            <span>مفاتيح API الذكية (Gemini & Tavily Search)</span>
          </h3>

          {/* Gemini API Key */}
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label">مفتاح Gemini API (للدردشة الذكية والذكاء الاصطناعي):</label>
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
                  left: '12px',
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
              يُحفظ المفتاح محليًا في المتصفح فقط ولن يُرسل لأي خادم خارجي سوى Google Gemini.
            </span>
          </div>

          {/* Tavily Search API Key */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">مفتاح Tavily API (للبحث الذكي المباشر وتحديث مواقيت الصلاة):</label>
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
                  left: '12px',
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
              مفتاح خادم Tavily للبحث المباشر في الويب وجلب أحدث مواقيت الصلاة لمدينتك تلقائياً وبدقة فائقة.
            </span>
          </div>
        </div>

        {/* Manual Source Link Card */}
        <div className="bento-card">
          <h3 style={{ fontSize: '1.15rem', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Globe size={20} />
            <span>رابط موقع مواقيت الصلاة المصدر (إدخال يدوي اختياري)</span>
          </h3>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">رابط الصفحة المصدر (يُترك فارغاً افتراضياً):</label>
            <input
              type="text"
              className="form-input"
              value={settings.prayerSourceUrl || ''}
              onChange={(e) => handleInputChange('prayerSourceUrl', e.target.value)}
              placeholder="مثال: https://timesprayer.com/prayer-times-in-sfax.html (اختياري)"
              id="input-prayer-source-url"
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px', display: 'block' }}>
              اختياري. إذا تُرِك فارغاً، يتم جلب مواقيت الصلاة عبر البحث العام في الويب أو الخدمة الرسمية مباشرة.
            </span>
          </div>
        </div>

        {/* Data Reset & Purge Demo Data Card (Aligned in single row alongside API Keys & Source Link) */}
        <div className="bento-card">
          <h3 style={{ fontSize: '1.15rem', fontWeight: '700', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Trash2 size={20} style={{ color: 'var(--status-qada)' }} />
            <span>مسح البيانات التجريبية والبدء من جديد</span>
          </h3>

          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            تم إلغاء البيانات الزائفة تماماً. انقر هنا لمسح وتصفير كافة سجلات التتبع التجريبية القديمة والبدء بسجلاتك الحقيقية 100%.
          </p>

          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              clearAllRecords();
              setSaveSuccessMsg('تم مسح وتصفير كافة البيانات التجريبية بنجاح ✓');
              setTimeout(() => setSaveSuccessMsg(''), 3000);
            }}
            style={{ fontSize: '0.84rem', padding: '8px 18px', color: 'var(--status-qada)', borderColor: 'rgba(239, 68, 68, 0.4)' }}
            id="btn-clear-demo-records"
          >
            <Trash2 size={15} />
            <span>تصفير وتطهير سجلات التتبع</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function SearchableSelect({ label, value, options, onChange, placeholder, searchPlaceholder, icon: IconComp }) {
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
                style={{ paddingRight: '32px', fontSize: '0.85rem' }}
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
              />
              <Search size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
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
                  لا توجد نتائج مطابقة
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
