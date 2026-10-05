import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {makeSnapLid} from '../src/snap-lid.js';
import {runOperation} from '../src/kernel.js';
import {defaults,validateProject} from '../src/geometry.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const params={bodyWall:4.2,lidWall:2.4,floor:2.4,insertion:4,clearance:.2,ridge:.4,pose:'assembled'};
function probe(shape,point){const tool=R.makeBox(point.map(v=>v-.02),point.map(v=>v+.02)),hit=shape.intersect(tool);try{return R.measureVolume(hit);}finally{hit.delete();tool.delete();}}
function valid(shape){const c=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false),solids=shape.solids;try{assert.ok(c.IsValid());assert.equal(solids.length,1);}finally{c.delete();solids.forEach(s=>s.delete());}}
for(const angle of [0,27])for(const direction of ['short','long'])for(const fillet of [false,true]){
 const lower=R.makeBox([-30,-25,3],[50,25,33]).rotate(angle,[0,0,0],[0,0,1]),upper=R.makeBox([-30,-25,33],[50,25,45]).rotate(angle,[0,0,0],[0,0,1]);
 const settings={...params,filletInside:fillet,filletOutside:fillet,innerFilletRadius:1,outerFilletRadius:1,openingGroove:true,openingWidth:24,openingHeight:3,openingDepth:.8};
 const original=makeSnapLid(lower,upper,settings),result=makeSnapLid(lower,upper,{...settings,divider:true,dividerDirection:direction,dividerThickness:2.4});
 try{
  valid(result.body);valid(result.lid);const d=result.analysis.divider,z=(d.zMin+d.zMax)/2;
  assert.equal(d.height,27.6);assert.equal(d.thickness,2.4);assert.equal(d.zMax,33);assert.ok(result.analysis.overlap<1e-5);
  assert.ok(probe(result.body,[...d.center,z])>1e-5,'center contains material');
  for(const side of [-1,1]){
   assert.ok(probe(result.body,[d.center[0]+d.normal[0]*side*5,d.center[1]+d.normal[1]*side*5,z])<1e-8,'both compartments remain empty');
   assert.ok(probe(result.body,[d.center[0]+d.tangent[0]*side*(d.span/2+.2),d.center[1]+d.tangent[1]*side*(d.span/2+.2),z])>1e-5,'joins both side walls');
  }
  assert.ok(probe(result.body,[...d.center,d.zMin-.1])>1e-5,'joins floor');
  assert.ok(probe(result.body,[...d.center,33.1])<1e-8,'stops below mating neck');
  const outside=result.body.cut(lower);const oldOutside=original.body.cut(lower);try{assert.ok(Math.abs(R.measureVolume(outside)-R.measureVolume(oldOutside))<1e-5,'outer neck unchanged');}finally{outside.delete();oldOutside.delete();}
  assert.ok(Math.abs(R.measureVolume(result.lid)-R.measureVolume(original.lid))<1e-6,'lid unchanged');
  const lidDifference=result.lid.cut(original.lid);try{assert.ok(R.measureVolume(lidDifference)<1e-8);}finally{lidDifference.delete();}
  assert.ok(R.measureVolume(result.body)>R.measureVolume(original.body),'divider adds volume');
 }finally{result.body.delete();result.lid.delete();original.body.delete();original.lid.delete();lower.delete();upper.delete();}
 console.log('PASS centered '+direction+' divider at '+angle+' degrees, fillet '+fillet+', solid continuity, two compartments and unchanged fit');
}
const base={...defaults,id:'body',kind:'extrusion',name:'本体',width:80,height:50,depth:30,z:3},upper={...base,id:'lid',name:'蓋',z:33,depth:12},history=[base,upper],spec={...params,type:'snapLid',id:'closure',target:'body',lidTarget:'lid',divider:true,dividerThickness:1.2,dividerDirection:'long',pose:'print'};
const result=runOperation(history,spec);for(const o of result.outputs){const b=R.deserializeShape(o.brep).asShape3D();try{valid(b);assert.ok(Math.abs(Math.min(...o.vertices.filter((_,i)=>i%3===2)))<1e-5);}finally{b.delete();}}
const operation={kind:'cadop',id:spec.id,name:'被せ蓋',spec,...result},layoutSpec={type:'printLayout',id:'plate',targets:['body','lid'],margin:2,gap:3,allowRotation:true},layout=runOperation([...history,operation],layoutSpec),before=[...history,operation,{kind:'cadop',id:'plate',name:'印刷配置',spec:layoutSpec,...layout}];
const proposed=structuredClone(before);proposed[2].spec.dividerThickness=3;const replay=runOperation(proposed,{type:'replay',before,start:2});assert.equal(replay.features[2].analysis.divider.thickness,3);assert.equal(replay.features[3].outputs.length,2);validateProject({format:'forma-cad',version:1,features:replay.features});
for(const bad of [{dividerThickness:1},{dividerThickness:100},{dividerThickness:NaN},{dividerDirection:'unknown'},{divider:'yes'}])assert.throws(()=>runOperation(history,{...spec,...bad}));
assert.equal(runOperation(history,{...spec,divider:false,dividerThickness:0}).analysis.divider,null);
assert.equal(runOperation(history,{...params,type:'snapLid',id:'legacy',target:'body',lidTarget:'lid'}).analysis.divider,null);
assert.throws(()=>runOperation([{...base,profile:'circle',diameter:60},{...upper,profile:'circle',diameter:60}],spec),/四角/);
console.log('PASS minimum thickness, print placement, saved model, history replay through print layout, legacy/off and invalid settings');
