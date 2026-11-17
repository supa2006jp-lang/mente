import test from 'node:test';
import assert from 'node:assert/strict';
import {addOffsetPreset,loadOffsetPresets,normalizeOffsetPresets,saveOffsetPresets,offsetPresetKey} from '../src/offset-extrusion-presets.js';
test('OS preset storage validates values, deduplicates and retains only numeric distances',()=>{
 let text=null;const storage=()=>({getItem:()=>text,setItem:(key,value)=>{assert.equal(key,offsetPresetKey);text=value;}});
 let state=loadOffsetPresets(storage);assert.deepEqual(state.values,[]);
 for(const value of [-.2,-.4,1,-.2,0,-0])state=addOffsetPreset(state,value);assert.deepEqual(state.values,[-.2,-.4,1,0]);
 saveOffsetPresets({...state,bodyId:'private-model'},storage);assert(!text.includes('private-model'));assert.deepEqual(loadOffsetPresets(storage),state);
 state={...state,values:state.values.filter(value=>value!==-.4)};saveOffsetPresets(state,storage);assert.deepEqual(loadOffsetPresets(storage).values,[-.2,1,0]);
 for(const value of [NaN,Infinity,'-2',10001])assert.throws(()=>addOffsetPreset(state,value));
 assert.throws(()=>normalizeOffsetPresets({version:1,values:Array.from({length:13},(_,i)=>i)}));
 text='{bad';assert.deepEqual(loadOffsetPresets(storage).values,[]);assert.deepEqual(loadOffsetPresets(()=>{throw Error('blocked');}).values,[]);
 assert.throws(()=>saveOffsetPresets(state,()=>({setItem(){throw Error('full');}})),/保存/);
});
