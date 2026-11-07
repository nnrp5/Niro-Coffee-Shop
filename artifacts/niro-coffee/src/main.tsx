import { createRoot } from 'react-dom/client';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';

import './index.css';

if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    if (import.meta.env.DEV) {
      void (async () => {
        const appRoot = new URL(import.meta.env.BASE_URL, window.location.origin).href;
        const registration = await navigator.serviceWorker.getRegistration(appRoot);
        const hadController = Boolean(navigator.serviceWorker.controller);

        await registration?.update().catch(() => undefined);
        await registration?.unregister();
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames
            .filter((cacheName) => cacheName.startsWith('noir-coffee-'))
            .map((cacheName) => caches.delete(cacheName)),
        );

        if (hadController) window.location.reload();
      })().catch((error: unknown) => {
        console.error('NOIR Coffee development cache could not be cleared:', error);
      });
      return;
    }

    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
      scope: import.meta.env.BASE_URL,
    }).catch((error: unknown) => {
      console.error('NOIR Coffee offline support could not be enabled:', error);
    });
  }, { once: true });
}

createRoot(document.getElementById('root')!, {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
