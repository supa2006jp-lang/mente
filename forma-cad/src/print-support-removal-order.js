import * as R from 'replicad';
import {inspectSupportRemoval} from './print-support-removal.js';
import {printSupportExportMesh} from './print-support-export-mesh.js';

const kerf=.04;
const bounds=shape=>{const box=shape.boundingBox;try{return box.bounds;}finally{box.delete();}};
const overlaps=(a,b)=>[0,1,2].every(i=>Math.min(a[1][i],b[1][i])-Math.max(a[0][i],b[0][i])>1e-6);

function splitSolid(solid,ribs,thickness,onProgress){
 const box=bounds(solid),local=ribs.filter(rib=>overlaps(box,rib.bounds));
 const axes=new Set(local.map(rib=>rib.axis)),axis=local[0]?.axis;
 if(axes.size!==1||![0,1].includes(axis))return {meshes:[printSupportExportMesh(solid)],cuts:[]};
 const centers=[...new Set(local.map(rib=>rib.center))].sort((a,b)=>a-b),planes=[];
 const other=1-axis;
 for(let i=1;i<centers.length;i++){
  if(centers[i]-centers[i-1]<=thickness+kerf*2)continue;
  const at=(centers[i]+centers[i-1])/2;
  if(at>box[0][axis]+kerf&&at<box[1][axis]-kerf)planes.push(at);
 }
 if(!planes.length)return {meshes:[printSupportExportMesh(solid)],cuts:[]};
 const meshes=[],cuts=[];
 for(const [index,to] of [...planes,box[1][axis]+1].entries()){
  const lo=box[0].map(v=>v-1),hi=box[1].map(v=>v+1);
  lo[axis]=index?planes[index-1]+kerf/2:box[0][axis]-1;
  hi[axis]=index<planes.length?to-kerf/2:to;
  onProgress?.({stage:'接合部を切り離した区画を作っています'});
  const slab=R.makeBox(lo,hi);
  let kept,solids=[];
  try{
   kept=solid.intersect(slab);solids=kept.solids;
   for(const part of solids)if(R.measureVolume(part)>1e-6)meshes.push(printSupportExportMesh(part));
  }finally{solids.forEach(part=>part.delete());kept?.delete();slab.delete();}
  if(index<planes.length)cuts.push({axis,at:to,span:[box[0][other],box[1][other]],height:[box[0][2],box[1][2]]});
 }
 return {meshes,cuts};
}

export function planSupportRemovalOrder(parts,obstacles,onProgress){
 const fixed=new Set(obstacles.map(part=>part.id));
 const remaining=new Set(parts.map(part=>part.id));
 const analyses=new Map();
 for(const [i,moving] of parts.entries()){
  onProgress?.({stage:'区画 '+(i+1)+' / '+parts.length+' の抜ける方向を調べています'});
  const nearby=[...obstacles,...parts.filter(part=>part!==moving)];
  const {directions}=inspectSupportRemoval({moving,obstacles:nearby,allDirections:true});
  analyses.set(moving.id,directions);
 }
 const steps=[];
 while(remaining.size){
  let selected;
  for(const id of remaining){
   for(const direction of analyses.get(id)){
    if(direction.state==='unknown'||direction.contacts.some(contact=>fixed.has(contact.id)||remaining.has(contact.id)))continue;
    const dependents=direction.contacts.length;
    if(!selected||direction.travel<selected.direction.travel||direction.travel===selected.direction.travel&&dependents<selected.dependents)
     selected={id,direction,dependents};
   }
  }
  if(!selected)break;
  remaining.delete(selected.id);
  steps.push({id:selected.id,direction:{...selected.direction,state:'clear',contacts:[],firstContact:null}});
 }
 return {steps,remaining:[...remaining].map(id=>({id,unknown:analyses.get(id).some(direction=>direction.state==='unknown')}))};
}

export function inspectSupportRemovalSections({brep,ribs,wallThickness,obstacles},onProgress){
 if(typeof brep!=='string'||!Array.isArray(ribs)||!Array.isArray(obstacles)||!obstacles.length||
  !Number.isFinite(wallThickness)||wallThickness<=0)throw Error('精密プレビューを作成してから区画を確認してください');
 const body=R.deserializeShape(brep).asShape3D(),solids=body.solids,parts=[],cuts=[];
 const ids=new Set(obstacles.map(obstacle=>obstacle.id));
 try{
  for(const solid of solids){
   const section=splitSolid(solid,ribs.filter(rib=>!rib.excluded),wallThickness,onProgress);
   cuts.push(...section.cuts);
   for(const mesh of section.meshes){
    const number=parts.length+1;
    let id='removal-section-'+number;
    while(ids.has(id))id='_'+id;
    parts.push({id,number,...mesh});ids.add(id);
   }
   if(parts.length+obstacles.length>101)
    throw Error('区画が多いため一度に確認できません。面または対象ボディを絞ってください');
  }
  if(!parts.length)throw Error('取り外しを確認する区画が見つかりませんでした');
  return {parts,cuts,...planSupportRemovalOrder(parts,obstacles,onProgress)};
 }finally{solids.forEach(solid=>solid.delete());body.delete();}
}
