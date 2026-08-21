import React, { useState, useRef, useEffect, useCallback } from 'react';
import { EyeOff, Volume2, VolumeX, RefreshCw } from 'lucide-react';
import Header from './components/Header';
import PrayerTrackerView from './components/PrayerTrackerView';
import ChatView from './components/ChatView';
import BookReaderView from './components/BookReaderView';
import TasbeehView from './components/TasbeehView';
import AudioPlayerView from './components/AudioPlayerView';
import SettingsView from './components/SettingsView';
import MuneerToastNotification from './components/MuneerToastNotification';
import { getSettings, saveSettings, getRecords, getPrayerTimesCache, APP_EVENTS } from './services/storage';
import { checkAndNotifyCurrentAdhan } from './services/permissionService';
import { autoDetectAndInitializeWorldLocation } from './services/adhanCalculator.js';
import { ensureDailySuggestions } from './services/dailySuggestionsService.js';
import { AUDIO_EVENTS } from './services/audioStorage.js';
import {
  dispatchMuneerSignal,
  MUNEER_SIGNALS,
  recordTabSwitchAndCheck,
  recordBgSwitchAndCheck,
  evaluatePrayerExpiryRisk,
} from './services/muneerSignalService.js';

/**
 * Proactively senses image decoding readiness in memory before lifting transition curtain.
 */
