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

function startServer(options = {}) {
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
            if (options.updateBuilds && ['index.html', 'service-worker.js'].includes(path.basename(file))) {
                let text = fs.readFileSync(file, 'utf8');
                text = text.replace(/(name="maintenance-build" content=")[^"]+/, '$1' + server.fixtureBuild)
                    .replace(/const APP_BUILD = '[^']+'/, `const APP_BUILD = '${server.fixtureBuild}'`)
                    .replace(/app-boot\.js\?v=[\w-]+/g, 'app-boot.js?v=' + server.fixtureBuild);
                response.writeHead(200, { 'Content-Type': mime[path.extname(file)], 'Cache-Control': 'no-store' }); response.end(text); return;
            }
            response.writeHead(200, { 'Content-Type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream' });
            fs.createReadStream(file).pipe(response);
        });
    });
    server.fixtureBuild = 'test-old';
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

async function launchHarness(options = {}) {
    const server = await startServer(options);
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
            deployBuild(build) { server.fixtureBuild = build; },
            async newPage() {
                const response = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(origin)}`, { method: 'PUT' });
                const target = await response.json();
                const socket = new WebSocket(target.webSocketDebuggerUrl);
                await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
                const other = new DevToolsPage(socket);
                await other.send('Runtime.enable'); await other.send('Page.enable');
                await other.waitFor('Boolean(window.app && window.store?._saveConcurrencyReady)', 'second tab startup');
                other.close = async () => { await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`); socket.close(); };
                return other;
            },
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
    await t.test('calendar memo failure keeps the editor open until a successful retry', async () => {
        const result = await page.evaluate(`(async () => {
            app.openCalendarMemoEditor('2026-11-15');
            document.querySelector('.calendar-memo-editor-text').value = '保持するメモ';
            const write = store.writeSaveSnapshot; store.writeSaveSnapshot = async () => { throw Error('memo quota'); };
            await app.saveCalendarMemoEditor('2026-11-15');
            const retained=!!app._calendarMemoEditor && document.querySelector('.calendar-memo-editor-text').value === '保持するメモ';
            store.writeSaveSnapshot=write; await app.saveCalendarMemoEditor('2026-11-15');
            return {retained,closed:!app._calendarMemoEditor,saved:store.activeData.memos['2026-11-15']};
        })()`);
        assert.deepEqual(result,{retained:true,closed:true,saved:'保持するメモ'});
    });

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

