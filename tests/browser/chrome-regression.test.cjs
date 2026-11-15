'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..', '..');
const mime = {
    '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
    '.mjs': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg', '.woff': 'font/woff', '.woff2': 'font/woff2', '.wasm': 'application/wasm',
    '.gz': 'application/gzip'
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function until(check, label, timeoutMs = 30000) {
    const deadline = Date.now() + timeoutMs;
    let lastError;
    while (Date.now() < deadline) {
        try {
            const value = await check();
            if (value) return value;
        } catch (error) {
            lastError = error;
        }
        await sleep(100);
    }
    throw new Error(`Timed out waiting for ${label}${lastError ? `: ${lastError.message}` : ''}`);
}

function findChrome() {
    const candidates = [
        process.env.CHROME_BIN,
        process.platform === 'win32' && path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
        process.platform === 'win32' && path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
        process.platform === 'linux' && '/usr/bin/google-chrome',
        process.platform === 'linux' && '/usr/bin/google-chrome-stable',
        process.platform === 'darwin' && '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    ].filter(Boolean);
    const chrome = candidates.find(candidate => fs.existsSync(candidate));
    if (!chrome) throw new Error('Google Chrome が見つかりません。CHROME_BIN を設定してください。');
    return chrome;
}

function startServer() {
    const server = http.createServer((request, response) => {
        let pathname;
        try { pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname); }
        catch { response.writeHead(400).end(); return; }
        const file = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
        if (file !== path.join(root, 'index.html') && !file.startsWith(root + path.sep)) {
            response.writeHead(403).end();
            return;
        }
        fs.stat(file, (error, stat) => {
            if (error || !stat.isFile()) { response.writeHead(404).end(); return; }
            response.writeHead(200, { 'Content-Type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream' });
            fs.createReadStream(file).pipe(response);
        });
    });
    return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

class DevToolsPage {
    constructor(socket) {
        this.socket = socket;
        this.pending = new Map();
        this.nextId = 1;
        socket.addEventListener('message', event => {
            const message = JSON.parse(String(event.data));
            if (!message.id) return;
            const waiter = this.pending.get(message.id);
            if (!waiter) return;
            this.pending.delete(message.id);
            clearTimeout(waiter.timer);
            if (message.error) waiter.reject(new Error(message.error.message));
            else waiter.resolve(message.result || {});
        });
    }

    send(method, params = {}, timeoutMs = 15000) {
        const id = this.nextId++;
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(id);
                reject(new Error(`Chrome command timed out: ${method}`));
            }, timeoutMs);
            this.pending.set(id, { resolve, reject, timer });
            this.socket.send(JSON.stringify({ id, method, params }));
        });
    }

    async evaluate(expression, timeoutMs = 60000) {
        const response = await this.send('Runtime.evaluate', {
            expression, awaitPromise: true, returnByValue: true
        }, timeoutMs);
        if (response.exceptionDetails) {
            const description = response.exceptionDetails.exception?.description || response.exceptionDetails.text;
            throw new Error(description || 'Chrome page evaluation failed');
        }
        return response.result?.value;
    }

    waitFor(expression, label, timeoutMs = 60000) {
        return until(() => this.evaluate(expression), label, timeoutMs);
    }
}

async function reloadApp(page, label) {
    const previousOrigin = await page.evaluate('performance.timeOrigin');
    await page.send('Page.reload');
    await page.waitFor(`performance.timeOrigin !== ${previousOrigin} && Boolean(window.app && window.store?.data)`, label);
}

