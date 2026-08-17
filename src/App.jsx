import React, { useState, useRef, useEffect } from 'react';
import { EyeOff, Volume2, VolumeX, RefreshCw } from 'lucide-react';
import Header from './components/Header';
import PrayerTrackerView from './components/PrayerTrackerView';
import DashboardView from './components/DashboardView';
import ChatView from './components/ChatView';
import BookReaderView from './components/BookReaderView';
import SettingsView from './components/SettingsView';
import { getSettings, saveSettings, getPrayerTimesCache, APP_EVENTS } from './services/storage';
import { requestNotificationsPermission, checkAndNotifyCurrentAdhan } from './services/permissionService';
import { logError } from './services/errorLogger.js';
import { autoDetectAndInitializeWorldLocation } from './services/adhanCalculator.js';

/**
 * Proactively senses image decoding readiness in memory before lifting transition curtain.
 */
export function checkImageReadiness(url) {
  return new Promise((resolve) => {
    if (!url || typeof url !== 'string') {
      resolve(true);
      return;
    }
    const img = new Image();
    let resolved = false;

    const onDone = () => {
      if (!resolved) {
        resolved = true;
        resolve(true);
      }
    };

    img.onload = () => {
      if (typeof img.decode === 'function') {
        img.decode().then(onDone).catch(onDone);
      } else {
        onDone();
      }
    };
    img.onerror = onDone;
    img.src = url;

    if (img.complete) {
      if (typeof img.decode === 'function') {
        img.decode().then(onDone).catch(onDone);
      } else {
        onDone();
      }
    }

    // Fallback safety timeout
    setTimeout(onDone, 1200);
  });
}

export function getAllAvailableScenes(settings) {
  const scenes = [
    { mode: 'makkah', type: 'video', id: 'makkah', nameAr: 'بث مباشر للحرم المكي', nameEn: 'Makkah Live Stream' },
    { mode: 'madinah', type: 'video', id: 'madinah', nameAr: 'بث مباشر للمسجد النبوي', nameEn: 'Madinah Live Stream' },
  ];

  if ((Array.isArray(settings?.customBgImages) && settings.customBgImages.length > 0) || settings?.activeCustomBgImage) {
    scenes.push({
      mode: 'custom_image',
      type: 'image',
      id: 'custom_image',
      nameAr: 'صورة مخصصة من حاسوبك',
      nameEn: 'Custom Device Wallpaper',
    });
  }

  return scenes;
}

export function getDesiredBg(settings) {
  const mode = settings?.bgMode || 'makkah';
  if (mode === 'makkah') {
    return {
      type: 'video',
      videoId: settings?.makkahVideoId || 'm9-Umj3aL1I',
      key: 'makkah',
    };
  }
  if (mode === 'madinah') {
    return {
      type: 'video',
      videoId: settings?.madinahVideoId || 'Rs7St51oDDc',
      key: 'madinah',
    };
  }
  if (mode === 'custom_image') {
    const activeImg = settings?.activeCustomBgImage || (Array.isArray(settings?.customBgImages) && settings.customBgImages[0]) || '';
    if (activeImg) {
      return { type: 'image', url: activeImg, imageUrl: activeImg, key: activeImg };
    }
  }
  return {
    type: 'video',
    videoId: 'm9-Umj3aL1I',
    key: 'makkah',
  };
}