test('consistency improvements: real date presets, cross-view totals, safe return, zero time, folding and undo', {timeout:180000}, async t=>{
    const h=await launchHarness();t.after(()=>h.close());const {page}=h;
    await page.evaluate(`(async()=>{
        await maintenanceLazyFeatures.loadNotebook();await maintenanceLazyFeatures.loadPhotos();
        await store.runAtomicSaveBatch(()=>{
            store.activeData.machineCategories=['包装'];store.activeData.machines=[{id:'cx-m',name:'確認ポンプ',model:'CP-1',lineNo:'1',category:'包装'}];
            store.activeData.tasks=[{id:'cx-t',machineId:'cx-m',startDate:app.getLocalDateString(),periodDays:7,content:'定期点検',workers:['田中']}];
            store.activeData.history=[{id:'cx-h',machineId:'cx-m',date:'2026-11-14',lineNo:'1',machineCategory:'包装',errorContent:'シール交換',cause:'摩耗',notes:'交換確認',workTime:0,workers:['田中'],category:'clean',isSudden:true,photos:[],replacedParts:[]}];
        });app.updateDataLists();
    })()`);
    await t.test('actual custom_range dates restore and persist without changing another view',async()=>{
        const result=await page.evaluate(`(async()=>{
            app.switchView('history');document.getElementById('search-scope').value='view';app.updateSearchScope();
            const ask=window.prompt;try {const answers=['2026-11-01','2026-11-30'];window.prompt=()=>answers.shift();const el=document.getElementById('hist-filter-period');el.value='custom_range';app.onPeriodChange(el,()=>app.renderHistory());}finally{window.prompt=ask;}
            app.saveNamedSearch('日付込み');app.switchView('worktime');
            try {const answers=['2026-10-01','2026-10-31'];window.prompt=()=>answers.shift();const el=document.getElementById('worktime-filter-period');el.value='custom_range';el.dispatchEvent(new Event('change',{bubbles:true}));}finally{window.prompt=ask;}
            if(document.getElementById('worktime-filter-period').value!=='custom_range')throw new Error('Worktime period selection reverted');
            app.setPeriodDateState({start:'2026-09-01',end:'2026-09-30'},'history');
            await app.applyNamedSearch('日付込み');return {history:app.getPeriodDateState('history'),worktime:app.getPeriodDateState('worktime'),period:document.getElementById('hist-filter-period').value,visible:document.querySelector('.history-worktime-summary').textContent};
        })()`);
        assert.equal(result.history.start,'2026-11-01');assert.equal(result.history.end,'2026-11-30');assert.equal(result.worktime.start,'2026-10-01');assert.equal(result.period,'custom_range');assert.match(result.visible,/1\s*件/);
        await reloadApp(page,'date ranges persist');await page.evaluate("app.applyNamedSearch('日付込み')");
        assert.equal(await page.evaluate("app.getPeriodDateState('history').end"),'2026-11-30');
    });
    await t.test('dashboard, history, equipment and worktime use the same valid elapsed time',async()=>{
        const result=await page.evaluate(`(async()=>{
            const saved=store.activeData.history;
            try {
                const base={...saved[0],date:app.getLocalDateString()};store.activeData.history=[{...base,workTime:30.5},{...base,id:'cx-neg',workTime:-5},{...base,id:'cx-invalid',workTime:'30x'},{...base,id:'cx-guide',isManualGuide:true,workTime:999},{...base,id:'cx-periodic',taskId:'cx-t',isDokatei:true,workTime:15}];
                app.switchView('history');app.clearCurrentViewSearchAndFilters();document.getElementById('hist-filter-period').value='all';app.renderHistory();const history=document.querySelector('.history-worktime-summary').textContent;
                app.dashboardPeriod='all';app.renderDashboard();const dashboard=Number(document.querySelector('.dashboard-chart-card').textContent.split('合計:')[1].split('分')[0].trim());
                app.switchView('ranking');document.getElementById('ranking-filter-period').value='all';app.renderRanking();await new Promise(resolve=>setTimeout(resolve,250));const count=Chart.getChart(document.getElementById('ranking-freq-chart')).data.datasets[0].data.reduce((a,b)=>a+b,0);
                app.switchView('worktime');document.getElementById('worktime-filter-period').value='all';app.saveWorkTimePeriodSelection();app.setWorkTimeGroup('category');const c=app._workTimeEvidenceContext;const total=app.getWorkTimeEvidence(c.history,c.results,c.groupBy,c.machines).total;
                return {history,dashboard,count,total,equipment:app.getEquipmentWorkspace('cx-m').minutes};
            }finally{store.activeData.history=saved;}
        })()`);
        assert.equal(result.dashboard,45.5);assert.equal(result.total,45.5);assert.equal(result.equipment,45.5);assert.equal(result.count,3);assert.match(result.history,/4\s*件/);assert.match(result.history,/45\.5分合計/);
    });
    await t.test('search return refuses to leave while saving or while discard is declined',async()=>{
        await page.evaluate("app.openHistoryEditForm('cx-h')");
        const result=await page.evaluate(`(()=>{
            app._unifiedSearchReturn={query:'シール',period:'all'};document.getElementById('e-notes').value='未保存';
            app._modalSaveInProgress=true;app.reopenUnifiedSearchReturn();const busy=document.getElementById('modal-container').dataset.modalType;app._modalSaveInProgress=false;
            const durable=app.hasDurableEditDraft,ask=window.confirm;try{app.hasDurableEditDraft=()=>false;window.confirm=()=>false;app.reopenUnifiedSearchReturn();return {busy,type:document.getElementById('modal-container').dataset.modalType,value:document.getElementById('e-notes').value};}finally{app.hasDurableEditDraft=durable;window.confirm=ask;}
        })()`);
        assert.equal(result.busy,'edit-history');assert.equal(result.type,'edit-history');assert.equal(result.value,'未保存');
        await page.evaluate('app.reopenUnifiedSearchReturn()');await page.waitFor("document.getElementById('modal-container').dataset.modalType==='shift-notebook-search'",'search return');
        await page.evaluate('app.closeModal();app._unifiedSearchReturn=null');
    });
    await t.test('zero stays editable, negative time is rejected in all three forms and decimals persist',async()=>{
        await page.evaluate("app.openHistoryEditForm('cx-h')");
        assert.equal(await page.evaluate("document.getElementById('e-work-time').value"),'0');
        for(const [type,prefix,open] of [['edit-history','e',"app.openHistoryEditForm('cx-h')"],['complete','c',"app.openCompletionForm('cx-t',app.getLocalDateString())"],['sudden','s','app.openSuddenRecordModal()']]) {
            await page.evaluate(open);
            const result=await page.evaluate(`(async()=>{document.getElementById('${prefix}-work-time').value='-1';const before=JSON.stringify(store.activeData.history);await app.saveModalData('${type}');return {type:document.getElementById('modal-container').dataset.modalType,unchanged:before===JSON.stringify(store.activeData.history),message:document.getElementById('toast-container').textContent};})()`);
            assert.equal(result.type,type);assert.equal(result.unchanged,true);assert.match(result.message,/0以上/);
        }
        await page.evaluate("app.closeModal();app.openHistoryEditForm('cx-h');document.getElementById('e-notes').value='0分の確認';app.saveModalData('edit-history')");
        assert.equal(await page.evaluate("Number(store.activeData.history.find(r=>r.id==='cx-h').workTime)"),0);
        const decimal=await page.evaluate(`(async()=>{let record;await store.runAtomicSaveBatch(()=>{record=store.addHistoryRecord({...store.activeData.history[0],workTime:12.5});});return record.workTime;})()`);assert.equal(decimal,12.5);
    });
    await t.test('equipment sections remain compact and remember their open state after reload',async()=>{
        await page.evaluate("app.openEquipmentWorkspace('cx-m');document.querySelector('[data-equipment-section=history]').open=true");await sleep(100);
        const initial=await page.evaluate("({count:document.querySelectorAll('[data-equipment-section]').length,emptyOpen:document.querySelector('[data-equipment-section=guides]').open})");assert.equal(initial.count,5);assert.equal(initial.emptyOpen,false);
        await reloadApp(page,'equipment fold state');await page.evaluate("app.openEquipmentWorkspace('cx-m')");
        assert.equal(await page.evaluate("document.querySelector('[data-equipment-section=history]').open"),true);await page.evaluate('app.closeModal()');
    });
    await t.test('copy preview changes nothing, undo preserves later typing and removes untouched copied parts',async()=>{
        await page.evaluate(`(()=>{app.openSuddenRecordModal();document.getElementById('s-machine-id').value='cx-m';app.onSuddenMachineChange('cx-m');document.getElementById('s-machine-id').dispatchEvent(new Event('change',{bubbles:true}));})()`);
        const preview=await page.evaluate(`(()=>{
            const source={...store.activeData.history.find(r=>r.id==='cx-h'),cause:'摩耗',notes:'交換確認',workTime:12.5,replacedParts:[{name:'シール',count:2,unit:'個',price:0}]};app.showRecordReuseChoice(source,'s-');
            const check=document.querySelector('[data-reuse-field=parts]');check.checked=true;check.dispatchEvent(new Event('change',{bubbles:true}));
            return {text:document.querySelector('.record-reuse-preview').textContent,cause:document.getElementById('s-cause').value};})()`);
        assert.match(preview.text,/空欄 → 摩耗/);assert.equal(preview.cause,'');
        const undone=await page.evaluate(`(()=>{
            document.querySelector('.record-reuse > button').click();const copied=document.getElementById('s-cause').value;
            const notes=document.getElementById('s-notes');notes.value='今回だけの処置';notes.dispatchEvent(new Event('input',{bubbles:true}));
            document.querySelector('.record-reuse-undo').click();return {copied,cause:document.getElementById('s-cause').value,notes:notes.value,parts:document.querySelectorAll('#s-parts-container .part-row').length,feedback:document.querySelector('.record-reuse-feedback').textContent};})()`);
        assert.equal(undone.copied,'摩耗');assert.equal(undone.cause,'');assert.equal(undone.notes,'今回だけの処置');assert.equal(undone.parts,0);assert.match(undone.feedback,/保持/);
        await page.send('Emulation.setDeviceMetricsOverride',{width:390,height:900,deviceScaleFactor:1,mobile:false});await page.evaluate('document.fonts.ready');await sleep(450);
        const layout=await page.evaluate("({width:document.querySelector('.record-reuse').clientWidth,scroll:document.querySelector('.record-reuse').scrollWidth})");assert.ok(layout.scroll<=layout.width+2,JSON.stringify(layout));
        await page.evaluate('app.closeModal()');
    });
});

