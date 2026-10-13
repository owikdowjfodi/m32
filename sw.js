/* ══════════════════════════════════════════════════════════════════
   M2 無限答題練習 · Service Worker
   讓 App 安裝後可以離線使用（Google Play / PWA 都需要）。
   更新流程：改動前端檔案後，把 VERSION 數字 +1，使用者下次開啟就會換新。
   ══════════════════════════════════════════════════════════════════ */
'use strict';

var VERSION = 'm2-v9-priv';
var CACHE = 'm2-cache-' + VERSION;

/* 需要預先下載的檔案（相對 index.html 的位置） */
var PRECACHE = [
  './',
  './favicon.svg',
  './icons/apple-touch-icon.png',
  './manifest.webmanifest',
  './styles.css',
  './privacy.html',
  './bank-extra/surds.js',
  './bank/induction.js',
  './bank-extra/induction.js',
  './bank/binomial.js',
  './bank-extra/binomial.js',
  './bank/sincos.js',
  './bank/trig.js',
  './bank-extra/trig.js',
  './bank/limits.js',
  './bank/diff.js',
  './bank-extra/diff.js',
  './bank/appdiff.js',
  './bank-extra/appdiff.js',
  './bank/indef.js',
  './bank-extra/indef.js',
  './bank/defint.js',
  './bank/matrix.js',
  './bank/linear.js',
  './bank/vector.js',
  './bank/vectorprod.js',
  './bank-extra/exam.js',
  './bank-local/ch1.js',
  './bank-local/ch2.js',
  './bank-local/ch3.js',
  './bank-local/ch4.js',
  './bank-local/ch7.js',
  './bank-local/ch9.js',
  './bank-local/exam.js',
  './questions.js',
  './grader.js',
  './i18n.js',
  './ai.js',
  './app.js'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      /* 逐個加入：個別檔案缺失（例如單一檔案版部署）不應令整個安裝失敗 */
      return Promise.all(PRECACHE.map(function (url) {
        return c.add(new Request(url, { cache: 'reload' })).catch(function () { return null; });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k === CACHE ? null : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return;          // 只處理本站檔案

  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        if (res && res.status === 200 && res.type === 'basic') {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () {
        /* 離線時若找不到快取的檔案，導回首頁 */
        if (req.mode === 'navigate') return caches.match('./index.html');
        return new Response('', { status: 504, statusText: 'Offline' });
      });
    })
  );
});

self.addEventListener('message', function (e) {
  if (e.data === 'm2-skip-waiting') self.skipWaiting();
});
