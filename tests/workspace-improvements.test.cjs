'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function runtime() {
    class MaintenanceApp {}
    const data = { machines: [{ id: 'm1', name: '機械A', model: 'A', category: '包装', lineNo: '1' }, { id: 'm2', name: '機械B', model: 'B', lineNo: '2' }], history: [], tasks: [], localTodos: [], shiftNotebooks: {}, localTodoWorkers: [{id:'w1',name:'田中'}] };
    const store = { activeData: data, data: { currentDepartmentId: 'test' }, getMachines: () => data.machines,
        getTasks: id => data.tasks.filter(t => t.machineId === id && !t.deleted), isMaintenanceTaskArchived: () => false,
        isTaskArchived: () => false, isWorkerArchived: name => name === '旧担当', getHistory: () => data.history };
    const context = vm.createContext({ MaintenanceApp, MaintenanceStore: { toHalfWidthLower: value => String(value).toLowerCase() }, store, console });
    for (const file of ['app-history.js','app-calendar-support.js','app-equipment-workspace.js','app-analysis-dashboard.js','app-worktime.js','app-worktime-evidence.js']) vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'), context);
    const app = new MaintenanceApp(); app.getLocalDateString = () => '2026-11-15'; app.getKanbanTodoWorkerName = id => data.localTodoWorkers.find(w => w.id === id)?.name || '全員'; app.getShiftNotebookLabel = () => ({});
    return { app, data, store };
}
test('equipment workspace excludes guides from work totals and finds the next uncompleted cycle', () => {
    const { app, data } = runtime();
    data.tasks.push({ id:'t1',machineId:'m1',startDate:'2026-11-15',periodDays:7 });
    data.history.push({id:'h1',machineId:'m1',taskId:'t1',date:'2026-11-15',scheduledDate:'2026-11-15',workTime:30,replacedParts:[{name:'ベルト',model:'A',count:2}]}, {id:'guide',machineId:'m1',isManualGuide:true,guide:'手順',workTime:999}, {id:'other',machineId:'m2',workTime:300});
    const result = app.getEquipmentWorkspace('m1');
    assert.equal(result.minutes,30); assert.equal(result.history.length,1); assert.equal(result.guides.length,1); assert.equal(result.parts[0].count,2); assert.equal(result.upcoming[0].date,'2026-11-22');
});
test('today filters match explicit assignees, everyone requests, line and unset values', () => {
    const { app } = runtime();
    Object.assign(app.getTodayWorkspaceFilters(), {line:'1',worker:'田中'});
    assert.equal(app.matchesTodayWorkspaceFilter({machineId:'m1',workers:['田中']}), true);
    assert.equal(app.matchesTodayWorkspaceFilter({machineId:'m1',assignedTo:['all']}), true);
    assert.equal(app.matchesTodayWorkspaceFilter({machineId:'m2',assignedTo:['w1']}), false);
    assert.equal(app.matchesTodayWorkspaceFilter({machineId:'m1'}), false);
    Object.assign(app.getTodayWorkspaceFilters(), {line:'__unset__',worker:'__unset__'});
    assert.equal(app.matchesTodayWorkspaceFilter({}), true);
});
test('evidence totals reconcile multiple workers, archived workers, empty time and filtered groups', () => {
    const { app, data } = runtime();
    const h = [{id:'a',machineId:'m1',workers:['田中','鈴木'],workTime:30}, {id:'b',machineId:'m1',workers:[],workTime:10}, {id:'c',machineId:'m1',workers:['田中'],workTime:''}, {id:'d',machineId:'m1',workers:['旧担当'],workTime:5}];
    let result = app.getWorkTimeEvidence(h,[{name:'田中'},{name:'鈴木'},{name:'旧作業者合計',isArchived:true}],'worker',data.machines);
    assert.equal(result.total,65); assert.equal(result.excludedWorkers.length,1); assert.equal(result.unknownTimes.length,1); assert.equal(result.contributions.get(h[0]),60);
    result = app.getWorkTimeEvidence(h,[{name:'田中'}],'worker',data.machines);
    assert.equal(result.total,30); assert.equal(result.rows.length,2);
    result = app.getWorkTimeEvidence(h,[{name:'包装'}],'category',data.machines);
    assert.equal(result.total,45); assert.equal(result.rows.length,4);
});
test('50,000 records with 500 machines retain correct totals within the performance budget', () => {
    const { app, data } = runtime();
    data.machines = Array.from({length:500},(_,i)=>({id:'m'+i,name:'機械'+i,model:'型式'+i,lineNo:String(i%10),category:'包装'}));
    data.history = Array.from({length:50000},(_,i)=>({id:'h'+i,machineId:'m'+(i%500),date:'2026-11-15',workers:['田中','鈴木'],workTime:30,replacedParts:[{name:'部品',count:1}]}));
    const start = performance.now();
    const card = app.getEquipmentWorkspace('m1');
    const evidence = app.getWorkTimeEvidence(data.history,[{name:'田中'},{name:'鈴木'}],'worker',data.machines);
    assert.equal(card.history.length,100); assert.equal(card.minutes,3000); assert.equal(evidence.total,3000000);
    assert.ok(performance.now()-start < 5000, '50k data derivation exceeds 5 seconds');
});