test('six refinements isolate filters, reconcile time and preserve equipment editing context', { timeout: 180000 }, async t => {
    const harness = await launchHarness(); t.after(() => harness.close());
    const { page } = harness;
    await page.evaluate(`(async () => {
        await maintenanceLazyFeatures.loadNotebook(); await maintenanceLazyFeatures.loadPhotos();
        const today=app.getLocalDateString(), day=n=>new Date(app.parseTaskScheduleDate(today)+n*86400000).toISOString().slice(0,10);
        await store.runAtomicSaveBatch(() => {
            store.activeData.machineCategories=['包装'];
            store.activeData.machines=[{id:'ref-machine',name:'検証ポンプ',model:'RP-1',lineNo:'1',category:'包装'}];
            store.activeData.tasks=[{id:'ref-task',machineId:'ref-machine',content:'点検',startDate:day(-14),periodDays:7,workers:['田中']}];
            store.activeData.history=[
                {id:'ref-history',machineId:'ref-machine',date:today,lineNo:'1',machineCategory:'包装',errorContent:'シール交換',cause:'摩耗',notes:'交換確認',workTime:30,workers:['田中','鈴木'],category:'parts',isSudden:true,photos:[],replacedParts:[]},
                {id:'ref-done',machineId:'ref-machine',taskId:'ref-task',scheduledDate:day(-7),date:day(-2),workTime:10,workers:['田中'],category:'clean',photos:[],replacedParts:[]}
            ];
        }); app.updateDataLists();
    })()`);
    await t.test('view presets and older snapshots leave unrelated views and date ranges intact', async () => {
        const result = await page.evaluate(`(async () => {
            app.switchView('history'); document.getElementById('search-scope').value='view'; app.updateSearchScope();
            document.getElementById('hist-filter-period').value='CUSTOM'; app.customStartDate='2026-10-01'; app.customEndDate='2026-10-31';
            document.getElementById('hist-filter-line').value='1'; document.getElementById('global-search').value='シール'; app.saveNamedSearch('履歴だけ');
            const key='maintenance-search-presets-v1:'+store.data.currentDepartmentId, old=JSON.parse(localStorage.getItem(key));
            old[0].props.todayWorkspaceFilters=null; old[0].props.workTimeGroupBy='category'; localStorage.setItem(key,JSON.stringify(old));
            app.switchView('worktime'); app.customStartDate='2026-09-01'; app.customEndDate='2026-09-30'; app.workTimeGroupBy='worker';
            app.getTodayWorkspaceFilters(); app.todayWorkspaceFilters={line:'1',worker:'田中'};
            await app.applyNamedSearch('履歴だけ');
            const historyDates=[app.customStartDate,app.customEndDate], untouched=app.todayWorkspaceFilters, group=app.workTimeGroupBy;
            app.switchView('worktime'); const workDates=[app.customStartDate,app.customEndDate]; app.switchView('history');
            return {historyDates,workDates,untouched,group,captured:Object.keys(app.captureNamedSearch('x').props)};
        })()`);
        assert.deepEqual(result.historyDates,['2026-10-01','2026-10-31']); assert.deepEqual(result.workDates,['2026-09-01','2026-09-30']);
        assert.deepEqual(result.untouched,{line:'1',worker:'田中'}); assert.equal(result.group,'worker'); assert.ok(!result.captured.includes('todayWorkspaceFilters'));
        const all = await page.evaluate(`(async () => {
            document.getElementById('search-scope').value='all'; app.updateSearchScope(); document.getElementById('notebook-search').value='シール'; app.saveNamedSearch('全体だけ');
            app.switchView('machines'); app.machineMaintenanceListFilters={status:'overdue',kind:'all',line:'1'};
            await app.applyNamedSearch('全体だけ');
            const result={view:app.currentView,filters:app.machineMaintenanceListFilters,type:document.getElementById('modal-container').dataset.modalType}; app.closeModal(); return result;
        })()`);
        assert.equal(all.view,'machines'); assert.equal(all.filters.status,'overdue'); assert.equal(all.type,'shift-notebook-search');
    });
    await t.test('collapsed search reports active conditions without adding toolbar height', async () => {
        await page.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
        const state = await page.evaluate(`(() => {
            app.switchView('history'); document.getElementById('search-scope').value='view'; app.updateSearchScope();
            document.getElementById('hist-filter-period').value='all'; document.getElementById('hist-filter-line').value='1';
            document.getElementById('global-search').value='シール'; app.setSearchWorkspaceCollapsed(true);
            const badge=document.getElementById('search-condition-summary');
            const result={text:badge.textContent,hidden:badge.hidden,title:badge.getAttribute('aria-label'),height:document.querySelector('.header-search-workspace').getBoundingClientRect().height};
            badge.click(); result.expanded=!document.getElementById('search-workspace-controls').hidden;
            app.clearCurrentViewSearchAndFilters(); return result;
        })()`);
        assert.match(state.text,/条件 2 件/); assert.equal(state.hidden,false); assert.match(state.title,/シール/); assert.equal(state.expanded,true); assert.ok(state.height<=32,JSON.stringify(state));
    });
    await t.test('legacy anomalies agree across table, graph, evidence and equipment totals without rewriting records', async () => {
        const result = await page.evaluate(`(() => {
            const saved=store.activeData.history; const today=app.getLocalDateString();
            try {
                store.activeData.history=[
                    {...saved[0],id:'duplicate',workers:['田中',' 田中 ','鈴木']},
                    {...saved[0],id:'negative',workTime:-20},
                    {...saved[0],id:'invalid',workTime:'30x'},
                    {...saved[0],id:'guide-only',isManualGuide:true,workTime:999}
                ]; const raw=JSON.stringify(store.activeData.history);
                app.switchView('worktime'); document.getElementById('worktime-filter-period').value='all'; app.saveWorkTimePeriodSelection(); app.setWorkTimeGroup('worker'); app.renderWorkTime('');
                const c=app._workTimeEvidenceContext, evidence=app.getWorkTimeEvidence(c.history,c.results,c.groupBy,c.machines);
                const table=c.results.reduce((n,r)=>n+r.totalTime,0);
                const trend=Chart.getChart(document.getElementById('worktime-trend-chart')).data.datasets.reduce((n,d)=>n+d.data.reduce((a,b)=>a+b,0),0);
                const download=app.downloadCSV; let csv='';
                try {app.downloadCSV=(name,text)=>{csv=text};app.exportWorkTimeAsCSV();}finally{app.downloadCSV=download;}
                const csvTotal=csv.split('\\n').slice(1).reduce((n,row)=>n+Number(row.split(',')[1].replace(/"/g,'')),0);
                app.openWorkTimeGraph();
                const graph=Object.values(app._currentGraphData.total).reduce((n,x)=>n+x,0); app.closeModal();
                const chart=app.getEquipmentWorkspace('ref-machine');
                return {total:evidence.total,table,graph,trend,csvTotal,elapsed:chart.minutes,duplicate:evidence.duplicateWorkers.length,invalid:evidence.unknownTimes.length,guides:evidence.guideOnly.length,unchanged:JSON.stringify(store.activeData.history)===raw};
            } finally {store.activeData.history=saved;}
        })()`);
        assert.deepEqual(result,{total:60,table:60,graph:60,trend:60,csvTotal:60,elapsed:30,duplicate:1,invalid:2,guides:1,unchanged:true});
    });
    await t.test('past due occurrence opens with its original date and successful save returns to refreshed chart', async () => {
        const before=await page.evaluate(`(() => {
            app._unifiedSearchReturn=null; app.openEquipmentWorkspace('ref-machine');
            const data=app.getEquipmentWorkspace('ref-machine'); document.querySelector('.equipment-overdue .workspace-row button').click();
            const result={overdue:data.overdue.length,scheduled:document.getElementById('c-scheduled-date').value,expected:data.overdue[0].date,back:!!document.querySelector('.equipment-return-button')};
            document.getElementById('c-work-time').value='12'; document.getElementById('c-category').value='clean'; return result;
        })()`);
        assert.equal(before.overdue,1); assert.equal(before.scheduled,before.expected); assert.equal(before.back,true);
        await page.evaluate("app.saveModalData('complete')");
        await page.waitFor("document.getElementById('modal-container').dataset.modalType==='equipment-workspace'",'chart after completion');
        assert.equal(await page.evaluate("app.getEquipmentWorkspace('ref-machine').overdue.length"),0);
        assert.match(await page.evaluate("document.querySelector('.equipment-overdue h3').textContent"),/0 件/);
    });
    await t.test('history return respects unsaved changes and a failed save, then refreshes after a successful edit', async () => {
        await page.evaluate(`(() => {
            app.openEquipmentWorkspace('ref-machine'); const root=document.getElementById('modal-content');root.scrollTop=120;
            [...root.querySelectorAll('button')].find(b=>b.textContent.startsWith('対応履歴')).click();
            [...document.querySelectorAll('#modal-content .workspace-row')].find(r=>r.textContent.includes('シール交換')).querySelector('button').click();
        })()`);
        assert.equal(await page.evaluate("document.getElementById('modal-container').dataset.modalType"),'edit-history');
        await page.send('Emulation.setDeviceMetricsOverride',{width:390,height:900,deviceScaleFactor:1,mobile:false});
        const footer=await page.evaluate(`(() => { const f=document.querySelector('.modal-footer');return {width:f.clientWidth,scroll:f.scrollWidth,button:document.querySelector('.equipment-return-button').getBoundingClientRect().height}; })()`);
        assert.ok(footer.scroll<=footer.width+2 && footer.button<50,JSON.stringify(footer));
        await page.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
        const blocked=await page.evaluate(`(() => {
            document.getElementById('e-notes').value='変更後の処置'; const old=app.hasDurableEditDraft, ask=window.confirm;
            try { app.hasDurableEditDraft=()=>false; window.confirm=()=>false; document.querySelector('.equipment-return-button').click(); return document.getElementById('modal-container').dataset.modalType; }
            finally {app.hasDurableEditDraft=old;window.confirm=ask;}
        })()`);
        assert.equal(blocked,'edit-history');
        const failed=await page.evaluate(`(async () => {
            const original=store.runAtomicSaveBatch; try {store.runAtomicSaveBatch=async()=>{throw new Error('検証用の保存失敗')};await app.saveModalData('edit-history');return {type:document.getElementById('modal-container').dataset.modalType,value:document.getElementById('e-notes').value,back:!!document.querySelector('.equipment-return-button')};}finally{store.runAtomicSaveBatch=original;}
        })()`);
        assert.equal(failed.type,'edit-history'); assert.equal(failed.value,'変更後の処置'); assert.equal(failed.back,true);
        await page.evaluate("app.saveModalData('edit-history')");
        await page.waitFor("document.getElementById('modal-container').dataset.modalType==='equipment-workspace'",'chart after history save');
        assert.equal(await page.evaluate("store.activeData.history.find(h=>h.id==='ref-history').notes"),'変更後の処置');
        const back = await page.evaluate(`(() => { document.querySelector('#modal-content section:not(.equipment-overdue)');
            [...document.querySelectorAll('#modal-content button')].find(b=>b.textContent.startsWith('対応履歴')).click(); document.querySelector('.equipment-return-button').click(); return document.getElementById('modal-container').dataset.modalType; })()`);
        assert.equal(back,'equipment-workspace'); await page.evaluate('app.closeModal()');
    });
    await t.test('reuse chooses fields and requires an explicit choice for duration and workers, including old copy actions', async () => {
        await page.evaluate(`(() => { app.openSuddenRecordModal(); document.getElementById('s-machine-id').value='ref-machine'; app.onSuddenMachineChange('ref-machine'); document.getElementById('s-machine-id').dispatchEvent(new Event('change',{bubbles:true})); })()`);
        const copied=await page.evaluate(`(() => {
            document.getElementById('s-work-time').value='';document.getElementById('s-workers').value='';document.getElementById('s-notes').value='今回の処置';
            store.activeData.history.find(h=>h.id==='ref-history').replacedParts=[{name:'シール',model:'P-1',count:2,unit:'個',price:0}];
            app.applyHistoryAssistCandidate('ref-history','s-','full');
            const before=document.getElementById('s-cause').value;
            document.querySelector('.record-reuse button').click();
            const after={cause:document.getElementById('s-cause').value,notes:document.getElementById('s-notes').value,time:document.getElementById('s-work-time').value,workers:document.getElementById('s-workers').value,partsBefore:document.querySelectorAll('#s-parts-container .part-row').length,before};
            document.querySelector('[data-reuse-field="work-time"]').checked=true;document.querySelector('[data-reuse-field="workers"]').checked=true;
            document.querySelector('[data-reuse-field="parts"]').checked=true;
            document.querySelector('[data-reuse-field="parts"]').dispatchEvent(new Event('change',{bubbles:true}));
            document.querySelector('.record-reuse button').click(); document.querySelector('.record-reuse button').click(); after.optedTime=document.getElementById('s-work-time').value;after.optedWorkers=document.getElementById('s-workers').value;after.partsAfter=document.querySelectorAll('#s-parts-container .part-row').length;return after;
        })()`);
        assert.equal(copied.before,'');assert.equal(copied.cause,'摩耗');assert.equal(copied.notes,'今回の処置');assert.equal(copied.time,'');assert.equal(copied.workers,'');assert.equal(copied.optedTime,'30');assert.equal(copied.optedWorkers,'田中, 鈴木');assert.equal(copied.partsBefore,0);assert.equal(copied.partsAfter,1);
        await page.send('Emulation.setDeviceMetricsOverride',{width:390,height:900,deviceScaleFactor:1,mobile:false});
        await page.evaluate('document.fonts.ready'); await sleep(450);
        const layout=await page.evaluate("({width:document.querySelector('.record-reuse').clientWidth,scroll:document.querySelector('.record-reuse').scrollWidth})");
        assert.ok(layout.scroll<=layout.width+2,JSON.stringify(layout)); await page.evaluate('app.closeModal()');
    });
});

