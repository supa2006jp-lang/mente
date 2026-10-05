import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {runOperation} from '../src/kernel.js';
import {defaults,validateProject} from '../src/geometry.js';
import {makeSnapLid} from '../src/snap-lid.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const p={bodyWall:4.2,lidWall:2.4,floor:2.4,insertion:4,clearance:.2,ridge:.4,pose:'assembled',divider:true,dividerThickness:2.4,filletInside:true,innerFilletRadius:1};
function material(shape,point){const tool=R.makeBox(point.map(v=>v-.01),point.map(v=>v+.01)),hit=shape.intersect(tool);try{return R.measureVolume(hit);}finally{hit.delete();tool.delete();}}
function valid(shape){const c=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false),solids=shape.solids;try{assert.ok(c.IsValid());assert.equal(solids.length,1);}finally{c.delete();solids.forEach(s=>s.delete());}}

for(const [count,direction,angle,offsets,fillet]of [[2,'short',0,[10],true],[3,'short',0,[0,0],true],[4,'short',27,[-3,2,0],true],[3,'long',0,[1,-1],false],[4,'long',27,[0,0,0],true]]){
 const lower=R.makeBox([-40,-25,0],[40,25,30]).rotate(angle,[0,0,0],[0,0,1]),upper=R.makeBox([-40,-25,30],[40,25,42]).rotate(angle,[0,0,0],[0,0,1]);
 const result=makeSnapLid(lower,upper,{...p,dividerCompartments:count,dividerOffsets:offsets,dividerDirection:direction,filletInside:fillet});
 try{
  valid(result.body);valid(result.lid);const d=result.analysis.divider;assert.equal(d.compartments,count);assert.equal(d.positions.length,count-1);assert.equal(d.compartmentWidths.length,count);assert.deepEqual(d.offsets,offsets);assert.ok(result.analysis.overlap<1e-5);
  const at=(s,t,z)=>[d.center[0]+d.tangent[0]*s+d.normal[0]*t,d.center[1]+d.tangent[1]*s+d.normal[1]*t,z];
  for(const pos of d.positions){
   for(const z of [d.zMin-.1,15,d.zMax-.05])assert.ok(material(result.body,at(0,pos,z))>1e-6,'every divider connects floor and reaches neck top');
   assert.ok(material(result.body,at(0,pos,d.zMax+.05))<1e-8);
   if(fillet){const r=d.filletRadius;for(const end of [-1,1])for(const side of [-1,1])for(const z of [15,29.95,30.05,33.95])assert.ok(material(result.body,at(end*(d.span/2-r*.12),pos+side*(d.thickness/2+r*.12),z))>1e-6,'every divider has continuous side-wall fillets');
    for(const side of [-1,1])assert.ok(material(result.body,at(0,pos+side*(d.thickness/2+r*.12),d.zMin+r*.12))>1e-6,'every divider has bottom fillets');}
  }
  for(let i=0;i<count;i++){const left=i===0?-d.innerWidth/2:d.positions[i-1]+d.thickness/2,right=i===count-1?d.innerWidth/2:d.positions[i]-d.thickness/2;assert.ok(material(result.body,at(0,(left+right)/2,15))<1e-8,'all compartments remain empty');}
  const equal=(d.innerWidth-(count-1)*d.thickness)/count;
  if(offsets.every(x=>x===0))for(const width of d.compartmentWidths)assert.ok(Math.abs(width-equal)<1e-6,'actual clear widths are equal');
  if(count===2)assert.ok(Math.abs(d.compartmentWidths[0]-d.compartmentWidths[1]-20)<1e-6,'offset makes unequal compartments');
  console.log('PASS '+count+' compartments, '+direction+', '+angle+' degrees, offsets '+offsets+', continuous body/neck/floor and fillets');
 }finally{result.body.delete();result.lid.delete();lower.delete();upper.delete();}
}
const lower=R.makeBox([-40,-25,0],[40,25,30]),upper=R.makeBox([-40,-25,30],[40,25,42]);
try{for(const invalid of [{dividerCompartments:1},{dividerCompartments:5},{dividerCompartments:2.5},{dividerCompartments:3,dividerOffsets:[0]},{dividerOffsets:[NaN]},{dividerOffsets:[100]},{dividerCompartments:3,dividerOffsets:[25,-25]}])assert.throws(()=>makeSnapLid(lower,upper,{...p,...invalid}));}finally{lower.delete();upper.delete();}
console.log('PASS invalid count, offset, crossed dividers and minimum empty-space checks');

const base={...defaults,id:'body',kind:'extrusion',name:'本体',width:80,height:50,depth:30,z:3},lid={...base,id:'lid',name:'蓋',z:33,depth:12},history=[base,lid];
const spec={...p,type:'snapLid',id:'closure',target:'body',lidTarget:'lid',dividerCompartments:4,dividerOffsets:[-3,2,0],pose:'print'},result=runOperation(history,spec);
assert.equal(result.outputs.length,2);for(const o of result.outputs)assert.ok(Math.abs(Math.min(...o.vertices.filter((_,i)=>i%3===2)))<1e-5);
const operation={kind:'cadop',id:spec.id,name:'被せ蓋',spec,...result},layoutSpec={type:'printLayout',id:'plate',targets:['body','lid'],margin:2,gap:3,allowRotation:true},layout=runOperation([...history,operation],layoutSpec),before=[...history,operation,{kind:'cadop',id:'plate',name:'印刷配置',spec:layoutSpec,...layout}];
const proposed=structuredClone(before);proposed[2].spec.dividerCompartments=3;proposed[2].spec.dividerOffsets=[-4,4];const replay=runOperation(proposed,{type:'replay',before,start:2});assert.equal(replay.features[2].analysis.divider.compartments,3);assert.deepEqual(replay.features[2].analysis.divider.offsets,[-4,4]);assert.equal(replay.features[3].outputs.length,2);validateProject({format:'forma-cad',version:1,features:replay.features});
console.log('PASS multiple dividers save/edit/replay through 180 mm print layout with two bodies on Z=0');
