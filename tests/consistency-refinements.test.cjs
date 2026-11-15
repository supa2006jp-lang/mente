'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function runtime(values = new Map()) {
    class MaintenanceApp {}
    const store = { data:{currentDepartmentId:'a'} };
    const prompts = [], messages=[];
    const context=vm.createContext({MaintenanceApp,store,console,Date,
        localStorage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)},
        prompt:()=>prompts.shift()
    });
    for(const file of ['app-history.js','app-worktime.js']) vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context);
    const app=new MaintenanceApp(); app.currentView='history';app.getLocalDateString=()=> '2026-11-15';app.updateHistoryPeriodOptions=()=>{};app.showToast=m=>messages.push(m);
    return {app,store,values,prompts,messages};
}

test('legacy date migration is isolated by view, survives reload, and cannot leak between departments',()=>{
    const {app,store,values}=runtime(new Map([['customStartDate','2026-01-01'],['customRangeStart','2026-01-01'],['customRangeEnd','2026-01-31']]));
    app.setPeriodDateState({since:'2026-02-01',start:'2026-02-01',end:'2026-02-28'},'history');
    assert.equal(app.getPeriodDateState('worktime').since,'2026-01-01');
    assert.equal(runtime(values).app.getPeriodDateState('history').since,'2026-02-01');
    store.data.currentDepartmentId='b';assert.equal(app.getPeriodDateState('history').since,'2026-01-01');
    app.setPeriodDateState({since:'2026-03-01'},'history');store.data.currentDepartmentId='a';assert.equal(app.getPeriodDateState('history').since,'2026-02-01');
});

test('cancelled and reversed date prompts leave both endpoints intact',()=>{
    const {app,prompts,messages}=runtime();
    app.setPeriodDateState({start:'2026-01-01',end:'2026-01-31'});
    prompts.push('2026-02-01',null);app.onPeriodChange({value:'custom_range'},()=>{});
    assert.equal(app.getPeriodDateState().start,'2026-01-01');
    prompts.push('2026-03-31','2026-03-01');app.onPeriodChange({value:'custom_range'},()=>{});
    assert.equal(app.getPeriodDateState().end,'2026-01-31');assert.match(messages[0],/終了日/);
});

test('background filtering uses the owning view date range',()=>{
    const {app}=runtime();app.setPeriodDateState({start:'2026-01-01',end:'2026-01-31'},'history');app.setPeriodDateState({start:'2026-02-01',end:'2026-02-28'},'dashboard');
    const records=[{id:1,date:'2026-01-15'},{id:2,date:'2026-02-15'}];
    assert.deepEqual(Array.from(app.filterHistoryByPeriod(records,'custom_range','dashboard'),r=>r.id),[2]);
    assert.match(app.getPeriodLabel('custom_range','history'),/2026-01-01/);
});

test('period option refresh cannot replace the newly selected period with an older saved value',()=>{
    const {app,prompts}=runtime(); const control={id:'worktime-filter-period',value:'custom_range'};
    prompts.push('2026-02-01','2026-02-28');app.updateHistoryPeriodOptions=()=>{control.value='all';};
    let renderedPeriod;app.onPeriodChange(control,()=>{renderedPeriod=control.value;});
    assert.equal(renderedPeriod,'custom_range');assert.equal(app.getPeriodDateState('worktime').start,'2026-02-01');
});

test('shared elapsed-time rule handles zero, decimals, malformed values and guide-only entries',()=>{
    const {app}=runtime();
    for(const workTime of [-5,'30min','',null,Infinity]) assert.equal(app.getRecordWorkMinutes({workTime}),0);
    assert.equal(app.getRecordWorkMinutes({workTime:0}),0);assert.equal(app.getWorkTimeRecordFacts({workTime:0}).unknownTime,false);
    assert.equal(app.getRecordWorkMinutes({workTime:12.5}),12.5);
    assert.equal(app.getRecordWorkMinutes({workTime:100,isManualGuide:true}),0);
});
