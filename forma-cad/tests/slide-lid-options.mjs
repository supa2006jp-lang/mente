import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {makeSlideLid} from '../src/slide-lid.js';
import {runOperation} from '../src/kernel.js';
import {defaults,validateProject} from '../src/geometry.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const p={wall:4.2,floor:2.4,lidThickness:3.6,railDepth:1.2,cover:1.2,clearance:.25,direction:'long',entry:'negative',pose:'assembled',grip:true,lock:true,lockHeight:.35,filletInside:true,filletOutside:true,innerFilletRadius:1,outerFilletRadius:1,divider:true,dividerThickness:2.4,dividerCompartments:2,dividerDirection:'short'};
function valid(shape){const c=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false),solids=shape.solids;try{assert.ok(c.IsValid());assert.equal(solids.length,1);}finally{c.delete();solids.forEach(s=>s.delete());}}
function material(shape,point){const tool=R.makeBox(point.map(v=>v-.01),point.map(v=>v+.01)),hit=shape.intersect(tool);try{return R.measureVolume(hit);}finally{hit.delete();tool.delete();}}
for(const compartments of [2,3,4])for(const dividerDirection of ['short','long'])for(const opposite of [false,true]){
 const source=R.makeBox([-40,-25,3],[40,25,33]).rotate(opposite?27:0,[0,0,0],[0,0,1]).translate([12,-7,0]);
 const values={...p,dividerCompartments:compartments,dividerDirection,direction:opposite?'short':'long',entry:opposite?'positive':'negative',dividerOffsets:Array.from({length:compartments-1},(_,i)=>i===0?-1:0)};
 const result=makeSlideLid(source,values);try{
  valid(result.body);valid(result.lid);const q=result.analysis;assert.equal(q.overlap,0);assert.equal(q.slidingOverlap,0);assert.ok(q.lock.slidingContact>0);assert.ok(q.lock.remainingLid>=1.2);assert.ok(Math.abs(q.lock.requiredFlex-.1)<1e-6);assert.equal(q.divider.compartments,compartments);assert.equal(q.divider.lidClearance,.25);assert.equal(q.divider.zMax,q.grooveLower);assert.equal(q.fillet.innerRadius,1);assert.ok(q.fillet.innerBottomEdges>0);assert.equal(q.fillet.outerEdges,8);
  const point=(x,y,z)=>[q.center[0]+Math.cos(q.angle*Math.PI/180)*x-Math.sin(q.angle*Math.PI/180)*y,q.center[1]+Math.sin(q.angle*Math.PI/180)*x+Math.cos(q.angle*Math.PI/180)*y,q.center[2]+z];
  for(const pos of q.divider.positions){const [x,y]=dividerDirection==='short'?[pos,0]:[0,pos];assert.ok(material(result.body,point(x,y,q.divider.zMax-.01))>1e-6,'divider reaches the intended height');assert.equal(material(result.body,point(x,y,q.divider.zMax+.05)),0,'divider stays below the lid');}
  const moved=result.lid.clone().translate(q.exitVector.map(v=>v*1.5)),hit=result.body.intersect(moved);try{assert.ok(R.measureVolume(hit)>0,'detent contacts the sliding lid after leaving the matching groove');}finally{moved.delete();hit.delete();}
  const plain=makeSlideLid(source,{...values,lock:false});try{const tool=result.body.intersect(plain.lid),baseline=plain.body.intersect(result.lid);try{assert.ok(R.measureVolume(tool)>0,'mountain exists');assert.equal(R.measureVolume(baseline),0,'grooves are subtractions');}finally{tool.delete();baseline.delete();}}finally{plain.body.delete();plain.lid.delete();}
  console.log('PASS all options '+compartments+' rooms / '+dividerDirection+' dividers / '+(opposite?'rotated opposite entrance':'default entrance'));
 }finally{result.body.delete();result.lid.delete();source.delete();}
}
const box=R.makeBox([-40,-25,0],[40,25,30]);try{
 for(const bad of [{lockHeight:.8},{lockHeight:NaN},{lock:'yes'},{filletInside:'yes'},{innerFilletRadius:0},{outerFilletRadius:Infinity},{dividerCompartments:5},{dividerCompartments:1.5},{dividerThickness:1},{dividerOffsets:[100]},{dividerOffsets:[]},{dividerDirection:'bad'},{floor:1.2},{wall:2,railDepth:.6}])assert.throws(()=>makeSlideLid(box,{...p,...bad}));
 const adjusted=makeSlideLid(box,{...p,innerFilletRadius:100,outerFilletRadius:100,lock:false});try{assert.ok(adjusted.analysis.fillet.innerRadius<100);assert.ok(adjusted.analysis.fillet.outerRadius<100);assert.equal(adjusted.analysis.slidingOverlap,0);valid(adjusted.body);}finally{adjusted.body.delete();adjusted.lid.delete();}
}finally{box.delete();}
const base={...defaults,id:'box',kind:'extrusion',name:'直方体',width:80,height:50,depth:30,z:3},spec={...p,type:'slideLid',id:'slide',target:'box',pose:'print',dividerCompartments:3,dividerOffsets:[-2,1]},result=runOperation([base],spec),op={kind:'cadop',id:'slide',name:'スライド蓋',spec,...result},layoutSpec={type:'printLayout',id:'plate',targets:['box','slide-lid'],margin:2,gap:3,allowRotation:true},layout=runOperation([base,op],layoutSpec),before=[base,op,{kind:'cadop',id:'plate',name:'印刷配置',spec:layoutSpec,...layout}];
const next=structuredClone(before);next[1].spec.lockHeight=.4;next[1].spec.dividerOffsets=[-1,2];const replay=runOperation(next,{type:'replay',before,start:1});assert.equal(replay.features[1].analysis.lock.height,.4);assert.deepEqual(replay.features[1].analysis.divider.offsets,[-1,2]);assert.equal(replay.features[2].outputs.length,2);validateProject({format:'forma-cad',version:1,features:replay.features});
console.log('PASS lock contact isolated from sliding interference, divider top clearance, inner/bottom/outer fillets, invalid settings, radius adjustment and replay through print layout');
