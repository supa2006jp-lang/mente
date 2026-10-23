import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {defaults} from '../src/geometry.js';
import {findRegions,regionContains} from '../src/regions.js';
import {runOperation,kernelBodies} from '../src/kernel.js';
import {selectedCadFaces} from '../src/face-pull.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const sketches=[-50,-20].map((x,i)=>({...defaults,id:'circle-'+i,kind:'sketch',profile:'circle',diameter:60,x,groupId:'circle-'+i,groupHidden:true})),region=findRegions(sketches).find(r=>regionContains(r,[-35,0]));
const feature={...defaults,id:'lens',kind:'extrusion',name:'円の重なり',profile:'region',depth:45,region},result=runOperation(sketches,{type:'extrusion',feature}),features=[...sketches,{...feature,cadResult:result}],snapshot=JSON.stringify(features),bodies=kernelBodies(features),base=bodies.get('lens'),before=R.measureVolume(base),dir='outputs/shell-short-arc-junctions/';
await fs.mkdir(dir,{recursive:true});await fs.writeFile(dir+'fixture.forma.json',JSON.stringify({format:'forma-cad',version:1,units:'mm',features}));
const p={type:'shell',id:'s',target:'lens',thickness:.4,direction:'内側',faces:[{bodyId:'lens',point:[-35,0,45],normal:[0,0,1]}]},faces=selectedCadFaces(base,p.faces);
let original;try{original=base.shell(.4,ff=>ff.inList(faces));assert.ok(Math.abs(R.measureVolume(original)-before)<1e-6,'reproduce the default offset returning the unchanged solid');}finally{original?.delete();faces.forEach(f=>f.delete());}
const distance=(point,shape)=>{const vertex=R.makeVertex(point);try{return R.measureDistanceBetween(vertex,shape);}finally{vertex.delete();}};
for(const thickness of [.4,1,2])for(const both of [false,true]){
 const spec={...p,thickness,faces:[...p.faces,...(both?[{bodyId:'lens',point:[-35,0,0],normal:[0,0,-1]}]:[])]},out=runOperation(features,spec),shape=R.deserializeShape(out.outputs[0].brep).asShape3D(),check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false),parts=shape.solids;
 try{
  assert.ok(check.IsValid());assert.equal(parts.length,1);assert.ok(R.measureVolume(shape)>0&&R.measureVolume(shape)<before);
  assert.ok(Math.abs(distance([-50+thickness+1,0,22.5],shape)-1)<1e-6,'cylindrical wall is exactly the requested thickness');
  assert.ok(distance([-35,0,45],shape)>1,'selected end is open');
  if(both)assert.ok(distance([-35,0,0],shape)>1,'second selected end is open');
  else assert.ok(Math.abs(distance([-35,0,thickness+1],shape)-1)<1e-6,'floor is exactly the requested thickness');
  const bb=base.boundingBox,sb=shape.boundingBox;try{for(let i=0;i<2;i++)for(let j=0;j<3;j++)assert.ok(Math.abs(bb.bounds[i][j]-sb.bounds[i][j])<1e-6,'external dimensions remain unchanged');}finally{bb.delete();sb.delete();}
  if(thickness===.4&&!both)await fs.writeFile(dir+'result.forma.json',JSON.stringify({format:'forma-cad',version:1,units:'mm',features:[...features,{kind:'cadop',id:'s',name:'シェル',spec,...out}]}));
 }finally{check.delete();parts.forEach(s=>s.delete());shape.delete();}
}
assert.throws(()=>runOperation(features,{...p,thickness:20}));assert.equal(JSON.stringify(features),snapshot);bodies.forEach(s=>s.delete());
const proof={defaultNoOpReproduced:true,thinWallRecovered:true,severalThicknesses:true,oneAndTwoOpenings:true,exactCylindricalWallThickness:true,exactFloorThickness:true,outerDimensionsPreserved:true,validSingleSolid:true,oversizedThicknessRejected:true,sourceUnchanged:true};await fs.writeFile(dir+'native-proof.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