test('edit safety: failed save, drafts, structural repair, and concurrent tabs', { timeout: 180000 }, async t => {
    const harness = await launchHarness(); t.after(() => harness.close());
    const { page } = harness;
    await t.test('ToDo failure retains input and retry creates exactly one record', async () => {
        const result = await page.evaluate(`(async () => {
            await maintenanceLazyFeatures.loadNotebook(); await maintenanceLazyFeatures.loadPhotos();
            app.openKanbanTodoModal();
            const title = document.getElementById('kt-task-title'); title.value = 'retry-todo'; title.dispatchEvent(new Event('input', { bubbles: true }));
            const write = store.writeSaveSnapshot; store.writeSaveSnapshot = async () => { throw Error('simulated quota'); };
            const before = store.activeData.localTodos.length;
            await app.saveKanbanTodoFromModal();
            const failed = { open: !!document.getElementById('kt-todo-modal-overlay'), title: title.value, count: store.activeData.localTodos.length, message: document.querySelector('.edit-save-error').textContent };
            store.writeSaveSnapshot = write;
            await app.saveKanbanTodoFromModal();
            return { before, failed, after: store.activeData.localTodos.length, closed: !document.getElementById('kt-todo-modal-overlay'), drafts: Object.keys(localStorage).filter(k => k.startsWith('maintenance-edit-draft-v1:')).length };
        })()`);
        assert.equal(result.failed.open, true); assert.equal(result.failed.title, 'retry-todo'); assert.equal(result.failed.count, result.before);
        assert.match(result.failed.message, /simulated quota/); assert.equal(result.after, result.before + 1); assert.equal(result.closed, true); assert.equal(result.drafts, 0);
    });
    await t.test('history fields, parts and photos restore after reload', async () => {
        await page.evaluate(`(async () => {
            await store.runAtomicSaveBatch(() => { store.activeData.machines.push({ id:'draft-machine', name:'下書き機械', model:'A', lineNo:'1' }); store.activeData.history.push({ id:'draft-history', machineId:'draft-machine', date:'2026-11-15', errorContent:'元の記録', photos:[], replacedParts:[], workers:[], isSudden:true, lineNo:'1' }); });
            await app.openHistoryEditForm('draft-history'); await Promise.resolve();
            document.getElementById('e-notes').value = '復元する作業内容';
            app.addPartRow({name:'部品', model:'P1', count:2, unit:'個'}, true);
            app._tempPhotos = ['data:image/png;base64,AQID'];
            document.getElementById('e-notes').dispatchEvent(new Event('input', {bubbles:true}));
        })()`);
        await reloadApp(page, 'draft reload');
        const restored = await page.evaluate(`(async () => {
            await app.openHistoryEditForm('draft-history'); await Promise.resolve();
            const before = document.getElementById('e-notes').value;
            [...document.querySelectorAll('.edit-safety-note button')].find(b => b.textContent === '下書きを復元').click();
            return {before, notes:document.getElementById('e-notes').value, part:document.querySelector('#s-parts-container .p-name').value, count:document.querySelector('#s-parts-container .p-count').value, photos:app._tempPhotos};
        })()`);
        assert.notEqual(restored.before, restored.notes); assert.equal(restored.notes, '復元する作業内容'); assert.equal(restored.part, '部品'); assert.equal(restored.count, '2'); assert.deepEqual(restored.photos, ['data:image/png;base64,AQID']);
        await page.evaluate('app.closeModal()');
    });
    await t.test('structural errors identify department and record and allow reviewed correction', async () => {
        const result = await page.evaluate(`(async () => {
            store.activeData.history.find(h => h.id === 'draft-history').photos = {};
            let error; try { await store.save(); } catch(e) { error=e; }
            app.openSaveStructureIssues(error);
            const d=document.querySelector('.edit-safety-dialog'); const label=d.querySelector('summary').textContent;
            const click=text=>[...d.querySelectorAll('button')].find(b=>b.textContent===text).click();
            click('修正前のデータをファイルに退避');
            d.querySelector('textarea').value='[]'; click('この修正を仮適用'); click('修正内容を保存');
            await new Promise(r=>setTimeout(r,300));
            const answer={label, valid:Array.isArray(store.activeData.history.find(h=>h.id==='draft-history').photos), text:d.textContent}; d.close(); return answer;
        })()`);
        assert.match(result.label, /初期部署.*メンテナンス履歴.*元の記録.*添付写真/); assert.equal(result.valid, true); assert.match(result.text, /修正を保存しました/);
    });
    await t.test('a stale second tab cannot overwrite an IndexedDB commit', async () => {
        const other = await harness.newPage();
        try {
            await page.evaluate("(async()=>{store.activeData.memos['concurrency']='new-value';await store.save()})()");
            const result = await other.evaluate("(async()=>{store.activeData.memos['stale']='old-tab';try{await store.save();return 'unexpected success'}catch(e){return e.code}})()");
            assert.equal(result, 'SAVE_CONFLICT');
            await reloadApp(page,'verify winning state');
            assert.deepEqual(await page.evaluate("({newValue:store.activeData.memos['concurrency'],hasStale:'stale' in store.activeData.memos})"), {newValue:'new-value',hasStale:false});
        } finally { await other.close(); }
    });
    await t.test('simultaneous localStorage fallback saves have one winner', async () => {
        const other = await harness.newPage();
        try {
            const setup="store.saveTarget='localStorage';store._saveBases.localStorage=localStorage.getItem(store.STORAGE_KEY);";
            await page.evaluate(setup); await other.evaluate(setup);
            const save=marker=>`(async()=>{store.activeData.memos['race']='${marker}';try{await store.save();return 'ok'}catch(e){return e.code}})()`;
            const results=await Promise.all([page.evaluate(save('one')),other.evaluate(save('two'))]);
            assert.deepEqual(results.sort(), ['SAVE_CONFLICT','ok']);
        } finally { await other.close(); }
    });
});

