import './styles.css';
import { GameStore } from './core/state';
import { App } from './ui/app';
import { registerServiceWorker } from './pwa';

function boot(): void {
  registerServiceWorker();
  try {
    const store = new GameStore();
    const app = new App(store);
    app.start();
    // 開発時に状態を見られるようにしておく（本番でも害はない）
    (window as unknown as { __focusTown?: unknown }).__focusTown = { store, app };
  } catch (err) {
    console.error(err);
    const msg = document.createElement('p');
    msg.style.cssText = 'padding:24px;font-family:sans-serif;line-height:1.8';
    msg.textContent =
      'ゲームの起動に失敗しました。ページを再読み込みしてください。解決しない場合はブラウザのデータを消してお試しください。';
    document.body.prepend(msg);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
