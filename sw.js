// CarbCounter service worker – שומר את קבצי האפליקציה לעבודה בלי רשת
const CACHE = 'carbcounter-v4';
const SHELL = ['./', './index.html', './manifest.webmanifest', './firebase-config.js', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // תעבורת Firebase/Google API לא נשמרת כאן (ל-Firestore יש מטמון משלו)
  if (url.hostname.endsWith('googleapis.com') && !url.hostname.startsWith('fonts.')) return;
  if (url.hostname.includes('firebaseapp.com') || url.hostname.includes('accounts.google.com')) return;
  const sameOrigin = url.origin === self.location.origin;
  const isStatic = url.hostname === 'www.gstatic.com' || url.hostname.startsWith('fonts.');
  if (!sameOrigin && !isStatic) return;
  if (sameOrigin && url.pathname.endsWith('firebase-config.js')) {
    // הגדרות הענן – תמיד קודם מהרשת, כדי לא להיתקע עם גרסה ישנה
    e.respondWith(fetch(req, { cache: 'no-store' }).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res;
    }).catch(() => caches.match(req)));
    return;
  }
  if (sameOrigin) {
    // קודם מהמטמון (פתיחה מהירה), ובמקביל עדכון מהרשת לפעם הבאה
    const net = fetch(req).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => null);
    e.waitUntil(net);
    e.respondWith(caches.match(req).then(r => r || net.then(n => n || caches.match('./index.html'))));
  } else {
    // ספריות וגופנים: מהמטמון, ואם אין – מהרשת
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res;
    })));
  }
});
