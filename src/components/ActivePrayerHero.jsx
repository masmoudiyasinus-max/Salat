import React from 'react';
import {
  CheckCircle,
  Clock,
  XCircle,
  Lock,
  Navigation,
  Settings,
} from 'lucide-react';
import { formatTimeDisplay, getRecords, saveRecords } from '../services/storage';
import { DATA_STATUS } from '../services/dataReadiness';
import LiveClock from './LiveClock';
import LiveCountdown from './LiveCountdown';
import LiveProgressBar from './LiveProgressBar';

export default function ActivePrayerHero({
  isDataReady,
  prayerTimes,
  settings,
  selectedDate,
  activeObligatoryId,
  activePrayerObj,
  activeAdhanStr,
  isActiveCompleted,
  activeRec,
  activeStatus,
  nextOblId,
  nextPrayerObj,
  nextAdhanStr,
  currentOblDateObj,
  nextOblDateObj,
  timerInfo,
  isNextPrayerTimeArrived,
  isMissedAndLocked,
  isReToggleLocked,
  getToggleHistory,
  saveToggleHistory,
  onRecordUpdated,
  setRecords,
  handleMarkPerformed,
  onOpenModal,
  onQuickAutoDetect,
  isDetectingLocation,
  onNavigateToSettings,
  t,
}) {
  const isEn = settings?.language === 'en';
  const dataStatus = isDetectingLocation
    ? DATA_STATUS.LOADING
    : (isDataReady && activePrayerObj ? DATA_STATUS.READY : DATA_STATUS.UNAVAILABLE);

  return (
    <div
      className="bento-card active-prayer-hero-card"
      style={{
        padding: '28px 36px',
        width: 'fit-content',
        minWidth: 'min(92vw, 520px)',
        maxWidth: '600px',
        margin: '0 auto',
        background: 'rgba(10, 10, 10, 0.88)',
        border: '1.5px solid rgba(255, 255, 255, 0.12)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: '0 24px 60px rgba(0, 0, 0, 0.75), inset 0 0 0 1px rgba(255, 255, 255, 0.05)',
        position: 'relative',
        transition: 'all 0.65s cubic-bezier(0.25, 1, 0.35, 1)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', alignItems: 'center', textAlign: 'center' }}>
        {/* 1. Reception Row: Clock, Hijri/Gregorian Date & Streak Flame in a Single Row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexWrap: 'nowrap',
            whiteSpace: 'nowrap',
            gap: '24px',
            textAlign: 'center',
            width: '100%',
            overflowX: 'auto',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {/* Large Clock & Date Stack */}
          <LiveClock
            timezone={prayerTimes?.timezone}
            city={settings?.city}
            country={settings?.country}
            timeFormat={settings?.timeFormat}
            language={settings?.language}
          />
        </div>

        {/* Divider Line */}
        <div style={{ width: '100%', height: '1px', backgroundColor: 'var(--border-subtle)' }} />

        {/* 2. Active Prayer Main Info (Centered - Fit Height) */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', width: '100%', padding: '4px 0' }}>
          {dataStatus === DATA_STATUS.READY ? (
            <>
              {/* Top Info (Collapsible Fit-Height on Hover) */}
              <div className="hero-collapsible-wrapper hero-top-wrapper">
                <div className="hero-collapsible-inner">
                  <div
                    className="hero-top-info"
                    style={{
                      fontSize: '0.85rem',
                      fontWeight: '700',
                      color: isActiveCompleted ? '#ffffff' : 'var(--text-secondary)',
                      paddingBottom: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                    }}
                  >
                    <span>{isActiveCompleted ? (isEn ? 'Current Prayer' : 'الصلاة الحالية') : (isEn ? 'Current Active Prayer' : 'الصلاة الحالية الآن')}</span>
                    {isActiveCompleted && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--status-on-time)', fontSize: '0.8rem', fontWeight: '800' }}>
                        <CheckCircle size={14} />
                        <span>{isEn ? 'Prayed' : 'أُدِّيت'}</span>
                      </span>
                    )}
                    <span style={{ fontSize: '0.78rem', padding: '2px 10px', borderRadius: 'var(--radius-pill)', backgroundColor: 'rgba(255, 255, 255, 0.08)', color: isActiveCompleted ? '#ffffff' : 'var(--text-muted)', border: '1px solid rgba(255, 255, 255, 0.12)' }}>
                      {isEn ? 'Adhan' : 'أذان'} {formatTimeDisplay(activeAdhanStr, settings?.timeFormat)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Main Prayer Name */}
              <h2
                className="hero-prayer-title"
                style={{
                  fontSize: 'clamp(2.1rem, 3.8vw, 2.9rem)',
                  fontWeight: '900',
                  color: isActiveCompleted ? '#ffffff' : 'var(--text-primary)',
                  margin: '4px 0',
                  lineHeight: 1.2,
                  letterSpacing: '-0.02em',
                  textAlign: 'center',
                }}
              >
                {isEn ? `${t(activeObligatoryId, activePrayerObj?.nameAr)} Prayer` : `صلاة ${activePrayerObj?.nameAr}`}
              </h2>

              {/* Bottom Info (Collapsible Fit-Height on Hover) */}
              {nextPrayerObj && nextAdhanStr && (
                <div className="hero-collapsible-wrapper hero-bottom-wrapper">
                  <div className="hero-collapsible-inner">
                    <div
                      className="hero-bottom-info"
                      style={{
                        paddingTop: '8px',
                        fontSize: '0.9rem',
                        fontWeight: '600',
                        color: isActiveCompleted ? '#ffffff' : 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        flexWrap: 'wrap',
                        textAlign: 'center',
                      }}
                    >
                      <span>{isEn ? `Next: ${t(nextOblId, nextPrayerObj?.nameAr)}` : `الصلاة القادمة: ${nextPrayerObj?.nameAr}`}</span>
                      <span style={{ fontWeight: '800', color: isActiveCompleted ? '#ffffff' : 'var(--text-primary)' }}>
                        {isEn ? 'Adhan' : 'أذان'} {formatTimeDisplay(nextAdhanStr, settings?.timeFormat)}
                      </span>
                      <LiveCountdown nextDateObj={nextOblDateObj} timezone={prayerTimes?.timezone} language={settings?.language} />
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', margin: '8px 0 0 0', textAlign: 'center' }}>
              <h2 style={{ fontSize: 'clamp(2rem, 3.8vw, 2.8rem)', fontWeight: '900', color: 'var(--text-primary)', margin: 0, lineHeight: 1.1, letterSpacing: '-0.02em', textAlign: 'center' }}>
                {dataStatus === DATA_STATUS.LOADING
                  ? (isEn ? 'Fetching Prayer Times from api.aladhan.com...' : 'جاري جلب مواقيت الصلاة عبر api.aladhan.com...')
                  : (isEn ? 'Prayer Times Unavailable' : 'مواقيت الصلاة غير معروفة')}
              </h2>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: 0, textAlign: 'center' }}>
                {dataStatus === DATA_STATUS.LOADING
                  ? (isEn ? 'Connecting to official Aladhan API to fetch exact timings for your city...' : 'يتم الآن جلب مواقيت الصلاة المعتمدة لمدينتك عبر واجهة Aladhan الرسمية (api.aladhan.com)...')
                  : (isEn
                    ? 'Please select your city in Settings or auto-detect your location to calculate prayer times.'
                    : 'يرجى اختيار مدينتك في الإعدادات أو النقر على تحديد الموقع لبدء حساب مواقيت الصلاة بدقة.')}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={onQuickAutoDetect}
                  disabled={isDetectingLocation}
                  id="btn-quick-detect-location"
                >
                  <Navigation size={15} style={{ color: 'var(--status-on-time)' }} />
                  <span>{isDetectingLocation ? (isEn ? 'Detecting Location...' : 'جاري تحديد الموقع...') : (isEn ? 'Auto-Detect My Location' : 'تحديد موقعي الحالي تلقائياً')}</span>
                </button>

                {onNavigateToSettings && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={onNavigateToSettings}
                    id="btn-quick-open-settings"
                  >
                    <Settings size={15} />
                    <span>{isEn ? 'Open Settings' : 'فتح الإعدادات'}</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Dynamic Progress Bar Separator - STRICTLY ONLY WHEN DATA IS READY */}
        {dataStatus === DATA_STATUS.READY && currentOblDateObj && nextOblDateObj && (
          <LiveProgressBar
            currentDateObj={currentOblDateObj}
            nextDateObj={nextOblDateObj}
            timezone={prayerTimes?.timezone}
            isActiveCompleted={isActiveCompleted}
          />
        )}

        {/* 3. Bottom Row: Smart Action Button + Details Link - STRICTLY ONLY WHEN DATA IS READY */}
        {isDataReady && activeObligatoryId && activePrayerObj && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '16px',
              flexWrap: 'wrap',
              width: '100%',
              textAlign: 'center',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              {/* Single Unified Smart Performance Button */}
              {(() => {
                const isActiveNextArrived = isNextPrayerTimeArrived ? isNextPrayerTimeArrived(activeObligatoryId) : false;
                const isActiveMissedLocked = isMissedAndLocked ? isMissedAndLocked(activeObligatoryId) : false;
                const isWithin15MinsOfAdhan = timerInfo?.elapsedSecs <= 15 * 60;

                const isDoneOnTime = activeRec && activeStatus === 'on_time';
                const isDoneLate = activeRec && (activeStatus === 'late' || activeStatus === 'qada');
                const isMissed = activeStatus === 'missed' || isActiveNextArrived || isActiveMissedLocked;

                const isFinalReToggleLocked = isReToggleLocked ? isReToggleLocked(activeObligatoryId) : false;

                let btnBg = 'rgba(255, 255, 255, 0.12)';
                let btnBorder = 'rgba(255, 255, 255, 0.16)';
                let btnColor = 'var(--status-on-time)';
                let btnShadow = 'none';
                let BtnIcon = CheckCircle;
                let btnText = isEn ? `Record ${t(activeObligatoryId, activePrayerObj.nameAr)}` : `تسجيل أداء صلاة ${activePrayerObj.nameAr}`;

                if (isFinalReToggleLocked && (isDoneOnTime || isDoneLate)) {
                  btnBg = 'rgba(255, 255, 255, 0.05)';
                  btnBorder = 'rgba(255, 255, 255, 0.12)';
                  btnColor = 'var(--text-secondary)';
                  BtnIcon = Lock;
                  btnText = isEn ? 'Locked' : 'مقفلة نهائياً';
                } else if (isDoneOnTime) {
                  btnBg = 'rgba(255, 255, 255, 0.18)';
                  btnBorder = 'rgba(255, 255, 255, 0.25)';
                  btnColor = 'var(--status-on-time)';
                  BtnIcon = CheckCircle;
                  btnText = isEn ? 'Prayed on time' : 'أُدِّيت في الوقت';
                } else if (isDoneLate) {
                  btnBg = 'rgba(255, 255, 255, 0.16)';
                  btnBorder = 'rgba(255, 255, 255, 0.22)';
                  btnColor = 'var(--status-late)';
                  BtnIcon = Clock;
                  btnText = isEn ? 'Prayed Qada' : 'أُدِّيت قضاءً';
                } else if (isMissed) {
                  btnBg = 'rgba(239, 68, 68, 0.12)';
                  btnBorder = 'rgba(255, 255, 255, 0.14)';
                  btnColor = 'var(--status-missed)';
                  BtnIcon = XCircle;
                  btnText = isEn ? `${t(activeObligatoryId, activePrayerObj.nameAr)} Missed` : `صلاة ${activePrayerObj.nameAr} متروكة`;
                } else if (!isWithin15MinsOfAdhan) {
                  btnBg = 'rgba(255, 255, 255, 0.12)';
                  btnBorder = 'rgba(255, 255, 255, 0.16)';
                  btnColor = 'var(--status-late)';
                  BtnIcon = Clock;
                  btnText = isEn ? `Record ${t(activeObligatoryId, activePrayerObj.nameAr)} Qada` : `تسجيل صلاة ${activePrayerObj.nameAr} قضاءً`;
                }

                return (
                  <button
                    type="button"
                    className="btn-pill"
                    onClick={() => {
                      if (isMissed) {
                        alert(isEn ? `${t(activeObligatoryId, activePrayerObj.nameAr)} prayer was recorded as missed because next prayer adhan has arrived.` : `صلاة ${activePrayerObj.nameAr} سُجّلت كمتروكة لعدم أدائها قبل أذان الصلاة التالية، ولا يمكن تحويلها إلى (تم).`);
                        return;
                      }
                      if (isFinalReToggleLocked) {
                        return;
                      }
                      // Toggle off if already performed
                      if (activeRec && (isDoneOnTime || isDoneLate)) {
                        const toggleKey = `${selectedDate}_${activeObligatoryId}`;
                        const history = getToggleHistory ? getToggleHistory() : {};
                        history[toggleKey] = Math.max(history[toggleKey] || 0, 1);
                        if (saveToggleHistory) saveToggleHistory(history);

                        const allRecords = getRecords();
                        const updated = allRecords.filter(r => !(r.date === selectedDate && r.prayer_name === activeObligatoryId));
                        saveRecords(updated);
                        if (setRecords) setRecords([...updated]);
                        if (onRecordUpdated) onRecordUpdated();
                        return;
                      }
                      // Mark performed
                      if (handleMarkPerformed) {
                        handleMarkPerformed(activeObligatoryId);
                      }
                    }}
                    disabled={isFinalReToggleLocked && (isDoneOnTime || isDoneLate)}
                    id={`btn-hero-action-${activeObligatoryId}`}
                    style={{
                      padding: '12px 28px',
                      fontSize: '1rem',
                      fontWeight: '800',
                      borderRadius: 'var(--radius-pill)',
                      backgroundColor: btnBg,
                      border: `1px solid ${btnBorder}`,
                      color: btnColor,
                      cursor: (isFinalReToggleLocked && (isDoneOnTime || isDoneLate)) ? 'not-allowed' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px',
                      lineHeight: '1',
                      transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: btnShadow,
                    }}
                  >
                    <BtnIcon size={18} style={{ flexShrink: 0 }} />
                    <span style={{ display: 'inline-flex', alignItems: 'center', lineHeight: '1' }}>{btnText}</span>
                  </button>
                );
              })()}

              {/* Frameless Details Link positioned directly underneath the button */}
              <button
                type="button"
                onClick={() => onOpenModal(activeObligatoryId)}
                style={{
                  padding: '2px 10px',
                  fontSize: '0.84rem',
                  fontWeight: '600',
                  backgroundColor: 'transparent',
                  color: 'rgba(255, 255, 255, 0.5)',
                  border: 'none',
                  borderRadius: '0',
                  boxShadow: 'none',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'color 0.2s ease',
                }}
                id={`btn-hero-details-${activeObligatoryId}`}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.5)')}
              >
                <span>{isEn ? 'Prayer Details & Adjustments' : 'تفاصيل وضبط أداء الصلاة'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
