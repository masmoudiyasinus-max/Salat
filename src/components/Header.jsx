import React from 'react';
import { Calendar, BarChart3, MessageSquare, Settings, Compass, Eye } from 'lucide-react';

export default function Header({ activeTab, setActiveTab, settings, onToggleFocusMode }) {
  const hasGemini = Boolean(settings?.geminiApiKey && settings.geminiApiKey.trim());

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

      <div className="api-status-badges">
        <div
          className={`badge-indicator ${hasGemini ? 'active' : 'missing'}`}
          title={hasGemini ? 'Gemini API مفعل' : 'Gemini API مفتاح غير مضاف'}
        >
          <span className="pulse-dot"></span>
          <span>Gemini: {hasGemini ? 'مفعل' : 'غير مضاف'}</span>
        </div>
      </div>
    </header>
  );
}
