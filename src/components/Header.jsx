import React from 'react';
import { Calendar, BarChart3, MessageSquare, Settings, Compass, Eye, Key } from 'lucide-react';

export default function Header({ activeTab, setActiveTab, settings, onToggleFocusMode, onOpenWelcomeModal }) {
  const hasGemini = Boolean(settings?.geminiApiKey && settings.geminiApiKey.trim());
  const hasTavily = Boolean(settings?.tavilyApiKey && settings.tavilyApiKey.trim());

  return (
    <header className="navbar-header">
      <div className="nav-brand">
        <div className="nav-brand-icon">
          <Compass size={22} />
        </div>
        <div>
          <span>مُتتبّع الصلوات اليومية</span>
        </div>
      </div>

      <nav className="nav-tabs">
        <button
          className={`nav-btn ${activeTab === 'tracker' ? 'active' : ''}`}
          onClick={() => setActiveTab('tracker')}
          id="nav-tracker-btn"
        >
          <Calendar size={18} />
          <span>تتبع الصلوات</span>
        </button>

        <button
          className={`nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
          id="nav-dashboard-btn"
        >
          <BarChart3 size={18} />
          <span>لوحة التحليلات</span>
        </button>

        <button
          className={`nav-btn ${activeTab === 'chat' ? 'active' : ''}`}
          onClick={() => setActiveTab('chat')}
          id="nav-chat-btn"
        >
          <MessageSquare size={18} />
          <span>الدردشة الذكية</span>
        </button>

        <button
          className={`nav-btn ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
          id="nav-settings-btn"
        >
          <Settings size={18} />
          <span>الإعدادات</span>
        </button>

        <button
          className="nav-btn"
          onClick={onToggleFocusMode}
          title="مشاهدة البث المباشر المكرّم بدون عناصر الموقع وبدون تعتيم"
          id="nav-focus-mode-btn"
          style={{
            backgroundColor: 'var(--status-on-time-bg)',
            color: 'var(--status-on-time)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
          }}
        >
          <Eye size={18} />
          <span>مشاهدة البث الصافي</span>
        </button>
      </nav>

      <div className="api-status-badges" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          type="button"
          onClick={onOpenWelcomeModal}
          style={{
            padding: '5px 12px',
            borderRadius: '9999px',
            backgroundColor: 'rgba(59, 130, 246, 0.12)',
            color: 'var(--accent-blue)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            fontSize: '0.78rem',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
          }}
          title="فتح دليل ومفتاح Tavily و Gemini API"
        >
          <Key size={13} />
          <span>المفاتيح</span>
        </button>

        <div
          className={`badge-indicator ${hasTavily ? 'active' : 'missing'}`}
          title={hasTavily ? 'Tavily API للمزامنة الحية مفعل' : 'Tavily API غير مضاف (المزامنة غير ممكنة)'}
        >
          <span className="pulse-dot"></span>
          <span>Tavily: {hasTavily ? 'مفعل' : 'مطلوب'}</span>
        </div>
      </div>
    </header>
  );
}
