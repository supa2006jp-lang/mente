'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function runtime(values = new Map()) {
    class MaintenanceApp {}
    const store = { data: { currentDepartmentId: 'a' }, getPartMaster: () => null };
    const messages = [], prompts = [];
    const storage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
    const document = { getElementById: id => id.startsWith('view-') ? {} : null };
    const context = vm.createContext({ MaintenanceApp, store, document, console, Date, localStorage: storage, prompt: () => prompts.shift() });
    for (const file of ['app-history.js','app-worktime.js','app-misc-analysis.js','app-search-presets.js','app-equipment-workspace.js']) {
        vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context);
    }
    const app = new MaintenanceApp(); app.currentView = 'history'; app.laborRate = 3600;
    app.getLocalDateString = () => '2026-11-15'; app.showToast = message => messages.push(message);
    app.updateHistoryPeriodOptions = () => {}; app.refreshNamedSearchOptions = () => {};
    return { app, store, values, messages, prompts, storage };
}

test('labor costs deduplicate trimmed workers, preserve decimal minutes, and retain one-person fallback', () => {
    const { app } = runtime();
    const record = { workTime: 12.5, workers: ['田中',' 田中 ','鈴木','',null], replacedParts: [{price: 100, count: 2}] };
    const snapshot = JSON.stringify(record), result = app.calculateHistoryCost(record);
    assert.equal(result.workerCount, 2); assert.equal(result.laborMinutes, 25);
    assert.equal(result.labor, 1500); assert.equal(result.total, 1700);
    assert.equal(app.calculateHistoryCost({ workTime: 30, workers: [] }).labor, 1800);
    assert.equal(app.calculateHistoryCost({ workTime: 30, workers: '田中, 田中,鈴木' }).labor, 3600);
    for (const h of [{workTime:-5},{workTime:'30min'},{workTime:100,isManualGuide:true}]) assert.equal(app.calculateHistoryCost(h).labor, 0);
    assert.equal(JSON.stringify(record), snapshot);
});

test('part costs distinguish free from missing, use the master only for missing prices, and preserve source records', () => {
    const {app,store}=runtime();store.getPartMaster=()=>({price:200,priceRaw:'200'});
    const record={replacedParts:[{name:'シール',price:0,count:2},{name:'シール',price:null,count:1},{name:'シール',price:100,count:1}]};
    const snapshot=JSON.stringify(record);
    assert.equal(app.calculateHistoryPartCost(record),300);assert.equal(app.getHistoryMissingPartPrices(record).length,0);
    assert.equal(app.getHistoryPartPrice({price:'0'}).source,'record');assert.equal(app.getHistoryPartPrice({price:''}).source,'master');
    store.getPartMaster=()=>({price:0,priceRaw:''});assert.equal(app.getHistoryPartPrice({price:null}).price,null);
    assert.equal(app.getHistoryMissingPartPrices({replacedParts:[{name:'シール',price:0,count:1}]}).length,0);
    store.getPartMaster=()=>({price:0,priceRaw:'0'});assert.equal(app.getHistoryPartPrice({price:null}).price,0);
    assert.equal(JSON.stringify(record),snapshot);
});

test('comparison date prompts and persisted ranges stay independent of each other and the current view', () => {
    const { app, values, prompts, store } = runtime();
    app.setPeriodDateState({ start:'2026-09-01',end:'2026-09-30' }, 'history');
    for (const [side,start,end] of [['a','2026-01-01','2026-01-31'],['b','2026-02-01','2026-02-28']]) {
        prompts.push(start,end);
        app.onPeriodChange({value:'custom_range',dataset:{periodView:'compare-'+side}},()=>{});
    }
    assert.equal(app.getTroubleComparisonRange('custom_range','compare-a').days, 31);
    assert.equal(app.getTroubleComparisonRange('custom_range','compare-b').days, 28);
    assert.equal(app.getPeriodDateState('history').start, '2026-09-01');
    assert.equal(runtime(values).app.getPeriodDateState('compare-a').start, '2026-01-01');
    prompts.push('2026-03-01',null);
    app.onPeriodChange({value:'custom_range',dataset:{periodView:'compare-a'}},()=>{});
    assert.equal(app.getPeriodDateState('compare-a').start, '2026-01-01');
    store.data.currentDepartmentId = 'b'; assert.equal(app.getPeriodDateState('compare-a').start, '');
});

