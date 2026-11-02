import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createSketchSectionState,sketchSectionPreference,withSketchSectionPreference} from '../src/sketch-section-state.js';
import {defaults,validateProject,validateFeature} from '../src/geometry.js';

test('section sketch persistence follows its actual plane, including rotated and translated planes',()=>{
 for(const plane of ['XY','XZ','YZ','CUSTOM']){
  const rotation=new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(.3,.6,-.2)),frame=plane==='CUSTOM'?Object.fromEntries(['u','v','n'].map((k,i)=>[k,new THREE.Vector3().setComponent(i,1).transformDirection(rotation).toArray()])):undefined;
  const f={...defaults,id:'section',name:'断面',kind:'sketch',plane,frame,x:25,y:-12,z:31,sketchSection:true};
  const restored=validateProject(JSON.parse(JSON.stringify({format:'forma-cad',version:1,features:[f]})))[0],state=createSketchSectionState(),face=state.plane(restored,'one');
  assert.equal(restored.sketchSection,true);assert.equal(face.workingGrid,true);
  assert.ok(Math.abs(face.offset-new THREE.Vector3(f.x,f.y,f.z).dot(new THREE.Vector3(...face.frame.n)))<1e-10);
  assert.deepEqual(face.anchor,[f.x,f.y,f.z]);
  assert.equal(state.plane({...restored,x:f.x+face.frame.u[0],y:f.y+face.frame.u[1],z:f.z+face.frame.u[2]},'one'),face,'in-plane drawing does not restart a dismissed section');
  assert.equal(state.plane({...restored,x:f.x+face.frame.n[0]*1e-8,y:f.y+face.frame.n[1]*1e-8,z:f.z+face.frame.n[2]*1e-8},'one'),face,'coordinate rounding does not restart a dismissed section');
  assert.notEqual(state.plane({...restored,x:f.x+face.frame.n[0],y:f.y+face.frame.n[1],z:f.z+face.frame.n[2]},'one'),face);
 }
});
test('ordinary sketches stay unclipped and ending or switching a session resets the opt-out identity',()=>{
 const state=createSketchSectionState(),f={...defaults,sketchSection:true},face=state.plane(f,1);
 assert.equal(state.plane({...f},1),face);assert.notEqual(state.plane(f,2),face);
 assert.equal(state.plane(defaults,2),null);assert.notEqual(state.plane(f,1),face);
});
test('section metadata rejects malformed project data',()=>{
 for(const value of ['true',{},1,null])assert.throws(()=>validateFeature({...defaults,id:'s',name:'s',kind:'sketch',sketchSection:value}),/断面表示設定/);
});
test('explicit OFF overrides group inheritance and both settings survive file validation',()=>{
 const a={...defaults,id:'a',kind:'sketch',name:'A',groupId:'g',groupNumber:1,sketchSection:true},b={...a,id:'b',sketchSection:undefined},solid={...defaults,id:'body',name:'箱',kind:'extrusion'},other={...a,id:'other',groupId:'other'};
 assert.equal(sketchSectionPreference(b,[a,b]),true);assert.equal(sketchSectionPreference({...b,sketchSection:false},[a,b]),false);
 const before=[a,b,solid,other],off=withSketchSectionPreference(before,{groupId:'g'},false);
 assert.equal(off[0].sketchSection,false);assert.equal(off[1].sketchSection,false);assert.equal(off[2],solid);assert.equal(off[3],other);assert.equal(a.sketchSection,true);
 const restored=validateProject(JSON.parse(JSON.stringify({format:'forma-cad',version:1,features:off})));assert.equal(sketchSectionPreference(restored[1],restored),false);
 assert.equal(withSketchSectionPreference(off,{groupId:'g'},true)[1].sketchSection,true);
});
test('old sketches can opt in without changing their geometry and pending sketches do not affect other groups',()=>{
 const old={...defaults,id:'old',name:'古いスケッチ',kind:'sketch'},original=structuredClone(old),next=withSketchSectionPreference([old],{id:'old'},true);
 assert.equal(sketchSectionPreference(old),undefined);const {sketchSection,...shape}=next[0];assert.equal(sketchSection,true);assert.deepEqual(shape,original);assert.deepEqual(old,original);
 assert.equal(withSketchSectionPreference([old],{groupNumber:3},false)[0],old);assert.throws(()=>withSketchSectionPreference([old],{id:'old'},'true'));
});
