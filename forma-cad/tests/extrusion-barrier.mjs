import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import {defaults,validateFeature,validateProject} from '../src/geometry.js';
import {runOperation,kernelBodies} from '../src/kernel.js';
import {regionExtrusions} from '../src/region-extrusions.js';

R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const near=(a,b,t=1e-5)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
const decode=output=>R.deserializeShape(output.brep).asShape3D();
const valid=shape=>{const check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);try{assert.ok(check.IsValid());}finally{check.delete();}};
const seed=(id,shape)=>({id,kind:'cadop',name:id,outputs:[{id,...shape.mesh(),brep:shape.serialize()}],remove:[]});
const obstacle=R.makeCylinder(3,6,[0,0,8]),features=[seed('obstacle',obstacle)],snapshot=JSON.stringify(features);
const feature={...defaults,kind:'extrusion',id:'barrier',name:'バリア押し出し',width:20,height:20,depth:25,barrier:true,barrierGap:.4};
function extrude(history,f=feature){return decode(runOperation(history,{type:'extrusion',target:f.target,feature:f}).outputs[0]);}
function probe(shape,point,inside){const box=R.makeBox(point.map(v=>v-.1),point.map(v=>v+.1));let common;try{common=shape.intersect(box);assert.ok(inside?R.measureVolume(common)>.0079:Math.abs(R.measureVolume(common))<1e-7,`probe ${point}: ${inside}`);}finally{common?.delete();box.delete();}}

for(const gap of [0,.4,.8]){
 const shape=extrude(features,{...feature,barrierGap:gap});
 try{valid(shape);near(R.measureDistanceBetween(shape,obstacle),gap);probe(shape,[0,0,20],true);probe(shape,[7,0,11],true);probe(shape,[0,0,11],false);if(gap)probe(shape,[3+gap/2,0,11],false);near(shape.boundingBox.bounds[1][2],25);}
 finally{shape.delete();}
}
const reversed=extrude(features,{...feature,z:25,depth:-25});try{valid(reversed);near(R.measureDistanceBetween(reversed,obstacle),.4);probe(reversed,[0,0,3],true);}finally{reversed.delete();}
const symmetric=extrude(features,{...feature,z:12,depth:15,symmetric:true});try{valid(symmetric);near(R.measureDistanceBetween(symmetric,obstacle),.4);near(symmetric.boundingBox.bounds[0][2],-3);near(symmetric.boundingBox.bounds[1][2],27);}finally{symmetric.delete();}
const tilted=R.makeBox([-3,-3,7],[3,3,14]).rotate(27,[0,0,10],[0,1,0]),rotated=extrude([seed('tilted',tilted)]);try{valid(rotated);near(R.measureDistanceBetween(rotated,tilted),.4);}finally{rotated.delete();tilted.delete();}
const distant=R.makeBox([100,100,100],[110,110,110]),plain=extrude([seed('distant',distant)]);try{near(R.measureVolume(plain),10000);}finally{plain.delete();distant.delete();}
const tapered=extrude(features,{...feature,taperAngle:3});try{valid(tapered);near(R.measureDistanceBetween(tapered,obstacle),.4);}finally{tapered.delete();}
const sideObstacle=R.makeCylinder(2,30,[9,0,-2]),thin=extrude([seed('side',sideObstacle)],{...feature,mode:'thin',wall:2});try{valid(thin);near(R.measureDistanceBetween(thin,sideObstacle),.4);}finally{thin.delete();sideObstacle.delete();}
const lower=R.makeBox([-10,-10,-4],[10,10,0]),source=seed('source',lower),region={id:'top',plane:'XY',offset:0,outer:[[-10,-10],[10,-10],[10,10],[-10,10]],holes:[],area:400,sourceIds:[],bodyId:'source',cadFace:{bodyId:'source',point:[0,0,0],normal:[0,0,1]}};
const joined=runOperation([source,...features],{type:'extrusion',target:'source',feature:{...feature,profile:'region',region,operation:'join',target:'source',targetAllBodies:true}});
assert.deepEqual(joined.remove,[]);assert.deepEqual(joined.outputs.map(o=>o.id),['source']);const joint=decode(joined.outputs[0]);try{valid(joint);near(R.measureDistanceBetween(joint,obstacle),.4);probe(joint,[0,0,-2],true);probe(joint,[0,0,20],true);}finally{joint.delete();}
const preview=runOperation(features,{type:'extrusionToolPreview',feature});assert.ok(preview.outputs[0].triangles.length);
const batch=regionExtrusions({...feature,profile:'region'},[{...region,bodyId:undefined,cadFace:undefined},{...region,id:'second',offset:-2,outer:[[20,-10],[30,-10],[30,10],[20,10]],bodyId:undefined,cadFace:undefined}]);
const added=runOperation(features,{type:'extrusionBatch',features:batch}).features;assert.equal(added.length,2);for(const f of added){assert.equal(f.barrierGap,.4);const shape=decode(f.cadResult.outputs[0]);try{valid(shape);}finally{shape.delete();}}
const saved={format:'forma-cad',version:1,features:[...features,{...feature,cadResult:runOperation(features,{type:'extrusion',feature})}]};validateProject(JSON.parse(JSON.stringify(saved)));
const proposed=structuredClone(saved.features);proposed[1].barrierGap=.8;const replayed=runOperation(proposed,{type:'replay',before:saved.features,start:1}).features,updated=decode(replayed[1].cadResult.outputs[0]);try{near(R.measureDistanceBetween(updated,obstacle),.8);}finally{updated.delete();}
const cachedA=kernelBodies([...features,feature]),cachedB=kernelBodies([...features,{...feature,barrierGap:.8}]);try{near(R.measureDistanceBetween(cachedA.get('barrier'),obstacle),.4);near(R.measureDistanceBetween(cachedB.get('barrier'),obstacle),.8);}finally{for(const s of [...cachedA.values(),...cachedB.values()])s.delete();}
const moved=obstacle.clone().translate([5,0,0]),changed=structuredClone(saved.features);changed[0]=seed('obstacle',moved);const movedHistory=runOperation(changed,{type:'replay',before:saved.features,start:0}).features,movedResult=decode(movedHistory[1].cadResult.outputs[0]);try{near(R.measureDistanceBetween(movedResult,moved),.4);probe(movedResult,[0,0,11],true);}finally{movedResult.delete();moved.delete();}
for(const patch of [{barrierGap:-.1},{barrierGap:NaN},{barrierGap:1001},{barrier:'yes'},{operation:'cut'},{untilSolid:true}])assert.throws(()=>validateFeature({...feature,...patch}),/バリア/);
const cover=R.makeBox([-20,-20,-20],[20,20,40]);assert.throws(()=>extrude([seed('cover',cover)]),/形状がなくなる|不正/);cover.delete();
assert.equal(JSON.stringify(features),snapshot);near(R.measureVolume(obstacle),Math.PI*9*6);
await fs.writeFile('.sites-runtime/extrusion-barrier-fixture.forma.json',JSON.stringify({format:'forma-cad',version:1,features:[source,...features,{...defaults,kind:'sketch',id:'profile',groupId:'sketch1',groupNumber:1,name:'押し出し用スケッチ',width:20,height:20,z:0}]}));
obstacle.delete();lower.delete();console.log('PASS exact 0/0.4/0.8 mm surface clearance, material beyond obstacles, reverse/symmetric/taper/thin, source join, immutable obstacles, preview, batch, save/replay/cache and invalid/empty results');