async function launchHarness() {
    const server = await startServer();
    const origin = `http://127.0.0.1:${server.address().port}`;
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'maintenance-chrome-regression-'));
    const chrome = spawn(findChrome(), [
        '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-extensions',
        '--disable-background-networking', '--no-first-run', '--no-default-browser-check',
        '--remote-debugging-port=0', `--user-data-dir=${profile}`, origin
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    let chromeStderr = '';
    chrome.stderr.on('data', chunk => { chromeStderr = (chromeStderr + chunk.toString()).slice(-4000); });
    let phase = 'Chrome launch';
    try {
        const portFile = path.join(profile, 'DevToolsActivePort');
        const port = await until(() => fs.existsSync(portFile) && Number(fs.readFileSync(portFile, 'utf8').split(/\r?\n/)[0]), 'Chrome debugging port');
        phase = 'target discovery';
        const target = await until(async () => {
            const response = await fetch(`http://127.0.0.1:${port}/json/list`);
            return (await response.json()).find(item => item.type === 'page' && item.url.startsWith(origin));
        }, 'Chrome app tab');
        const socket = new WebSocket(target.webSocketDebuggerUrl);
        await new Promise((resolve, reject) => {
            socket.addEventListener('open', resolve, { once: true });
            socket.addEventListener('error', reject, { once: true });
        });
        const page = new DevToolsPage(socket);
        phase = 'page initialization';
        await page.send('Page.enable');
        await page.send('Runtime.enable');
        phase = 'app startup';
        await page.waitFor('Boolean(window.app && window.store?.data)', 'app startup');
        phase = 'authorized reload';
        await page.evaluate("sessionStorage.setItem('is_authorized', 'true')");
        await reloadApp(page, 'authorized app startup');
        return {
            page, origin,
            async close() {
                socket.close();
                chrome.kill();
                await Promise.race([
                    new Promise(resolve => chrome.once('exit', resolve)),
                    sleep(4000)
                ]);
                await new Promise(resolve => server.close(resolve));
                // Only remove the newly created, task-specific profile under the OS temp directory.
                const safePrefix = path.join(os.tmpdir(), 'maintenance-chrome-regression-');
                if (profile.startsWith(safePrefix)) {
                    try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 }); }
                    catch (error) { console.warn(`Chrome test profile cleanup: ${error.message}`); }
                }
            }
        };
    } catch (error) {
        chrome.kill();
        await new Promise(resolve => server.close(resolve));
        throw new Error(`${phase}: ${error.message}${chromeStderr ? `\nChrome stderr: ${chromeStderr}` : ''}`);
    }
}

