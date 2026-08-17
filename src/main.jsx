import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import GlobalErrorBoundary from './components/GlobalErrorBoundary.jsx';
import { initGlobalErrorListeners } from './services/errorLogger.js';
import { initTelemetry } from './services/telemetry.js';

// Initialize Sentry / GlitchTip telemetry & deduplication engine
initTelemetry();

// Initialize global window.onerror and window.onunhandledrejection telemetry interceptors
initGlobalErrorListeners();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GlobalErrorBoundary>
      <App />
    </GlobalErrorBoundary>
  </StrictMode>,
);
