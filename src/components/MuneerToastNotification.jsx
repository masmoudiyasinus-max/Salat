import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { APP_EVENTS } from '../services/prayerConstants';
import { formatMarkdownText } from '../services/markdownFormatter';
import { sendBrowserNotification } from '../services/permissionService';

export default function MuneerToastNotification() {
  const [toastData, setToastData] = useState(null); // { id, signalType, fullText }
  const [status, setStatus] = useState('idle'); // 'idle' | 'generating' | 'streaming' | 'completed'
  const [animState, setAnimState] = useState('hidden'); // 'hidden' | 'entering' | 'visible' | 'exiting'
  const [displayedText, setDisplayedText] = useState('');

  const toastRef = useRef(null);
  const isHoveredRef = useRef(false);
  const typewriterTimeoutRef = useRef(null);
  const autoDismissTimerRef = useRef(null);
  const exitTimerRef = useRef(null);

  const updateClearanceOffset = useCallback((height) => {
    if (typeof document !== 'undefined') {
      if (height > 0) {
        document.documentElement.style.setProperty('--muneer-toast-offset', `${height + 24}px`);
      } else {
        document.documentElement.style.setProperty('--muneer-toast-offset', '0px');
      }
    }
  }, []);

  const clearAllTimers = useCallback(() => {
    if (typewriterTimeoutRef.current) {
      clearTimeout(typewriterTimeoutRef.current);
      typewriterTimeoutRef.current = null;
    }
    if (autoDismissTimerRef.current) {
      clearTimeout(autoDismissTimerRef.current);
      autoDismissTimerRef.current = null;
    }
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
  }, []);

  const handleDismiss = useCallback(() => {
    clearAllTimers();
    updateClearanceOffset(0);
    setAnimState('exiting');
    exitTimerRef.current = setTimeout(() => {
      setAnimState('hidden');
      setStatus('idle');
      setToastData(null);
      setDisplayedText('');
    }, 280);
  }, [clearAllTimers, updateClearanceOffset]);

  const startAutoDismiss = useCallback((duration = 10000) => {
    if (autoDismissTimerRef.current) {
      clearTimeout(autoDismissTimerRef.current);
      autoDismissTimerRef.current = null;
    }
    // Hover invariant: If user is hovering over the toast, it NEVER disappears
    if (isHoveredRef.current) {
      return;
    }
    autoDismissTimerRef.current = setTimeout(() => {
      handleDismiss();
    }, duration);
  }, [handleDismiss]);

  const handleMouseEnter = useCallback(() => {
    isHoveredRef.current = true;
    if (autoDismissTimerRef.current) {
      clearTimeout(autoDismissTimerRef.current);
      autoDismissTimerRef.current = null;
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    isHoveredRef.current = false;
    if (status === 'completed') {
      startAutoDismiss(10000);
    }
  }, [status, startAutoDismiss]);

  // Adjust clearance of lower frames whenever toast mounts or content height updates
  useLayoutEffect(() => {
    if (animState === 'hidden' || animState === 'exiting' || !toastData) {
      updateClearanceOffset(0);
      return;
    }

    if (toastRef.current) {
      const h = toastRef.current.offsetHeight || 50;
      updateClearanceOffset(h);
    }
  }, [animState, toastData, status, displayedText, updateClearanceOffset]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      if (typeof document !== 'undefined') {
        document.documentElement.style.setProperty('--muneer-toast-offset', '0px');
      }
    };
  }, []);

  // 1. Listen for Generation Start (Prompt submitted to AI)
  useEffect(() => {
    const handleStart = (e) => {
      clearAllTimers();
      const signalType = e.detail?.signalType || '';
      setToastData({
        id: Date.now().toString(),
        signalType,
        fullText: '',
      });
      setStatus('generating');
      setDisplayedText('');
      setAnimState('entering');

      setTimeout(() => {
        setAnimState('visible');
      }, 40);
    };

    window.addEventListener(APP_EVENTS.MUNEER_PROACTIVE_START, handleStart);
    return () => {
      window.removeEventListener(APP_EVENTS.MUNEER_PROACTIVE_START, handleStart);
    };
  }, [clearAllTimers]);

  // 2. Listen for Generation Complete / Text Ready
  useEffect(() => {
    const handleMessage = (e) => {
      const detail = e.detail;
      if (detail?.cancelled) {
        handleDismiss();
        return;
      }

      const text = detail?.text || detail?.message?.text;
      if (!text || !text.trim()) {
        handleDismiss();
        return;
      }

      const cleanText = text.trim();
      const signalType = detail?.signalType || '';

      // Send prominent native browser notification (visible even when outside the site in OS notification center)
      if (!detail?.skipBrowserNotification) {
        const isEn = typeof document !== 'undefined' && document.documentElement.lang === 'en';
        const isCriticalRisk = signalType === 'PRAYER_EXPIRY_RISK';
        const notifTitle = isCriticalRisk
          ? (isEn ? 'High Priority Alert: Prayer Expiry Risk' : 'تحذير عالي الأهمية: اقتراب خروج وقت الصلاة — الشيخ منير')
          : (isEn ? 'Sheikh Muneer' : 'الشيخ منير');

        sendBrowserNotification(notifTitle, cleanText, {
          tag: isCriticalRisk ? 'muneer-critical-prayer-expiry' : `muneer-${signalType || 'guidance'}`,
          requireInteraction: isCriticalRisk, // Critical risk notifications stay pinned on screen
        });
      }

      setToastData((prev) => ({
        id: prev?.id || Date.now().toString(),
        signalType: signalType || prev?.signalType || '',
        fullText: cleanText,
      }));

      // Transition to streaming state
      setStatus('streaming');
      if (animState === 'hidden') {
        setAnimState('entering');
        setTimeout(() => setAnimState('visible'), 40);
      }

      // Exact Tokenization matching original ChatView typewriter engine
      const tokens = cleanText.match(/\S+\s*|\s+/g) || [cleanText];
      const totalTokens = tokens.length;
      let currentTokenIdx = 0;

      if (typewriterTimeoutRef.current) {
        clearTimeout(typewriterTimeoutRef.current);
        typewriterTimeoutRef.current = null;
      }

      const typeNext = () => {
        if (currentTokenIdx >= totalTokens) {
          if (typewriterTimeoutRef.current) {
            clearTimeout(typewriterTimeoutRef.current);
            typewriterTimeoutRef.current = null;
          }
          setDisplayedText(cleanText);
          setStatus('completed');

          // STRICT USER REQUIREMENT: Wait 10 seconds after message completion before auto-dismiss (unless hovered)
          startAutoDismiss(10000);
          return;
        }

        currentTokenIdx += 1;
        const currentToken = tokens[currentTokenIdx - 1] || '';
        const partialText = tokens.slice(0, currentTokenIdx).join('');
        setDisplayedText(partialText);

        // Exact natural human-like cadence matching ChatView (300ms - 700ms per word)
        const minDelay = 300;
        const maxDelay = 700;
        let nextDelayMs = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;

        // Exact Punctuation pauses matching ChatView
        if (currentTokenIdx < totalTokens) {
          if (/[.؟?!…]/.test(currentToken)) {
            nextDelayMs += 1000;
          } else if (/[،,؛;:]/.test(currentToken)) {
            nextDelayMs += 600;
          }
        }

        typewriterTimeoutRef.current = setTimeout(typeNext, nextDelayMs);
      };

      // Start typing immediately after a brief initial pause (matching ChatView 80ms)
      typewriterTimeoutRef.current = setTimeout(typeNext, 80);
    };

    window.addEventListener(APP_EVENTS.MUNEER_PROACTIVE_MESSAGE, handleMessage);
    return () => {
      window.removeEventListener(APP_EVENTS.MUNEER_PROACTIVE_MESSAGE, handleMessage);
      clearAllTimers();
    };
  }, [handleDismiss, animState, clearAllTimers, startAutoDismiss]);

  if (animState === 'hidden' || !toastData) return null;

  const isExiting = animState === 'exiting';

  return ReactDOM.createPortal(
    <div
      ref={toastRef}
      role="alert"
      aria-live="polite"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        position: 'fixed',
        top: '24px',
        left: '50%',
        transform: isExiting
          ? 'translateX(-50%) translateY(-24px) scale(0.96)'
          : 'translateX(-50%) translateY(0) scale(1)',
        opacity: isExiting ? 0 : 1,
        transition: 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.24s ease',
        zIndex: 999999,
        width: status === 'generating' ? 'auto' : 'min(92vw, 560px)',
        pointerEvents: 'auto',
        cursor: 'default',
      }}
    >
      <div
        className="glass-frame bento-card"
        style={{
          background: 'rgba(10, 10, 10, 0.88)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.14)',
          borderRadius: '18px',
          padding: status === 'generating' ? '12px 20px' : '16px 20px',
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: status === 'generating' ? 'center' : 'flex-start',
          direction: 'rtl',
          transition: 'all 0.25s ease',
        }}
      >
        {/* Pure Minimalist Body: Only the 3 Dots during thinking, or Only the Typed Response Text */}
        {status === 'generating' ? (
          <div
            className="typing-indicator-pill"
            id="ai-typing-indicator"
            aria-label="جاري التفكير..."
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '2px 6px',
            }}
          >
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </div>
        ) : (
          <div
            style={{
              fontSize: '0.95rem',
              lineHeight: '1.7',
              color: '#f3f4f6',
              position: 'relative',
              margin: 0,
              width: '100%',
            }}
          >
            {formatMarkdownText(displayedText, status === 'streaming')}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
