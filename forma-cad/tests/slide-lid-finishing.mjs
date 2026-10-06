import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';import fs from 'node:fs/promises';import assert from 'node:assert/strict';
import {makeSlideLid} from '../src/slide-lid.js';import {runOperation} from '../src/kernel.js';import {defaults,validateProject} from '../src/geometry.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const p={lidStyle:'top',wall:4.2,floor:2.4,lidThickness:3.6,railDepth:1.2,cover:1.2,clearance:.25,direction:'long',entry:'negative',pose:'assembled',grip:true,lock:true,lockHeight:.35,divider:true,dividerCompartments:2,dividerDirection:'short',dividerThickness:2.4,filletInside:true,innerFilletRadius:1,filletOutside:true,outerFilletRadius:1};
const hit=(s,point)=>{const b=R.makeBox(point.map(v=>v-.005),point.map(v=>v+.005)),a=s.intersect(b);try{return R.measureVolume(a);}finally{a.delete();b.delete();}};
function valid(s){const c=new (R.getOC().BRepCheck_Analyzer)(s.wrapped,true,false),solids=s.solids;try{assert.ok(c.IsValid());assert.equal(solids.length,1);}finally{c.delete();solids.forEach(s=>s.delete());}}
for(const direction of ['long','short'])for(const entry of ['negative','positive']){
 const source=R.makeBox([-40,-25,3],[40,25,33]).rotate(27,[0,0,0],[0,0,1]).translate([12,-7,0]),input={...p,direction,entry},plain=makeSlideLid(source,input),result=makeSlideLid(source,{...input,leadIn:true,leadInSize:.6,roundLidCorners:true,lidCornerRadius:2}),q=result.analysis;
 const world=(x,y,z)=>{const a=q.angle*Math.PI/180;return [q.center[0]+Math.cos(a)*x-Math.sin(a)*y,q.center[1]+Math.sin(a)*x+Math.cos(a)*y,q.center[2]+z];};const S=q.width/2-p.wall,front=-q.length/2,back=q.length/2-p.wall-p.clearance,tip=S+p.railDepth-p.clearance;
 try{valid(result.body);valid(result.lid);assert.equal(q.overlap,0);assert.equal(q.slidingOverlap,0);assert.equal(q.leadIn.entrance,.6);assert.equal(q.leadIn.ridge,.6);assert.equal(q.lidCorners.radius,2);assert.ok(q.lock.slidingContact>0);
 for(const side of [-1,1]){
  const mouth=world(front+.1,side*(S+p.railDepth+.15),q.grooveUpper-.3);assert.ok(hit(plain.body,mouth)>0);assert.equal(hit(result.body,mouth),0,'entrance actually widened');
  const nose=world(back-.1,side*(tip-.15),(q.grooveLower+q.grooveUpper)/2);assert.ok(hit(plain.lid,nose)>0);assert.equal(hit(result.lid,nose),0,'insertion end of ridge actually chamfered');
  for(const x of [0,back-.1])assert.ok(hit(result.lid,world(x,side*(S-p.clearance-q.railStemWidth/2),q.capLower-.5))>0,'stem intact');
  assert.ok(hit(result.lid,world(0,side*(tip-.15),(q.grooveLower+q.grooveUpper)/2))>0,'main engagement untouched');
 }
 for(const sx of [-1,1])for(const sy of [-1,1]){const corner=world(sx*(q.length/2-.1),sy*(q.width/2-.1),q.capLower+p.lidThickness/2);assert.ok(hit(plain.lid,corner)>0);assert.equal(hit(result.lid,corner),0,'all four cap corners rounded');}
 const stopped=result.lid.clone().translate(q.axis),rear=result.body.intersect(stopped);try{assert.ok(R.measureVolume(rear)>0,'rear stop retained');}finally{stopped.delete();rear.delete();}
 console.log('PASS mouth and insertion nose cuts, four rounded corners, preserved stems/engagement, stop, detent and slide clearance: '+direction+' / '+entry);
 }finally{plain.body.delete();plain.lid.delete();result.body.delete();result.lid.delete();source.delete();}
}
const source=R.makeBox([-40,-25,0],[40,25,30]);try{
 for(const bad of [{leadIn:'yes'},{leadIn:true,leadInSize:-1},{leadIn:true,leadInSize:3},{roundLidCorners:'yes'},{roundLidCorners:true,lidCornerRadius:NaN},{roundLidCorners:true,lidStyle:'inset'}])assert.throws(()=>makeSlideLid(source,{...p,...bad}));
 const safe=makeSlideLid(source,{...p,wall:2.4,filletOutside:false,lock:false,leadIn:true,leadInSize:2,roundLidCorners:true,lidCornerRadius:100});try{valid(safe.lid);assert.equal(safe.analysis.leadIn.entrance,0);assert.ok(safe.analysis.leadIn.ridge<=p.railDepth-.3);assert.ok(safe.analysis.lidCorners.radius<=2.4+p.clearance-.3);}finally{safe.body.delete();safe.lid.delete();}
 const legacy=makeSlideLid(source,{...p,lidStyle:'inset',leadIn:true});try{valid(legacy.lid);assert.equal(legacy.analysis.slidingOverlap,0);assert.equal(legacy.analysis.lidCorners,null);}finally{legacy.body.delete();legacy.lid.delete();}
}finally{source.delete();}
const base={...defaults,id:'box',kind:'extrusion',name:'直方体',width:80,height:50,depth:30,z:3},spec={...p,type:'slideLid',id:'slide',target:'box',pose:'print',leadIn:true,leadInSize:.6,roundLidCorners:true,lidCornerRadius:2},r=runOperation([base],spec),op={kind:'cadop',id:'slide',name:'スライド蓋',spec,...r},before=[base,op],next=structuredClone(before);next[1].spec.lidCornerRadius=3;next[1].spec.leadInSize=.4;const replay=runOperation(next,{type:'replay',before,start:1});assert.equal(replay.features[1].analysis.lidCorners.radius,3);assert.equal(replay.features[1].analysis.leadIn.ridge,.4);for(const o of replay.features[1].outputs)assert.ok(Math.abs(Math.min(...o.vertices.filter((_,i)=>i%3===2)))<1e-5);validateProject({format:'forma-cad',version:1,features:replay.features});console.log('PASS bounds guards, legacy lead-in, saved settings and replay with inverted print placement');
