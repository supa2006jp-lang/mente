// The app shell is safe to cache. User records stay in IndexedDB/localStorage.
const CACHE_NAME = 'maintenance-next-static-20261115-all5';
const CACHE_PREFIX = 'maintenance-next-static-';
const SHELL_FILES = [
    './',
    './index.html',
    './assets/vendor/fontsource/inter/5.2.6/index.css',
    './assets/vendor/fontsource/noto-sans-jp/5.2.6/index.css',
    './all.min.css?v=6.5.1-embedded3',
    './style.css?v=20261115-all5',
    './assets/vendor/chart.js/4.6.1/chart.umd.min.js',
    './assets/vendor/chartjs-plugin-datalabels/2.2.0/chartjs-plugin-datalabels.min.js',
    './assets/vendor/kuromoji/0.1.2/kuromoji.js',
    './assets/vendor/kuroshiro/1.2.0/kuroshiro.min.js',
    './assets/vendor/kuroshiro-analyzer-kuromoji/1.1.0/kuroshiro-analyzer-kuromoji.min.js',
    './store.js?v=20261114-save12',
    './app.js?v=20261115-all5',
    './app-settings.js?v=20261114-save12',
    './app-todos.js?v=20260611-todo-stamp-wrap',
    './app-shift-notebook-settings.js',
    './app-calendar.js?v=20261114-improve123',
    './app-calendar-details.js?v=20261115-all5',
    './app-shift-notebook-editor.js?v=20260802-shift-stamp-backspace1',
    './app-calendar-support.js?v=20261114-improve123',
    './app-departments.js?v=20260623-dept-switch-import-fix',
    './app-machines.js?v=20261114-improve123',
    './app-maintenance-forms.js?v=20261115-all5',
    './app-history.js?v=20261115-all5',
    './app-analysis-dashboard.js?v=20261114-fix123',
    './app-ranking-guides.js?v=20260826-auto-contrast1',
    './app-tips.js?v=20260826-tips-copy-body1',
    './app-skills.js?v=20261114-fix123',
    './app-outlook-assist.js?v=20261114-fix123',
    './app-worktime.js?v=20261114-fix123',
    './app-archives.js?v=20261114-save12',
    './app-hard-delete.js?v=20261114-fix123',
    './app-persistence.js?v=20261115-all5',
    './app-csv.js?v=20261114-fix123',
    './app-misc-analysis.js',
    './assets/vendor/ffmpeg/0.11.6/ffmpeg.min.js',
    './assets/vendor/ffmpeg/0.11.6/046d0074eee1d99a674a.js',
    './app-dom-actions.js',
    './app-boot.js?v=20261115-all5'
];

self.addEventListener('install', event => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);
        const requests = SHELL_FILES.map(path => new Request(new URL(path, self.registration.scope), { cache: 'reload' }));
        await cache.addAll(requests);
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map(key => caches.delete(key)));
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET' || request.headers.has('Range')) return;
    const url = new URL(request.url);
    const scope = new URL(self.registration.scope);
    if (url.protocol !== scope.protocol || url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
    const relativePath = decodeURIComponent(url.pathname.slice(scope.pathname.length));
    const isAppPage = relativePath === '' || relativePath === 'index.html';
    const isStatic = (!relativePath.includes('/') || relativePath.startsWith('assets/'))
        && /\.(?:js|mjs|css|png|jpe?g|svg|webp|woff2?|ttf|otf|wasm|gz|html)$/i.test(relativePath);
    if (!isAppPage && !isStatic) return;

    event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);
        try {
            const response = await fetch(request);
            if (response.ok && response.type === 'basic') {
                event.waitUntil(cache.put(request, response.clone()).catch(() => {}));
            }
            return response;
        } catch (error) {
            const cached = await cache.match(request);
            if (cached) return cached;
            if (isAppPage) {
                const fallback = await cache.match(new URL('./index.html', self.registration.scope));
                if (fallback) return fallback;
            }
            return Response.error();
        }
    })());
});
