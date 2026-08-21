import React from 'react';
import { AlertTriangle, RefreshCw, Copy, Check, Terminal, Mail, CheckCircle2 } from 'lucide-react';
import { logError } from '../services/errorLogger.js';

export default class GlobalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('GlobalErrorBoundary captured exception:', error, errorInfo);

    // Centrally log error with component stack telemetry
    try {
      const errToLog = error || new Error('Unknown React render error');
      if (errorInfo && errorInfo.componentStack) {
        errToLog.componentStack = errorInfo.componentStack;
      }
      logError(errToLog, 'React.GlobalErrorBoundary');
    } catch (e) {
      console.error('Failed to dispatch error to errorLogger:', e);
    }
  }

  getLogReportText = () => {
    const { error, errorInfo } = this.state;
    return `[PRAYER TRACKER DIAGNOSTIC LOG REPORT]
Time: ${new Date().toLocaleString('ar-EG')}
Error Name: ${error?.name || 'Error'}
Message: ${error?.message || String(error)}
URL: ${typeof window !== 'undefined' ? window.location.href : 'N/A'}

--- STACK TRACE ---
${error?.stack || 'N/A'}

--- COMPONENT STACK ---
${errorInfo?.componentStack || 'N/A'}
`;
  };

  handleCopyLog = () => {
    const logDetails = this.getLogReportText();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(logDetails).then(() => {
        this.setState({ copied: true });
        setTimeout(() => this.setState({ copied: false }), 2000);
      });
    }
  };

  handleContactDevelopers = () => {
    const { error } = this.state;
    const logDetails = this.getLogReportText();
    
    // Automatically copy report to clipboard
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(logDetails);
    }

    const subject = encodeURIComponent(`تقرير خطأ برمجي: ${error?.name || 'Error'}`);
    const body = encodeURIComponent(`السلام عليكم ورحمة الله،\n\nنود إبلاغكم بحدوث الخطأ البرمجي التالي:\n\n${logDetails}`);
    window.open(`mailto:support@habittracker.app?subject=${subject}&body=${body}`, '_blank');
  };

  handleResetApp = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const { error, errorInfo, copied } = this.state;
      return (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999999,
            backgroundColor: '#0a0a0a',
            color: '#f5f5f5',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
            direction: 'rtl',
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              width: 'min(92%, 850px)',
              backgroundColor: 'rgba(18, 18, 18, 0.92)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '20px',
              padding: '32px',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.25)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
            }}
          >
            {/* Top Bar Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                paddingBottom: '16px',
                marginBottom: '20px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ef4444',
                  }}
                >
                  <AlertTriangle size={22} />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: '#ffffff' }}>
                    شاشة تقرير الأخطاء البرمجية
                  </h2>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: '#a3a3a3' }}>
                    تم اعتراض الخطأ وتوثيقه تلقائياً في السجل المركزي الموحد
                  </p>
                </div>
              </div>

              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '4px 10px',
                  borderRadius: '9999px',
                  backgroundColor: 'rgba(239, 68, 68, 0.2)',
                  color: '#fca5a5',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  fontFamily: 'monospace',
                }}
              >
                {error?.name || 'Error'}
              </span>
            </div>

            {/* Error Message Box */}
            <div
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: '12px',
                padding: '14px 18px',
                marginBottom: '20px',
                fontSize: '0.95rem',
                color: '#f87171',
                fontWeight: '600',
                lineHeight: 1.5,
              }}
            >
              الخلل: {error?.message || String(error)}
            </div>

            {/* Code / Terminal Screen Viewer with Centered Copy Button */}
            <div
              style={{
                backgroundColor: '#0d0d0d',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '14px',
                overflow: 'hidden',
                marginBottom: '20px',
              }}
            >
              <div
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  padding: '10px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                  direction: 'ltr',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#a3a3a3', fontFamily: 'monospace' }}>
                  <Terminal size={14} style={{ color: '#ef4444' }} />
                  <span>Console Stack Trace / Debug Log</span>
                </div>

                {/* Centered Copy Button directly in the Report Header */}
                <button
                  type="button"
                  onClick={this.handleCopyLog}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 16px',
                    borderRadius: '9999px',
                    backgroundColor: copied ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.08)',
                    color: '#ffffff',
                    border: copied ? '1px solid rgba(255, 255, 255, 0.35)' : '1px solid rgba(255, 255, 255, 0.15)',
                    fontSize: '0.8rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    direction: 'rtl',
                  }}
                >
                  {copied ? <Check size={14} style={{ color: '#ffffff' }} /> : <Copy size={14} />}
                  <span>{copied ? 'تم نسخ التقرير' : 'نسخ تفاصيل الخطأ'}</span>
                </button>
              </div>

              <pre
                style={{
                  margin: 0,
                  padding: '16px',
                  fontSize: '0.82rem',
                  color: '#e5e5e5',
                  fontFamily: 'Consolas, Monaco, "Andale Mono", "Ubuntu Mono", monospace',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  maxHeight: '260px',
                  overflowY: 'auto',
                  direction: 'ltr',
                  textAlign: 'left',
                  lineHeight: 1.6,
                }}
              >
                {error?.stack || 'No JavaScript stack trace available.'}
                {'\n\n--- Component Stack ---\n'}
                {errorInfo?.componentStack || 'No Component stack trace available.'}
              </pre>
            </div>

            {/* Action Bar with Contact Developers and Reload buttons */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '12px',
                justifyContent: 'flex-start',
                alignItems: 'center',
                marginBottom: '16px',
              }}
            >
              <button
                type="button"
                onClick={this.handleContactDevelopers}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 24px',
                  borderRadius: '9999px',
                  backgroundColor: '#ffffff',
                  color: '#000000',
                  border: 'none',
                  fontWeight: '700',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
                  transition: 'all 0.2s ease',
                }}
              >
                <Mail size={16} />
                <span>التواصل مع المطورين</span>
              </button>

              <button
                type="button"
                onClick={this.handleResetApp}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  borderRadius: '9999px',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  color: '#ffffff',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  fontWeight: '600',
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <RefreshCw size={16} />
                <span>تحديث الصفحة واستئناف العمل</span>
              </button>
            </div>

            {/* Bottom Notice / Disclaimer for Automatic Logging and Review */}
            <div
              style={{
                padding: '14px 18px',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '0.84rem',
                color: '#a3a3a3',
                lineHeight: 1.6,
              }}
            >
              <CheckCircle2 size={18} style={{ color: '#ffffff', flexShrink: 0 }} />
              <span>
                تم تسجيل وتوثيق هذا الخطأ تلقائياً في السجل المركزي، وسيتم إرساله ومراجعته بدقة من قِبل فريق المطورين لمعالجته في التحديث القادم.
              </span>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
