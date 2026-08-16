import React, { useState } from 'react';
import { Key, ExternalLink, Sparkles, Check, X } from 'lucide-react';

export default function WelcomeModal({ isOpen, onClose, onSaveKeys, currentSettings }) {
  const [tavilyKey, setTavilyKey] = useState(currentSettings?.tavilyApiKey || '');
  const [geminiKey, setGeminiKey] = useState(currentSettings?.geminiApiKey || '');

  const lang = currentSettings?.language || 'ar';
  const isEn = lang === 'en';

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveKeys({
      tavilyApiKey: tavilyKey.trim(),
      geminiApiKey: geminiKey.trim(),
    });
    localStorage.setItem('prayer_tracker_welcome_seen', 'true');
    onClose();
  };

  const handleSkip = () => {
    localStorage.setItem('prayer_tracker_welcome_seen', 'true');
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.82)',
        zIndex: 4000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={handleSkip}
    >
      <div
        style={{
          backgroundColor: '#0f172a',
          border: '1px solid rgba(255, 255, 255, 0.18)',
          borderRadius: 'var(--radius-lg)',
          width: 'min(92%, 520px)',
          padding: '28px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.5)',
          color: 'var(--text-primary)',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={handleSkip}
          style={{
            position: 'absolute',
            top: '18px',
            [isEn ? 'right' : 'left']: '18px',
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '4px',
          }}
          title={isEn ? 'Skip' : 'تخطي'}
        >
          <X size={20} />
        </button>

        {/* Modal Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: 'rgba(59, 130, 246, 0.15)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '12px',
              color: 'var(--accent-blue)',
            }}
          >
            <Sparkles size={28} />
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: '800', margin: '0 0 6px 0' }}>
            {isEn ? 'Welcome to Prayer Tracker' : 'مرحباً بك في متابع الصلوات'}
          </h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
            {isEn ? 'To enable real-time web sync for prayer times and Sheikh Muneer AI, you can provide the following keys:' : 'للحصول على المزامنة الفورية لمواقيت الصلاة عبر الويب، يلزم توفير مفاتيح API المجانية التالية:'}
          </p>
        </div>

        {/* Step 1: Tavily API Key */}
        <div
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            marginBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700', fontSize: '0.92rem' }}>
              <Key size={16} style={{ color: 'var(--status-late)' }} />
              <span>{isEn ? 'Tavily API Key' : 'مفتاح Tavily API'}</span>
            </div>
            <a
              href="https://tavily.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: 'var(--accent-blue)',
                fontSize: '0.82rem',
                fontWeight: '700',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                textDecoration: 'none',
              }}
            >
              <span>{isEn ? 'Get from Tavily' : 'احصل عليه من Tavily'}</span>
              <ExternalLink size={13} />
            </a>
          </div>

          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '10px', lineHeight: 1.4 }}>
            {isEn ? 'Fetches prayer times accurately from live web sources.' : 'يقوم بالبحث عن مواقيت الصلاة لمدينتك بدقة من الشبكة مباشرة.'}
          </p>

          <input
            type="password"
            placeholder={isEn ? 'Paste Tavily API Key here' : 'ألصق مفتاح Tavily هنا'}
            value={tavilyKey}
            onChange={(e) => setTavilyKey(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px',
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              fontSize: '0.88rem',
              outline: 'none',
            }}
          />
        </div>

        {/* Step 2: Gemini API Key */}
        <div
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            marginBottom: '24px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700', fontSize: '0.92rem' }}>
              <Key size={16} style={{ color: 'var(--accent-blue)' }} />
              <span>{isEn ? 'Gemini API Key' : 'مفتاح Gemini API'}</span>
            </div>
            <a
              href="https://aistudio.google.com/"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: 'var(--accent-blue)',
                fontSize: '0.82rem',
                fontWeight: '700',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                textDecoration: 'none',
              }}
            >
              <span>{isEn ? 'Get from AI Studio' : 'احصل عليه من AI Studio'}</span>
              <ExternalLink size={13} />
            </a>
          </div>

          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '10px', lineHeight: 1.4 }}>
            {isEn ? 'Free Google API key for Sheikh Muneer AI companion and habit insights.' : 'مفتاح مجاني من غوغل لتحليل التوقيتات وتفعيل المساعد الذكي والشات.'}
          </p>

          <input
            type="password"
            placeholder={isEn ? 'Paste Gemini API Key here' : 'ألصق مفتاح Gemini هنا'}
            value={geminiKey}
            onChange={(e) => setGeminiKey(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px',
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              fontSize: '0.88rem',
              outline: 'none',
            }}
          />
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSave}
            style={{
              flex: 1,
              padding: '12px 16px',
              justifyContent: 'center',
              fontWeight: '800',
              fontSize: '0.92rem',
            }}
          >
            <Check size={18} />
            <span>{isEn ? 'Save Keys & Get Started' : 'حفظ المفاتيح وبدء الاستخدام'}</span>
          </button>

          <button
            type="button"
            onClick={handleSkip}
            style={{
              padding: '12px 18px',
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              color: 'var(--text-secondary)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 'var(--radius-md)',
              fontWeight: '700',
              fontSize: '0.88rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {isEn ? 'Skip for now' : 'تخطي المتابعة'}
          </button>
        </div>

      </div>
    </div>
  );
}