test('real Chrome regression: persistence, restore, offline photos, and save failure', { timeout: 180000 }, async t => {
    const harness = await launchHarness();
    t.after(() => harness.close());
    const { page } = harness;

    await t.test('a saved record survives reload and a JSON backup restores it', async () => {
        const marker = `chrome-smoke-${Date.now()}`;
        const saved = await page.evaluate(`(async () => {
            await store.runAtomicSaveBatch(() => {
                store.activeData.tips ||= [];
                store.activeData.tips.push({ id: ${JSON.stringify(marker)}, group: 'テスト', body: '保存確認', attachments: [] });
            });
            window.__browserSmokeBackup = store.exportAsJSON({ optimizeImages: true, mode: 'complete' });
            await store.runAtomicSaveBatch(() => {
                store.activeData.tips.push({ id: 'temporary-to-restore', group: 'テスト', body: '復元で削除', attachments: [] });
            });
            app.getImportPreviewInfo(window.__browserSmokeBackup, 'latest.json');
            return await store.importFromJSON(window.__browserSmokeBackup, { throwOnError: true });
        })()`);
        assert.equal(saved, true);
        await reloadApp(page, 'app reload');
        const result = await page.evaluate(`({
            found: store.activeData.tips?.some(item => item.id === ${JSON.stringify(marker)}),
            removed: !store.activeData.tips?.some(item => item.id === 'temporary-to-restore')
        })`);
        assert.deepEqual(result, { found: true, removed: true });
    });

    await t.test('search and filters stay with their view until the clear button is used', async () => {
        const result = await page.evaluate(`(() => {
            app.switchView('history');
            const search = document.getElementById('global-search');
            const period = document.getElementById('hist-filter-period');
            search.value = 'pump';
            search.dispatchEvent(new Event('input', { bubbles: true }));
            period.value = 'all';
            app.switchView('guides');
            search.value = 'manual';
            search.dispatchEvent(new Event('input', { bubbles: true }));
            app.switchView('history');
            const restored = { query: search.value, period: period.value };
            document.getElementById('view-filter-clear').click();
            const cleared = { query: search.value, period: period.value };
            app.switchView('fiveS');
            return { restored, cleared, disabled: search.disabled, explanation: search.placeholder };
        })()`);
        assert.deepEqual(result.restored, { query: 'pump', period: 'all' });
        assert.deepEqual(result.cleared, { query: '', period: 'last_this_month' });
        assert.equal(result.disabled, true);
        assert.match(result.explanation, /画面内の検索欄/);
    });

    await t.test('the installed app and unused photo modules open while offline', async () => {
        await page.waitFor('Boolean(navigator.serviceWorker?.controller)', 'service worker control');
        await page.evaluate('navigator.serviceWorker.ready.then(() => true)');
        await page.send('Network.enable');
        await page.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
        try {
            await reloadApp(page, 'offline app startup');
            const loaded = await page.evaluate('(async () => { await window.maintenanceLazyFeatures.loadPhotoEffects(); return typeof app.importPhotoManagerFiles === "function" && typeof app.openShiftPhotoCompare === "function"; })()', 90000);
            assert.equal(loaded, true);
        } finally {
            await page.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
        }
    });

    await t.test('image import commits before success and a failed save leaves no new image', async () => {
        const result = await page.evaluate(`(async () => {
            await window.maintenanceLazyFeatures.loadPhotos();
            const firstSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><rect width="4" height="4" fill="red"/></svg>';
            const secondSvg = firstSvg.replace('red', 'blue');
            const makeFile = (svg, name) => new File([svg], name, { type: 'image/svg+xml' });
            const before = app.getPhotoManagerLibrary().length;
            await app.importPhotoManagerFiles([makeFile(firstSvg, 'smoke-red.svg')]);
            const afterSuccess = app.getPhotoManagerLibrary().length;
            const originalWrite = store.writeSaveSnapshot;
            store.writeSaveSnapshot = async () => { throw new Error('simulated browser save failure'); };
            try { await app.importPhotoManagerFiles([makeFile(secondSvg, 'smoke-blue.svg')]); }
            finally { store.writeSaveSnapshot = originalWrite; }
            return { before, afterSuccess, afterFailure: app.getPhotoManagerLibrary().length };
        })()`, 90000);
        assert.equal(result.afterSuccess, result.before + 1);
        assert.equal(result.afterFailure, result.afterSuccess);
        await reloadApp(page, 'image reload');
        const persisted = await page.evaluate("(async () => { await window.maintenanceLazyFeatures.loadPhotos(); return app.getPhotoManagerLibrary().filter(item => item.name?.startsWith('smoke-')).map(item => item.name); })()");
        assert.deepEqual(persisted, ['smoke-red']);
    });

    await t.test('old unreferenced image Blobs are reclaimed in IndexedDB', async () => {
        const result = await page.evaluate(`(async () => {
            const key = store.DURABLE_IMAGE_MEDIA_PREFIX + 'browser-gc-check-' + Date.now();
            await store.runMediaWriteTransaction(media => media.put({
                blob: new Blob(['image'], { type: 'image/png' }),
                size: 5,
                updatedAt: Date.now() - 31 * 24 * 60 * 60 * 1000
            }, key));
            const preview = await store.cleanupUnusedImageBlobs({ dryRun: true });
            const completed = await store.cleanupUnusedImageBlobs({ dryRun: false });
            const stillPresent = await new Promise((resolve, reject) => {
                const tx = store.db.transaction(store.MEDIA_STORE_NAME, 'readonly');
                const request = tx.objectStore(store.MEDIA_STORE_NAME).get(key);
                request.onsuccess = () => resolve(Boolean(request.result));
                request.onerror = () => reject(request.error);
            });
            return { previewed: preview.eligibleImages >= 1, reclaimed: completed.reclaimedImages >= 1, stillPresent };
        })()`);
        assert.deepEqual(result, { previewed: true, reclaimed: true, stillPresent: false });
    });
});