test('service worker update banner clears after update or a normal reload into the new build', { timeout: 120000 }, async () => {
    const harness = await launchHarness({ updateBuilds: true });
    const { page } = harness;
    let other;
    try {
        await page.waitFor('Boolean(navigator.serviceWorker.controller)', 'initial worker');
        await page.evaluate("(async()=>{store.activeData.memos['update-proof']='保存データは残る';await store.save()})()");
        harness.deployBuild('test-new');
        await page.evaluate('navigator.serviceWorker.getRegistration().then(r=>r.update()).then(()=>true)');
        await page.waitFor("Boolean(document.getElementById('maintenance-update-banner'))", 'actual new build banner');
        const before = await page.evaluate('performance.timeOrigin');
        await page.evaluate("window.confirm=()=>true;document.querySelector('#maintenance-update-banner button').click()");
        await page.waitFor(`performance.timeOrigin !== ${before} && Boolean(window.app)`, 'update reload');
        await page.waitFor("!document.getElementById('maintenance-update-banner') && document.querySelector('meta[name=maintenance-build]').content==='test-new'", 'no repeated update notice');
        await reloadApp(page, 'second reload after update');
        await page.waitFor('navigator.serviceWorker.getRegistration().then(r=>!r.waiting)', 'activated worker');
        assert.equal(await page.evaluate("Boolean(document.getElementById('maintenance-update-banner'))"), false);
        assert.equal(await page.evaluate("store.activeData.memos['update-proof']"), '保存データは残る');

        // Keep another app tab alive so a browser refresh cannot auto-activate the waiting worker.
        other = await harness.newPage();
        harness.deployBuild('test-next');
        await page.evaluate('navigator.serviceWorker.getRegistration().then(r=>r.update()).then(()=>true)');
        await page.waitFor("Boolean(document.getElementById('maintenance-update-banner'))", 'next actual update');
        await reloadApp(page, 'normal browser refresh with another tab');
        await page.waitFor("document.querySelector('meta[name=maintenance-build]').content==='test-next'", 'latest page loaded');
        await sleep(600);
        assert.equal(await page.evaluate("Boolean(document.getElementById('maintenance-update-banner'))"), false, 'a page already at the waiting build is current');
        assert.equal(await page.evaluate('navigator.serviceWorker.getRegistration().then(r=>!!r.waiting)'), true, 'old tab remains protected');
        await other.close(); other = null;
        await reloadApp(page, 'align worker after other tab closes');
        await page.waitFor('navigator.serviceWorker.getRegistration().then(r=>!r.waiting)', 'quiet activation of matching build');
        await sleep(300);
        assert.equal(await page.evaluate("Boolean(document.getElementById('maintenance-update-banner'))"), false);
    } finally { if (other) await other.close(); await harness.close(); }
});

