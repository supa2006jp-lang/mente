import * as R from 'replicad';
import {basisFor} from './frames.js';
import {nativeSketchFeature} from './native-sketch-arcs.js';

function faceSignature(shape){
 const faces=shape.faces;
 try{return faces.map(face=>{
  const edges=face.edges;
  try{return face.geomType+':'+edges.map(edge=>{
   const points=[0,.25,.5,.75,1].map(t=>{const p=edge.pointAt(t);try{return p.toTuple().map(v=>Math.round(v*1e7)).join(',');}finally{p.delete();}});
   return edge.geomType+':'+[points.join(';'),points.reverse().join(';')].sort()[0];
  }).sort().join('|');}finally{edges.forEach(edge=>edge.delete());}
 }).sort().join('\n');}finally{faces.forEach(face=>face.delete());}
}
function faceCount(shape){const faces=shape.faces;try{return faces.length;}finally{faces.forEach(face=>face.delete());}}
function valid(shape){const check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);try{return check.IsValid();}finally{check.delete();}}

// Recover only a verifiable sketch extrusion followed by cap shelling and
// rigid moves. Cuts, joins, imported solids and other histories are left alone.
// Original history/BREP is never rewritten; the fillet owns the returned shape.
export function legacyArcBody(features,id,current,{makeSolid,run,onProgress}={}){
 if(faceCount(current)<12)return null;
 const index=features.findIndex(f=>f.id===id&&f.kind!=='sketch'&&f.operation==='new'&&f.profile==='region');
 if(index<0)return null;
 const source=features[index];
 if(source.mode!=='solid'||source.taperAngle||source.symmetric||source.overlapOnly||source.untilSolid||source.barrier||source.holesOnly||source.region?.bodyId||source.region?.cadFace)return null;
 const recovered=nativeSketchFeature(source,features.slice(0,index));
 if(recovered===source)return null;
 const stages=[];let moved=false;
 for(const f of features.slice(index+1)){
  const output=f.cadResult||(f.kind==='cadop'?f:null),touches=output?output.outputs?.some(o=>o.id===id)||output.remove?.includes(id):f.kind!=='sketch'&&f.operation!=='new'&&f.target===id;
  if(!touches)continue;
  const p=f.spec;
  if(!p||p.target!==id||p.targets?.some(target=>target!==id)||output.remove?.includes(id))return null;
  if(p.type==='shell'){
   if(moved||stages.some(p=>p.type==='shell')||!p.faces?.length||p.faces.some(face=>!face.normal||Math.abs(basisFor(source.region).n.dot({x:face.normal[0],y:face.normal[1],z:face.normal[2]}))<1-1e-7))return null;
  }else if(p.type==='move'&&!p.copy&&p.moveMode!=='複製して移動')moved=true;
  else return null;
  stages.push(p);if(stages.length>8)return null;
 }
 let original,shape;
 try{
  original=makeSolid(source);shape=makeSolid(recovered);
  if(faceCount(original)-faceCount(shape)<8)return null;
  onProgress?.({stage:'元のスケッチから円弧の輪郭を復元しています'});
  const apply=(solid,spec)=>{
   const result=run([{kind:'cadop',id:'arc-repair-source',name:'arc-repair-source',outputs:[{id,brep:solid.serialize()}],remove:[]}],spec),output=result.outputs.find(o=>o.id===id);
   if(!output?.brep)throw Error('missing recovered body');return R.deserializeShape(output.brep).asShape3D();
  };
  for(const spec of stages){const oldNext=apply(original,spec);original.delete();original=oldNext;const next=apply(shape,spec);shape.delete();shape=next;}
  if(faceSignature(original)!==faceSignature(current)||!valid(shape))return null;
  const before=R.measureVolume(current),after=R.measureVolume(shape);
  if(!(after>0)||Math.abs(before-after)>Math.max(.001,Math.abs(before)*.005))return null;
  const sources=recovered.region._nativeArcSources,maxDeviation=Math.max(...sources.flatMap(source=>source.points.slice(1).map((p,i)=>{const a=source.points[i],chord=Math.hypot(p[0]-a[0],p[1]-a[1]);return source.radius-Math.sqrt(Math.max(0,source.radius**2-chord**2/4));})));
  const a=current.boundingBox,b=shape.boundingBox;
  try{if(a.bounds.some((point,i)=>point.some((v,j)=>Math.abs(v-b.bounds[i][j])>maxDeviation*2+1e-5)))return null;}finally{a.delete();b.delete();}
  const info={sourceFeatureId:source.id,beforeFaces:faceCount(current),afterFaces:faceCount(shape),maxDeviation};
  const result=shape;shape=null;return {shape:result,info};
 }catch(error){if(error instanceof WebAssembly.RuntimeError)throw error;return null;}
 finally{original?.delete();shape?.delete();}
}
