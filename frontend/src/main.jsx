import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Capacitor } from '@capacitor/core';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { WorkspaceProvider } from './context/WorkspaceContext';
import { QuickActionsProvider } from './context/QuickActions';
import { ConfirmProvider } from './components/ui';
import './index.css';

// Native shell niceties when running inside the Capacitor Android/iOS app.
if (Capacitor.isNativePlatform()) {
  import('@capacitor/app').then(({ App: CapApp }) => {
    CapApp.addListener('backButton', ({ canGoBack }) => (canGoBack ? window.history.back() : CapApp.exitApp()));
  });
  import('@capacitor/status-bar').then(({ StatusBar, Style }) => {
    StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
  });
} else if ('serviceWorker' in navigator && import.meta.env.PROD) {
  // Lets phones install the website as an app (Add to Home screen).
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <WorkspaceProvider>
          <ConfirmProvider>
            <QuickActionsProvider>
              <App />
              <Toaster position="top-center" toastOptions={{ duration: 3000, style: { borderRadius: '14px', fontSize: '14px' } }} />
            </QuickActionsProvider>
          </ConfirmProvider>
        </WorkspaceProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
