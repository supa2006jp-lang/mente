'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'app-csv.js'), 'utf8');
const csv = '日付,機械名,型式,区分,作業内容\n2026-11-14,ポンプ,P1,突発,漏れ';

function makePage(confirmed, text = csv) {
    class MaintenanceApp {}
    class MaintenanceStore {
        static toHalfWidthLower(value) { return String(value).toLowerCase(); }
        static toFullWidth(value) { return String(value); }
    }
    const alerts = [];
    const confirmations = [];
    let saves = 0;
    let closed = 0;
    let nextId = 0;
    let review = null;
    let errors = [];
    const activeData = { machines: [], history: [], partsMaster: [], historyImportLogs: [] };
    const store = {
        data: { currentDepartmentId: 'a' },
        activeData,
        getMachines() { return activeData.machines; },
        generateId() { return `new-${++nextId}`; },
        async runAtomicSaveBatch(mutate) { const value = mutate(); saves++; return value; }
    };
    const file = { name: 'test.csv', arrayBuffer: async () => new TextEncoder().encode(text).buffer };
    const document = { getElementById(id) { return id === 'hist-csv-upload' ? { files: [file] } : null; } };
    const context = vm.createContext({
        MaintenanceApp, MaintenanceStore, store, document,
        confirm: message => { confirmations.push(message); return confirmed; }, alert: message => alerts.push(message),
        requestAnimationFrame: callback => callback(), console, Date, TextDecoder
    });
    vm.runInContext(source, context, { filename: 'app-csv.js' });
    for (const name of ['app-history.js', 'app-import-input.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', name), 'utf8'), context);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'app-import-review.js'), 'utf8'), context);
    const app = new MaintenanceApp();
    app.parseHistoryImportParts = () => [];
    app.closeModal = () => { closed++; };
    app.showToast = () => {};
    app.updateDataLists = () => {};
    app.updateHistoryPeriodOptions = () => {};
    app.switchView = () => {};
    app.renderHistory = () => {};
    app.renderCalendar = () => {};
    app.openHistoryImportReview = plan => { review = plan; };
    app.openHistoryImportErrors = items => { errors = items; };
    return { app, store, activeData, alerts, confirmations, get errors() { return errors; }, get review() { return review; }, get saves() { return saves; }, get closed() { return closed; } };
}

test('cancelling CSV import leaves provisional machines and history untouched', async () => {
    const page = makePage(false);
    await page.app.processHistoryImportCSV();
    assert.equal(page.activeData.machines.length, 0);
    assert.equal(page.activeData.history.length, 0);
    assert.equal(page.saves, 0);
    assert.equal(page.closed, 0);
    assert.deepEqual(page.alerts, []);
});

test('confirmed CSV import saves machine, history and log in one batch', async () => {
    const page = makePage(true);
    await page.app.processHistoryImportCSV();
    assert.equal(page.activeData.machines.length, 1);
    assert.equal(page.activeData.history.length, 1);
    assert.equal(page.activeData.history[0].machineId, page.activeData.machines[0].id);
    assert.equal(page.activeData.historyImportLogs[0].addedMachines, 1);
    assert.equal(page.saves, 1);
    assert.equal(page.closed, 1);
    assert.deepEqual(page.alerts, []);
});

test('CSV import preserves decimal and zero minutes without silently rounding', async () => {
    const page = makePage(true, '日付,機械名,型式,区分,作業内容,作業時間\n2026-11-14,ポンプ,P1,突発,交換,12.5\n2026-11-15,ポンプ,P1,突発,確認,0');
    await page.app.processHistoryImportCSV();
    assert.deepEqual(Array.from(page.activeData.history, h => h.workTime), [12.5, 0]);
    assert.equal(page.saves, 1);
});

test('CSV invalid time reports physical source lines including empty and multiline rows and saves nothing', async () => {
    const page = makePage(true, '日付,機械名,型式,区分,作業内容,作業時間\r\n\r\n2026-11-14,ポンプ,P1,突発,"交換\r\n確認",12.5\r\n2026-11-15,別の機械,P2,突発,確認,30min\r\n2026-11-16,別の機械,P2,突発,確認,-5');
    await page.app.processHistoryImportCSV();
    assert.equal(page.activeData.machines.length, 0);
    assert.equal(page.activeData.history.length, 0);
    assert.equal(page.saves, 0); assert.equal(page.confirmations.length, 0);
    assert.equal(page.errors[0].row, 5); assert.equal(page.errors[0].value, '30min');
    assert.equal(page.errors[1].row, 6); assert.equal(page.errors[1].value, '-5');
});

test('CSV selects the matching line without merging same-name equipment on another line', async () => {
    const page = makePage(true, '日付,機械名,型式,区分,作業内容,ライン\n2026/1/2,ポンプ,P1,突発,確認,2号ライン');
    page.activeData.machines.push({id:'a',name:'ポンプ',model:'P1',lineNo:'1'},{id:'b',name:'ポンプ',model:'P1',lineNo:'2'});
    await page.app.processHistoryImportCSV();
    assert.equal(page.activeData.history[0].machineId,'b'); assert.equal(page.activeData.history[0].date,'2026-01-02');
    assert.equal(page.activeData.machines.length,2); assert.equal(page.review,null);
});

