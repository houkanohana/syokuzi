import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './index.css';

const SW_UPDATE_INTERVAL_MS = 60 * 60 * 1000; // 1時間ごとに更新確認

// PWA Service Worker の登録と定期・復帰時の自動更新チェック
if ('serviceWorker' in navigator) {
  let hadController = Boolean(navigator.serviceWorker.controller);

  // 既存の Service Worker から新しい版へ切り替わったとき、画面へ更新通知を送る
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) {
      window.dispatchEvent(new CustomEvent('app:pwa-updated'));
    } else {
      hadController = true;
    }
  });
}

registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;

    const checkUpdate = () => {
      if (navigator.onLine) {
        void registration.update();
      }
    };

    // 1時間おきに新版を確認
    window.setInterval(checkUpdate, SW_UPDATE_INTERVAL_MS);

    // スマホで別アプリから戻ってきた時・オンライン復帰時にも新版を確認
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        checkUpdate();
      }
    });
    window.addEventListener('online', checkUpdate);
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
