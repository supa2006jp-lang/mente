import fs from 'node:fs/promises';import assert from 'node:assert/strict';import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';import * as R from 'replicad';
import {fuseSolids} from '../src/solid-fuse.js';import {finalizeUnion} from '../src/solid-union-result.js';import {runOperation,kernelBodies} from '../src/kernel.js';import {cadMesh} from '../src/cad-mesh.js';import {inspectCadStl} from '../src/stl-cad-inspection.js';
import {splitSolidSections} from '../src/solid-section-split.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));const dir='.sites-runtime/union-followup-commands';await fs.mkdir(dir,{recursive:true});const rows=[],close=(a,b)=>assert.ok(Math.abs(a-b)<=Math.max(1e-6,Math.abs(b)*1e-8),`${a} != ${b}`),count=(s,key)=>{const p=s[key];try{return p.length;}finally{p.forEach(v=>v.delete());}};
function inspect(output){const s=R.deserializeShape(output.brep).asShape3D();try{const c=new (R.getOC().BRepCheck_Analyzer)(s.wrapped,true,false);try{assert(c.IsValid());}finally{c.delete();}assert(inspectCadStl(output).report.ok,'closed export mesh');return R.measureVolume(s);}finally{s.delete();}}
const record=(id,s)=>({id,brep:s.serialize(),...cadMesh(s)}),parts=[R.makeBox([-20,-15,0],[0,15,30]),R.makeBox([0,-15,0],[20,15,30])],source=parts.map(s=>s.serialize()),events=[];
try{
 const normalized=fuseSolids(parts,{onProgress:e=>events.push(e)});try{assert.equal(count(normalized,'faces'),6);assert.equal(count(normalized,'edges'),12);close(R.measureVolume(normalized),36000);assert(events.some(e=>e.unionResult?.normalized));assert(inspectCadStl({brep:normalized.serialize()}).report.ok);}finally{normalized.delete();}
 parts.forEach((s,i)=>assert.equal(s.serialize(),source[i],'union and verification preserve input caches'));
 const gap=R.makeBox([.001,-15,0],[20,15,30]),separate=fuseSolids([parts[0],gap]);try{assert.equal(count(separate,'solids'),2,'real gaps stay separate');close(R.measureVolume(separate),36000-.001*30*30);}finally{gap.delete();separate.delete();}
 const tiny=R.makeBox([40,0,0],[40.01,.01,.01]),withTiny=fuseSolids([parts[0],tiny]);try{assert.equal(count(withTiny,'solids'),2,'tiny disconnected parts survive');close(R.measureVolume(withTiny),18000+1e-6);}finally{tiny.delete();withTiny.delete();}
 const initial=[{kind:'cadop',id:'seed',name:'結合前の2ボディ',outputs:parts.map((s,i)=>record(i?'b':'a',s)),remove:[]}];
 await fs.writeFile(dir+'/fixture.forma.json',JSON.stringify({format:'forma-cad',version:1,features:initial}));
 function apply(history,spec,expected){const before=JSON.stringify(history),preview=runOperation(history,{type:'preview',operation:spec}),result=runOperation(history,spec);assert.equal(JSON.stringify(history),before);assert.equal(preview.outputs.length,result.outputs.length);for(let i=0;i<result.outputs.length;i++)close(inspect(preview.outputs[i]),inspect(result.outputs[i]));if(expected!==undefined)close(result.outputs.reduce((v,o)=>v+inspect(o),0),expected);return [...history,{kind:'cadop',id:spec.id,name:spec.type,spec,...result}];}
 const joined=apply(initial,{type:'join',id:'join',target:'a',other:'b',combineMode:'結合',keepTools:'削除'},36000);
 // Branches exercise real application operations, not only native primitives.
 for(const mode of ['shell','fillet','cut']){
  let history=joined;
  if(mode==='shell')history=apply(history,{type:'shell',id:'hollow',target:'a',thickness:2,direction:'内側',faces:[{point:[0,0,30],normal:[0,0,1]}]},9792);
  if(mode==='fillet'){const r=1,A=38,B=28,C=28,expected=A*B*C+2*r*(A*B+B*C+C*A)+Math.PI*r*r*(A+B+C)+4*Math.PI*r**3/3;history=apply(history,{type:'fillet',id:'round',target:'a',radius:r},expected);}
  if(mode==='cut'){
   const tool=R.makeCylinder(3,30);try{history=[...history,{kind:'cadop',id:'tool',outputs:[record('tool',tool)],remove:[]}];}finally{tool.delete();}
   history=apply(history,{type:'join',id:'cut',target:'a',other:'tool',combineMode:'切り取り',keepTools:'削除'},36000-270*Math.PI);
  }
  const beforeSplit=history.at(-1).outputs.reduce((v,o)=>v+inspect(o),0);history=apply(history,{type:'split',id:'split-'+mode,target:'a',plane:'YZ',offset:0,keep:'both'},beforeSplit);
  const reloaded=JSON.parse(JSON.stringify(history)),bodies=kernelBodies(reloaded);try{assert.equal(bodies.size,2);close([...bodies.values()].reduce((v,s)=>v+R.measureVolume(s),0),beforeSplit);}finally{bodies.forEach(s=>s.delete());}
  const replay=runOperation(history,{type:'replay',before:history,start:0,forceFull:true}),replayed=kernelBodies(replay.features);try{close([...replayed.values()].reduce((v,s)=>v+R.measureVolume(s),0),beforeSplit);}finally{replayed.forEach(s=>s.delete());}
  rows.push({command:mode,previewCommitMatch:true,closedStl:true,splitVolumePreserved:true,reloadReplay:true});
 }
 // An old saved periodic surface previously broke under unconditional simplify.
 const legacy=JSON.parse(await fs.readFile('tests/fixtures/joined-revolution-section-failure.forma.json')),p=legacy.failure.request.spec,oldBodies=kernelBodies(legacy.failure.request.features),base=oldBodies.get(p.target),snapshot=base.serialize(),independent=R.deserializeShape(snapshot).asShape3D(),plane=new R.Plane([p.offset,0,0],[0,0,-1],[1,0,0]);let raw,clean;
 try{raw=independent.split(plane);clean=finalizeUnion(raw.positive);close(R.measureVolume(clean),R.measureVolume(raw.positive));assert.equal(count(clean,'solids'),count(raw.positive,'solids'));const check=new (R.getOC().BRepCheck_Analyzer)(clean.wrapped,true,false);try{assert(check.IsValid(),'normalization must not corrupt the periodic seam');}finally{check.delete();}const finished=splitSolidSections(base,plane);try{for(const s of [finished.positive,finished.negative])assert(inspectCadStl({brep:s.serialize()}).report.ok,'finished sections retain closed STL');}finally{finished.positive.delete();finished.negative.delete();}assert.equal(base.serialize(),snapshot);}finally{clean?.delete();raw?.positive?.delete();raw?.negative?.delete();raw?.on?.delete();independent.delete();plane.delete();oldBodies.forEach(s=>s.delete());}
 const proof={pass:true,normalizedPlanarUnion:true,realGapsPreserved:true,tinyPartsPreserved:true,sourceCachesUnchanged:true,periodicSeamProtected:true,rows};await fs.writeFile(dir+'/proof.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}finally{parts.forEach(s=>s.delete());}
