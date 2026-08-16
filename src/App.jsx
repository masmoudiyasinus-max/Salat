import React, { useState, useRef, useEffect } from 'react';
import { EyeOff, Volume2, VolumeX, RefreshCw } from 'lucide-react';
import Header from './components/Header';
import PrayerTrackerView from './components/PrayerTrackerView';
import DashboardView from './components/DashboardView';
import ChatView from './components/ChatView';
import SettingsView from './components/SettingsView';
import { getSettings, saveSettings } from './services/storage';

export function extractYouTubeId(url) {
  if (!url) return '';
  const trimmed = url.trim();
  if (trimmed.length === 11 && !trimmed.includes('/') && !trimmed.includes('.')) return trimmed;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = trimmed.match(regExp);
  return (match && match[2].length === 11) ? match[2] : '';
}

export function getDesiredBg(settings) {
  const mode = settings?.bgMode || 'makkah';
  if (mode === 'makkah') {
    return { type: 'video', videoId: 'm9-Umj3aL1I', key: 'makkah' };
  }
  if (mode === 'madinah') {
    return { type: 'video', videoId: 'Rs7St51oDDc', key: 'madinah' };
  }
  if (mode === 'custom_image') {
    const imgUrl = settings?.activeCustomBgImage;
    if (imgUrl && typeof imgUrl === 'string' && imgUrl.trim() !== '') {
      return { type: 'image', imageUrl: imgUrl.trim(), key: `img_${imgUrl.trim()}` };
    }
    return null;
  }
  if (settings?.youtubeLiveUrl) {
    const vidId = extractYouTubeId(settings.youtubeLiveUrl);
    if (vidId) {
      return { type: 'video', videoId: vidId, key: `yt_${vidId}` };
    }
  }
  return { type: 'video', videoId: 'm9-Umj3aL1I', key: 'makkah' };
}