test('workspace improvements: equipment, today actions, saved searches, forms, evidence and responsive layout', { timeout: 180000 }, async t => {
    const harness = await launchHarness(); t.after(() => harness.close());
    const { page } = harness;
    await page.evaluate(`(async () => {
        await maintenanceLazyFeatures.loadNotebook(); await maintenanceLazyFeatures.loadPhotos();
        const today = app.getLocalDateString();
        await store.runAtomicSaveBatch(() => {
            store.activeData.machineCategories = ['包装機'];
            store.activeData.machines = [{id:'ws-machine',name:'テスト包装機',model:'PK-1',lineNo:'1',category:'包装機'}];
            store.activeData.tasks = [{id:'ws-task',machineId:'ws-machine',content:'定期点検',periodDays:7,startDate:today,workers:['田中']}];
            store.activeData.history = [{id:'ws-history',machineId:'ws-machine',date:today,lineNo:'1',machineCategory:'包装機',errorContent:'ベルト交換',cause:'摩耗',notes:'交換して動作確認',workTime:30,workers:['田中','鈴木'],category:'parts',isSudden:true,photos:[],replacedParts:[]}];
        });
        app.updateDataLists();
    })()`);
    await t.test('machine chart exposes history, next occurrence and its completion form', async () => {
        const result = await page.evaluate(`(() => {
            app.openEquipmentWorkspace('ws-machine');
            const text = document.getElementById('modal-content').textContent;
            [...document.querySelectorAll('#modal-content button')].find(b=>b.textContent==='完了を記録').click();
            return {text,type:document.getElementById('modal-container').dataset.modalType,workers:document.getElementById('c-workers').value};
        })()`);
        assert.match(result.text,/ベルト交換/); assert.match(result.text,/次回のメンテ予定/); assert.equal(result.type,'complete'); assert.equal(result.workers,'田中');
        await page.evaluate('app.closeModal()');
    });
    await t.test('today filters show the real scheduled occurrence and saving removes it', async () => {
        const before = await page.evaluate(`(() => {
            app.switchView('dashboard'); app.setTodayWorkspaceFilter('line','1'); app.setTodayWorkspaceFilter('worker','田中');
            const count=app.getTodayActionSummary().todayTasks.length;
            document.querySelector('.today-scheduled-list [data-task-id="ws-task"]').click();
            document.getElementById('c-work-time').value='10'; document.getElementById('c-category').value='clean';
            return {count,valid:document.getElementById('complete-form').checkValidity(),invalid:[...document.querySelectorAll('#complete-form :invalid')].map(n=>({id:n.id,value:n.value,options:[...(n.options||[])].map(o=>o.value)}))};
        })()`);
        assert.equal(before.count,1); assert.equal(before.valid,true,JSON.stringify(before));
        await page.evaluate("app.saveModalData('complete')");
        assert.equal(await page.evaluate('app.getTodayActionSummary().todayTasks.length'),0);
        assert.equal(await page.evaluate("store.activeData.history.filter(h=>h.taskId==='ws-task').length"),1);
        await page.evaluate("app.setTodayWorkspaceFilter('line','all'); app.setTodayWorkspaceFilter('worker','all')");
    });
    await t.test('named searches restore query, line, period and scope after reload', async () => {
        await page.evaluate(`(() => {
            app.switchView('history');
            document.getElementById('global-search').value='ベルト'; document.getElementById('global-search').dispatchEvent(new Event('input',{bubbles:true}));
            document.getElementById('hist-filter-period').value='all'; document.getElementById('hist-filter-line').value='1';
            app.saveNamedSearch('包装機のベルト');
        })()`);
        await reloadApp(page,'saved search persists');
        await page.evaluate("app.applyNamedSearch('包装機のベルト')");
        assert.deepEqual(await page.evaluate("({view:app.currentView,q:document.getElementById('global-search').value,line:document.getElementById('hist-filter-line').value,period:document.getElementById('hist-filter-period').value,scope:document.getElementById('search-scope').value})"),{view:'history',q:'ベルト',line:'1',period:'all',scope:'view'});
        await page.evaluate(`(() => { document.getElementById('search-scope').value='all'; app.updateSearchScope(); document.getElementById('notebook-search').value='ベルト'; document.getElementById('notebook-search-period').value='this_month'; app.saveNamedSearch('全体のベルト'); })()`);
        await page.evaluate("app.applyNamedSearch('全体のベルト')");
        assert.equal(await page.evaluate("document.getElementById('modal-container').dataset.modalType"),'shift-notebook-search');
        assert.equal(await page.evaluate("document.getElementById('notebook-search-period').value"),'this_month');
        await page.evaluate('app.closeModal()');
    });
    await t.test('organized forms keep required fields visible and reuse only blank values', async () => {
        const result = await page.evaluate(`(() => {
            app.openSuddenRecordModal(); document.getElementById('s-machine-id').value='ws-machine'; app.onSuddenMachineChange('ws-machine');
            document.getElementById('s-machine-id').dispatchEvent(new Event('change',{bubbles:true}));
            document.getElementById('s-notes').value='今回の処置'; document.getElementById('record-reuse-select').value='ws-history';
            document.getElementById('record-reuse-select').dispatchEvent(new Event('change',{bubbles:true}));
            document.querySelector('.record-reuse button').click();
            return {cause:document.getElementById('s-cause').value,notes:document.getElementById('s-notes').value,required:[...document.querySelectorAll('#sudden-form [required]')].every(f=>!f.closest('details')||f.closest('details').open),open:document.querySelector('.maintenance-form-details').open};
        })()`);
        assert.equal(result.cause,'摩耗'); assert.equal(result.notes,'今回の処置'); assert.equal(result.required,true); assert.equal(result.open,true);
        await page.evaluate('app.closeModal()');
    });
    await t.test('worktime numbers drill into the exact records including multiperson contribution', async () => {
        const result = await page.evaluate(`(() => {
            app.switchView('worktime'); document.getElementById('worktime-filter-period').value='all'; app.saveWorkTimePeriodSelection(); app.setWorkTimeGroup('worker');
            const data=app._workTimeEvidenceContext;
            const sum=app.getWorkTimeEvidence(data.history,data.results,data.groupBy,data.machines).total;
            document.querySelector('.worktime-evidence-number').click();
            return {sum,text:document.getElementById('modal-content').textContent,type:document.getElementById('modal-container').dataset.modalType};
        })()`);
        assert.equal(result.sum,70); assert.equal(result.type,'evidence-records'); assert.match(result.text,/集計への加算/);
        await page.evaluate('app.closeModal()');
    });
    await t.test('mobile and 200 percent equivalent viewport keep the new controls and forms usable', async () => {
        for (const width of [390,640]) {
            await page.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:width===640?2:1,mobile:false});
            await page.evaluate("app.switchView('history'); document.getElementById('search-scope').value='view'; app.updateSearchScope(); app.openSuddenRecordModal()");
            await page.evaluate('document.fonts.ready.then(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))');
            const layout = await page.evaluate(`(() => {
                const dialog=document.getElementById('modal-container'), form=document.getElementById('sudden-form'), bar=document.querySelector('.header-search-workspace');
                const overflow=[...form.querySelectorAll('*')].filter(n=>n.getBoundingClientRect().width && n.getBoundingClientRect().right>form.getBoundingClientRect().right+2).slice(0,8).map(n=>({tag:n.tagName,id:n.id,width:n.getBoundingClientRect().width}));
                return {viewport:innerWidth,dialogRight:dialog.getBoundingClientRect().right,dialogLeft:dialog.getBoundingClientRect().left,formWidth:form.clientWidth,formScroll:form.scrollWidth,barLeft:bar.getBoundingClientRect().left,barRight:bar.getBoundingClientRect().right,scopeWidth:document.getElementById('search-scope').getBoundingClientRect().width,overflow};
            })()`);
            assert.ok(layout.dialogLeft>=-1 && layout.dialogRight<=width+1,JSON.stringify(layout));
            assert.ok(layout.formScroll<=layout.formWidth+2,JSON.stringify(layout));
            assert.ok(layout.barLeft<20 && layout.barRight<=width+1 && layout.scopeWidth>30,JSON.stringify(layout));
            await page.evaluate('app.closeModal()');
        }
    });
    await t.test('ten thousand real records render a bounded evidence page and reconcile the worktime table', async () => {
        await page.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
        const result = await page.evaluate(`(() => {
            const saved = store.activeData.history;
            const records = Array.from({length:10000},(_,i)=>({...saved[0],id:'bulk-'+i,workers:['田中','鈴木'],workTime:30}));
            try {
                store.activeData.history=records;
                const start=performance.now(); app.switchView('worktime'); app.renderWorkTime('');
                const c=app._workTimeEvidenceContext, evidence=app.getWorkTimeEvidence(c.history,c.results,c.groupBy,c.machines);
                app.openWorkTimeEvidence();
                const rendered=document.querySelectorAll('#modal-content .workspace-row').length;
                const text=document.querySelector('#modal-content .workspace-toolbar').textContent;
                return {total:evidence.total,rendered,text,ms:performance.now()-start};
            } finally { store.activeData.history=saved; app.closeModal(); }
        })()`);
        assert.equal(result.total,600000); assert.equal(result.rendered,50); assert.match(result.text,/200 ページ・全 10000 件/);
        assert.ok(result.ms<8000,JSON.stringify(result));
        t.diagnostic(`10,000 records: ${Math.round(result.ms)} ms, 50 visible evidence rows`);
    });
    await t.test('compact search collapses without clearing input and machine chart buttons remain horizontal', async () => {
        await page.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
        await page.evaluate("app.switchView('machines'); app.machineMaintenanceListMode=false; document.getElementById('global-search').value=''; app.renderMachines(); document.getElementById('search-scope').value='all'; app.updateSearchScope()");
        await page.evaluate('document.fonts.ready.then(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))');
        const sizes = await page.evaluate(`(() => {
            const bar=document.querySelector('.header-search-workspace'), chart=document.querySelector('.machine-card-chart-link'), edit=document.querySelector('.machine-card-actions .edit-btn');
            const openHeight=bar.getBoundingClientRect().height;
            document.querySelector('.saved-search-controls').open=true;
            const panelHeight=bar.getBoundingClientRect().height;
            const savedName=document.getElementById('saved-search-name'), fieldRect=savedName.getBoundingClientRect();
            const panelAccessible=document.elementFromPoint(fieldRect.left+fieldRect.width/2,fieldRect.top+fieldRect.height/2)===savedName;
            document.getElementById('notebook-search').value='保持する検索';
            document.getElementById('search-workspace-toggle').click();
            const folded={height:bar.getBoundingClientRect().height,hidden:document.getElementById('search-workspace-controls').hidden,expanded:document.getElementById('search-workspace-toggle').getAttribute('aria-expanded')};
            document.getElementById('search-workspace-toggle').click();
            const text=document.getElementById('notebook-search').value;
            document.getElementById('search-workspace-toggle').click();
            const a=chart.getBoundingClientRect(), b=edit.getBoundingClientRect();
            return {openHeight,panelHeight,panelAccessible,folded,text,chartHeight:a.height,chartWidth:a.width,overlap:a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top};
        })()`);
        assert.ok(sizes.openHeight<=48,JSON.stringify(sizes)); assert.equal(sizes.panelHeight,sizes.openHeight);
        assert.equal(sizes.panelAccessible,true);
        assert.ok(sizes.folded.height<=32,JSON.stringify(sizes)); assert.equal(sizes.folded.hidden,true); assert.equal(sizes.folded.expanded,'false'); assert.equal(sizes.text,'保持する検索');
        assert.ok(sizes.chartHeight<=32 && sizes.chartWidth>sizes.chartHeight*2,JSON.stringify(sizes)); assert.equal(sizes.overlap,false);
        await reloadApp(page,'collapsed search preference');
        assert.equal(await page.evaluate("document.getElementById('search-workspace-controls').hidden"),true);
        await page.evaluate('app.setSearchWorkspaceCollapsed(false)');
    });
});
