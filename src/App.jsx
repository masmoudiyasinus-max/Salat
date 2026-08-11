import React, { useState, useRef, useEffect } from 'react';
import { EyeOff, Volume2, VolumeX, RefreshCw } from 'lucide-react';
import Header from './components/Header';
import PrayerTrackerView from './components/PrayerTrackerView';
import DashboardView from './components/DashboardView';
import ChatView from './components/ChatView';
import SettingsView from './components/SettingsView';
import { getSettings } from './services/storage';

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
    // Return null if custom_image mode has no valid image found/inserted yet!
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
  const [syncToastMsg, setSyncToastMsg] = useState('');

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
                '*'
              );
              iframeRef.current.contentWindow.postMessage(
                JSON.stringify({ event: 'command', func: 'setVolume', args: [100] }),
                '*'
              );
            }
          }, delay);
        });
      }
    }
    setSyncToastMsg('تمت مزامنة البث مباشر الآن ✓');
    setTimeout(() => {
      setSyncToastMsg('');
    }, 2500);
  };

  const handleToggleAudio = () => {
    if (!iframeRef.current || !iframeRef.current.contentWindow) return;

    if (fadeTimerRef.current) {
      clearInterval(fadeTimerRef.current);
    }

    if (isAudioMuted) {
      // Instant UI State update (0ms delay)
      setIsAudioMuted(false);

      // Smooth 0.5-Second Fast Fade-In in background (10 steps * 50ms = 500ms)
      let vol = 0;
      iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'setVolume', args: [0] }), '*');
      iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'unMute', args: '' }), '*');

      fadeTimerRef.current = setInterval(() => {
        vol += 10;
        if (vol >= 100) {
          vol = 100;
          clearInterval(fadeTimerRef.current);
        }
        if (iframeRef.current && iframeRef.current.contentWindow) {
          iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'setVolume', args: [vol] }), '*');
        }
      }, 50);
    } else {
      // Instant UI State update (0ms delay)
      setIsAudioMuted(true);

      // Smooth 0.5-Second Fast Fade-Out in background (10 steps * 50ms = 500ms)
      let vol = 100;
      fadeTimerRef.current = setInterval(() => {
        vol -= 10;
        if (vol <= 0) {
          vol = 0;
          clearInterval(fadeTimerRef.current);
          if (iframeRef.current && iframeRef.current.contentWindow) {
            iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'setVolume', args: [0] }), '*');
            iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'mute', args: '' }), '*');
          }
        } else {
          if (iframeRef.current && iframeRef.current.contentWindow) {
            iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'setVolume', args: [vol] }), '*');
          }
        }
      }, 50);
    }
  };

  // Keyboard Shortcuts: 'm' for Audio Toggle, 'f' for Focus Mode Toggle
  useEffect(() => {
    const handleKeyDown = (e) => {
      const targetTag = e.target.tagName ? e.target.tagName.toLowerCase() : '';
      if (targetTag === 'input' || targetTag === 'textarea' || e.target.isContentEditable) {
        return;
      }

      const key = e.key ? e.key.toLowerCase() : '';
      if (key === 'm' || key === 'ك') {
        e.preventDefault();
        handleToggleAudio();
      } else if (key === 'f' || key === 'ب') {
        e.preventDefault();
        setIsWallpaperFocusMode((prev) => !prev);
      } else if (key === 'l' || key === 'م') {
        e.preventDefault();
        handleSyncLiveStream();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAudioMuted]);

  const [currentBg, setCurrentBg] = useState(() => {
    return getDesiredBg(settings) || { type: 'video', videoId: 'm9-Umj3aL1I', key: 'makkah' };
  });
  const [curtainOpacity, setCurtainOpacity] = useState(0);
  const [isChangingBg, setIsChangingBg] = useState(false);

  // 1. Seamless 2-phase transition using a Front Black Curtain Overlay
  useEffect(() => {
    const desired = getDesiredBg(settings);
    if (!desired || desired.key === currentBg.key || isChangingBg) return;

    setIsChangingBg(true);
    hasSyncedNewBgRef.current = false;

    // Wait 0.5s (500ms) before starting the Black Curtain Fade In
    let swapTimer = null;
    const startDelayTimer = setTimeout(() => {
      // Phase 1: Fade IN Black Curtain over 500ms to hide screen cleanly
      setCurtainOpacity(1);

      // Phase 2: After 500ms (screen is pure black), unmount old stream and mount new stream fresh
      swapTimer = setTimeout(() => {
        setCurrentBg(desired);
      }, 500);
    }, 500);

    // Fallback safety timer to fade out curtain even if iframe load is delayed
    const fallbackTimer = setTimeout(() => {
      setCurtainOpacity(0);
      setIsChangingBg(false);
    }, 5000);

    return () => {
      clearTimeout(startDelayTimer);
      if (swapTimer) clearTimeout(swapTimer);
      clearTimeout(fallbackTimer);
    };
  }, [settings.bgMode, settings.activeCustomBgImage, settings.youtubeLiveUrl]);

  // Preserve user audio state across background stream changes
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
              // Register YouTube API listening command
              if (iframeRef.current && iframeRef.current.contentWindow) {
                try {
                  iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'listening' }), '*');
                } catch (e) {}
              }

              // Restore unmuted audio state if user had audio open
              if (!isAudioMuted && iframeRef.current && iframeRef.current.contentWindow) {
                const applyAudio = () => {
                  if (iframeRef.current && iframeRef.current.contentWindow) {
                    iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'unMute', args: '' }), '*');
                    iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'setVolume', args: [100] }), '*');
                  }
                };
                applyAudio();
                setTimeout(applyAudio, 400);
                setTimeout(applyAudio, 1000);
              }

              // Phase 3: Allow YouTube player GPU decoder 1.4s of playing frames behind curtain, then smoothly fade out curtain (1.5s)!
              if (!hasSyncedNewBgRef.current) {
                hasSyncedNewBgRef.current = true;
                setSyncToastMsg('تمت مزامنة البث مباشر الآن ✓');
                setTimeout(() => {
                  setSyncToastMsg('');
                }, 2500);

                setTimeout(() => {
                  setCurtainOpacity(0); // Ultra-smooth 1.5s Fade Out of Black Curtain!
                  setIsChangingBg(false);
                }, 1400);
              }
            }}
            style={{
              width: '100vw',
              height: '100vh',
              pointerEvents: 'none',
              transform: 'scale(1.35) translateZ(0)',
              WebkitTransform: 'scale(1.35) translateZ(0)',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              border: 'none',
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

      {/* Front Black Curtain Layer: Fades in to hide old stream, then fades out smoothly (1.5s) AFTER YouTube video is playing! */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: -3,
          backgroundColor: '#090a0f',
          pointerEvents: 'none',
          willChange: 'opacity',
          transform: 'translateZ(0)',
          WebkitTransform: 'translateZ(0)',
          transition: 'opacity 1.5s cubic-bezier(0.25, 1, 0.5, 1)',
          opacity: curtainOpacity,
        }}
      />

      {/* Overlay to dim background for readability */}
      <div
        className="custom-site-bg-overlay"
        style={{
          opacity: isWallpaperFocusMode ? 0 : 1,
          transition: 'opacity 0.3s ease',
        }}
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
        <Header
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          settings={settings}
          onToggleFocusMode={() => setIsWallpaperFocusMode(true)}
        />

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
            <DashboardView key={refreshTrigger} />
          )}

          {activeTab === 'chat' && (
            <ChatView
              settings={settings}
              onNavigateToSettings={() => setActiveTab('settings')}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              onSettingsSaved={handleSettingsSaved}
            />
          )}
        </main>
      </div>

      {/* Fixed Bottom Left Live Stream Controls Badge when Live Video is Active */}
      {currentBg?.type === 'video' && !isWallpaperFocusMode && (
        <div
          style={{
            position: 'fixed',
            bottom: '16px',
            left: '16px',
            zIndex: 900,
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
          }}
        >
          <button
            type="button"
            className="btn-secondary"
            onClick={handleSyncLiveStream}
            style={{
              padding: '6px 14px',
              fontSize: '0.8rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              borderColor: 'rgba(16, 185, 129, 0.4)',
              color: 'var(--text-primary)',
              borderRadius: 'var(--radius-pill)',
            }}
            id="badge-sync-live-btn"
            title="المزامنة الفورية مع البث المباشر للتأكد من عدم التأخير"
          >
            <span className="pulse-dot" style={{ width: '7px', height: '7px', backgroundColor: 'var(--status-on-time)' }}></span>
            <RefreshCw size={13} style={{ color: 'var(--status-on-time)' }} />
            <span>مباشر الآن</span>
          </button>

          <button
            type="button"
            className="btn-secondary"
            onClick={handleToggleAudio}
            style={{
              padding: '6px 14px',
              fontSize: '0.8rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              borderColor: isAudioMuted ? 'rgba(255, 255, 255, 0.15)' : 'var(--status-on-time)',
              color: isAudioMuted ? 'var(--text-secondary)' : 'var(--status-on-time)',
              borderRadius: 'var(--radius-pill)',
            }}
            id="badge-stream-audio-btn"
          >
            {isAudioMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            <span>{isAudioMuted ? 'تشغيل الصوت' : 'كتم الصوت'}</span>
          </button>
        </div>
      )}

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
                  padding: '7px 16px',
                  fontSize: '0.84rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                  borderColor: 'rgba(16, 185, 129, 0.4)',
                  color: 'var(--text-primary)',
                }}
                id="focus-sync-live-btn"
                title="المزامنة الفورية مع نقطة البث المباشر الفعالية"
              >
                <span className="pulse-dot" style={{ width: '7px', height: '7px', backgroundColor: 'var(--status-on-time)' }}></span>
                <RefreshCw size={14} style={{ color: 'var(--status-on-time)' }} />
                <span>مباشر الآن</span>
              </button>

              <button
                type="button"
                className="btn-secondary"
                onClick={handleToggleAudio}
                style={{
                  padding: '7px 16px',
                  fontSize: '0.84rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                  borderColor: isAudioMuted ? 'var(--border-subtle)' : 'var(--status-on-time)',
                  color: isAudioMuted ? 'var(--text-secondary)' : 'var(--status-on-time)',
                }}
                id="focus-stream-audio-btn"
              >
                {isAudioMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                <span>{isAudioMuted ? 'تشغيل الصوت (تدرج 0.5 ثانية)' : 'كتم الصوت'}</span>
              </button>
            </>
          )}

          <button
            className="btn-secondary"
            onClick={() => setIsWallpaperFocusMode(false)}
            style={{
              padding: '7px 18px',
              fontSize: '0.84rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
            }}
            id="exit-focus-mode-btn"
          >
            <EyeOff size={15} />
            <span>إغلاق العرض والعودة</span>
          </button>
        </div>
      )}
    </>
  );
}
