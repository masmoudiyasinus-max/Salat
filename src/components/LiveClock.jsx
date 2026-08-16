import React, { useState, useEffect } from 'react';
import { getCityNowDate, toWesternDigits } from '../services/storage';

export default function LiveClock({ timezone, timeFormat = '12', language = 'ar' }) {
  const [nowTime, setNowTime] = useState(() => {
    const d = getCityNowDate(timezone);
    return isNaN(d.getTime()) ? new Date() : d;
  });

  useEffect(() => {
    const updateClock = () => {
      if (document.hidden) return;
      const cityNow = getCityNowDate(timezone);
      setNowTime(isNaN(cityNow.getTime()) ? new Date() : cityNow);
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) updateClock();
    };

    const timer = setInterval(updateClock, 1000);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [timezone]);

  const isEn = language === 'en';
  const is12Hour = (timeFormat || '12') === '12';

  const liveClockTime = isEn
    ? nowTime.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: is12Hour,
      })
    : toWesternDigits(
        nowTime.toLocaleTimeString('ar-EG-u-nu-latn', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: is12Hour,
        })
      );

  const gregorianDateFormatted = isEn
    ? nowTime.toLocaleDateString('en-US', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : toWesternDigits(
        nowTime.toLocaleDateString('ar-EG-u-nu-latn', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      );

  const hijriDateFormatted = isEn
    ? `${nowTime.toLocaleDateString('en-US-u-ca-islamic-umalqura', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })} AH`
    : `${toWesternDigits(
        nowTime.toLocaleDateString('ar-SA-u-ca-islamic-umalqura-nu-latn', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      )} هـ`;

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '16px', flexWrap: 'nowrap', whiteSpace: 'nowrap' }}>
      {/* Compact Live Clock */}
      <div
        style={{
          fontSize: 'clamp(1.7rem, 3vw, 2.5rem)',
          fontWeight: '800',
          color: 'var(--text-primary)',
          lineHeight: '1',
          letterSpacing: '-0.02em',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        {liveClockTime}
      </div>

      {/* Vertical Hairline Divider */}
      <div
        style={{
          width: '1px',
          height: '36px',
          backgroundColor: 'var(--border-subtle)',
          flexShrink: 0,
        }}
      />

      {/* Dates: Gregorian & Hijri */}
      <div style={{ textAlign: isEn ? 'left' : 'right', whiteSpace: 'nowrap', display: 'flex', flexDirection: 'column', gap: '2px', flexShrink: 0 }}>
        <div
          style={{
            fontSize: '1.05rem',
            fontWeight: '700',
            color: 'var(--text-primary)',
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
          }}
        >
          {gregorianDateFormatted}
        </div>
        <div
          style={{
            fontSize: '0.95rem',
            fontWeight: '600',
            color: 'var(--text-secondary)',
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
          }}
        >
          <span>{hijriDateFormatted}</span>
        </div>
      </div>
    </div>
  );
}
