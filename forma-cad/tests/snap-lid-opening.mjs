import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {runOperation} from '../src/kernel.js';
import {defaults,validateProject} from '../src/geometry.js';
import {makeSnapLid} from '../src/snap-lid.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const params={bodyWall:4.2,lidWall:2.4,floor:2.4,insertion:4,clearance:.2,ridge:.4,pose:'assembled',openingGroove:true,openingWidth:24,openingHeight:3,openingDepth:.8};
const shape=o=>R.deserializeShape(o.brep).asShape3D();
function historyFor(width,height,profile='rect') {const base={...defaults,id:'body',kind:'extrusion',name:'本体',profile,width,height,diameter:60,depth:30,z:3,x:10,y:-5},lid={...base,id:'lid',name:'蓋',depth:12,z:33};return [base,lid];}
function probe(body,p){const box=R.makeBox(p.map(v=>v-.02),p.map(v=>v+.02)),hit=body.intersect(box);try{return R.measureVolume(hit);}finally{box.delete();hit.delete();}}
for(const [width,height] of [[80,50],[50,80],[40,40]]){
const history=historyFor(width,height),spec={...params,type:'snapLid',id:'closure',target:'body',lidTarget:'lid'},plain=runOperation(history,{...spec,openingGroove:false});
for(const mode of ['default','rounded','limited','print']){
 const extra=mode==='rounded'?{filletInside:true,filletOutside:true,innerFilletRadius:1,outerFilletRadius:1}:mode==='limited'?{openingWidth:1000,openingHeight:1000,openingDepth:1000}:mode==='print'?{pose:'print'}:{};
 const result=runOperation(history,{...spec,...extra}),q=result.analysis.opening;
 assert.equal(q.count,2);assert.ok(q.remainingWall>=1.2-1e-6);assert.ok(q.height>=q.depth,'at least a 45-degree supported ramp');assert.equal(q.pullingFace,'horizontal');assert.ok(q.lip>=1.2);assert.ok(q.height-q.rampHeight>=.6);assert.ok(q.depth<=params.lidWall-params.ridge-1.2+1e-6,'retaining groove backing remains thick enough');assert.ok(result.analysis.overlap<1e-5);
 if(width!==height)for(const side of q.sides)assert.ok(Math.abs(side.normal[width>height?0:1])>.999999,'shorter end faces chosen');
 const bodies=result.outputs.map(shape);
 try{for(const body of bodies){const check=new (R.getOC().BRepCheck_Analyzer)(body.wrapped,true,false),solids=body.solids;try{assert.ok(check.IsValid());assert.equal(solids.length,1);}finally{check.delete();solids.forEach(s=>s.delete());}}
 if(mode==='print'){for(const body of bodies){const box=body.boundingBox;try{assert.ok(Math.abs(box.bounds[0][2])<1e-5);}finally{box.delete();}}}
 else{
 const plainLid=shape(plain.outputs[1]),plainBody=shape(plain.outputs[0]);
 try{if(mode==='default'||mode==='limited'){assert.ok(Math.abs(R.measureVolume(bodies[0])-R.measureVolume(plainBody))<1e-6,'container unchanged');const loss=R.measureVolume(plainLid)-R.measureVolume(bodies[1]);assert.ok(Math.abs(loss-2*q.width*q.depth*(q.height-q.rampHeight/2))<.0001,'two pockets with ramp and horizontal pulling ledge removed');}
 for(const {center,normal} of q.sides){const at=(distance,z,side=0)=>[center[0]-normal[0]*distance+normal[1]*side,center[1]-normal[1]*distance-normal[0]*side,z];
 assert.ok(probe(bodies[1],at(q.depth*.5,result.analysis.seam+q.lip+q.rampHeight+.15))<1e-8,'nail entrance exists at both lid edges');
 assert.ok(probe(bodies[1],at(q.depth+.15,result.analysis.seam+q.height*.15))>.00001,'wall retained behind opening');
 assert.ok(probe(bodies[1],at(q.depth*.5,result.analysis.seam+q.lip+q.height+.1))>.00001,'solid horizontal ledge above opening');assert.ok(probe(bodies[1],at(q.depth*.5,result.analysis.seam+.5))>.00001,'full opening lip retained');assert.ok(probe(bodies[1],at(q.depth*.5,result.analysis.seam+q.lip+q.height-.1))<1e-8,'space directly below the pulling ledge');
 assert.ok(probe(bodies[1],at(.15,result.analysis.seam+q.lip+q.rampHeight+.15,q.width/2+.3))>.00001,'material beside opening retained');}
 }finally{plainLid.delete();plainBody.delete();}}
 {const faces=bodies[1].faces;try{const ledges=faces.filter(f=>{if(f.geomType!=='PLANE')return false;const c=f.center,n=f.normalAt();try{const print=mode==='print',z=print?result.analysis.lidHeight-q.lip-q.height:result.analysis.seam+q.lip+q.height;return Math.abs(c.toTuple()[2]-z)<1e-5&&(print?n.toTuple()[2]>.99999:n.toTuple()[2]<-.99999);}finally{c.delete();n.delete();}});assert.equal(ledges.length,2,'two native horizontal pulling faces');for(const ledge of ledges)assert.ok(Math.abs(R.measureArea(ledge)-q.width*q.depth)<1e-5);}finally{faces.forEach(f=>f.delete());}}
 validateProject({format:'forma-cad',version:1,features:[...history,{kind:'cadop',id:'closure',name:'被せ蓋',spec:{...spec,...extra},...result}]});
 }finally{bodies.forEach(b=>b.delete());}
 console.log('PASS '+width+'x'+height+' '+mode+': short-face openings, native valid solids, safe wall/ramp and retained snap fit');
}
for(const bad of [{openingGroove:'yes'},{openingWidth:0},{openingHeight:NaN},{openingDepth:-1},{openingWidth:.1},{openingHeight:.1},{openingDepth:.1}])assert.throws(()=>runOperation(history,{...spec,...bad}));
}
assert.throws(()=>runOperation(historyFor(60,60,'circle'),{...params,type:'snapLid',id:'closure',target:'body',lidTarget:'lid'}),/四角/);
console.log('PASS invalid settings rejected and unsupported cylinder explained');

// Short-face detection uses edge directions, including a box rotated within the XY plane.
const lower=R.makeBox([-40,-25,3],[40,25,33]).rotate(32,[0,0,3],[0,0,1]),upper=R.makeBox([-40,-25,33],[40,25,45]).rotate(32,[0,0,3],[0,0,1]);
try{const result=makeSnapLid(lower,upper,params);try{const q=result.analysis.opening;assert.equal(q.count,2);for(const {center,normal}of q.sides){assert.ok(Math.abs(Math.abs(normal[0])-Math.cos(32*Math.PI/180))<1e-6);assert.ok(probe(result.lid,[center[0]-normal[0]*.4,center[1]-normal[1]*.4,33+q.lip+q.rampHeight+.15])<1e-8);}assert.ok(result.analysis.overlap<1e-5);console.log('PASS rotated rectangular box selects its actual short end faces');}finally{result.body.delete();result.lid.delete();}}finally{lower.delete();upper.delete();}
