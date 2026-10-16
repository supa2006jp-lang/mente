import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import {defaults} from '../src/geometry.js';
import {runOperation} from '../src/kernel.js';
import {PhaseTimings,withPhaseTimings} from '../src/phase-timings.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const obstacle=R.makeCylinder(3,6,[0,0,8]);
const history=[{kind:'cadop',id:'obstacle',name:'障害物',outputs:[{id:'obstacle',...obstacle.mesh(),brep:obstacle.serialize()}],remove:[]}];
const f={...defaults,id:'barrier',name:'バリア押し出し',kind:'extrusion',width:20,height:20,depth:25,barrier:true,barrierGap:.6};
const first=new PhaseTimings();withPhaseTimings(first,()=>runOperation(history,{type:'extrusionToolPreview',feature:f}));
const a=first.report();for(const key of ['geometry','inspection','display'])assert.ok(a.phases[key]>0,key+' must be measured');
const final=new PhaseTimings(),result=withPhaseTimings(final,()=>runOperation(history,{type:'preview',operation:{type:'extrusion',feature:f}}));
const b=final.report();assert.ok(b.phases.save>0);assert.ok(b.phases.display>0);
for(const report of [a,b])assert.ok(Math.abs(Object.values(report.phases).reduce((x,y)=>x+y,0)-report.totalMs)<.001,'phase durations must not double count nested operations');
const shape=R.deserializeShape(result.outputs[0].brep).asShape3D();
try{assert.ok(Math.abs(R.measureDistanceBetween(shape,obstacle)-.6)<1e-5);}finally{shape.delete();obstacle.delete();}
assert.equal(result.timings,undefined);console.log('PASS measured native barrier geometry/inspection/display/save phases, exact gap and unchanged output format');
