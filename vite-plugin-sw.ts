/**
 * ビルド時に Service Worker（sw.js）を書き出す小さな Vite プラグイン。
 * 外部ライブラリを足さずにオフライン対応するためのもの。
 *
 * やっていること:
 *   1. ビルドで出来たファイル名（ハッシュ付き）を集める
 *   2. その一覧を埋め込んだ sw.js を出力する
 *   3. sw.js は install 時に全部キャッシュし、以後はキャッシュ優先で返す
 *
 * 開発中（npm run dev）には何もしない。Service Worker が
 * ソースの更新を邪魔しないようにするため。
 */
import type { Plugin } from 'vite';

/** キャッシュしない拡張子（無くてもよいもの） */
const SKIP = /\.(map)$/;

export function serviceWorkerPlugin(options: { cacheName?: string } = {}): Plugin {
  const cacheName = options.cacheName ?? 'focus-town';

  return {
    name: 'focus-town-service-worker',
    apply: 'build',
    generateBundle(_outputOptions, bundle) {
      const assets = Object.keys(bundle)
        .filter((name) => !SKIP.test(name))
        .map((name) => './' + name);

      // index.html 自体と、public/ から配られるファイルも足す
      const precache = Array.from(
        new Set([
          // index.html はこのフックの時点ではまだ bundle に無いことがあるので、明示的に入れる
          './',
          './index.html',
          ...assets,
          './manifest.webmanifest',
          './icon-192.png',
          './icon-512.png',
          './icon-maskable-512.png',
          './apple-touch-icon.png',
          './favicon-32.png',
        ]),
      );

      // 中身が変わるたびにキャッシュ名も変わるようにする
      const version = hash(precache.join('|') + Date.now().toString(36));

      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: renderServiceWorker(cacheName, version, precache),
      });
    },
  };
}

function hash(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function renderServiceWorker(cacheName: string, version: string, precache: string[]): string {
  return `/* 自動生成されたファイルです。編集しても次のビルドで上書きされます。 */
const CACHE = '${cacheName}-${version}';
const PRECACHE = ${JSON.stringify(precache, null, 2)};

// サーバーが Vary ヘッダ（例: Vary: Origin）を返すと、保存したときと
// ブラウザが実際に出すリクエストのヘッダが違うだけで照合が外れてしまう。
// オフラインで確実に返せるよう、照合では Vary を見ない。
const MATCH = { ignoreVary: true };

async function lookup(cache, request) {
  const hit = await cache.match(request, MATCH);
  if (hit) return hit;
  // Request そのものでだめなら URL だけで引き直す
  return cache.match(new URL(request.url).href, MATCH);
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // 1つでも失敗したら全部止まる addAll は使わず、取れたものだけ入れる
      await Promise.all(
        PRECACHE.map(async (path) => {
          try {
            const url = new URL(path, self.location.href);
            const res = await fetch(url, { cache: 'reload' });
            if (res.ok) await cache.put(url, res);
          } catch {
            /* 1つ取れなくても起動は続ける */
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith('${cacheName}-') && n !== CACHE).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // ページそのものへのアクセスは、オフラインなら index.html を返す
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(CACHE);
          cache.put(new URL('./index.html', self.location.href), fresh.clone());
          return fresh;
        } catch {
          const cache = await caches.open(CACHE);
          const cached =
            (await cache.match(new URL('./index.html', self.location.href).href, MATCH)) ||
            (await cache.match(new URL('./', self.location.href).href, MATCH));
          if (cached) return cached;
          return new Response('オフラインです。一度オンラインで開き直してください。', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          });
        }
      })(),
    );
    return;
  }

  // それ以外は、キャッシュがあればキャッシュを返し、裏で更新する
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await lookup(cache, req);
      const network = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => null);
      if (cached) {
        event.waitUntil(network);
        return cached;
      }
      const fresh = await network;
      if (fresh) return fresh;
      return new Response('', { status: 504 });
    })(),
  );
});
`;
}
