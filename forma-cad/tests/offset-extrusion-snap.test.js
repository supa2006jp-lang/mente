import test from 'node:test';
import assert from 'node:assert/strict';
import {loadOffsetDragStep,saveOffsetDragStep,snapOffsetDrag,validateOffsetDragStep,offsetDragSnapKey} from '../src/offset-extrusion-snap.js';
import {offsetDragValue} from '../src/offset-extrusion-guides.js';
test('OS drag snaps symmetrically to absolute custom intervals and fine intervals',()=>{
 for(const [value,expected] of [[.14,.1],[.16,.2],[-.14,-.1],[-.16,-.2],[.05,.1],[-.05,-.1],[.3,.3],[-.03,0]])assert.equal(snapOffsetDrag(value),expected);
 assert.equal(snapOffsetDrag(-.237,.1),-.2);assert.equal(snapOffsetDrag(-.237,.1,true),-.24);
 assert.equal(snapOffsetDrag(.38,.25),.5);assert.equal(snapOffsetDrag(-.38,.25),-.5);assert.equal(snapOffsetDrag(.038,.25,true),.05);
 assert.equal(snapOffsetDrag(.00016,.001,true),.0002);assert.equal(Object.is(snapOffsetDrag(-.001),-0),false);
 assert.equal(snapOffsetDrag(10000,.3),9999.9);assert.equal(snapOffsetDrag(11000,.7),10000);assert.equal(snapOffsetDrag(-11000,.7),-10000);
 let raw=0;const shown=[];for(let i=0;i<30;i++){raw=offsetDragValue(raw,.01);shown.push(snapOffsetDrag(raw,.1));}assert.equal(shown.at(-1),.3,'small moves accumulate before quantizing');assert.deepEqual([...new Set(shown)],[0,.1,.2,.3]);
 for(const bad of [0,-1,.0001,1001,Infinity,NaN,'0.1'])assert.throws(()=>validateOffsetDragStep(bad));
});
test('custom OS drag step persists without model references and falls back when storage is invalid',()=>{
 let text=null;const storage=()=>({getItem:()=>text,setItem:(key,value)=>{assert.equal(key,offsetDragSnapKey);text=value;}});
 assert.equal(loadOffsetDragStep(storage),.1);saveOffsetDragStep(.25,storage);assert.equal(loadOffsetDragStep(storage),.25);assert.deepEqual(JSON.parse(text),{version:1,step:.25});
 for(const bad of ['{bad',JSON.stringify({version:1,step:0}),JSON.stringify({version:2,step:.5})]){text=bad;assert.equal(loadOffsetDragStep(storage),.1);}
 assert.equal(loadOffsetDragStep(()=>{throw Error('blocked');}),.1);assert.throws(()=>saveOffsetDragStep(.2,()=>({setItem(){throw Error('full');}})),/保存/);
});