test('ambiguous machines require explicit review and cancelled review makes no changes', async () => {
    const page = makePage(true);
    page.activeData.machines.push({id:'a',name:'ポンプ',model:'P1',lineNo:'1'},{id:'b',name:'ポンプ',model:'P1',lineNo:'2'});
    await page.app.processHistoryImportCSV();
    assert.equal(page.saves,0); assert.equal(page.activeData.history.length,0); assert.equal(page.review.entries[0].record.machineId,'');
    assert.equal(await page.app.commitHistoryImportPlan(page.review),false);
    page.app.setHistoryImportTarget(page.review.entries[0],'b');
    assert.equal(await page.app.commitHistoryImportPlan(page.review),true);
    assert.equal(page.activeData.history[0].machineId,'b'); assert.equal(page.activeData.history[0].lineNo,'2');
});

test('CSV with a new line creates a separate machine and never assigns another existing line', async () => {
    const page = makePage(true, '日付,機械名,型式,区分,作業内容,ライン\n2026-11-14,ポンプ,P1,突発,確認,2');
    page.activeData.machines.push({id:'a',name:'ポンプ',model:'P1',lineNo:'1'});
    await page.app.processHistoryImportCSV();
    assert.equal(page.activeData.machines.length,2); assert.notEqual(page.activeData.history[0].machineId,'a');
    assert.equal(page.activeData.machines[0].lineNo,'1');
});

test('different workers remain visible as a duplicate candidate and can be added without replacing the original', async () => {
    const page = makePage(true, '日付,機械名,型式,区分,作業内容,作業時間,作業者\n2026-11-14,ポンプ,P1,突発,確認,12.5,鈴木');
    page.activeData.machines.push({id:'a',name:'ポンプ',model:'P1'});
    page.activeData.history.push({id:'existing',machineId:'a',date:'2026-11-14',errorContent:'確認',workTime:12.5,workers:['田中'],isSudden:true});
    const original=JSON.stringify(page.activeData.history[0]);
    await page.app.processHistoryImportCSV();
    const entry=page.review.entries[0]; assert.equal(entry.selected,false); assert.equal(entry.duplicates.length,1);
    assert.equal(page.app.getHistoryImportDetails(entry.record)['作業者'],'鈴木');
    entry.decision=true;assert.equal(await page.app.commitHistoryImportPlan(page.review),true);
    assert.equal(page.activeData.history.length,2);assert.equal(JSON.stringify(page.activeData.history[0]),original);
});

test('file duplicates exclude only the repeated row, do not compare a row with itself, and respect explicit selection', async () => {
    const page=makePage(true,csv+'\n2026-11-14,ポンプ,P1,突発,漏れ');
    await page.app.processHistoryImportCSV();
    const entries=page.review.entries;assert.equal(entries[0].duplicates.length,0);assert.equal(entries[1].duplicates.length,1);
    assert.equal(entries[0].selected,true);assert.equal(entries[1].selected,false);
    entries[0].decision=false;page.app.assessHistoryImportPlan(page.review);
    assert.equal(entries[1].selected,true);assert.equal(await page.app.commitHistoryImportPlan(page.review),true);
    assert.equal(page.activeData.history.length,1);assert.equal(page.activeData.machines.length,1);
});

test('invalid calendar dates block the whole import before confirmation and date variants normalize exactly', async () => {
    const page=makePage(true,'日付,機械名,型式,区分,作業内容\n2026-02-30,ポンプ,P1,突発,漏れ\n2026-02-28,ポンプ,P1,突発,確認');
    await page.app.processHistoryImportCSV();assert.equal(page.saves,0);assert.equal(page.confirmations.length,0);assert.equal(page.errors[0].row,2);
    for(const value of ['2024/2/29','２０２４／２／２９','2024年2月29日','2024.2.29']) assert.equal(page.app.normalizeHistoryImportDate(value),'2024-02-29');
    for(const value of ['2023-02-29','2026-13-01','2026-01-00','1/2','']) assert.equal(page.app.normalizeHistoryImportDate(value),'');
});

test('a changed dataset or department invalidates a pending import instead of silently merging stale choices', async () => {
    const page=makePage(true,csv+'\n2026-11-14,ポンプ,P1,突発,漏れ');await page.app.processHistoryImportCSV();
    page.store.data.currentDepartmentId='b';assert.equal(await page.app.commitHistoryImportPlan(page.review),false);
    page.store.data.currentDepartmentId='a';page.activeData.history.push({id:'external'});
    assert.equal(await page.app.commitHistoryImportPlan(page.review),false);assert.equal(page.saves,0);
});

