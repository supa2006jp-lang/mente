import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';import fs from 'node:fs/promises';import assert from 'node:assert/strict';
import {runOperation} from '../src/kernel.js';import {defaults,validateProject} from '../src/geometry.js';
import {ballJointDefaults} from '../src/ball-joint-settings.js';
import {createBallClampSectionModel} from '../src/ball-joint-section.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const source={...defaults,id:'c',name:'円柱',profile:'circle',diameter:24,depth:40},spec={...ballJointDefaults({radius:12,height:40}),type:'ballJoint',id:'joint',target:'c'},original=JSON.stringify(spec);
function area(part){let sum=0;for(let i=0;i<part.fill.length;i+=3){const[a,b,c]=part.fill.slice(i,i+3);sum+=Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))/2;}return sum;}
function check(result){assert.equal(result.analysis.placements.length,3);const model=createBallClampSectionModel(result),initial=model.slice(),seat=model.slice(model.s.contactTravel),ball=model.slice(model.s.clampingTravel),end=model.slice(model.s.availableTravel),stop=model.slice(model.stopTravel);
 assert.equal(initial.phase,'free');assert.equal(seat.phase,'seat');assert.equal(ball.phase,'ball');assert.equal(stop.phase,'stop');assert.ok(Math.abs(end.remaining-.15)<1e-9);assert.equal(stop.remaining,0);assert.equal(model.slice(Infinity).advance,0);assert.equal(model.slice(-1).advance,0);assert.equal(model.slice(999).advance,model.stopTravel);
 assert.ok(Math.abs(stop.rotation-model.stopTravel/model.s.threadPitch*360)<1e-9);assert.deepEqual(stop.parts.slice(0,2),initial.parts.slice(0,2));assert.notDeepEqual(stop.parts[2].segments,initial.parts[2].segments);
 for(const p of initial.parts){assert.ok(p.fill.length>0);assert.ok(p.segments.every(Number.isFinite));}

 const stats=initial.parts.map(area);model.dispose();return stats;
}
const assembled=runOperation([source],{...spec,pose:'assembled'}),reference=check(assembled);
// Independently move the CAD solid and compare its section against the mesh preview.
const travel=assembled.analysis.contactTravel+.3,nut=R.deserializeShape(assembled.outputs[2].brep).asShape3D(),moved=nut.clone().rotate(travel/spec.threadPitch*360,[0,0,0],[0,0,1]).translate([0,0,travel]),changed={...assembled,outputs:[...assembled.outputs.slice(0,2),moved.mesh({tolerance:.08,angularTolerance:.15})]},actual=createBallClampSectionModel(assembled),expected=createBallClampSectionModel(changed);
const previewPart=actual.slice(travel).parts[2],cadPart=expected.slice(0).parts[2];assert.ok(Math.abs(area(previewPart)-area(cadPart))<.02,'mesh screw motion matches independently transformed CAD solid');for(const component of [0,2]){const a=previewPart.segments.filter((_,i)=>i%3===component),b=cadPart.segments.filter((_,i)=>i%3===component);assert.ok(Math.abs(Math.min(...a)-Math.min(...b))<.002);assert.ok(Math.abs(Math.max(...a)-Math.max(...b))<.002);}actual.dispose();expected.dispose();moved.delete();nut.delete();
for(const pose of ['print','exploded','assembled']){const r=runOperation([source],{...spec,pose}),stats=check(r);stats.forEach((v,i)=>assert.ok(Math.abs(v-reference[i])<.01,'section is independent of output pose'));validateProject({format:'forma-cad',version:1,features:[source,{kind:'cadop',id:'joint',name:'ボール',spec:{...spec,pose},...r}]});}
for(const plane of ['YZ','XZ']){const r=runOperation([{...source,plane,x:11,y:-7,z:3}],{...spec,pose:'assembled'}),stats=check(r);stats.forEach((v,i)=>assert.ok(Math.abs(v-reference[i])<.02,'translated/rotated cylinder local section'));}
assert.equal(JSON.stringify(spec),original);console.log('PASS real sections, exact CAD placement recovery, screw rotation/advance, contact phases, physical stop and safe travel, poses/axes and unchanged saved geometry');
