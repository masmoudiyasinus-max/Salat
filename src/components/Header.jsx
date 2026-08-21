import React from 'react';
import { Calendar, MessageSquare, BookOpen, Settings, Eye, Headphones } from 'lucide-react';
import { getTranslation } from '../services/i18n';
import TasbeehIcon from './TasbeehIcon.jsx';

export default function Header({
  activeTab,
  setActiveTab,
  settings,
  onToggleFocusMode,
  isLiveVideo,
  isWallpaperFocusMode,
  isOnline = true,
}) {
  const lang = settings?.language || 'ar';
  const isEn = lang === 'en';
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
          title={isWallpaperFocusMode ? t('navFocusModeDisabled', 'التنقل معطل أثناء وضع التركيز') : `${t('navTracker', 'تتبع الصلوات')} (1)`}
          style={{
            opacity: isWallpaperFocusMode ? 0.35 : 1,
            cursor: isWallpaperFocusMode ? 'not-allowed' : 'pointer',
          }}
        >
          <Calendar size={20} />
        </button>

        <button
          className={`nav-btn ${activeTab === 'chat' ? 'active' : ''}`}
          onClick={() => handleTabClick('chat')}
          id="nav-chat-btn"
          title={
            isWallpaperFocusMode
              ? t('navFocusModeDisabled', 'التنقل معطل أثناء وضع التركيز')
              : !isOnline
              ? (isEn ? 'AI Chat (Past History Available - Offline)' : 'الدردشة الذكية (تصفح المحادثات السابقة - بدون إنترنت)')
              : `${t('navChat', 'الدردشة الذكية')} (2)`
          }
          style={{
            opacity: isWallpaperFocusMode ? 0.35 : 1,
            cursor: isWallpaperFocusMode ? 'not-allowed' : 'pointer',
          }}
        >
          <MessageSquare size={20} />
        </button>

        <button
          className={`nav-btn ${activeTab === 'books' ? 'active' : ''}`}
          onClick={() => handleTabClick('books')}
          id="nav-books-btn"
          title={isWallpaperFocusMode ? t('navFocusModeDisabled', 'التنقل معطل أثناء وضع التركيز') : `${lang === 'en' ? 'Book Reader & Daily Ward' : 'ورد القراءة وقارئ الكتب'} (3)`}
          style={{
            opacity: isWallpaperFocusMode ? 0.35 : 1,
            cursor: isWallpaperFocusMode ? 'not-allowed' : 'pointer',
          }}
        >
          <BookOpen size={20} />
        </button>

        <button
          className={`nav-btn ${activeTab === 'tasbeeh' ? 'active' : ''}`}
          onClick={() => handleTabClick('tasbeeh')}
          id="nav-tasbeeh-btn"
          title={isWallpaperFocusMode ? t('navFocusModeDisabled', 'التنقل معطل أثناء وضع التركيز') : `${lang === 'en' ? 'Electronic Tasbeeh & Dhikr' : 'المسبحة الإلكترونية والأذكار'} (4)`}
          style={{
            opacity: isWallpaperFocusMode ? 0.35 : 1,
            cursor: isWallpaperFocusMode ? 'not-allowed' : 'pointer',
          }}
        >
          <TasbeehIcon size={20} />
        </button>

        <button
          className={`nav-btn ${activeTab === 'audio' ? 'active' : ''}`}
          onClick={() => handleTabClick('audio')}
          id="nav-audio-btn"
          title={isWallpaperFocusMode ? t('navFocusModeDisabled', 'التنقل معطل أثناء وضع التركيز') : `${lang === 'en' ? 'Audio Library & Player' : 'مشغل الصوتيات والمكتبة'} (5)`}
          style={{
            opacity: isWallpaperFocusMode ? 0.35 : 1,
            cursor: isWallpaperFocusMode ? 'not-allowed' : 'pointer',
          }}
        >
          <Headphones size={20} />
        </button>

        <button
          className={`nav-btn ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => handleTabClick('settings')}
          id="nav-settings-btn"
          title={isWallpaperFocusMode ? t('navFocusModeDisabled', 'التنقل معطل أثناء وضع التركيز') : `${t('navSettings', 'الإعدادات')} (6)`}
          style={{
            opacity: isWallpaperFocusMode ? 0.35 : 1,
            cursor: isWallpaperFocusMode ? 'not-allowed' : 'pointer',
          }}
        >
          <Settings size={20} />
        </button>

        {isLiveVideo && (
          <>
            <div className="nav-divider" />

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
          </>
        )}
      </nav>
    </>
  );
}
