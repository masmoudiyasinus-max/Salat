import React from 'react';
import { AlertTriangle, RefreshCw, Trash2, Copy, Check, Terminal } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
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
    console.error('ErrorBoundary captured exception:', error, errorInfo);
  }

  handleCopyLog = () => {
    const { error, errorInfo } = this.state;
    const logDetails = `[PRAYER TRACKER DIAGNOSTIC LOG REPORT]
Time: ${new Date().toLocaleString('ar-EG')}
Error Name: ${error?.name || 'Error'}
Message: ${error?.message || String(error)}
URL: ${window.location.href}

--- STACK TRACE ---
${error?.stack || 'N/A'}

--- COMPONENT STACK ---
${errorInfo?.componentStack || 'N/A'}
`;
    navigator.clipboard.writeText(logDetails).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    });
  };

  handleResetApp = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  handleClearCacheAndReload = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {}
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
            backgroundColor: '#090a0f',
            color: '#f3f4f6',
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
              backgroundColor: 'rgba(18, 20, 29, 0.95)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '20px',
              padding: '32px',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.8)',
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
                    شاشة تقرير الأخطاء البرمجية (System Diagnostic Exception)
                  </h2>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: '#9ca3af' }}>
                    تم التقاط خطأ تشغيلي في الواجهة أثناء المزامنة
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

            {/* Error Message Header */}
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

            {/* Code / Terminal Screen Viewer */}
            <div
              style={{
                backgroundColor: '#0d0f17',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '14px',
                overflow: 'hidden',
                marginBottom: '24px',
              }}
            >
              <div
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  padding: '8px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                  fontSize: '0.8rem',
                  color: '#9ca3af',
                  fontFamily: 'monospace',
                  direction: 'ltr',
                }}
              >
                <Terminal size={14} style={{ color: '#ef4444' }} />
                <span>Console Stack Trace / Debug Log</span>
              </div>

              <pre
                style={{
                  margin: 0,
                  padding: '16px',
                  fontSize: '0.82rem',
                  color: '#e5e7eb',
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

            {/* Action Bar Buttons */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '12px',
                justifyContent: 'flex-start',
                alignItems: 'center',
              }}
            >
              <button
                type="button"
                onClick={this.handleResetApp}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 22px',
                  borderRadius: '9999px',
                  backgroundColor: '#ffffff',
                  color: '#000000',
                  border: 'none',
                  fontWeight: '600',
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                }}
              >
                <RefreshCw size={16} />
                إعادة رسم الواجهة وتنشيط التطبيق
              </button>

              <button
                type="button"
                onClick={this.handleCopyLog}
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
                }}
              >
                {copied ? <Check size={16} style={{ color: '#10b981' }} /> : <Copy size={16} />}
                {copied ? 'تم نسخ التقرير التشخيصي' : 'نسخ تفاصيل الخطأ البرمجي'}
              </button>

              <button
                type="button"
                onClick={this.handleClearCacheAndReload}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  borderRadius: '9999px',
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  color: '#fca5a5',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  fontWeight: '600',
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  marginRight: 'auto',
                }}
              >
                <Trash2 size={16} />
                تفريغ الذاكرة المؤقتة وإعادة التشغيل
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
