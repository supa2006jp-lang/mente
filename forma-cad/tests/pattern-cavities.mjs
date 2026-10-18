import fs from 'node:fs/promises';import assert from 'node:assert/strict';import * as R from 'replicad';import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';import {patternCavities} from '../src/pattern-cavities.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`);
for(const blind of [false,true]){const box=R.makeBox([0,0,0],[20,20,10]),tool=R.makeCylinder(3,blind?6:12,[10,10,blind?5:-1]),body=box.cut(tool),before=body.serialize(),holes=patternCavities(body);assert.equal(holes.length,1);near(R.measureVolume(holes[0]),Math.PI*9*(blind?5:10));assert.equal(body.serialize(),before);holes.forEach(h=>h.delete());body.delete();box.delete();tool.delete();}
const plain=R.makeBox([0,0,0],[10,10,10]);assert.deepEqual(patternCavities(plain),[]);plain.delete();
const outer=R.makeBox([0,0,0],[20,20,10]),inner=R.makeCylinder(3,6,[10,10,2]),closed=outer.cut(inner),sealed=patternCavities(closed);assert.equal(sealed.length,1);near(R.measureVolume(sealed[0]),Math.PI*9*6);sealed.forEach(h=>h.delete());closed.delete();inner.delete();outer.delete();
// Closed blind rectangular grooves and stepped/multiple holes retain their depth.
const cases=[
 [()=>R.makeBox([3,7,6],[17,13,12]),14*6*4,1],
 [()=>{const a=R.makeCylinder(2,12,[10,10,-1]),b=R.makeCylinder(4,5,[10,10,7]);try{return a.fuse(b);}finally{a.delete();b.delete();}},Math.PI*(4*7+16*3),2],
 [()=>{const a=R.makeCylinder(2,12,[5,10,-1]),b=R.makeCylinder(2,12,[15,10,-1]);try{return R.makeCompound([a,b]);}finally{a.delete();b.delete();}},Math.PI*8*10,2]
];
for(const [makeTool,expected,count]of cases){const box=R.makeBox([0,0,0],[20,20,10]),tool=makeTool(),body=box.cut(tool),holes=patternCavities(body);assert.equal(holes.length,count);near(holes.reduce((sum,h)=>sum+R.measureVolume(h),0),expected);holes.forEach(h=>h.delete());body.delete();tool.delete();box.delete();}
console.log('PASS native through-hole and blind-hole voids, unchanged source and no invented holes in a solid box');

const rb=R.makeBox([0,0,0],[20,20,10]),rt=R.makeCylinder(3,12,[10,10,-1]),rh=rb.cut(rt),rounded=rh.fillet(.5,f=>f.ofCurveType('CIRCLE').inPlane('XY',10)),roundHoles=patternCavities(rounded);assert.equal(roundHoles.length,1);assert.ok(R.measureVolume(roundHoles[0])>90*Math.PI);for(const h of roundHoles){const common=h.intersect(rounded);near(R.measureVolume(common),0);common.delete();h.delete();}[rounded,rh,rt,rb].forEach(s=>s.delete());console.log('PASS enclosed blind grooves, stepped/multiple/closed holes and rounded opening');