test('comparison calendar windows contain exactly thirty days, leap days and inclusive endpoints', () => {
    const { app } = runtime(); app.getLocalDateString = () => '2024-03-01';
    const recent = app.getTroubleComparisonRange('last_30_days','compare-a');
    const previous = app.getTroubleComparisonRange('prev_30_days','compare-b');
    assert.equal(recent.start, '2024-02-01'); assert.equal(recent.end, '2024-03-01'); assert.equal(recent.days, 30);
    assert.equal(previous.start, '2024-01-02'); assert.equal(previous.end, '2024-01-31'); assert.equal(previous.days, 30);
    assert.equal(app.getTroubleComparisonRange('last_month','compare-a').days, 29);
    assert.equal(app.getTroubleComparisonRange('this_month','compare-a').days, 1);
    app.setPeriodDateState({since:'2024-03-02'},'compare-a'); assert.equal(app.getTroubleComparisonRange('custom','compare-a'), null);
});

test('zero baseline uses new-occurrence totals and nonzero comparisons retain signed daily percentages', () => {
    const { app } = runtime();
    const fresh = app.getTroubleComparisonChange(0, 0.5, 14, '件');
    assert.equal(fresh.percent, null); assert.match(fresh.label, /新規発生・＋14件（合計）/); assert.doesNotMatch(fresh.label, /%/);
    assert.equal(app.getTroubleComparisonChange(0,0,0,'件').label, '変化なし（0.0%）');
    assert.equal(app.getTroubleComparisonChange(2,0,0,'件').percent, -100);
    assert.equal(app.getTroubleComparisonChange(1,2,28,'件').percent, 100);
});

test('saved conditions update, rename without changing criteria, and undo deletion without losing subsequent additions', () => {
    const { app } = runtime(); let query = '初期';
    app.captureNamedSearch = name => ({name,view:'history',query,dates:{start:'2026-01-01',end:'2026-01-31'}});
    app.saveNamedSearch('毎月'); query = '更新後'; assert.equal(app.updateNamedSearch('毎月'), true);
    assert.equal(app.getNamedSearches()[0].query, query);
    assert.equal(app.renameNamedSearch('毎月','毎月の確認'), true);
    assert.equal(app.getNamedSearches()[0].dates.end, '2026-01-31');
    app.deleteNamedSearch('毎月の確認'); app.saveNamedSearch('追加'); app.undoDeleteNamedSearch();
    assert.deepEqual(Array.from(app.getNamedSearches(), p => p.name), ['毎月の確認','追加']);
    assert.equal(app.undoDeleteNamedSearch(), false);
    assert.equal(app.renameNamedSearch('毎月の確認','追加'), false);
});

test('preset undo cannot cross departments or replace a colliding name; failed storage preserves data and undo', () => {
    const { app, store, storage, values } = runtime();
    app.captureNamedSearch = name => ({name,view:'history'});
    app.saveNamedSearch('条件'); app.deleteNamedSearch('条件');
    store.data.currentDepartmentId = 'b'; assert.equal(app.undoDeleteNamedSearch(), false);
    store.data.currentDepartmentId = 'a'; app.saveNamedSearch('条件'); assert.equal(app.undoDeleteNamedSearch(), false);
    app.renameNamedSearch('条件','別名');
    const before = values.get('maintenance-search-presets-v1:a'), set = storage.setItem;
    storage.setItem = () => { throw new Error('full'); };
    assert.equal(app.undoDeleteNamedSearch(), false); assert.equal(values.get('maintenance-search-presets-v1:a'), before);
    storage.setItem = set; assert.equal(app.undoDeleteNamedSearch(), true);
});

test('overdue grouping uses task IDs and oldest dates without dropping occurrences or mutating input', () => {
    const { app } = runtime();
    const rows = [{task:{id:'a',content:'点検'},date:'2026-11-12'},{task:{id:'b',content:'点検'},date:'2026-11-02'},{task:{id:'a',content:'点検'},date:'2026-11-01'}];
    const snapshot = JSON.stringify(rows), groups = app.groupEquipmentOverdue(rows);
    assert.equal(groups.length, 2); assert.equal(groups[0].task.id, 'a');
    assert.deepEqual(Array.from(groups[0].dates), ['2026-11-01','2026-11-12']);
    assert.equal(groups.reduce((sum,g)=>sum+g.dates.length,0), rows.length);
    assert.equal(JSON.stringify(rows), snapshot);
});
