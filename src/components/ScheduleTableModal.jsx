import React, { useState, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { X, Search, Table } from 'lucide-react';
import { formatTimeDisplay, getCityTodayDateStr } from '../services/timeUtils';

export default function ScheduleTableModal({ isOpen, onClose, scheduleData, isEn, is12HourFormat = false, timezone }) {
  const [searchQuery, setSearchQuery] = useState('');

  const effectiveTz = timezone || scheduleData?.timezone;
  const todayISO = useMemo(() => getCityTodayDateStr(effectiveTz), [effectiveTz]);

  const scheduleEntries = useMemo(() => {
    if (!scheduleData || !scheduleData.schedule) return [];
    const raw = scheduleData.schedule || {};
    const entries = Object.entries(raw)
      .filter(([_, times]) => times && typeof times === 'object')
      .map(([dateStr, times]) => ({
        dateStr,
        times: times || {},
        isToday: dateStr === todayISO,
      }));

    // Sort chronologically
    entries.sort((a, b) => a.dateStr.localeCompare(b.dateStr));

    if (!searchQuery.trim()) return entries;
    const q = searchQuery.toLowerCase().trim();
    return entries.filter((e) => e.dateStr.toLowerCase().startsWith(q));
  }, [scheduleData, todayISO, searchQuery]);

  if (!isOpen || !scheduleData || !scheduleData.schedule) return null;

  const modalContent = (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-secondary, rgba(10, 10, 10, 0.88))',
          border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.12))',
          borderRadius: 'var(--radius-lg, 16px)',
          width: '100%',
          maxWidth: '900px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 24px',
            borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: 'var(--radius-md, 10px)',
                backgroundColor: 'rgba(255, 255, 255, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--status-on-time, #ffffff)',
              }}
            >
              <Table size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: '800', margin: 0, color: 'var(--text-primary, #f5f5f5)' }}>
                {isEn ? 'Prayer Times Schedule Table' : 'جدول مواقيت الصلاة المستخرج'}
              </h2>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted, #a3a3a3)', margin: '2px 0 0 0' }}>
                {isEn
                  ? `${scheduleData.totalDays || scheduleEntries.length} days cached locally from ${scheduleData.domain || 'Source Website'}`
                  : `تم تخزين ${scheduleData.totalDays || scheduleEntries.length} يوماً محلياً من موقع: ${scheduleData.domain || 'الموقع المصدر'}`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted, #a3a3a3)',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Search Bar & Stats */}
        <div
          style={{
            padding: '12px 24px',
            backgroundColor: 'rgba(0, 0, 0, 0.15)',
            borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: 'var(--bg-primary, #121212)',
              border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.12))',
              borderRadius: 'var(--radius-pill, 9999px)',
              padding: '6px 14px',
              flex: '1',
              maxWidth: '300px',
            }}
          >
            <Search size={14} style={{ color: 'var(--text-muted, #a3a3a3)' }} />
            <input
              type="search"
              placeholder={isEn ? 'Search date (e.g. 2026-08)...' : 'ابحث عن تاريخ (مثال: 2026-08)...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              data-lpignore="true"
              data-1p-ignore="true"
              data-form-type="other"
              name="search_schedule_query"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-primary, #f5f5f5)',
                fontSize: '0.82rem',
                width: '100%',
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />
          </div>

          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted, #a3a3a3)', fontWeight: '600' }}>
            {isEn ? `Showing ${scheduleEntries.length} records` : `معروض ${scheduleEntries.length} يوم`}
          </span>
        </div>

        {/* Scrollable Table Area */}
        <div style={{ flex: '1', overflowY: 'auto', padding: '0 24px', maxHeight: '60vh' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.84rem',
              textAlign: isEn ? 'left' : 'right',
            }}
          >
            <thead
              style={{
                position: 'sticky',
                top: 0,
                backgroundColor: 'var(--bg-secondary, rgba(10, 10, 10, 0.88))',
                zIndex: 2,
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
              }}
            >
              <tr style={{ color: 'var(--text-muted, #a3a3a3)', borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))' }}>
                <th style={{ padding: '12px 10px', fontWeight: '700' }}>{isEn ? 'Date' : 'التاريخ'}</th>
                <th style={{ padding: '12px 10px', fontWeight: '700' }}>{isEn ? 'Fajr' : 'الفجر'}</th>
                <th style={{ padding: '12px 10px', fontWeight: '700' }}>{isEn ? 'Sunrise' : 'الشروق'}</th>
                <th style={{ padding: '12px 10px', fontWeight: '700' }}>{isEn ? 'Dhuhr' : 'الظهر'}</th>
                <th style={{ padding: '12px 10px', fontWeight: '700' }}>{isEn ? 'Asr' : 'العصر'}</th>
                <th style={{ padding: '12px 10px', fontWeight: '700' }}>{isEn ? 'Maghrib' : 'المغرب'}</th>
                <th style={{ padding: '12px 10px', fontWeight: '700' }}>{isEn ? 'Isha' : 'العشاء'}</th>
              </tr>
            </thead>
            <tbody>
              {scheduleEntries.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted, #a3a3a3)' }}>
                    {isEn ? 'No dates match your search' : 'لا توجد تواريخ تطابق البحث'}
                  </td>
                </tr>
              ) : (
                  scheduleEntries.map((row) => {
                    const timeFmt = (is12HourFormat === true || is12HourFormat === '12') ? '12' : '24';
                    const lang = isEn ? 'en' : 'ar';
                    return (
                      <tr
                        key={row.dateStr}
                        style={{
                          borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.05))',
                          backgroundColor: row.isToday ? 'rgba(255, 255, 255, 0.14)' : 'transparent',
                          transition: 'background-color 0.15s ease',
                          fontWeight: row.isToday ? '700' : '400',
                        }}
                      >
                        <td style={{ padding: '10px', color: row.isToday ? 'var(--status-on-time, #ffffff)' : 'var(--text-primary, #f5f5f5)', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>{row.dateStr}</span>
                            {row.isToday && (
                              <span
                                style={{
                                  fontSize: '0.68rem',
                                  padding: '2px 6px',
                                  borderRadius: 'var(--radius-pill, 9999px)',
                                  backgroundColor: 'var(--status-on-time, #ffffff)',
                                  color: '#000000',
                                  fontWeight: '800',
                                }}
                              >
                                {isEn ? 'Today' : 'اليوم'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '10px', color: 'var(--text-primary, #f5f5f5)' }}>
                          {row.times?.Fajr ? formatTimeDisplay(row.times.Fajr, timeFmt, lang) : '—'}
                        </td>
                        <td style={{ padding: '10px', color: 'var(--text-muted, #a3a3a3)' }}>
                          {row.times?.Sunrise ? formatTimeDisplay(row.times.Sunrise, timeFmt, lang) : '—'}
                        </td>
                        <td style={{ padding: '10px', color: 'var(--text-primary, #f5f5f5)' }}>
                          {row.times?.Dhuhr ? formatTimeDisplay(row.times.Dhuhr, timeFmt, lang) : '—'}
                        </td>
                        <td style={{ padding: '10px', color: 'var(--text-primary, #f5f5f5)' }}>
                          {row.times?.Asr ? formatTimeDisplay(row.times.Asr, timeFmt, lang) : '—'}
                        </td>
                        <td style={{ padding: '10px', color: 'var(--text-primary, #f5f5f5)' }}>
                          {row.times?.Maghrib ? formatTimeDisplay(row.times.Maghrib, timeFmt, lang) : '—'}
                        </td>
                        <td style={{ padding: '10px', color: 'var(--text-primary, #f5f5f5)' }}>
                          {row.times?.Isha ? formatTimeDisplay(row.times.Isha, timeFmt, lang) : '—'}
                        </td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #a3a3a3)' }}>
            <span>{isEn ? 'All times are stored offline in your browser.' : 'جميع المواقيت مخزنة محلياً في متصفحك وتعمل تلقائياً بدون اتصال بالإنترنت.'}</span>
          </div>

          <button
            type="button"
            className="btn-primary"
            onClick={onClose}
            style={{
              padding: '8px 20px',
              borderRadius: 'var(--radius-pill, 9999px)',
              fontSize: '0.82rem',
              fontWeight: '700',
            }}
          >
            {isEn ? 'Close' : 'إغلاق'}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? ReactDOM.createPortal(modalContent, document.body) : null;
}
