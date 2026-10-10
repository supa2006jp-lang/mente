import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createProjectFileTarget} from '../src/project-file-target.js';
function fake(name='box.forma.json'){
 const state={text:'original',opens:0,closes:0,aborts:0,permissions:[]};
 const handle={name,async requestPermission(options){state.permissions.push(options);return state.denied?'denied':'granted';},async createWritable(){state.opens++;let text;return {async write(data){text=data;if(state.wait)await state.wait;if(state.fail)throw Error('disk full');},async close(){state.closes++;if(state.closeFail)throw Error('close failed');state.text=text;},async abort(){state.aborts++;}};}};
 return {state,handle};
}
test('picker runs before data capture; subsequent writes reuse the same file',async()=>{
 const file=fake(),events=[],target=createProjectFileTarget({host:{async showSaveFilePicker(options){events.push('pick');assert.equal(options.suggestedName,'suggested.forma.json');return file.handle;}}});
 const save=()=>target.save(()=>{events.push('capture');return {text:'model',extra:1};},{suggestedName:'suggested.forma.json'});
 assert.equal((await save()).name,'box.forma.json');await save();assert.deepEqual(events,['pick','capture','capture']);assert.equal(file.state.text,'model');assert.equal(file.state.closes,2);assert.deepEqual(file.state.permissions,[{mode:'readwrite'}]);assert.equal(target.busy,false);
});
test('cancel, permission denial and failed writes preserve the target and original file',async()=>{
 let cancel=true;const file=fake(),target=createProjectFileTarget({host:{async showSaveFilePicker(){if(cancel)throw new DOMException('cancel','AbortError');return file.handle;}}});
 assert.equal(await target.save(()=>{throw Error('must not capture');}),null);cancel=false;file.state.fail=true;
 await assert.rejects(target.save(()=>({text:'new'})),/disk full/);assert.equal(file.state.text,'original');assert.equal(file.state.aborts,1);
 file.state.fail=false;await target.save(()=>({text:'new'}));file.state.denied=true;
 await assert.rejects(target.save(()=>({text:'denied'})),/許可/);assert.equal(file.state.text,'new');
 file.state.denied=false;file.state.closeFail=true;await assert.rejects(target.save(()=>({text:'failed close'})),/close failed/);assert.equal(file.state.aborts,2);assert.equal(file.state.text,'new');
 file.state.closeFail=false;await target.save(()=>({text:'retry'}));assert.equal(file.state.text,'retry');
});
test('changing documents aborts an in-progress write and clears old destination',async()=>{
 const old=fake('old.json'),next=fake('next.json'),target=createProjectFileTarget({host:{async showSaveFilePicker(){return next.handle;}}});target.attach(old.handle);
 let release;old.state.wait=new Promise(resolve=>release=resolve);const pending=target.save(()=>({text:'stale'}));await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(target.busy,true);assert.equal(await target.save(()=>{throw Error('busy');}),null);target.attach();release();assert.equal(await pending,null);assert.equal(old.state.aborts,1);assert.equal(old.state.text,'original');
 assert.equal((await target.save(()=>({text:'fresh'}))).name,'next.json');
});
test('unsupported picker is explicit; attached handles can still be saved',async()=>{
 const target=createProjectFileTarget({host:{}});await assert.rejects(target.save(()=>({text:'x'})),/名前を付けて保存/);
 const file=fake();target.attach(file.handle);await target.save(()=>({text:'x'}));assert.equal(file.state.text,'x');
});
