import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {makeCylinderHinge} from '../src/cylinder-hinge.js';
import {solidMeshComplete} from '../src/solid-mesh.js';
import {runOperation} from '../src/kernel.js';
import {defaults,validateProject} from '../src/geometry.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const volume=s=>Math.abs(R.measureVolume(s)),hit=(a,b)=>{const c=a.intersect(b);try{return volume(c);}finally{c.delete();}};
function valid(s){const c=new (R.getOC().BRepCheck_Analyzer)(s.wrapped,true,false),solids=s.solids;try{assert.ok(c.IsValid());assert.equal(solids.length,1);assert.ok(solidMeshComplete(s));}finally{c.delete();solids.forEach(s=>s.delete());}}
const source=R.makeCylinder(30,80),spec={pose:'closed',openBottom:true,holderLip:true,lipInset:1.2,lipHeight:2.4,fingerTab:true,tabWidth:18,tabReach:6},result=makeCylinderHinge(source,spec),[body,lid]=result.parts;
result.parts.forEach(valid);assert.equal(result.analysis.openBottom,true);assert.ok(Math.abs(result.analysis.mouthRadius-26.4)<1e-8);assert.equal(result.analysis.tabReach,6);
const bore=R.makeCylinder(26.3,82,[0,0,-1]),lowBore=R.makeCylinder(27.5,76,[0,0,0]),lip=R.makeBox([-.1,26.6,77.7],[.1,27.4,79.9]),belowLip=R.makeBox([-.1,26.6,76],[.1,27.4,77.5]),tab=R.makeBox([-.1,33,80.4],[.1,34,82.6]),back=R.makeBox([6,-34,80.4],[6.2,-33,82.6]);
assert.ok(hit(body,bore)<1e-5,'bottom-to-mouth through opening');assert.ok(hit(body,lowBore)<1e-5,'tube bore remains wide below lip');assert.ok(hit(body,lip)>.3,'inward retaining lip has positive material');assert.ok(hit(body,belowLip)<1e-5,'horizontal underside creates retaining shoulder');assert.ok(hit(lid,tab)>.3,'finger tab extends opposite hinge');assert.ok(hit(lid,back)<1e-5,'no finger tab on hinge side');
// Simulate an existing holder: it fits below the shoulder and stops at the lip.
const outer=R.makeCylinder(27.35,77.55),inner=R.makeCylinder(25.2,80,[0,0,-1]),holder=outer.cut(inner);
assert.ok(hit(body,holder)<1e-5,'external collar fits around holder');const raised=holder.clone().translate([0,0,1]);assert.ok(hit(body,raised)>1,'holder rim is stopped by the shoulder');raised.delete();outer.delete();inner.delete();holder.delete();
const plain=makeCylinderHinge(source,{pose:'closed'}),explicit=makeCylinderHinge(source,{pose:'closed',openBottom:false,holderLip:false,fingerTab:false});
for(let i=0;i<2;i++){const a=plain.parts[i].cut(explicit.parts[i]),b=explicit.parts[i].cut(plain.parts[i]);assert.ok(volume(a)+volume(b)<1e-5,'old files retain exact geometry');a.delete();b.delete();}
for(const pose of ['print','open']){const r=makeCylinderHinge(source,{...spec,pose,azimuth:145,angle:65});r.parts.forEach(valid);assert.ok(hit(...r.parts)<1e-5);if(pose==='print')r.parts.forEach(s=>assert.ok(Math.abs(s.boundingBox.bounds[0][2])<1e-6));r.parts.forEach(s=>s.delete());}
const tool=R.makeCylinder(27,77,[0,0,4]),cup=source.cut(tool),cupResult=makeCylinderHinge(cup,spec),cupBore=R.makeCylinder(25.7,82,[0,0,-1]);cupResult.parts.forEach(valid);assert.ok(hit(cupResult.parts[0],cupBore)<1e-5,'existing closed cup floor is also removed on request');
for(const p of [{lipInset:28},{lipHeight:80},{tabWidth:60},{tabReach:0},{openBottom:'true'}])assert.throws(()=>makeCylinderHinge(source,{...spec,...p}));
const f={...defaults,id:'c',name:'円柱',profile:'circle',diameter:60,depth:80},operation={...spec,type:'cylinderHinge',target:'c',id:'hinge'},output=runOperation([f],operation);validateProject({format:'forma-cad',version:1,features:[f,{kind:'cadop',id:'hinge',name:'円柱のヒンジ蓋',spec:operation,...output}]});assert.equal(output.outputs.length,2);
[source,...result.parts,bore,lowBore,lip,belowLip,tab,back,...plain.parts,...explicit.parts,tool,cup,...cupResult.parts,cupBore].forEach(s=>s.delete());
console.log('PASS through bottom, retaining shoulder and actual holder stop, rounded opposite beak, valid solids/meshes, checked motion and print pose, hollow cup conversion, old geometry preservation and persisted options');