test('duplicate workers, invalid times and guide-only entries cannot inflate or subtract from totals', () => {
    const { app, data } = runtime();
    const records = [
        { id:'duplicate', machineId:'m1', workTime:30, workers:['田中', ' 田中 ', '鈴木'] },
        ...[-10, '30minutes', '', 'Infinity', null].map((workTime,i)=>({id:'bad'+i,machineId:'m1',workTime,workers:['田中']})),
        { id:'zero',machineId:'m1',workTime:0,workers:['田中'] },
        { id:'guide',machineId:'m1',isManualGuide:true,workTime:999,workers:['田中'] },
        { id:'actual-with-guide',machineId:'m1',guide:'手順',workTime:15,workers:['鈴木'] }
    ];
    const original = JSON.stringify(records);
    const evidence = app.getWorkTimeEvidence(records,[{name:'田中'},{name:'鈴木'}],'worker',data.machines);
    assert.equal(evidence.total,75); assert.equal(evidence.count,9);
    assert.equal(evidence.duplicateWorkers.length,1); assert.equal(evidence.unknownTimes.length,5); assert.equal(evidence.guideOnly.length,1);
    assert.equal(app.getWorkTimeMinutes(records),45);
    assert.equal(records.reduce((n,h)=>n+app.getWorkTimeContribution(h,'worker','田中'),0),30);
    assert.equal(records.reduce((n,h)=>n+app.getWorkTimeContribution(h,'category'),0),45);
    data.history=records; assert.equal(app.getEquipmentWorkspace('m1').minutes,45);
    assert.equal(JSON.stringify(records), original, 'derivation must not edit legacy records');
});

test('equipment overdue dates use scheduled completion dates, legacy one-off completion and schedule history', () => {
    const { app, data } = runtime();
    data.tasks = [
        {id:'cycle',machineId:'m1',startDate:'2026-11-01',periodDays:7},
        {id:'single',machineId:'m1',startDate:'2026-11-02',periodDays:0},
        {id:'changed',machineId:'m1',startDate:'2026-11-13',periodDays:7,scheduleEffectiveDate:'2026-11-10',scheduleHistory:[{startDate:'2026-11-03',fromDate:'2026-11-03',untilDate:'2026-11-10',periodDays:7}]}
    ];
    data.history = [
        {machineId:'m1',taskId:'cycle',date:'2026-11-09',scheduledDate:'2026-11-08',workTime:10},
        {machineId:'m1',taskId:'single',date:'2026-11-04',workTime:10}
    ];
    const chart=app.getEquipmentWorkspace('m1');
    assert.deepEqual(Array.from(chart.overdue,x=>x.task.id+':'+x.date),['cycle:2026-11-01','changed:2026-11-03','changed:2026-11-13']);
    assert.deepEqual(Array.from(chart.upcoming,x=>x.date),['2026-11-15','2026-11-20']);
});

test('today filters recover from an older preset with null state', () => {
    const { app, store } = runtime();
    app._todayWorkspaceDepartment=store.data.currentDepartmentId; app.todayWorkspaceFilters=null;
    assert.equal(app.getTodayWorkspaceFilters().line,'all');
    assert.equal(app.matchesTodayWorkspaceFilter({machineId:'m1'}),true);
});
