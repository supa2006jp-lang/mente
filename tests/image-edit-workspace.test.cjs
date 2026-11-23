'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function harness(){
    class MaintenanceApp{} let next=0; const status={dataset:{},textContent:''};
    const store={data:{currentDepartmentId:'a'},activeData:{},generateId:()=>String(++next),save:async()=>{}};
    const ctx=vm.createContext({MaintenanceApp,store,document:{getElementById:()=>status},console});
    vm.runInContext(fs.readFileSync(path.join(__dirname,'..','app-image-edit-workspace.js'),'utf8'),ctx);
    const app=new MaintenanceApp();app._shiftPhotoCompareContext={departmentId:'a',source:'photoManager',imageEditKey:'image:one'};
    return {app,store,status};
}
const snapshot=n=>({version:1,wraps:[{photoIndex:0,src:'data:image/png;base64,test',marks:[{mode:'circle',x:n}]}],globalMarks:[]});

test('toolbar categories cover creation and selected mark modes without moving navigation tools',()=>{
    const {app}=harness();
    for(const mode of ['text','boxedText','callout','number','table'])assert.equal(app.getImageEditToolbarCategoryForMode(mode),'text');
    for(const mode of ['image','video','mosaic','mosaicRange'])assert.equal(app.getImageEditToolbarCategoryForMode(mode),'image');
    for(const mode of ['circle','triangle','arrow','dimension','rect','xmark','freehand','polyline'])assert.equal(app.getImageEditToolbarCategoryForMode(mode),'draw');
    for(const mode of ['move','selectRange','erase','',null,undefined])assert.equal(app.getImageEditToolbarCategoryForMode(mode),'');
    const calls=[];app.setImageEditToolbarCategory=(...args)=>calls.push(args);
    app.followImageEditToolbarMode('move');assert.equal(calls.length,0);
    app.followImageEditToolbarMode('image');assert.equal(calls[0][0],'image');assert.equal(calls[0][1].follow,true);
});

test('saved image versions retain ten per image without merging other images or departments',()=>{
    const {app,store}=harness();const first=snapshot(0);app.addImageEditVersion(first,'start');first.wraps[0].marks[0].x=999;
    assert.equal(app.getImageEditVersions()[0].snapshot.wraps[0].marks[0].x,0);
    const other={departmentId:'a',imageEditKey:'image:two'};app.addImageEditVersion(snapshot(100),'saved',other);
    for(let i=1;i<=15;i++)app.addImageEditVersion(snapshot(i),'saved');
    assert.equal(app.getImageEditVersions().length,10);assert.equal(app.getImageEditVersions()[0].snapshot.wraps[0].marks[0].x,6);
    app.addImageEditVersion(snapshot(15),'saved');assert.equal(app.getImageEditVersions().length,10);
    assert.equal(app.getImageEditVersions(other).length,1);
    store.data.currentDepartmentId='b';const before=JSON.stringify(store.activeData);assert.equal(app.addImageEditVersion(snapshot(16),'saved'),null);assert.equal(JSON.stringify(store.activeData),before);
});

test('autosave status follows the actual promise and reports rejected writes without losing retry state',async()=>{
    const {app,status}=harness();let resolve,reject;
    let pending=new Promise(r=>resolve=r);let tracked=app.trackImageEditSave(pending);assert.equal(status.dataset.state,'saving');assert.equal(app._shiftPhotoCompareContext.imagePendingSaves.size,1);
    resolve();await tracked;assert.equal(status.dataset.state,'saved');
    pending=new Promise((r,j)=>reject=j);tracked=app.trackImageEditSave(pending);reject(Error('quota'));await assert.rejects(tracked,/quota/);
    assert.equal(status.dataset.state,'failed');assert.equal(app._shiftPhotoCompareContext.imagePendingSaves.size,0);
    pending=Promise.resolve();await app.trackImageEditSave(pending);assert.equal(status.dataset.state,'saved');
});

test('failed version save keeps previous retained versions and can retry the edited snapshot',async()=>{
    const {app,store}=harness();for(let i=0;i<10;i++)app.addImageEditVersion(snapshot(i),'saved');
    const before=JSON.stringify(store.activeData.imageEditVersions);app.captureImageEditSnapshot=()=>snapshot(10);
    store.save=async()=>{throw Error('disk unavailable');};
    await assert.rejects(app.persistImageEditor(app._shiftPhotoCompareContext),/disk unavailable/);
    assert.equal(JSON.stringify(store.activeData.imageEditVersions),before);assert.equal(app.captureImageEditSnapshot().wraps[0].marks[0].x,10);
    store.save=async()=>{};await app.persistImageEditor(app._shiftPhotoCompareContext);
    assert.equal(app.getImageEditVersions().length,10);assert.equal(app.getImageEditVersions().at(-1).snapshot.wraps[0].marks[0].x,10);
});