export default function App() {
  const [activeTab, setActiveTab] = useState('tracker'); // 'tracker', 'dashboard', 'chat', 'settings'
  const [settings, setSettings] = useState(getSettings);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isWallpaperFocusMode, setIsWallpaperFocusMode] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(true);
  const isAudioMutedRef = useRef(true);
  const [syncToastMsg, setSyncToastMsg] = useState('');

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
    window.addEventListener('settings-updated', handleSettingsUpdated);
    return () => window.removeEventListener('settings-updated', handleSettingsUpdated);
  }, []);

  const iframeRef = useRef(null);
  const prevIframeRef = useRef(null);
  const fadeTimerRef = useRef(null);
  const hasSyncedNewBgRef = useRef(false);

  const handleSettingsSaved = (newSettings) => {
    setSettings(newSettings);
  };

  const handleRecordUpdated = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleSyncLiveStream = () => {
    const wasUnmuted = !isAudioMuted;

    if (iframeRef.current) {
      // Force YouTube player to snap to the absolute latest live edge by refreshing its source
      const currentSrc = iframeRef.current.src;
      iframeRef.current.src = currentSrc;

      // Fortify: If audio was open before sync, restore unmuted audio state smoothly after iframe reloads
      if (wasUnmuted) {
        [600, 1200, 2000].forEach((delay) => {
          setTimeout(() => {
            if (iframeRef.current && iframeRef.current.contentWindow) {
              iframeRef.current.contentWindow.postMessage(
                JSON.stringify({ event: 'command', func: 'unMute', args: '' }),
                'https://www.youtube.com'
              );
              iframeRef.current.contentWindow.postMessage(
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
    if (!iframeRef.current || !iframeRef.current.contentWindow) return;

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
        iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'setVolume', args: [0] }), 'https://www.youtube.com');
        iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'unMute', args: '' }), 'https://www.youtube.com');
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
        if (iframeRef.current && iframeRef.current.contentWindow) {
          try {
            iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'setVolume', args: [vol] }), 'https://www.youtube.com');
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
          if (iframeRef.current && iframeRef.current.contentWindow) {
            try {
              iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'setVolume', args: [0] }), 'https://www.youtube.com');
              iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'mute', args: '' }), 'https://www.youtube.com');
            } catch (e) {}
          }
        } else {
          if (iframeRef.current && iframeRef.current.contentWindow) {
            try {
              iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'setVolume', args: [vol] }), 'https://www.youtube.com');
            } catch (e) {}
          }
        }
      }, 50);
    }
  };

  // Keyboard Shortcuts: 'm' for Audio, 'f' for Focus Mode, 'l' for Live Sync, ArrowUp/ArrowDown for Page Navigation
  useEffect(() => {
    const tabs = ['tracker', 'dashboard', 'chat', 'settings'];

    const handleKeyDown = (e) => {
      const targetTag = e.target.tagName ? e.target.tagName.toLowerCase() : '';
      if (targetTag === 'input' || targetTag === 'textarea' || e.target.isContentEditable) {
        return;
      }

      const key = e.key;
      if (key === 'ArrowUp') {
        e.preventDefault();
        if (isWallpaperFocusMode) return;
        setActiveTab((prev) => {
          const idx = tabs.indexOf(prev);
          const prevIdx = idx > 0 ? idx - 1 : tabs.length - 1;
          return tabs[prevIdx];
        });
      } else if (key === 'ArrowDown') {
        e.preventDefault();
        if (isWallpaperFocusMode) return;
        setActiveTab((prev) => {
          const idx = tabs.indexOf(prev);
          const nextIdx = idx < tabs.length - 1 ? idx + 1 : 0;
          return tabs[nextIdx];
        });
      } else if (key === 'ArrowRight') {
        e.preventDefault();
        const bgModes = ['makkah', 'madinah', 'custom_image'];
        setSettings((prev) => {
          const currentMode = prev.bgMode || 'makkah';
          const idx = bgModes.indexOf(currentMode);
          const nextIdx = idx < bgModes.length - 1 ? idx + 1 : 0;
          const updated = { ...prev, bgMode: bgModes[nextIdx] };
          saveSettings(updated);
          return updated;
        });
      } else if (key === 'ArrowLeft') {
        e.preventDefault();
        const bgModes = ['makkah', 'madinah', 'custom_image'];
        setSettings((prev) => {
          const currentMode = prev.bgMode || 'makkah';
          const idx = bgModes.indexOf(currentMode);
          const prevIdx = idx > 0 ? idx - 1 : bgModes.length - 1;
          const updated = { ...prev, bgMode: bgModes[prevIdx] };
          saveSettings(updated);
          return updated;
        });
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

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAudioMuted, isWallpaperFocusMode]);

  const [currentBg, setCurrentBg] = useState(() => {
    return getDesiredBg(settings) || { type: 'video', videoId: 'm9-Umj3aL1I', key: 'makkah' };
  });

  const [isBlackCurtainActive, setIsBlackCurtainActive] = useState(true); // START TRUE TO PREVENT INITIAL FLASH
  const isPlaybackDetectedRef = useRef(false);
  const isTransitioningRef = useRef(false); // Track transition to prevent old iframe leaks
  const pollIntervalRef = useRef(null);
  const fallbackTimerRef = useRef(null);
  const isFirstMountRef = useRef(true);

  // Reveal: transition the overlay from solid black back to normal semi-transparent dimming
  const triggerReveal = (toastText = '') => {
    if (isPlaybackDetectedRef.current) return;
    isPlaybackDetectedRef.current = true;

    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }

    if (toastText) {
      setSyncToastMsg(toastText);
      setTimeout(() => setSyncToastMsg(''), 2500);
    }

    // Smooth Audio Fade-In helper for new stream
    if (!isAudioMutedRef.current && iframeRef.current && iframeRef.current.contentWindow) {
      let vol = 0;
      try {
        iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'setVolume', args: [0] }), 'https://www.youtube.com');
        iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'unMute', args: '' }), 'https://www.youtube.com');
      } catch (e) {}

      if (fadeTimerRef.current) clearInterval(fadeTimerRef.current);
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
        if (iframeRef.current && iframeRef.current.contentWindow) {
          try {
            iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'setVolume', args: [vol] }), 'https://www.youtube.com');
          } catch (e) {}
        }
      }, 60);
    }

    // Force React to reliably trigger the CSS transition
    requestAnimationFrame(() => {
      setIsBlackCurtainActive(false);
    });
  };

  // Setup Initial Mount Fallback Timer
  useEffect(() => {
    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    fallbackTimerRef.current = setTimeout(() => {
      triggerReveal();
    }, 8000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // YouTube postMessage listener
  useEffect(() => {
    const handleWindowMessage = (event) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (!data) return;

        // Ensure we only reveal when frames are ACTUALLY playing (currentTime > 0.1)
        // Ignoring playerState === 1 avoids flashing the YouTube UI player right before the video starts.
        const hasActiveTime =
          data.info && typeof data.info.currentTime === 'number' && data.info.currentTime > 0.1;

        // CRITICAL FIX: Ignore messages from old iframe during the 500ms black-curtain transition!
        if (hasActiveTime && !isTransitioningRef.current) {
          const isEn = settings?.language === 'en';
          triggerReveal(isEn ? 'Live stream synced' : 'تمت مزامنة البث المباشر');
        }
      } catch (e) {}
    };

    window.addEventListener('message', handleWindowMessage);
    return () => window.removeEventListener('message', handleWindowMessage);
  }, []);

  useEffect(() => {
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      return;
    }

    const desired = getDesiredBg(settings);
    if (!desired || desired.key === currentBg.key) return;

    isPlaybackDetectedRef.current = false;
    isTransitioningRef.current = true; // Lock out old iframe messages
    setIsBlackCurtainActive(true);

    // Audio Fade-Out for old stream if unmuted
    if (!isAudioMutedRef.current && iframeRef.current && iframeRef.current.contentWindow) {
      const win = iframeRef.current.contentWindow;
      try {
        win.postMessage(JSON.stringify({ event: 'command', func: 'setVolume', args: [40] }), 'https://www.youtube.com');
      } catch (e) {}
      setTimeout(() => {
        try {
          win.postMessage(JSON.stringify({ event: 'command', func: 'setVolume', args: [10] }), 'https://www.youtube.com');
        } catch (e) {}
      }, 100);
      setTimeout(() => {
        try {
          win.postMessage(JSON.stringify({ event: 'command', func: 'setVolume', args: [0] }), 'https://www.youtube.com');
          win.postMessage(JSON.stringify({ event: 'command', func: 'mute', args: '' }), 'https://www.youtube.com');
        } catch (e) {}
      }, 200);
    }

    const swapTimer = setTimeout(() => {
      setCurrentBg(desired);
      isTransitioningRef.current = false; // Unlock for new iframe
    }, 300);

    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    fallbackTimerRef.current = setTimeout(() => {
      triggerReveal();
    }, 8000);

    return () => clearTimeout(swapTimer);
  }, [settings.bgMode, settings.activeCustomBgImage, settings.youtubeLiveUrl]);

  // Image preload sensing (Decoded off main thread to prevent UI stutter)
  useEffect(() => {
    if (currentBg?.type === 'image') {
      isPlaybackDetectedRef.current = false;
      const img = new Image();
      img.src = currentBg.imageUrl;
      if (img.decode) {
        img.decode()
          .then(() => {
            requestAnimationFrame(() => triggerReveal());
          })
          .catch(() => triggerReveal());
      } else {
        img.onload = () => triggerReveal();
        img.onerror = () => triggerReveal();
      }
    }
  }, [currentBg]);

  useEffect(() => {
    if (fadeTimerRef.current) {
      clearInterval(fadeTimerRef.current);
    }
  }, [currentBg.key]);

  const renderBgLayer = (bgObj, zIndexVal) => {
    if (!bgObj) return null;

    const layerStyle = {
      position: 'fixed',
      inset: 0,
      zIndex: zIndexVal,
      pointerEvents: 'none',
      overflow: 'hidden',
    };

    if (bgObj.type === 'video') {
      return (
        <div
          key={bgObj.key}
          style={{
            ...layerStyle,
            backgroundColor: '#0a0c12',
          }}
          id="youtube-live-bg-container"
        >
          <iframe
            ref={iframeRef}
            src={`https://www.youtube.com/embed/${bgObj.videoId}?autoplay=1&mute=1&controls=0&showinfo=0&rel=0&enablejsapi=1&iv_load_policy=3&modestbranding=1&playsinline=1`}
            title="YouTube Live Background Stream"
            allow="autoplay; encrypted-media"
            onLoad={() => {
              if (iframeRef.current && iframeRef.current.contentWindow) {
                try {
                  iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'listening' }), 'https://www.youtube.com');
                } catch (e) {}
              }

              if (!isAudioMutedRef.current && iframeRef.current && iframeRef.current.contentWindow) {
                const applyGradualFadeIn = () => {
                  if (isAudioMutedRef.current || !iframeRef.current || !iframeRef.current.contentWindow) return;
                  let vol = 0;
                  try {
                    iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'setVolume', args: [0] }), 'https://www.youtube.com');
                    iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'unMute', args: '' }), 'https://www.youtube.com');
                  } catch (e) {}

                  if (fadeTimerRef.current) clearInterval(fadeTimerRef.current);
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
                    if (iframeRef.current && iframeRef.current.contentWindow) {
                      try {
                        iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'setVolume', args: [vol] }), 'https://www.youtube.com');
                      } catch (e) {}
                    }
                  }, 60);
                };
                setTimeout(applyGradualFadeIn, 1200); // Gradual smooth audio fade-in once ready
              }

              if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
              let attempts = 0;
              pollIntervalRef.current = setInterval(() => {
                attempts++;
                if (isPlaybackDetectedRef.current || attempts > 25) {
                  clearInterval(pollIntervalRef.current);
                  pollIntervalRef.current = null;
                  if (!isPlaybackDetectedRef.current) {
                    triggerReveal();
                  }
                  return;
                }

                if (iframeRef.current && iframeRef.current.contentWindow) {
                  try {
                    iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'playVideo', args: '' }), 'https://www.youtube.com');
                    iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'getPlayerState', args: '' }), 'https://www.youtube.com');
                  } catch (e) {}
                }
              }, 300);
            }}
            style={{
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
            }}
          />
        </div>
      );
    }

    if (bgObj.type === 'image') {
      return (
        <div
          key={bgObj.key}
          className="custom-site-bg"
          style={{
            ...layerStyle,
            backgroundImage: `url('${bgObj.imageUrl}')`,
            filter: isWallpaperFocusMode ? 'none' : 'blur(20px)',
            transition: 'filter 0.3s ease',
          }}
        />
      );
    }

    return null;
  };

  return (
    <>
      {/* Solid Dark Background Base Layer */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: -6,
          backgroundColor: '#090a0f',
          pointerEvents: 'none',
        }}
      />

      {/* Sync Toast Notification */}
      {syncToastMsg && (
        <div
          style={{
            position: 'fixed',
            top: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 2000,
            backgroundColor: 'rgba(16, 185, 129, 0.95)',
            color: '#000',
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

      {/* Background Layer: Current background loaded fresh */}
      {renderBgLayer(currentBg, -4)}

      {/* Unified Overlay Layer: dims background normally, becomes solid black curtain during transitions */}
      <div
        className={`custom-site-bg-overlay ${isBlackCurtainActive ? 'black-curtain-active' : ''}`}
        style={{
          opacity: isWallpaperFocusMode && !isBlackCurtainActive ? 0 : undefined,
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
          {activeTab === 'tracker' && (
            <PrayerTrackerView
              settings={settings}
              onRecordUpdated={handleRecordUpdated}
              isAudioMuted={isAudioMuted}
              onToggleAudio={handleToggleAudio}
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

          {activeTab === 'settings' && (
            <SettingsView
              onSettingsSaved={handleSettingsSaved}
            />
          )}
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