export default function App() {
  const [activeTab, setActiveTab] = useState('tracker'); // 'tracker', 'dashboard', 'chat', 'books', 'settings'
  const [settings, setSettings] = useState(() => getSettings());
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isWallpaperFocusMode, setIsWallpaperFocusMode] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(true);
  const isAudioMutedRef = useRef(true);
  const [syncToastMsg, setSyncToastMsg] = useState('');

  // Book Reader & Background Auto-Switch States
  const [isReaderActive, setIsReaderActive] = useState(false);
  const savedPreviousBgRef = useRef(null);

  const handleStartReading = () => {
    savedPreviousBgRef.current = settings?.bgMode || 'makkah';
    const updated = saveSettings({ ...settings, bgMode: 'custom_image' });
    setSettings(updated);
  };

  const handleExitReading = () => {
    if (savedPreviousBgRef.current) {
      const updated = saveSettings({ ...settings, bgMode: savedPreviousBgRef.current });
      setSettings(updated);
      savedPreviousBgRef.current = null;
    }
  };

  // Background Media & Audio States
  const [bgMuted, setBgMuted] = useState(true);
  const [bgHidden, setBgHidden] = useState(false);
  const [isIframeLoaded, setIsIframeLoaded] = useState(false);

  useEffect(() => {
    isAudioMutedRef.current = isAudioMuted;
  }, [isAudioMuted]);

  useEffect(() => {
    const isEn = settings?.language === 'en';
    document.documentElement.dir = isEn ? 'ltr' : 'rtl';
    document.documentElement.lang = isEn ? 'en' : 'ar';
  }, [settings?.language]);

  useEffect(() => {
    const handleSettingsUpdated = (e) => {
      if (e.detail) {
        setSettings(e.detail);
        setRefreshTrigger((prev) => prev + 1);
      }
    };
    window.addEventListener(APP_EVENTS.SETTINGS_UPDATED, handleSettingsUpdated);
    return () => window.removeEventListener(APP_EVENTS.SETTINGS_UPDATED, handleSettingsUpdated);
  }, []);

  // Automatic Zero-Click World Location & Accurate Astronomical Calculation on Boot
  useEffect(() => {
    autoDetectAndInitializeWorldLocation();
  }, []);

  // Check Notifications & Adhan Alerts on App Launch
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      requestNotificationsPermission();
    }

    // Check for Adhan alert every 30 seconds
    const adhanTimer = setInterval(() => {
      if (!document.hidden) {
        checkAndNotifyCurrentAdhan(getPrayerTimesCache(), settings?.language);
      }
    }, 30000);

    return () => clearInterval(adhanTimer);
  }, [settings?.language]);

  const makkahIframeRef = useRef(null);
  const madinahIframeRef = useRef(null);
  const fadeTimerRef = useRef(null);
  const prevTabRef = useRef(activeTab);

  // Automatic live stream synchronization whenever navigating between screens/tabs
  useEffect(() => {
    if (prevTabRef.current === activeTab) return;
    prevTabRef.current = activeTab;

    const mode = settings?.bgMode || 'makkah';
    if (mode === 'makkah' || mode === 'madinah') {
      const activeIframe = mode === 'madinah' ? madinahIframeRef.current : makkahIframeRef.current;
      if (activeIframe && activeIframe.contentWindow) {
        try {
          activeIframe.contentWindow.postMessage(
            JSON.stringify({ event: 'command', func: 'seekTo', args: [99999999, true] }),
            'https://www.youtube.com'
          );
          activeIframe.contentWindow.postMessage(
            JSON.stringify({ event: 'command', func: 'playVideo', args: '' }),
            'https://www.youtube.com'
          );
        } catch (e) {}
      }
    }
  }, [activeTab, settings?.bgMode]);

  const handleSettingsSaved = (newSettings) => {
    setSettings(newSettings);
  };

  const handleRecordUpdated = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleSyncLiveStream = () => {
    const wasUnmuted = !isAudioMuted;
    const mode = settings?.bgMode || 'makkah';
    const activeIframe = mode === 'madinah' ? madinahIframeRef.current : makkahIframeRef.current;

    if (activeIframe) {
      const currentSrc = activeIframe.src;
      activeIframe.src = currentSrc;

      if (wasUnmuted) {
        [600, 1200, 2000].forEach((delay) => {
          setTimeout(() => {
            if (activeIframe && activeIframe.contentWindow) {
              activeIframe.contentWindow.postMessage(
                JSON.stringify({ event: 'command', func: 'unMute', args: '' }),
                'https://www.youtube.com'
              );
              activeIframe.contentWindow.postMessage(
                JSON.stringify({ event: 'command', func: 'setVolume', args: [100] }),
                'https://www.youtube.com'
              );
            }
          }, delay);
        });
      }
    }
    const isEn = settings?.language === 'en';
    setSyncToastMsg(isEn ? 'Live stream synced' : 'تمت مزامنة البث المباشر');
    setTimeout(() => {
      setSyncToastMsg('');
    }, 2500);
  };

  const handleToggleAudio = () => {
    const mode = settings?.bgMode || 'makkah';
    const activeIframe = mode === 'madinah' ? madinahIframeRef.current : makkahIframeRef.current;
    if (!activeIframe || !activeIframe.contentWindow) return;

    if (fadeTimerRef.current) {
      clearInterval(fadeTimerRef.current);
    }

    const nextMuted = !isAudioMuted;
    setIsAudioMuted(nextMuted);
    isAudioMutedRef.current = nextMuted;

    if (!nextMuted) {
      // Instant UI State update & Smooth Fade-In
      let vol = 0;
      try {
        activeIframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'setVolume', args: [0] }), 'https://www.youtube.com');
        activeIframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'unMute', args: '' }), 'https://www.youtube.com');
      } catch (e) {}

      fadeTimerRef.current = setInterval(() => {
        if (isAudioMutedRef.current) {
          clearInterval(fadeTimerRef.current);
          return;
        }
        vol += 10;
        if (vol >= 100) {
          vol = 100;
          clearInterval(fadeTimerRef.current);
        }
        if (activeIframe && activeIframe.contentWindow) {
          try {
            activeIframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'setVolume', args: [vol] }), 'https://www.youtube.com');
          } catch (e) {}
        }
      }, 50);
    } else {
      // Instant UI State update & Smooth Fade-Out
      let vol = 100;
      fadeTimerRef.current = setInterval(() => {
        vol -= 10;
        if (vol <= 0) {
          vol = 0;
          clearInterval(fadeTimerRef.current);
          if (activeIframe && activeIframe.contentWindow) {
            try {
              activeIframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'setVolume', args: [0] }), 'https://www.youtube.com');
              activeIframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'mute', args: '' }), 'https://www.youtube.com');
            } catch (e) {}
          }
        } else {
          if (activeIframe && activeIframe.contentWindow) {
            try {
              activeIframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'setVolume', args: [vol] }), 'https://www.youtube.com');
            } catch (e) {}
          }
        }
      }, 50);
    }
  };

  const handleNavigateBg = (direction = 1) => {
    const currentSettings = getSettings();
    const scenes = getAllAvailableScenes(currentSettings);
    if (!scenes || scenes.length === 0) return;

    const currentMode = currentSettings.bgMode || 'makkah';
    let currentIdx = scenes.findIndex((s) => s.mode === currentMode);
    if (currentIdx === -1) currentIdx = 0;

    const nextIdx = (currentIdx + direction + scenes.length) % scenes.length;
    const nextScene = scenes[nextIdx];

    const updated = {
      ...currentSettings,
      bgMode: nextScene.mode,
    };

    saveSettings(updated);
    setSettings(updated);

    const isEn = updated.language === 'en';
    setSyncToastMsg(isEn ? nextScene.nameEn : nextScene.nameAr);
    setTimeout(() => setSyncToastMsg(''), 2200);
  };

  // Keyboard Shortcuts: 'm' for Audio, 'f' for Focus Mode, 'l' for Live Sync, ArrowUp/ArrowDown for Page Navigation, ArrowLeft/ArrowRight for Background Switching
  useEffect(() => {
    const tabs = ['tracker', 'dashboard', 'chat', 'books', 'settings'];

    const handleKeyDown = (e) => {
      // If book reader is currently open in active reading mode, completely mute global shortcuts!
      if (isReaderActive) return;

      const targetTag = e.target && e.target.tagName ? e.target.tagName.toLowerCase() : '';
      if (targetTag === 'input' || targetTag === 'textarea' || (e.target && e.target.isContentEditable)) {
        return;
      }

      const key = e.key || '';
      const code = e.code || '';

      if (key === 'ArrowUp' || key === 'Up' || code === 'ArrowUp') {
        e.preventDefault();
        if (isWallpaperFocusMode) return;
        setActiveTab((prev) => {
          const idx = tabs.indexOf(prev);
          const prevIdx = idx > 0 ? idx - 1 : tabs.length - 1;
          return tabs[prevIdx];
        });
      } else if (key === 'ArrowDown' || key === 'Down' || code === 'ArrowDown') {
        e.preventDefault();
        if (isWallpaperFocusMode) return;
        setActiveTab((prev) => {
          const idx = tabs.indexOf(prev);
          const nextIdx = idx < tabs.length - 1 ? idx + 1 : 0;
          return tabs[nextIdx];
        });
      } else if (key === 'ArrowRight' || key === 'Right' || code === 'ArrowRight') {
        e.preventDefault();
        handleNavigateBg(1);
      } else if (key === 'ArrowLeft' || key === 'Left' || code === 'ArrowLeft') {
        e.preventDefault();
        handleNavigateBg(-1);
      } else {
        const lowerKey = key ? key.toLowerCase() : '';
        if (lowerKey === 'm' || lowerKey === 'ك') {
          e.preventDefault();
          handleToggleAudio();
        } else if (lowerKey === 'f' || lowerKey === 'ب') {
          e.preventDefault();
          setIsWallpaperFocusMode((prev) => !prev);
        } else if (lowerKey === 'l' || lowerKey === 'م') {
          e.preventDefault();
          handleSyncLiveStream();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isAudioMuted, isWallpaperFocusMode, isReaderActive]);

  // Synchronously compute current background directly from settings for 100% instant reactivity
  const currentBg = getDesiredBg(settings) || { type: 'video', videoId: 'm9-Umj3aL1I', key: 'makkah' };
  const currentBgKey = currentBg.key || settings?.bgMode || 'makkah';
  const targetIsImage = currentBg.type === 'image' || settings?.bgMode === 'custom_image';
  const targetImageUrl = targetIsImage
    ? (currentBg.url || settings?.activeCustomBgImage || (Array.isArray(settings?.customBgImages) && settings.customBgImages[0]) || '')
    : '';

  // Displayed stage states (Only swapped at exactly 280ms when the screen is 100% solid dark behind the curtain)
  const [displayedMode, setDisplayedMode] = useState(targetIsImage ? 'custom_image' : currentBgKey);
  const [displayedImageUrl, setDisplayedImageUrl] = useState(targetImageUrl);
  const [isCurtainActive, setIsCurtainActive] = useState(false);
  const prevBgKeyRef = useRef(currentBgKey);
  const prevImageUrlRef = useRef(targetImageUrl);
  const transitionTimerRef = useRef(null);

  // AUTOMATIC FADE & BACKGROUND READINESS SENSING CONTROLLER: Senses loading completion before lifting the curtain
  useEffect(() => {
    const bgChanged = prevBgKeyRef.current !== currentBgKey || prevImageUrlRef.current !== targetImageUrl;
    if (!bgChanged) return;

    prevBgKeyRef.current = currentBgKey;
    prevImageUrlRef.current = targetImageUrl;

    let isCancelled = false;
    if (transitionTimerRef.current) {
      clearTimeout(transitionTimerRef.current);
    }

    // 1. Immediately drop dark curtain (smooth 0.28s Fade-In preserved)
    setIsCurtainActive(true);

    // 2. Trigger instant live seek on target stream if video mode
    if (!targetIsImage) {
      const targetIframe = currentBgKey === 'madinah' ? madinahIframeRef.current : makkahIframeRef.current;
      if (targetIframe && targetIframe.contentWindow) {
        try {
          targetIframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'seekTo', args: [99999999, true] }), 'https://www.youtube.com');
          targetIframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'playVideo', args: '' }), 'https://www.youtube.com');
        } catch (e) {}
      }
    }

    // 3. Audio switch handling behind the curtain
    if (!isAudioMutedRef.current) {
      if (targetIsImage) {
        // Mute both live video streams when viewing a custom image
        [makkahIframeRef.current, madinahIframeRef.current].forEach((iframe) => {
          if (iframe && iframe.contentWindow) {
            try {
              iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'setVolume', args: [0] }), 'https://www.youtube.com');
              iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'mute', args: '' }), 'https://www.youtube.com');
            } catch (e) {}
          }
        });
      } else {
        const prevIframe = currentBgKey === 'madinah' ? makkahIframeRef.current : madinahIframeRef.current;
        if (prevIframe && prevIframe.contentWindow) {
          try {
            prevIframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'setVolume', args: [0] }), 'https://www.youtube.com');
            prevIframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'mute', args: '' }), 'https://www.youtube.com');
          } catch (e) {}
        }
      }
    }

    // 4. Background Readiness Sensor:
    // A) Minimum curtain drop time (280ms for complete solid dark fade-in)
    // B) Real background loading & memory decode sensor
    const minCurtainPromise = new Promise((resolve) => setTimeout(resolve, 280));
    const readinessPromise = targetIsImage
      ? checkImageReadiness(targetImageUrl)
      : new Promise((resolve) => setTimeout(resolve, 260));

    Promise.all([minCurtainPromise, readinessPromise]).then(() => {
      if (isCancelled) return;

      // Swap the active displayed stage behind the 100% solid dark curtain
      setDisplayedMode(targetIsImage ? 'custom_image' : currentBgKey);
      if (targetIsImage) {
        setDisplayedImageUrl(targetImageUrl);
      }

      // If video mode, re-verify live sync & play on target stream
      if (!targetIsImage) {
        const targetIframe = currentBgKey === 'madinah' ? madinahIframeRef.current : makkahIframeRef.current;
        if (targetIframe && targetIframe.contentWindow) {
          try {
            targetIframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'seekTo', args: [99999999, true] }), 'https://www.youtube.com');
            targetIframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'playVideo', args: '' }), 'https://www.youtube.com');
          } catch (e) {}
        }

        // Unmute target stream if audio was active
        if (!isAudioMutedRef.current && targetIframe && targetIframe.contentWindow) {
          try {
            targetIframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'unMute', args: '' }), 'https://www.youtube.com');
            targetIframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'setVolume', args: [100] }), 'https://www.youtube.com');
          } catch (e) {}
        }
      }

      // 5. Readiness sensor confirmed! Lift curtain and dissolve over 0.85s
      transitionTimerRef.current = setTimeout(() => {
        if (!isCancelled) {
          setIsCurtainActive(false);
        }
      }, 40);
    });

    return () => {
      isCancelled = true;
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current);
      }
    };
  }, [currentBgKey, targetImageUrl, targetIsImage]);

  const originParam = (typeof window !== 'undefined' && window.location.protocol.startsWith('http'))
    ? `&origin=${encodeURIComponent(window.location.origin)}`
    : '';

  const iframeCommonStyle = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 'max(100vw, 177.78vh)',
    height: 'max(100vh, 56.25vw)',
    transform: 'translate(-50%, -50%) scale(1.18) translateZ(0)',
    WebkitTransform: 'translate(-50%, -50%) scale(1.18) translateZ(0)',
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
    pointerEvents: 'none',
    border: 'none',
    filter: isWallpaperFocusMode ? 'none' : 'blur(20px)',
    transition: 'filter 0.3s ease',
  };

  return (
    <>
      {/* Layer -5: Solid Dark Ground Base */}
      <div className="bg-ground-base" />

      {/* Sync Toast Notification */}
      {syncToastMsg && (
        <div
          style={{
            position: 'fixed',
            top: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 2000,
            backgroundColor: '#ffffff',
            color: '#000000',
            border: '1px solid rgba(255, 255, 255, 0.4)',
            fontWeight: '700',
            fontSize: '0.86rem',
            padding: '8px 20px',
            borderRadius: 'var(--radius-pill)',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            animation: 'slideDown 0.2s ease-out',
          }}
        >
          {syncToastMsg}
        </div>
      )}

      {/* Layer -4: Dual Persistent Streams & Custom Image Stage */}
      {/* Makkah Live Stream */}
      <div
        key="makkah_layer"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: -4,
          pointerEvents: 'none',
          overflow: 'hidden',
          backgroundColor: '#0a0c12',
          opacity: displayedMode === 'makkah' ? 1 : 0,
          visibility: displayedMode === 'makkah' ? 'visible' : 'hidden',
          transition: 'opacity 0.85s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <iframe
          ref={makkahIframeRef}
          src={`https://www.youtube.com/embed/${settings?.makkahVideoId || 'm9-Umj3aL1I'}?autoplay=1&mute=1&controls=0&showinfo=0&rel=0&enablejsapi=1&iv_load_policy=3&modestbranding=1&playsinline=1${originParam}`}
          title="Makkah Live Background Stream"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          style={iframeCommonStyle}
        />
      </div>

      {/* Madinah Live Stream */}
      <div
        key="madinah_layer"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: -4,
          pointerEvents: 'none',
          overflow: 'hidden',
          backgroundColor: '#0a0c12',
          opacity: displayedMode === 'madinah' ? 1 : 0,
          visibility: displayedMode === 'madinah' ? 'visible' : 'hidden',
          transition: 'opacity 0.85s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <iframe
          ref={madinahIframeRef}
          src={`https://www.youtube.com/embed/${settings?.madinahVideoId || 'Rs7St51oDDc'}?autoplay=1&mute=1&controls=0&showinfo=0&rel=0&enablejsapi=1&iv_load_policy=3&modestbranding=1&playsinline=1${originParam}`}
          title="Madinah Live Background Stream"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          style={iframeCommonStyle}
        />
      </div>

      {/* Custom Image Layer */}
      {displayedImageUrl && (
        <div
          key="custom_image_layer"
          className="custom-site-bg"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: -4,
            pointerEvents: 'none',
            overflow: 'hidden',
            backgroundImage: `url('${displayedImageUrl}')`,
            opacity: displayedMode === 'custom_image' ? 1 : 0,
            visibility: displayedMode === 'custom_image' ? 'visible' : 'hidden',
            filter: isWallpaperFocusMode ? 'none' : 'blur(20px)',
            transition: 'opacity 0.85s cubic-bezier(0.16, 1, 0.3, 1), filter 0.3s ease',
          }}
        />
      )}

      {/* Layer -3: Dedicated Scene Transition Curtain (Automatic fade on ANY background change) */}
      <div
        className={`bg-transition-curtain ${isCurtainActive ? 'curtain-active' : ''}`}
      />

      {/* Layer -2: Glassmorphism Dimmer Overlay (Dims background behind frosted cards) */}
      <div
        className="bg-frosted-dimmer"
        style={{
          opacity: isWallpaperFocusMode ? 0 : 1,
        }}
      />

      {/* Floating Dock Navbar */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        settings={settings}
        onToggleFocusMode={() => setIsWallpaperFocusMode((prev) => !prev)}
        isLiveVideo={currentBg?.type === 'video'}
        onSyncLive={handleSyncLiveStream}
        isAudioMuted={isAudioMuted}
        onToggleAudio={handleToggleAudio}
        isWallpaperFocusMode={isWallpaperFocusMode}
        onToggleBg={() => handleNavigateBg(1)}
      />

      {/* Main App Container - Fades out completely in Focus Mode */}
      <div
        className="app-container"
        style={{
          opacity: isWallpaperFocusMode ? 0 : 1,
          pointerEvents: isWallpaperFocusMode ? 'none' : 'auto',
          transition: 'opacity 0.25s ease',
        }}
      >
        <main>
          <div key={activeTab} className="view-transition-wrapper">
            {activeTab === 'tracker' && (
              <PrayerTrackerView
                settings={settings}
                onRecordUpdated={handleRecordUpdated}
                isAudioMuted={isAudioMuted}
                onToggleAudio={handleToggleAudio}
                onNavigateToSettings={() => setActiveTab('settings')}
              />
            )}

            {activeTab === 'dashboard' && (
              <DashboardView key={refreshTrigger} settings={settings} />
            )}

            {activeTab === 'chat' && (
              <ChatView
                settings={settings}
                onNavigateToSettings={() => setActiveTab('settings')}
                onSettingsSaved={handleSettingsSaved}
              />
            )}

            {activeTab === 'books' && (
              <BookReaderView
                key="book-reader-view"
                settings={settings}
                onStartReading={handleStartReading}
                onExitReading={handleExitReading}
                isReaderActive={isReaderActive}
                setIsReaderActive={setIsReaderActive}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsView
                onSettingsSaved={handleSettingsSaved}
              />
            )}
          </div>
        </main>
      </div>

      {/* Floating Control Bar in Focus Mode */}
      {isWallpaperFocusMode && (
        <div
          style={{
            position: 'fixed',
            bottom: '28px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            backgroundColor: 'rgba(16, 18, 26, 0.92)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-pill)',
            padding: '8px 20px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            animation: 'slideUp 0.25s ease-out',
            whiteSpace: 'nowrap',
          }}
        >
          {currentBg?.type === 'video' && (
            <>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleSyncLiveStream}
                style={{
                  padding: '8px 18px',
                  fontSize: '0.86rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  lineHeight: '1',
                  whiteSpace: 'nowrap',
                }}
                id="focus-sync-live-btn"
                title={settings?.language === 'en' ? 'Instant Re-sync live stream to present moment' : 'المزامنة الفورية مع نقطة البث المباشر الفعالية'}
              >
                <span className="pulse-dot" style={{ width: '7px', height: '7px', backgroundColor: 'var(--status-on-time)' }}></span>
                <RefreshCw size={15} style={{ color: 'var(--status-on-time)', flexShrink: 0 }} />
                <span>{settings?.language === 'en' ? 'Live Now' : 'مباشر الآن'}</span>
              </button>

              <button
                type="button"
                className="btn-secondary"
                onClick={handleToggleAudio}
                style={{
                  padding: '8px 18px',
                  fontSize: '0.86rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  lineHeight: '1',
                  whiteSpace: 'nowrap',
                  color: isAudioMuted ? 'var(--text-secondary)' : 'var(--status-on-time)',
                }}
                id="focus-stream-audio-btn"
              >
                {isAudioMuted ? <VolumeX size={16} style={{ flexShrink: 0 }} /> : <Volume2 size={16} style={{ flexShrink: 0 }} />}
                <span>{isAudioMuted ? (settings?.language === 'en' ? 'Unmute Audio' : 'تشغيل الصوت') : (settings?.language === 'en' ? 'Mute Audio' : 'كتم الصوت')}</span>
              </button>
            </>
          )}

          <button
            className="btn-secondary"
            onClick={() => setIsWallpaperFocusMode(false)}
            style={{
              padding: '8px 20px',
              fontSize: '0.86rem',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              lineHeight: '1',
              whiteSpace: 'nowrap',
            }}
            id="exit-focus-mode-btn"
          >
            <EyeOff size={16} style={{ flexShrink: 0 }} />
            <span>{settings?.language === 'en' ? 'Exit Focus Mode' : 'إغلاق العرض والعودة'}</span>
          </button>
        </div>
      )}
    </>
  );
}
