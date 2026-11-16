/**
 * Service Worker の登録。
 * これが入ると、一度オンラインで開いたあとは圏外でも遊べる。
 *
 * 開発中（npm run dev）は登録しない。ソースの更新がキャッシュに邪魔されないようにするため。
 * もし以前に登録されたものが残っていたら、開発中は外しておく。
 */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;

  if (import.meta.env.DEV) {
    void navigator.serviceWorker.getRegistrations().then((regs) => {
      for (const reg of regs) void reg.unregister();
    });
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      // 登録できなくてもゲームは普通に動く（オフライン対応が効かないだけ）
      console.warn('Service Worker を登録できませんでした:', err);
    });
  });
}

/** ホーム画面に追加できる状態か（設定画面の案内に使う） */
export function isStandalone(): boolean {
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  // iOS Safari 用
  return Boolean((window.navigator as unknown as { standalone?: boolean }).standalone);
}