function checkImageReadiness(url) {
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

function getAllAvailableScenes(settings, isOnline = true) {
  const scenes = [];

  // Live video streams are only available when online
  if (isOnline) {
    scenes.push(
      { mode: 'makkah', type: 'video', id: 'makkah', nameAr: 'بث مباشر للحرم المكي', nameEn: 'Makkah Live Stream' },
      { mode: 'madinah', type: 'video', id: 'madinah', nameAr: 'بث مباشر للمسجد النبوي', nameEn: 'Madinah Live Stream' }
    );
  }

  // Nature & custom image wallpaper (available online and offline)
  scenes.push({
    mode: 'custom_image',
    type: 'image',
    id: 'custom_image',
    nameAr: 'خلفية الطبيعة والصور',
    nameEn: 'Nature & Custom Wallpaper',
  });

  return scenes;
}

function getDesiredBg(settings, isOnline = true) {
  const mode = settings?.bgMode || 'makkah';

  // If user is offline, live YouTube video streams cannot load. Automatically select image wallpaper!
  if (!isOnline && (mode === 'makkah' || mode === 'madinah')) {
    const activeImg = settings?.activeCustomBgImage || (Array.isArray(settings?.customBgImages) && settings.customBgImages[0]) || '/nature-meadow.jpg';
    return {
      type: 'image',
      url: activeImg,
      imageUrl: activeImg,
      key: activeImg || 'nature-meadow',
      isOfflineFallback: true,
    };
  }

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
    const activeImg = settings?.activeCustomBgImage || (Array.isArray(settings?.customBgImages) && settings.customBgImages[0]) || '/nature-meadow.jpg';
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
  const [activeTab, setActiveTab] = useState('tracker'); // 'tracker', 'chat', 'books', 'tasbeeh', 'settings'
  const [settings, setSettings] = useState(() => getSettings());
  const [isWallpaperFocusMode, setIsWallpaperFocusMode] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(true);
  const isAudioMutedRef = useRef(true);
  const [syncToastMsg, setSyncToastMsg] = useState('');
  const [isReaderActive, setIsReaderActive] = useState(false);
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const lastTabSwitchTimeRef = useRef(0);
  const activeTabRef = useRef(activeTab);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      const isEn = settings?.language === 'en';
      setSyncToastMsg(isEn ? 'Internet connection restored — Online features unlocked' : 'تمت استعادة الاتصال بالإنترنت — فتح جميع الميزات السحابية بنجاح');
      setTimeout(() => setSyncToastMsg(''), 3500);
    };
    const handleOffline = () => {
      setIsOnline(false);
      const isEn = settings?.language === 'en';
      setSyncToastMsg(isEn ? 'Internet disconnected — Offline mode active (Cloud features locked)' : 'انقطع الاتصال بالإنترنت — تم تفعيل وضع عدم الاتصال وقفل الميزات السحابية');
      setTimeout(() => setSyncToastMsg(''), 3500);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [settings?.language]);

  // Throttled 0.5s navigation handler preventing frantic page switching
  const handleNavigateTab = useCallback((targetTab) => {
    if (isWallpaperFocusMode || targetTab === activeTabRef.current) return;
    recordTabSwitchAndCheck();
    const now = Date.now();
    if (now - lastTabSwitchTimeRef.current < 500) {
      return; // Cooldown 0.5s to prevent frantic switching
    }
    lastTabSwitchTimeRef.current = now;
    setActiveTab(targetTab);
  }, [isWallpaperFocusMode]);

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
      }
    };
    window.addEventListener(APP_EVENTS.SETTINGS_UPDATED, handleSettingsUpdated);
    return () => window.removeEventListener(APP_EVENTS.SETTINGS_UPDATED, handleSettingsUpdated);
  }, []);

  // Automatic Zero-Click World Location & Accurate Astronomical Calculation on Boot
  useEffect(() => {
    autoDetectAndInitializeWorldLocation();
  }, []);

  // Proactive Background Daily Suggestions Pre-fetching (runs on app boot without needing to open chat)
  useEffect(() => {
    const apiKey = (settings?.geminiApiKey || '').trim();
    if (!apiKey) return;
    const lang = settings?.language === 'en' ? 'en' : 'ar';
    ensureDailySuggestions(apiKey, lang).catch(() => {});
  }, [settings?.geminiApiKey, settings?.language]);

  // Background Adhan Alerts & Prayer Expiry Risk Monitoring
  useEffect(() => {
    // Check for Adhan alert and Prayer Expiry Risk every 30 seconds (runs continuously even when tab is minimized)
    const adhanTimer = setInterval(() => {
      const prayerTimes = getPrayerTimesCache();
      checkAndNotifyCurrentAdhan(prayerTimes, settings?.language);
      const risk = evaluatePrayerExpiryRisk(prayerTimes, getRecords());
      if (risk) {
        dispatchMuneerSignal(MUNEER_SIGNALS.PRAYER_EXPIRY_RISK, risk);
      }
    }, 30000);

    return () => clearInterval(adhanTimer);
  }, [settings?.language]);

  const makkahIframeRef = useRef(null);
  const madinahIframeRef = useRef(null);
  const fadeTimerRef = useRef(null);
  const chatAudioMuteTimerRef = useRef(null);
  const chatAudioRestoreTimerRef = useRef(null);
  const wasAudioActiveBeforeChatRef = useRef(false);

  const handleSettingsSaved = (newSettings) => {
    setSettings(newSettings);
  };

  const handleRecordUpdated = () => {
    // Record updated event handler
  };

  const handleToggleAudio = useCallback((isAutoTrigger = false) => {
    if (!isAutoTrigger) {
      // User manual toggle overrides automatic chat restore
      wasAudioActiveBeforeChatRef.current = false;
    }
    const currentSettings = getSettings();
    const mode = currentSettings?.bgMode || settings?.bgMode || 'makkah';
    if (mode === 'custom_image' && isAudioMutedRef.current) return;

    const activeIframe = mode === 'madinah' ? madinahIframeRef.current : makkahIframeRef.current;
    if (!activeIframe || !activeIframe.contentWindow) return;

    if (fadeTimerRef.current) {
      clearInterval(fadeTimerRef.current);
    }

    const nextMuted = !isAudioMutedRef.current;
    setIsAudioMuted(nextMuted);
    isAudioMutedRef.current = nextMuted;

    if (!nextMuted) {
      // Instant UI State update & Smooth Fade-In
      let vol = 0;
      try {
        activeIframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'setVolume', args: [0] }), 'https://www.youtube.com');
        activeIframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'unMute', args: '' }), 'https://www.youtube.com');
      } catch {}

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
          } catch {}
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
            } catch {}
          }
        } else {
          if (activeIframe && activeIframe.contentWindow) {
            try {
              activeIframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'setVolume', args: [vol] }), 'https://www.youtube.com');
            } catch {}
          }
        }
      }, 50);
    }
  }, [settings?.bgMode]);

  // Smart Chat Tab Audio Management: Automatically triggers audio mute 10s after entering Chat, and restores immediately upon leaving Chat
  useEffect(() => {
    if (chatAudioMuteTimerRef.current) {
      clearTimeout(chatAudioMuteTimerRef.current);
      chatAudioMuteTimerRef.current = null;
    }
    if (chatAudioRestoreTimerRef.current) {
      clearTimeout(chatAudioRestoreTimerRef.current);
      chatAudioRestoreTimerRef.current = null;
    }

    if (activeTab === 'chat') {
      if (!isAudioMutedRef.current) {
        wasAudioActiveBeforeChatRef.current = true;
        chatAudioMuteTimerRef.current = setTimeout(() => {
          if (activeTabRef.current === 'chat' && !isAudioMutedRef.current) {
            handleToggleAudio(true);
          }
        }, 10000);
      }
    } else {
      if (wasAudioActiveBeforeChatRef.current) {
        wasAudioActiveBeforeChatRef.current = false;
        // User directive: Immediately restore audio upon leaving chat
        if (isAudioMutedRef.current) {
          handleToggleAudio(true);
        }
      }
    }

    return () => {
      if (chatAudioMuteTimerRef.current) {
        clearTimeout(chatAudioMuteTimerRef.current);
        chatAudioMuteTimerRef.current = null;
      }
      if (chatAudioRestoreTimerRef.current) {
        clearTimeout(chatAudioRestoreTimerRef.current);
        chatAudioRestoreTimerRef.current = null;
      }
    };
  }, [activeTab, handleToggleAudio]);

  // When local audio playback starts in Audio Player, mute live background stream if unmuted
  useEffect(() => {
    const handleAudioPlayStarted = () => {
      if (!isAudioMutedRef.current) {
        handleToggleAudio();
      }
    };
    window.addEventListener(AUDIO_EVENTS.PLAYBACK_STARTED, handleAudioPlayStarted);
    return () => window.removeEventListener(AUDIO_EVENTS.PLAYBACK_STARTED, handleAudioPlayStarted);
  }, [handleToggleAudio]);

  const handleSyncLiveStream = useCallback(() => {
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
                JSON.stringify({ event: 'command', func: 'unMute' }),
                '*'
              );
            }
          }, delay);
        });
      }
    }
    const isEn = settings?.language === 'en';
    setSyncToastMsg(isEn ? 'Synced with live broadcast' : 'تمت المزامنة المباشرة مع البث');
    setTimeout(() => {
      setSyncToastMsg('');
    }, 2200);
  }, [isAudioMuted, settings?.bgMode, settings?.language]);

  const handleNavigateBg = useCallback((direction = 1) => {
    recordBgSwitchAndCheck();
    const currentSettings = getSettings();
    const scenes = getAllAvailableScenes(currentSettings, isOnline);
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
  }, [isOnline]);

  // Keyboard Shortcuts: 'm' for Audio, 'f' for Focus Mode, 'l' for Live Sync, ArrowUp/ArrowDown for Page Navigation, ArrowLeft/ArrowRight for Background Switching, 1-6 for Direct Tab Switching
  useEffect(() => {
    const tabs = ['tracker', 'chat', 'books', 'tasbeeh', 'audio', 'settings'];

    const digitMap = {
      '1': 'tracker', '١': 'tracker', 'Digit1': 'tracker', 'Numpad1': 'tracker',
      '2': 'chat',    '٢': 'chat',    'Digit2': 'chat',    'Numpad2': 'chat',
      '3': 'books',   '٣': 'books',   'Digit3': 'books',   'Numpad3': 'books',
      '4': 'tasbeeh', '٤': 'tasbeeh', 'Digit4': 'tasbeeh', 'Numpad4': 'tasbeeh',
      '5': 'audio',   '٥': 'audio',   'Digit5': 'audio',   'Numpad5': 'audio',
      '6': 'settings','٦': 'settings','Digit6': 'settings','Numpad6': 'settings',
    };

    const handleKeyDown = (e) => {
      // If book reader is currently open in active reading mode, completely mute global shortcuts!
      if (isReaderActive) return;

      const targetTag = e.target && e.target.tagName ? e.target.tagName.toLowerCase() : '';
      if (targetTag === 'input' || targetTag === 'textarea' || (e.target && e.target.isContentEditable)) {
        return;
      }

      const key = e.key || '';
      const code = e.code || '';

      // Direct numeric tab shortcuts: 1 -> tracker, 2 -> chat, 3 -> books, 4 -> tasbeeh, 5 -> settings
      const targetTab = digitMap[key] || digitMap[code];
      if (targetTab) {
        e.preventDefault();
        handleNavigateTab(targetTab);
        return;
      }

      if (key === 'ArrowUp' || key === 'Up' || code === 'ArrowUp') {
        e.preventDefault();
        if (isWallpaperFocusMode) return;
        const now = Date.now();
        if (now - lastTabSwitchTimeRef.current < 500) return;
        lastTabSwitchTimeRef.current = now;
        setActiveTab((prev) => {
          const idx = tabs.indexOf(prev);
          const prevIdx = idx > 0 ? idx - 1 : tabs.length - 1;
          return tabs[prevIdx];
        });
      } else if (key === 'ArrowDown' || key === 'Down' || code === 'ArrowDown') {
        e.preventDefault();
        if (isWallpaperFocusMode) return;
        const now = Date.now();
        if (now - lastTabSwitchTimeRef.current < 500) return;
        lastTabSwitchTimeRef.current = now;
        setActiveTab((prev) => {
          const idx = tabs.indexOf(prev);
          const nextIdx = idx < tabs.length - 1 ? idx + 1 : 0;
          return tabs[nextIdx];
        });
      } else if (key === 'ArrowRight' || key === 'Right' || code === 'ArrowRight') {
        e.preventDefault();
        const isRtl = document.documentElement.dir === 'rtl';
        handleNavigateBg(isRtl ? -1 : 1);
      } else if (key === 'ArrowLeft' || key === 'Left' || code === 'ArrowLeft') {
        e.preventDefault();
        const isRtl = document.documentElement.dir === 'rtl';
        handleNavigateBg(isRtl ? 1 : -1);
      } else {
        const lowerKey = key ? key.toLowerCase() : '';
        if (lowerKey === 'm' || lowerKey === 'ك' || lowerKey === 'ة' || code === 'KeyM') {
          e.preventDefault();
          handleToggleAudio();
        } else if (lowerKey === 'f' || lowerKey === 'ب' || code === 'KeyF') {
          e.preventDefault();
          setIsWallpaperFocusMode((prev) => !prev);
        } else if (lowerKey === 'l' || lowerKey === 'م' || code === 'KeyL') {
          e.preventDefault();
          handleSyncLiveStream();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNavigateBg, handleNavigateTab, handleSyncLiveStream, handleToggleAudio, isReaderActive, isWallpaperFocusMode]);

  // Synchronously compute current background directly from settings & online state for 100% instant reactivity
  const currentBg = getDesiredBg(settings, isOnline) || { type: 'image', url: '/nature-meadow.jpg', key: 'nature-meadow' };
  const currentBgKey = currentBg.key || (isOnline ? (settings?.bgMode || 'makkah') : 'custom_image');
  const targetIsImage = currentBg.type === 'image' || !isOnline || settings?.bgMode === 'custom_image';
  const targetImageUrl = targetIsImage
    ? (currentBg.url || settings?.activeCustomBgImage || (Array.isArray(settings?.customBgImages) && settings.customBgImages[0]) || '/nature-meadow.jpg')
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
        } catch {}
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
            } catch {}
          }
        });
      } else {
        const prevIframe = currentBgKey === 'madinah' ? makkahIframeRef.current : madinahIframeRef.current;
        if (prevIframe && prevIframe.contentWindow) {
          try {
            prevIframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'setVolume', args: [0] }), 'https://www.youtube.com');
            prevIframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'mute', args: '' }), 'https://www.youtube.com');
          } catch {}
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
        setTimeout(() => {
          if (isCancelled) return;
          const targetIframe = currentBgKey === 'madinah' ? madinahIframeRef.current : makkahIframeRef.current;
          if (targetIframe && targetIframe.contentWindow) {
            try {
              targetIframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'seekTo', args: [99999999, true] }), 'https://www.youtube.com');
              targetIframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'playVideo', args: '' }), 'https://www.youtube.com');
            } catch {}

            // Unmute target stream if audio was active
            if (!isAudioMutedRef.current) {
              try {
                targetIframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'unMute', args: '' }), 'https://www.youtube.com');
                targetIframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'setVolume', args: [100] }), 'https://www.youtube.com');
              } catch {}
            }
          }
        }, 150);
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
    transform: isWallpaperFocusMode
      ? 'translate(-50%, -50%) scale(1.05) translateZ(0)'
      : 'translate(-50%, -50%) scale(1.18) translateZ(0)',
    WebkitTransform: isWallpaperFocusMode
      ? 'translate(-50%, -50%) scale(1.05) translateZ(0)'
      : 'translate(-50%, -50%) scale(1.18) translateZ(0)',
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
    pointerEvents: 'none',
    border: 'none',
    filter: isWallpaperFocusMode ? 'none' : 'blur(20px)',
    transition: 'filter 0.3s ease, transform 0.3s ease, -webkit-transform 0.3s ease',
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
      {/* Real-time Proactive Floating Toast Notification from Sheikh Muneer */}
      <MuneerToastNotification />

      {/* Layer -4: Exclusive Active Background Stage (Zero background overhead) */}
      {/* Makkah Live Stream */}
      {displayedMode === 'makkah' && (
        <div
          key="makkah_layer"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: -4,
            pointerEvents: 'none',
            overflow: 'hidden',
            backgroundColor: '#0a0a0a',
            opacity: 1,
            visibility: 'visible',
            animation: 'fadeIn 0.35s ease-out',
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
      )}

      {/* Madinah Live Stream */}
      {displayedMode === 'madinah' && (
        <div
          key="madinah_layer"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: -4,
            pointerEvents: 'none',
            overflow: 'hidden',
            backgroundColor: '#0a0a0a',
            opacity: 1,
            visibility: 'visible',
            animation: 'fadeIn 0.35s ease-out',
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
      )}

      {/* Custom Image Layer */}
      {displayedMode === 'custom_image' && displayedImageUrl && (
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
            opacity: 1,
            visibility: 'visible',
            filter: isWallpaperFocusMode ? 'none' : 'blur(20px)',
            transform: isWallpaperFocusMode ? 'scale(1) translateZ(0)' : 'scale(1.12) translateZ(0)',
            WebkitTransform: isWallpaperFocusMode ? 'scale(1) translateZ(0)' : 'scale(1.12) translateZ(0)',
            transformOrigin: 'center center',
            transition: 'filter 0.3s ease, transform 0.3s ease, -webkit-transform 0.3s ease',
            animation: 'fadeIn 0.35s ease-out',
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
        setActiveTab={handleNavigateTab}
        settings={settings}
        onToggleFocusMode={() => setIsWallpaperFocusMode((prev) => !prev)}
        isLiveVideo={currentBg?.type === 'video'}
        isWallpaperFocusMode={isWallpaperFocusMode}
        isOnline={isOnline}
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
          <div className={`view-pane ${activeTab === 'tracker' ? 'active' : 'hidden'}`}>
            <PrayerTrackerView
              settings={settings}
              onRecordUpdated={handleRecordUpdated}
              isAudioMuted={isAudioMuted}
              onToggleAudio={handleToggleAudio}
              onNavigateToSettings={() => handleNavigateTab('settings')}
            />
          </div>

          <div className={`view-pane ${activeTab === 'chat' ? 'active' : 'hidden'}`}>
            <ChatView
              settings={settings}
              onNavigateToSettings={() => handleNavigateTab('settings')}
              onSettingsSaved={handleSettingsSaved}
              isActive={activeTab === 'chat'}
              isOnline={isOnline}
            />
          </div>

          <div className={`view-pane ${activeTab === 'books' ? 'active' : 'hidden'}`}>
            <BookReaderView
              key="book-reader-view"
              settings={settings}
              onStartReading={handleStartReading}
              onExitReading={handleExitReading}
              isReaderActive={isReaderActive}
              setIsReaderActive={setIsReaderActive}
            />
          </div>

          <div className={`view-pane ${activeTab === 'tasbeeh' ? 'active' : 'hidden'}`}>
            <TasbeehView settings={settings} isActive={activeTab === 'tasbeeh'} />
          </div>

          <div className={`view-pane ${activeTab === 'audio' ? 'active' : 'hidden'}`}>
            <AudioPlayerView settings={settings} isActive={activeTab === 'audio'} />
          </div>

          <div className={`view-pane ${activeTab === 'settings' ? 'active' : 'hidden'}`}>
            <SettingsView
              settings={settings}
              onSettingsSaved={handleSettingsSaved}
              isOnline={isOnline}
            />
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
            backgroundColor: 'rgba(18, 18, 18, 0.88)',
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
