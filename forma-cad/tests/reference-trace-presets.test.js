import test from 'node:test';import assert from 'node:assert/strict';
import {traceDefaultSettings,tracePresetSettings,decodeTracePresets,createTracePresetStore} from '../src/reference-trace-presets.js';
test('photo defaults match the supplied extraction settings and offset-only output',()=>{
 const s=traceDefaultSettings();assert.equal(s.mode,'edge');assert.equal(s.threshold,12);assert.equal(s.smoothing,2);assert.equal(Number(s.detail),.31);assert.equal(Number(s.tolerance),.51);assert.equal(s.regularize,true);assert.equal(s.shape,'auto');assert.equal(s.offset,true);assert.equal(s.offsetDistance,'1');assert.equal(s.offsetKeep,false);assert.equal(s.holes,false);assert.equal(s.compare,true);
 const copy=tracePresetSettings({...s,seed:[.2,.5],contourEdits:{something:{offsetDistance:'3'}}});assert.equal(copy.seed,undefined);assert.equal(copy.contourEdits,undefined);assert.equal(copy.crop,undefined);
});
test('named presets and chosen defaults persist without sharing mutable data',()=>{
 const memory=new Map(),storage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)},store=createTracePresetStore(storage),s=tracePresetSettings(traceDefaultSettings()),value={format:'forma-trace-presets',version:1,presets:[{id:'one',name:'ボタン',settings:s}],defaultSettings:{...s,offsetDistance:'.3'}};store.write(value);value.presets[0].settings.detail='9';assert.equal(store.read().presets[0].settings.detail,'.31');assert.equal(createTracePresetStore(storage).read().defaultSettings.offsetDistance,'.3');
});
test('invalid preset files and storage failures reject before replacing saved values',()=>{
 const valid={format:'forma-trace-presets',version:1,presets:[{id:'one',name:'ボタン',settings:tracePresetSettings(traceDefaultSettings())}]};
 for(const transform of [v=>v.version=9,v=>v.presets.push(v.presets[0]),v=>v.presets[0].settings.detail='-1',v=>v.presets[0].settings.offsetDistance='0',v=>v.presets[0].settings.regularize='true',v=>v.presets[0].settings.threshold=NaN]){const value=structuredClone(valid);transform(value);assert.throws(()=>decodeTracePresets(value));}
 assert.throws(()=>decodeTracePresets('x'.repeat(65537)),/64 KB/);let calls=0;const store=createTracePresetStore({getItem:()=>null,setItem:()=>{calls++;throw Error('quota');}});assert.throws(()=>store.write(valid),/quota/);assert.equal(calls,1);
});
