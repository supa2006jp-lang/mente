// The app shell is safe to cache. User records stay in IndexedDB/localStorage.
const APP_BUILD = '20261123-foil2';
const CACHE_NAME = 'maintenance-next-static-' + APP_BUILD;
const CACHE_PREFIX = 'maintenance-next-static-';
const SHELL_FILES = [
    './app-equipment-workspace.js?v=20261115-import6',
    './app-record-assist.js?v=20261115-consistency6',
    './app-worktime-evidence.js?v=20261115-workspace-refine6',
    './app-search-presets.js?v=20261115-accuracy6',
    './app-five-s-management.js?v=20261116-image4',
    './app-unified-search.js?v=20261115-data6',
    './app-photo-export.js?v=20261115-workspace6',
    './workspace-improvements.css?v=20261116-image4',
    './',
    './index.html',
    './assets/vendor/fontsource/inter/5.2.6/index.css',
    './assets/vendor/fontsource/noto-sans-jp/5.2.6/index.css',
    './all.min.css?v=6.5.1-embedded3',
    './style.css?v=20261123-foil1',
    './assets/vendor/chart.js/4.6.1/chart.umd.min.js',
    './assets/vendor/chartjs-plugin-datalabels/2.2.0/chartjs-plugin-datalabels.min.js',
    './assets/vendor/kuromoji/0.1.2/kuromoji.js',
    './assets/vendor/kuroshiro/1.2.0/kuroshiro.min.js',
    './assets/vendor/kuroshiro-analyzer-kuromoji/1.1.0/kuroshiro-analyzer-kuromoji.min.js',
    './store.js?v=20261115-integrity6',
    './app.js?v=20261115-workspace-refine6',
    './app-settings.js?v=20261115-data6',
    './app-todos.js?v=20261115-edit-safety1',
    './app-shift-notebook-settings.js',
    './app-calendar.js?v=20261115-data6',
    './app-calendar-details.js?v=20261115-data6',
    './app-shift-notebook-editor.js?v=20260802-shift-stamp-backspace1',
    './app-calendar-support.js?v=20261115-data6',
    './app-departments.js?v=20261115-five1',
    './app-machines.js?v=20261115-data6',
    './app-maintenance-forms.js?v=20261116-image4',
    './app-history.js?v=20261115-integrity6',
    './app-analysis-dashboard.js?v=20261115-data6',
    './app-ranking-guides.js?v=20261115-data6',
    './app-tips.js?v=20261115-five1',
    './app-skills.js?v=20261115-data6',
    './app-outlook-assist.js?v=20261114-fix123',
    './app-worktime.js?v=20261115-data6',
    './app-archives.js?v=20261115-data6',
    './app-hard-delete.js?v=20261115-five1',
    './app-persistence.js?v=20261115-five1',
    './app-csv.js?v=20261115-integrity6',
    './app-import-input.js?v=20261115-integrity6',
    './app-import-undo.js?v=20261115-integrity6',
    './app-import-review.js?v=20261115-integrity6',
    './app-misc-analysis.js?v=20261115-data6',
    './assets/vendor/ffmpeg/0.11.6/ffmpeg.min.js',
    './assets/vendor/ffmpeg/0.11.6/046d0074eee1d99a674a.js',
    './app-dom-actions.js',
    './app-edit-safety.js?v=20261115-workspace-refine6',
    './app-image-edit-workspace.js?v=20261123-gradient2',
    './app-boot.js?v=20261123-foil2',
    './app-shift-notebook-core.js?v=20261123-foil2',
    './app-photo-manager.js?v=20261123-foil1',
    './app-shift-photo-camera.js?v=20260906-avatar-stage72',
    './app-shift-photo-reveal.js?v=20260906-avatar-stage72',
    './app-shift-avatar-conversation.js?v=20260906-avatar-stage72'
];

self.addEventListener('install', event => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);
        const requests = SHELL_FILES.map(path => new Request(new URL(path, self.registration.scope), { cache: 'reload' }));
        await cache.addAll(requests);
    })());
});

self.addEventListener('message', event => {
    if (event.data?.type === 'MAINTENANCE_GET_VERSION') {
        event.ports?.[0]?.postMessage({ type: 'MAINTENANCE_VERSION', build: APP_BUILD });
        return;
    }
    if (event.data?.type === 'maintenance-image-gc-clients-v1') {
        event.waitUntil((async () => {
            const reply = event.ports?.[0];
            if (!reply) return;
            const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
            const sourceId = event.source?.id;
            reply.postMessage({
                type: 'maintenance-image-gc-clients-v1',
                sourceFound: !!sourceId && windows.some(client => client.id === sourceId),
                otherCount: windows.filter(client => client.id !== sourceId).length
            });
        })());
        return;
    }
    if (event.data?.type !== 'MAINTENANCE_ACTIVATE_UPDATE') return;
    event.waitUntil((async () => {
        const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        const scope = new URL(self.registration.scope);
        const appWindows = windows.filter(client => {
            // Unknown clients remain blockers; other apps hosted below this scope do not.
            if (!client.url) return true;
            try {
                const url = new URL(client.url);
                return url.origin === scope.origin && [scope.pathname, scope.pathname + 'index.html'].includes(url.pathname);
            } catch (_) { return true; }
        });
        if (appWindows.some(client => client.id !== event.source?.id)) {
            event.source?.postMessage({ type: 'MAINTENANCE_UPDATE_OTHER_TABS' });
            return;
        }
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        // A page loaded before the update can still ask for its versioned lazy
        // modules. Retain one previous shell until the next deployment.
        const previous = keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .pop();
        await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME && key !== previous)
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
    const versionedCode = /\.(?:js|mjs|css)$/i.test(relativePath) && url.searchParams.has('v');

    event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);
        if (versionedCode) {
            const cached = await cache.match(request) || await caches.match?.(request);
            if (cached) return cached;
        }
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
