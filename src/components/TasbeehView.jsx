import React, { useState, useEffect, useCallback, useId, useRef } from 'react';
import ReactDOM from 'react-dom';
import {
  RotateCcw,
  Plus,
  Trash2,
  CheckCircle,
  X,
  Flame,
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  PanelRightClose,
  PanelRightOpen,
  PanelLeftClose,
  PanelLeftOpen,
  SlidersHorizontal,
  Eye,
  EyeOff,
} from 'lucide-react';
import TasbeehIcon from './TasbeehIcon.jsx';
import {
  getTasbeehState,
  incrementDhikrCount,
  resetDhikrCount,
  addCustomDhikr,
  deleteCustomDhikr,
  updateDhikrTarget,
  toggleDhikrHidden,
  moveDhikr,
  resetAdhkarToDefaults,
  setActiveDhikrId,
  getTodayTotalTasbeehCount,
} from '../services/tasbeehStorage.js';
import { recordTasbeehTapAndCheck } from '../services/muneerSignalService.js';

export default function TasbeehView({ settings, isActive = true }) {
  const [tasbeehState, setTasbeehState] = useState(() => getTasbeehState());
  const [todayTotal, setTodayTotal] = useState(() => getTodayTotalTasbeehCount());
  const [isClicking, setIsClicking] = useState(false);
  const [isCompletedAnim, setIsCompletedAnim] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [customTextAr, setCustomTextAr] = useState('');
  const [customTextEn, setCustomTextEn] = useState('');
  const [customTarget, setCustomTarget] = useState('33');
  const [customVirtueAr, setCustomVirtueAr] = useState('');
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(() => {
    try {
      const saved = localStorage.getItem('prayer_tracker_tasbeeh_sidebar_expanded');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const handleToggleSidebar = () => {
    setIsSidebarExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('prayer_tracker_tasbeeh_sidebar_expanded', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const customTextArId = useId();
  const customTargetId = useId();
  const customVirtueArId = useId();

  const isEn = settings?.language === 'en';

  // Sync state whenever storage changes
  useEffect(() => {
    const handleStorageUpdate = (e) => {
      if (e.detail) {
        setTasbeehState(e.detail);
        setTodayTotal(getTodayTotalTasbeehCount());
      }
    };
    window.addEventListener('prayer_tracker_tasbeeh_updated', handleStorageUpdate);
    return () => {
      window.removeEventListener('prayer_tracker_tasbeeh_updated', handleStorageUpdate);
    };
  }, []);

  // Filter visible adhkar for active cycling and dial
  const visibleAdhkar = (tasbeehState.adhkar || []).filter((d) => !d.isHidden);
  const currentVisibleIndex = Math.max(0, visibleAdhkar.findIndex((d) => d.id === tasbeehState.activeDhikrId));
  const activeDhikr = visibleAdhkar[currentVisibleIndex] || visibleAdhkar[0] || (tasbeehState.adhkar && tasbeehState.adhkar[0]) || null;

  const currentCount = activeDhikr?.count || 0;
  const currentTarget = activeDhikr?.target || 33;
  const progressPct = currentTarget > 0 ? Math.min(100, (currentCount / currentTarget) * 100) : 0;
  const isTargetAchieved = currentTarget > 0 && currentCount >= currentTarget;
  const lastTasbeehTapTimeRef = useRef(0);

  // Perform increment with visual and haptic feedback (strictly zero sound)
  const handleIncrement = useCallback(() => {
    if (!activeDhikr) return;
    const now = Date.now();
    if (now - lastTasbeehTapTimeRef.current < 1000) {
      return; // Enforce strictly 1 second between consecutive tasbeehs
    }
    lastTasbeehTapTimeRef.current = now;
    recordTasbeehTapAndCheck();

    // Visual feedback ripple
    setIsClicking(true);
    setTimeout(() => setIsClicking(false), 120);

    // Haptic vibration
    if (tasbeehState.vibrationEnabled && typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(isTargetAchieved ? [40, 60, 40] : 25);
    }

    if (currentCount + 1 >= currentTarget && currentCount < currentTarget) {
      setIsCompletedAnim(true);
      setTimeout(() => setIsCompletedAnim(false), 1200);
    }

    const updated = incrementDhikrCount(activeDhikr.id, 1);
    setTasbeehState(updated);
    setTodayTotal(getTodayTotalTasbeehCount());
  }, [activeDhikr, tasbeehState.vibrationEnabled, currentCount, currentTarget, isTargetAchieved]);

  const handleNextDhikr = useCallback((e) => {
    if (e) e.stopPropagation();
    if (visibleAdhkar.length === 0) return;
    const nextIdx = (currentVisibleIndex + 1) % visibleAdhkar.length;
    const updated = setActiveDhikrId(visibleAdhkar[nextIdx].id);
    setTasbeehState(updated);
  }, [currentVisibleIndex, visibleAdhkar]);

  const handlePrevDhikr = useCallback((e) => {
    if (e) e.stopPropagation();
    if (visibleAdhkar.length === 0) return;
    const prevIdx = (currentVisibleIndex - 1 + visibleAdhkar.length) % visibleAdhkar.length;
    const updated = setActiveDhikrId(visibleAdhkar[prevIdx].id);
    setTasbeehState(updated);
  }, [currentVisibleIndex, visibleAdhkar]);

  // Handle Spacebar tap (strictly when TasbeehView is active and NOT inside an input or editable field)
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e) => {
      const target = e.target;
      const targetTag = target && target.tagName ? target.tagName.toLowerCase() : '';
      if (
        targetTag === 'input' ||
        targetTag === 'textarea' ||
        targetTag === 'select' ||
        (target && target.isContentEditable) ||
        (target && typeof target.closest === 'function' && target.closest('[contenteditable="true"]'))
      ) {
        return;
      }
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        handleIncrement();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, handleIncrement]);

  const handleReset = (e) => {
    if (e) e.stopPropagation();
    if (!activeDhikr || activeDhikr.count <= 0) return;
    const updated = resetDhikrCount(activeDhikr.id);
    setTasbeehState(updated);
    setTodayTotal(getTodayTotalTasbeehCount());
  };

  const handleSelectDhikr = (id) => {
    const updated = setActiveDhikrId(id);
    setTasbeehState(updated);
  };

  const handleMoveDhikr = (e, id, direction) => {
    if (e) e.stopPropagation();
    const updated = moveDhikr(id, direction);
    setTasbeehState(updated);
  };

  const handleToggleDhikrVisibility = (e, id) => {
    if (e) e.stopPropagation();
    const updated = toggleDhikrHidden(id);
    setTasbeehState(updated);
  };

  const handleUpdateTarget = (id, newTarget) => {
    const val = Math.max(1, Number(newTarget) || 1);
    const updated = updateDhikrTarget(id, val);
    setTasbeehState(updated);
  };

  const handleResetDefaults = () => {
    const updated = resetAdhkarToDefaults();
    setTasbeehState(updated);
  };

  const handleAddCustomSubmit = (e) => {
    e.preventDefault();
    if (!customTextAr.trim()) return;
    const updated = addCustomDhikr({
      textAr: customTextAr,
      textEn: customTextEn,
      target: Number(customTarget) || 33,
      virtueAr: customVirtueAr,
      virtueEn: '',
    });
    if (updated) {
      setTasbeehState(updated);
      setCustomTextAr('');
      setCustomTextEn('');
      setCustomTarget('33');
      setCustomVirtueAr('');
      setShowAddModal(false);
    }
  };

  const handleDeleteCustom = (e, id) => {
    if (e) e.stopPropagation();
    const updated = deleteCustomDhikr(id);
    setTasbeehState(updated);
  };

  // Circular SVG dimensions
  const circleRadius = 110;
  const strokeWidth = 10;
  const normalizedRadius = circleRadius - strokeWidth * 0.5;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (progressPct / 100) * circumference;

  return (
    <div
      className="bento-card"
      style={{
        width: '100%',
        maxWidth: '1200px',
        height: 'min(860px, calc(100dvh - 84px))',
        minHeight: 'min(580px, calc(100dvh - 84px))',
        margin: '0 auto',
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        boxSizing: 'border-box',
      }}
    >
      {/* 1. Integrated Header & Stats Row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(255, 255, 255, 0.18)',
              color: '#ffffff',
            }}
          >
            <TasbeehIcon
              size={24}
              style={{
                filter: 'drop-shadow(0 0 6px rgba(255, 255, 255, 0.6))',
              }}
            />
          </div>
          <div>
            <h1 style={{ fontSize: '1.3rem', fontWeight: '800', color: '#ffffff', margin: 0, lineHeight: 1.2 }}>
              {isEn ? 'Electronic Tasbeeh & Dhikr' : 'المسبحة الإلكترونية والأذكار'}
            </h1>
            <p style={{ fontSize: '0.80rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
              {isEn ? 'Count your daily remembrances and earn rewards' : 'ألا بذكر الله تطمئن القلوب • عداد أذكار وتسبيح يومي'}
            </p>
          </div>
        </div>

        {/* Today's Total Stat Badge (Single Horizontal Line) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '0 4px',
            whiteSpace: 'nowrap',
          }}
        >
          <Flame size={20} style={{ color: 'var(--status-on-time)', flexShrink: 0 }} />
          <span style={{ fontSize: '0.90rem', color: 'var(--text-secondary)', fontWeight: '600' }}>
            {isEn ? "Today's Total:" : 'تسبيحات اليوم:'}
          </span>
          <span style={{ fontSize: '1.2rem', fontWeight: '800', color: '#ffffff' }}>
            {todayTotal.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div style={{ width: '100%', height: '1px', backgroundColor: 'var(--border-subtle)', flexShrink: 0 }} />

      {/* 2. Main Area: Center Masbaha Dial + Gemini-Style Collapsible Adhkar Sidebar */}
      <div
        style={{
          display: 'flex',
          gap: '20px',
          alignItems: 'stretch',
          width: '100%',
          flex: 1,
          minHeight: 0,
          position: 'relative',
        }}
      >
        {/* 1. Giant Interactive Masbaha Dial Area (Expands and centers smoothly) */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '8px 12px',
            textAlign: 'center',
            position: 'relative',
            userSelect: 'none',
            minWidth: 0,
            transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {/* Active Dhikr Title & Navigation Arrows */}
          <div
            style={{
              width: '100%',
              maxWidth: '480px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              marginBottom: '12px',
            }}
          >
            {/* Previous Dhikr Button */}
            <button
              type="button"
              onClick={handlePrevDhikr}
              className="nav-btn"
              title={isEn ? 'Previous dhikr (Right Arrow)' : 'الذكر السابق (سهم يمين)'}
              style={{
                width: '38px',
                height: '38px',
                flexShrink: 0,
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
              }}
            >
              <ChevronRight size={20} />
            </button>

            {/* Dhikr Title & Virtue */}
            <div style={{ flex: 1, minHeight: '68px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <h2
                style={{
                  fontSize: 'clamp(1.3rem, 2.8vw, 1.85rem)',
                  fontWeight: '900',
                  color: '#ffffff',
                  margin: 0,
                  lineHeight: 1.3,
                  textShadow: '0 2px 14px rgba(0, 0, 0, 0.85)',
                }}
              >
                {isEn && activeDhikr?.textEn ? activeDhikr.textEn : activeDhikr?.textAr}
              </h2>
              {activeDhikr?.virtueAr && (
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '6px', maxWidth: '360px', marginInline: 'auto' }}>
                  {isEn && activeDhikr?.virtueEn ? activeDhikr.virtueEn : activeDhikr.virtueAr}
                </p>
              )}
            </div>

            {/* Next Dhikr Button */}
            <button
              type="button"
              onClick={handleNextDhikr}
              className="nav-btn"
              title={isEn ? 'Next dhikr (Left Arrow)' : 'الذكر التالي (سهم يسار)'}
              style={{
                width: '38px',
                height: '38px',
                flexShrink: 0,
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
              }}
            >
              <ChevronLeft size={20} />
            </button>
          </div>

          {/* Giant Circular Touch Counter Area */}
          <div
            onClick={handleIncrement}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleIncrement();
              }
            }}
            aria-label={isEn ? `Count ${currentCount}` : `العدد الحالي ${currentCount}`}
            style={{
              position: 'relative',
              width: `${circleRadius * 2}px`,
              height: `${circleRadius * 2}px`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              borderRadius: '50%',
              margin: '8px auto 20px auto',
              transform: isClicking ? 'scale(0.95)' : isCompletedAnim ? 'scale(1.06)' : 'scale(1)',
              transition: 'transform 0.12s cubic-bezier(0.16, 1, 0.3, 1)',
              outline: 'none',
            }}
          >
            {/* SVG Circular Progress Ring */}
            <svg
              width={circleRadius * 2}
              height={circleRadius * 2}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                transform: 'rotate(-90deg)',
              }}
            >
              {/* Background Track Ring */}
              <circle
                stroke="rgba(255, 255, 255, 0.08)"
                fill="transparent"
                strokeWidth={strokeWidth}
                r={normalizedRadius}
                cx={circleRadius}
                cy={circleRadius}
              />
              {/* Animated Progress Ring */}
              <circle
                stroke={isTargetAchieved ? '#ffffff' : '#ffffff'}
                fill="rgba(20, 20, 20, 0.75)"
                strokeWidth={strokeWidth}
                strokeDasharray={`${circumference} ${circumference}`}
                style={{
                  strokeDashoffset,
                  transition: 'stroke-dashoffset 0.18s cubic-bezier(0.16, 1, 0.3, 1), stroke 0.3s ease',
                }}
                r={normalizedRadius}
                cx={circleRadius}
                cy={circleRadius}
              />
            </svg>

            {/* Counter Numeric Display */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2,
                pointerEvents: 'none',
              }}
            >
              <div
                style={{
                  fontSize: 'clamp(2.5rem, 5vw, 3.4rem)',
                  fontWeight: '900',
                  color: isTargetAchieved ? 'var(--status-on-time)' : '#ffffff',
                  lineHeight: 1,
                  fontVariantNumeric: 'tabular-nums',
                  textShadow: '0 4px 18px rgba(0, 0, 0, 0.9)',
                }}
              >
                {currentCount}
              </div>
              <div
                style={{
                  fontSize: '0.82rem',
                  fontWeight: '700',
                  color: 'var(--text-secondary)',
                  marginTop: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span>{isEn ? 'Target' : 'الهدف'}: {currentTarget}</span>
                {isTargetAchieved && <CheckCircle size={14} style={{ color: 'var(--status-on-time)' }} />}
              </div>
            </div>
          </div>

          {/* Action Button: Instant 1-Click Reset Counter */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '8px' }}>
            <button
              type="button"
              onClick={handleReset}
              disabled={currentCount <= 0}
              className="btn-secondary"
              title={isEn ? 'Reset counter (instant 1-click)' : 'تصفير العداد فوراً بنقرة واحدة'}
              style={{
                padding: '8px 22px',
                fontSize: '0.86rem',
                opacity: currentCount > 0 ? 1 : 0.4,
                cursor: currentCount > 0 ? 'pointer' : 'not-allowed',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                borderRadius: 'var(--radius-pill)',
              }}
            >
              <RotateCcw size={15} />
              <span>{isEn ? 'Reset' : 'تصفير العداد'}</span>
            </button>
          </div>
        </div>

        {/* 2. Gemini-Style Collapsible Adhkar Sidebar / Rail */}
        <aside
          className="sub-glass-card"
          style={{
            width: isSidebarExpanded ? '340px' : '58px',
            minWidth: isSidebarExpanded ? '280px' : '58px',
            maxWidth: isSidebarExpanded ? '380px' : '58px',
            height: '100%',
            borderRadius: 'var(--radius-lg)',
            padding: isSidebarExpanded ? '14px 14px' : '10px 6px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            backgroundColor: 'rgba(18, 18, 18, 0.72)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            transition: 'width 0.25s cubic-bezier(0.16, 1, 0.3, 1), min-width 0.25s cubic-bezier(0.16, 1, 0.3, 1), max-width 0.25s cubic-bezier(0.16, 1, 0.3, 1), padding 0.25s ease',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          {/* Top Control Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: isSidebarExpanded ? 'space-between' : 'center',
              width: '100%',
              gap: '8px',
              paddingBottom: isSidebarExpanded ? '10px' : '6px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              flexShrink: 0,
            }}
          >
            {isSidebarExpanded ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                  <button
                    type="button"
                    onClick={handleToggleSidebar}
                    className="nav-btn"
                    title={isEn ? 'Collapse sidebar' : 'طي الشريط الجانبي'}
                    style={{ width: '34px', height: '34px', flexShrink: 0 }}
                  >
                    {isEn ? <PanelLeftClose size={18} /> : <PanelRightClose size={18} />}
                  </button>
                  <span style={{ fontWeight: '800', fontSize: '0.96rem', color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {isEn ? 'Adhkar Collection' : 'باقة الأذكار'}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => setShowSettingsModal(true)}
                    className="nav-btn"
                    style={{ width: '32px', height: '32px', color: 'var(--text-secondary)' }}
                    title={isEn ? 'Dhikr & Ward Settings' : 'إعدادات وتخصيص الأذكار والأوراد'}
                  >
                    <SlidersHorizontal size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(true)}
                    className="btn-primary"
                    style={{ fontSize: '0.78rem', padding: '5px 10px', display: 'inline-flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}
                    title={isEn ? 'Add custom dhikr' : 'إضافة ذكر خاص'}
                  >
                    <Plus size={14} />
                    <span>{isEn ? 'New' : 'إضافة ذكر'}</span>
                  </button>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', width: '100%' }}>
                <button
                  type="button"
                  onClick={handleToggleSidebar}
                  className="nav-btn"
                  title={isEn ? 'Expand sidebar' : 'توسيع الشريط الجانبي'}
                  style={{ width: '36px', height: '36px' }}
                >
                  {isEn ? <PanelLeftOpen size={18} /> : <PanelRightOpen size={18} />}
                </button>
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(true)}
                  className="nav-btn"
                  title={isEn ? 'Dhikr & Ward Settings' : 'إعدادات وتخصيص الأذكار والأوراد'}
                  style={{ width: '34px', height: '34px' }}
                >
                  <SlidersHorizontal size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  className="btn-primary"
                  title={isEn ? 'Add custom dhikr' : 'إضافة ذكر خاص'}
                  style={{ width: '34px', height: '34px', padding: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Plus size={16} />
                </button>
              </div>
            )}
          </div>

          {/* Adhkar Items Rail / List (Visible only) */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: isSidebarExpanded ? '8px' : '6px',
              overflowY: 'auto',
              overflowX: 'hidden',
              padding: isSidebarExpanded ? '4px 2px' : '4px 0',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              alignItems: isSidebarExpanded ? 'stretch' : 'center',
            }}
          >
            {visibleAdhkar.map((dhikr, idx) => {
              const isActive = dhikr.id === tasbeehState.activeDhikrId;
              const dTarget = dhikr.target || 33;
              const dCount = dhikr.count || 0;
              const isAchieved = dTarget > 0 && dCount >= dTarget;

              if (!isSidebarExpanded) {
                // Collapsed Rail Item (Matching Gemini Collapsed Style)
                return (
                  <div
                    key={dhikr.id}
                    onClick={() => handleSelectDhikr(dhikr.id)}
                    title={`${dhikr.textAr} (${dCount}/${dTarget})`}
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      backgroundColor: isActive
                        ? 'rgba(255, 255, 255, 0.22)'
                        : 'rgba(255, 255, 255, 0.05)',
                      border: isActive
                        ? '1.5px solid #ffffff'
                        : isAchieved
                        ? '1px solid rgba(34, 197, 94, 0.6)'
                        : '1px solid rgba(255, 255, 255, 0.1)',
                      color: isActive ? '#ffffff' : isAchieved ? '#22c55e' : 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      fontSize: '0.82rem',
                      fontWeight: '800',
                      transition: 'all 0.18s ease',
                      flexShrink: 0,
                    }}
                  >
                    {isAchieved ? (
                      <CheckCircle size={16} style={{ color: '#22c55e' }} />
                    ) : (
                      <span>{idx + 1}</span>
                    )}
                  </div>
                );
              }

              // Expanded Full Item
              return (
                <div
                  key={dhikr.id}
                  onClick={() => handleSelectDhikr(dhikr.id)}
                  className={`sub-glass-card ${isActive ? 'option-tile-active' : ''}`}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    border: isActive ? '1.5px solid #ffffff' : '1px solid rgba(255, 255, 255, 0.1)',
                    backgroundColor: isActive ? 'rgba(255, 255, 255, 0.14)' : 'rgba(18, 18, 18, 0.6)',
                    transition: 'all 0.18s ease',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: '0.92rem',
                          fontWeight: '800',
                          color: '#ffffff',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {dhikr.textAr}
                      </span>
                      {dhikr.isCustom && (
                        <span
                          style={{
                            fontSize: '0.65rem',
                            padding: '1px 6px',
                            borderRadius: 'var(--radius-pill)',
                            backgroundColor: 'rgba(255, 255, 255, 0.15)',
                            color: '#ffffff',
                          }}
                        >
                          {isEn ? 'Custom' : 'مخصص'}
                        </span>
                      )}
                    </div>
                    {dhikr.virtueAr && (
                      <div
                        style={{
                          fontSize: '0.74rem',
                          color: 'var(--text-muted)',
                          marginTop: '3px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {dhikr.virtueAr}
                      </div>
                    )}
                  </div>

                  {/* Progress Counter Pill & Delete Button */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <div
                      style={{
                        padding: '3px 8px',
                        borderRadius: 'var(--radius-pill)',
                        backgroundColor: isAchieved ? 'rgba(34, 197, 94, 0.18)' : 'rgba(255, 255, 255, 0.08)',
                        border: isAchieved ? '1px solid rgba(34, 197, 94, 0.35)' : '1px solid rgba(255, 255, 255, 0.14)',
                        fontSize: '0.76rem',
                        fontWeight: '700',
                        color: isAchieved ? '#22c55e' : '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                      }}
                    >
                      <span>{dCount}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>/ {dTarget}</span>
                      {isAchieved && <CheckCircle size={11} />}
                    </div>

                    {dhikr.isCustom && (
                      <button
                        type="button"
                        onClick={(e) => handleDeleteCustom(e, dhikr.id)}
                        className="nav-btn"
                        title={isEn ? 'Delete custom dhikr' : 'حذف الذكر المخصص'}
                        style={{
                          width: '28px',
                          height: '28px',
                          color: 'var(--status-missed)',
                          backgroundColor: 'rgba(239, 68, 68, 0.12)',
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </aside>
      </div>

      {/* Comprehensive In-Page Dhikr & Ward Settings Modal */}
      {typeof document !== 'undefined' && showSettingsModal && ReactDOM.createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.80)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '16px',
            animation: 'fadeIn 0.2s ease-out',
          }}
          onClick={() => setShowSettingsModal(false)}
        >
          <div
            className="bento-card"
            style={{
              width: '100%',
              maxWidth: '660px',
              maxHeight: '90vh',
              padding: '24px',
              borderRadius: 'var(--radius-lg)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              backgroundColor: 'rgba(18, 18, 18, 0.94)',
              border: '1px solid rgba(255, 255, 255, 0.16)',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '50%', backgroundColor: 'rgba(255, 255, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <SlidersHorizontal size={20} style={{ color: '#ffffff' }} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#ffffff', margin: 0 }}>
                    {isEn ? 'Dhikr & Ward Customization' : 'تخصيص وإعدادات الأذكار والأوراد'}
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                    {isEn ? 'Control visibility, customize target count (ward) per dhikr, or add new ones' : 'تحكم بإظهار وإخفاء الأذكار، حدد الورد المستهدف لكل ذكر، أو أضف أذكاراً جديدة'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="nav-btn"
                style={{ width: '34px', height: '34px' }}
                title={isEn ? 'Close' : 'إغلاق'}
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Add Custom Dhikr Button Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                {isEn ? 'Need a specific dua or dhikr?' : 'هل ترغب في إضافة دعاء أو ذكر خاص بك؟'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowSettingsModal(false);
                  setShowAddModal(true);
                }}
                className="btn-primary"
                style={{ fontSize: '0.80rem', padding: '6px 14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus size={14} />
                <span>{isEn ? 'Add New Dhikr' : 'إضافة ذكر جديد'}</span>
              </button>
            </div>

            {/* Adhkar Items Table / List */}
            <div
              style={{
                flex: 1,
                minHeight: '240px',
                maxHeight: '440px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                paddingRight: '4px',
              }}
            >
              {tasbeehState.adhkar.map((dhikr, idx) => {
                const isHidden = Boolean(dhikr.isHidden);
                return (
                  <div
                    key={dhikr.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: isHidden ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 255, 255, 0.07)',
                      border: isHidden ? '1px dashed rgba(255, 255, 255, 0.1)' : '1px solid rgba(255, 255, 255, 0.12)',
                      opacity: isHidden ? 0.6 : 1,
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {/* Reorder Up/Down Controls */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={(e) => handleMoveDhikr(e, dhikr.id, 'up')}
                        disabled={idx === 0}
                        className="nav-btn"
                        title={isEn ? 'Move Up' : 'تحريك لأعلى في الترتيب'}
                        style={{
                          width: '26px',
                          height: '20px',
                          padding: 0,
                          opacity: idx === 0 ? 0.25 : 0.85,
                          cursor: idx === 0 ? 'not-allowed' : 'pointer',
                          backgroundColor: 'rgba(255, 255, 255, 0.06)',
                        }}
                      >
                        <ChevronUp size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleMoveDhikr(e, dhikr.id, 'down')}
                        disabled={idx === tasbeehState.adhkar.length - 1}
                        className="nav-btn"
                        title={isEn ? 'Move Down' : 'تحريك لأسفل في الترتيب'}
                        style={{
                          width: '26px',
                          height: '20px',
                          padding: 0,
                          opacity: idx === tasbeehState.adhkar.length - 1 ? 0.25 : 0.85,
                          cursor: idx === tasbeehState.adhkar.length - 1 ? 'not-allowed' : 'pointer',
                          backgroundColor: 'rgba(255, 255, 255, 0.06)',
                        }}
                      >
                        <ChevronDown size={13} />
                      </button>
                    </div>

                    {/* Visibility Toggle Button */}
                    <button
                      type="button"
                      onClick={(e) => handleToggleDhikrVisibility(e, dhikr.id)}
                      className="nav-btn"
                      title={
                        isHidden
                          ? (isEn ? 'Hidden: Click to show in Tasbeeh' : 'مخفي: انقر لإظهاره في المسبحة')
                          : (isEn ? 'Visible: Click to hide from Tasbeeh' : 'معروض: انقر لإخفائه من المسبحة')
                      }
                      style={{
                        width: '34px',
                        height: '34px',
                        flexShrink: 0,
                        backgroundColor: isHidden ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.15)',
                        color: isHidden ? 'var(--text-muted)' : '#ffffff',
                      }}
                    >
                      {isHidden ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>

                    {/* Dhikr Title & Virtue */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.94rem', fontWeight: '800', color: '#ffffff' }}>
                          {dhikr.textAr}
                        </span>
                        {dhikr.isCustom && (
                          <span style={{ fontSize: '0.65rem', padding: '1px 6px', borderRadius: 'var(--radius-pill)', backgroundColor: 'rgba(255, 255, 255, 0.15)', color: '#ffffff' }}>
                            {isEn ? 'Custom' : 'مخصص'}
                          </span>
                        )}
                        {isHidden && (
                          <span style={{ fontSize: '0.65rem', padding: '1px 6px', borderRadius: 'var(--radius-pill)', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: 'var(--status-missed)' }}>
                            {isEn ? 'Hidden' : 'مخفي'}
                          </span>
                        )}
                      </div>
                      {dhikr.virtueAr && (
                        <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: '2px 0 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {dhikr.virtueAr}
                        </p>
                      )}
                    </div>

                    {/* Target / Ward Numeric Editor */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: '600' }}>
                        {isEn ? 'Ward:' : 'الورد:'}
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="100000"
                        value={dhikr.target || 33}
                        onChange={(e) => handleUpdateTarget(dhikr.id, e.target.value)}
                        className="form-input"
                        title={isEn ? 'Set target count (ward)' : 'حدد عدد الورد المستهدف'}
                        style={{
                          width: '74px',
                          padding: '5px 8px',
                          textAlign: 'center',
                          fontSize: '0.88rem',
                          fontWeight: '800',
                          borderRadius: 'var(--radius-sm)',
                        }}
                      />

                      {/* Delete Custom Dhikr Button */}
                      {dhikr.isCustom && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteCustom(e, dhikr.id)}
                          className="nav-btn"
                          title={isEn ? 'Delete custom dhikr' : 'حذف الذكر المخصص'}
                          style={{
                            width: '32px',
                            height: '32px',
                            color: 'var(--status-missed)',
                            backgroundColor: 'rgba(239, 68, 68, 0.12)',
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Bottom Actions */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '14px', flexWrap: 'wrap', gap: '10px' }}>
              <button
                type="button"
                onClick={handleResetDefaults}
                className="btn-secondary"
                style={{ fontSize: '0.80rem', padding: '6px 14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                title={isEn ? 'Reset to 9 default adhkar with default counts' : 'استعادة الأذكار والأعداد الافتراضية'}
              >
                <RotateCcw size={14} />
                <span>{isEn ? 'Restore Defaults' : 'استعادة الأذكار الافتراضية'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="btn-primary"
                style={{ padding: '8px 24px', fontSize: '0.88rem' }}
              >
                <span>{isEn ? 'Done & Close' : 'تم وحفظ'}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Add Custom Dhikr Modal */}
      {typeof document !== 'undefined' && showAddModal && ReactDOM.createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px',
            animation: 'fadeIn 0.2s ease-out',
          }}
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="bento-card"
            style={{
              width: '100%',
              maxWidth: '480px',
              padding: '28px',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: 'rgba(18, 18, 18, 0.94)',
              border: '1px solid rgba(255, 255, 255, 0.16)',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#ffffff', margin: 0 }}>
                {isEn ? 'Add Custom Dhikr or Dua' : 'إضافة ذكر أو دعاء مخصص'}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="nav-btn"
                style={{ width: '34px', height: '34px' }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddCustomSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label
                  htmlFor={customTextArId}
                  style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}
                >
                  {isEn ? 'Dhikr / Dua Text (Arabic)' : 'نص الذكر أو الدعاء (بالعربية)'} *
                </label>
                <input
                  id={customTextArId}
                  type="text"
                  required
                  value={customTextAr}
                  onChange={(e) => setCustomTextAr(e.target.value)}
                  placeholder={isEn ? 'e.g. رَبِّ اغْفِرْ لِي' : 'مثال: رَبِّ اغْفِرْ لِي وَتُبْ عَلَيَّ'}
                  className="form-input"
                />
              </div>

              <div>
                <label
                  htmlFor={customTargetId}
                  style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}
                >
                  {isEn ? 'Target Count' : 'الهدف العددي للتسبيح'} *
                </label>
                <input
                  id={customTargetId}
                  type="number"
                  required
                  min="1"
                  max="100000"
                  value={customTarget}
                  onChange={(e) => setCustomTarget(e.target.value)}
                  className="form-input"
                />
              </div>

              <div>
                <label
                  htmlFor={customVirtueArId}
                  style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}
                >
                  {isEn ? 'Virtue / Reference (Optional)' : 'الفضل أو الدليل (اختياري)'}
                </label>
                <input
                  id={customVirtueArId}
                  type="text"
                  value={customVirtueAr}
                  onChange={(e) => setCustomVirtueAr(e.target.value)}
                  placeholder={isEn ? 'e.g. من قالها غفرت ذنوبه' : 'مثال: من قالها غُفرت له ذنوبه وإن كانت مثل زبد البحر'}
                  className="form-input"
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-secondary"
                  style={{ padding: '8px 18px' }}
                >
                  {isEn ? 'Cancel' : 'إلغاء'}
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ padding: '8px 24px' }}
                >
                  {isEn ? 'Save Dhikr' : 'حفظ الذكر'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
