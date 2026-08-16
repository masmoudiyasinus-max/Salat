import React from 'react';
import { Calendar, BarChart3, MessageSquare, Settings, Compass, Eye, RefreshCw, Volume2, VolumeX } from 'lucide-react';
import { getTranslation } from '../services/i18n';

export default function Header({
  activeTab,
  setActiveTab,
  settings,
  onToggleFocusMode,
  isLiveVideo,
  onSyncLive,
  isAudioMuted,
  onToggleAudio,
  isWallpaperFocusMode,
}) {
  const lang = settings?.language || 'ar';
  const t = (k, fb) => getTranslation(lang, k, fb);

  const handleTabClick = (tab) => {
    if (isWallpaperFocusMode) return;
    setActiveTab(tab);
  };

  return (
    <>
      <nav className="nav-tabs floating-vertical-dock">
        <button
          className={`nav-btn ${activeTab === 'tracker' ? 'active' : ''}`}
          onClick={() => handleTabClick('tracker')}
          id="nav-tracker-btn"
          title={isWallpaperFocusMode ? t('navFocusModeDisabled', 'التنقل معطل أثناء وضع التركيز') : t('navTracker', 'تتبع الصلوات')}
          style={{
            opacity: isWallpaperFocusMode ? 0.35 : 1,
            cursor: isWallpaperFocusMode ? 'not-allowed' : 'pointer',
          }}
        >
          <Calendar size={20} />
        </button>

        <button
          className={`nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => handleTabClick('dashboard')}
          id="nav-dashboard-btn"
          title={isWallpaperFocusMode ? t('navFocusModeDisabled', 'التنقل معطل أثناء وضع التركيز') : t('navAnalytics', 'لوحة التحليلات')}
          style={{
            opacity: isWallpaperFocusMode ? 0.35 : 1,
            cursor: isWallpaperFocusMode ? 'not-allowed' : 'pointer',
          }}
        >
          <BarChart3 size={20} />
        </button>

        <button
          className={`nav-btn ${activeTab === 'chat' ? 'active' : ''}`}
          onClick={() => handleTabClick('chat')}
          id="nav-chat-btn"
          title={isWallpaperFocusMode ? t('navFocusModeDisabled', 'التنقل معطل أثناء وضع التركيز') : t('navChat', 'الدردشة الذكية')}
          style={{
            opacity: isWallpaperFocusMode ? 0.35 : 1,
            cursor: isWallpaperFocusMode ? 'not-allowed' : 'pointer',
          }}
        >
          <MessageSquare size={20} />
        </button>

        <button
          className={`nav-btn ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => handleTabClick('settings')}
          id="nav-settings-btn"
          title={isWallpaperFocusMode ? t('navFocusModeDisabled', 'التنقل معطل أثناء وضع التركيز') : t('navSettings', 'الإعدادات')}
          style={{
            opacity: isWallpaperFocusMode ? 0.35 : 1,
            cursor: isWallpaperFocusMode ? 'not-allowed' : 'pointer',
          }}
        >
          <Settings size={20} />
        </button>

        {isLiveVideo && (
          <>
            <div style={{ width: '100%', height: '1px', backgroundColor: 'rgba(255, 255, 255, 0.15)', margin: '4px 0' }} />

            <button
              className="nav-btn"
              onClick={onToggleFocusMode}
              title={t('navFocusMode', 'مشاهدة البث المباشر المكرّم بدون عناصر الموقع وبدون تعتيم')}
              id="nav-focus-mode-btn"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                color: 'var(--text-primary)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
              }}
            >
              <Eye size={20} />
            </button>

            <button
              className="nav-btn"
              onClick={onToggleAudio}
              title={isAudioMuted ? t('navAudioUnmute', 'تشغيل صوت البث المباشر') : t('navAudioMute', 'كتم صوت البث المباشر')}
              id="nav-audio-btn"
              style={{
                backgroundColor: isAudioMuted ? 'rgba(255, 255, 255, 0.05)' : 'rgba(16, 185, 129, 0.2)',
                color: isAudioMuted ? 'var(--text-secondary)' : 'var(--status-on-time)',
                border: isAudioMuted ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(16, 185, 129, 0.4)',
              }}
            >
              {isAudioMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>

            <button
              className="nav-btn"
              onClick={onSyncLive}
              title={t('navSyncLive', 'مباشر الآن: المزامنة الفورية مع البث المباشر')}
              id="nav-sync-live-btn"
              style={{
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                color: 'var(--status-on-time)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
              }}
            >
              <RefreshCw size={20} />
            </button>
          </>
        )}
      </nav>
    </>
  );
}