test('part text retains explicit zero and keeps absent prices empty', () => {
    const {app}=makePage(true);
    assert.equal(app.parseHistoryPartsText('シール [A] x2 個 @0')[0].price,0);
    assert.equal(app.parseHistoryPartsText('シール [A] x2 個')[0].price,null);
});

test('worker separators and repeated names normalize consistently, including CSV furigana removal', async () => {
    const page=makePage(true,'日付,機械名,作業内容,作業者\n2026-11-14,ポンプ,確認,"田中、 鈴木，田中／佐藤;鈴木（スズキ）"');
    assert.deepEqual(Array.from(page.app.splitWorkerText(' 田中、鈴木，田中／佐藤;佐藤\n山田 太郎 ')),['田中','鈴木','佐藤','山田 太郎']);
    await page.app.processHistoryImportCSV();
    assert.equal(page.errors.length,0); assert.deepEqual(Array.from(page.activeData.history[0].workers),['田中','鈴木','佐藤']);
});

test('exact aliases keep work category independent of occurrence type in any column order', async () => {
    const page=makePage(true,'作業区分,作業内容(症状),対応種別（突発/定期）,機械名,作業日\n電気,確認,突発,ポンプ,2026-11-14');
    await page.app.processHistoryImportCSV();
    assert.equal(page.errors.length,0);assert.equal(page.activeData.history[0].isSudden,true);assert.equal(page.activeData.history[0].category,'electric');
    const mapped=page.app.detectHistoryImportColumns([['日付','機械名','作業内容','作業区分','原因の区分']]);
    assert.equal(mapped.indexMap.type,-1);assert.equal(mapped.indexMap.category,3);
});

test('ambiguous column aliases require a choice and duplicate column assignments are rejected', () => {
    const {app}=makePage(true),rows=[['日付','機械名','作業内容','区分','対応種別']];
    const mapped={rows,...app.detectHistoryImportColumns(rows)};
    assert.equal(mapped.indexMap.type,-2);assert.equal(app.getHistoryImportColumnErrors(mapped)[0].field,'対応種別');
    mapped.indexMap.type=4;mapped.confirmed.add('type');assert.equal(app.getHistoryImportColumnErrors(mapped).length,0);
    mapped.indexMap.category=4;assert.match(app.getHistoryImportColumnErrors(mapped)[0].reason,/同じ列/);
    mapped.indexMap.type=-1;assert.equal(app.getHistoryImportColumnErrors(mapped).length,0);
});

test('strict decoder supports UTF-8 BOM, Shift_JIS and explicit encodings without replacement characters', () => {
    const {app}=makePage(true);
    assert.equal(app.decodeHistoryImportCsv(new TextEncoder().encode('\ufeff日付,機械名')).text,'日付,機械名');
    const sjis=Uint8Array.from([0x93,0xfa,0x95,0x74,0x2c,0x8b,0x40,0x8a,0x42,0x96,0xbc]);
    assert.equal(app.decodeHistoryImportCsv(sjis).encoding,'shift_jis');assert.equal(app.decodeHistoryImportCsv(sjis,'shift_jis').text,'日付,機械名');
    assert.throws(()=>app.decodeHistoryImportCsv(sjis,'utf-8'));
    assert.throws(()=>app.decodeHistoryImportCsv(Uint8Array.from([0x81]),'auto'));
});

test('invalid dates, times and required cells are collected together and exported with row numbers', async () => {
    const page=makePage(true,'日付,機械名,作業内容,作業時間\n2026-02-30,,,bad\n2026-01-01,ポンプ,確認,-2');
    await page.app.processHistoryImportCSV();
    assert.equal(page.errors.length,5);assert.equal(page.saves,0);assert.equal(page.confirmations.length,0);
    assert.deepEqual(Array.from(page.errors,e=>e.field),['日付','作業時間','機械名','作業内容','作業時間']);
    let exported;page.app.downloadCSV=(name,text)=>exported={name,text};page.app.exportHistoryImportErrors([...page.errors,{row:4,field:'機械名',value:'=1+1',reason:'確認'}]);
    assert.equal(exported.name,'history_import_errors.csv');assert.match(exported.text,/"2","日付","2026-02-30"/);assert.match(exported.text,/"'=1\+1"/);
});

test('bulk target assignment affects only identical equipment inputs and preserves explicit exclusions', async () => {
    const page=makePage(true,csv+'\n2026-11-15,ポンプ,P1,突発,確認\n2026-11-15,ポンプ,P2,突発,確認');
    page.activeData.machines.push({id:'a',name:'ポンプ',model:'P1',lineNo:'1'},{id:'b',name:'ポンプ',model:'P1',lineNo:'2'});
    await page.app.processHistoryImportCSV();const entries=page.review.entries;entries[1].decision=false;
    page.app.setHistoryImportTarget(entries[0],'b');assert.equal(page.app.applyHistoryImportTargetToMatching(page.review,entries[0]),1);
    assert.equal(entries[1].record.machineId,'b');assert.equal(entries[1].decision,false);assert.notEqual(entries[2].record.machineId,'b');
});
