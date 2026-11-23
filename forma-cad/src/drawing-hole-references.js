import {basisFor} from './frames.js';
import {drawingProjections} from './drawing-view-preferences.js';
import {drawingTableHoles} from './drawing-hole-table.js';
import {machiningSuppressed} from './machining-suppression.js';
import {drawingThreadReference,sameDrawingThread,validDrawingThreadReference} from './drawing-thread-annotations.js';

const epsilon=1e-4;
const distance=(a,b)=>Math.hypot(a.center[0]-b.center[0],a.center[1]-b.center[1]);
const sameRadius=(a,b)=>Math.abs(a-b)<epsilon;
const sameRim=(old,hole)=>distance(old,hole)<epsilon&&(sameRadius(old.radius,hole.radius)||
 hole.machining?.counterbore&&sameRadius(old.radius,hole.machining.counterbore.radius));
const dot=(p,axis)=>p.reduce((value,n,i)=>value+n*axis[i],0);
export function holeAnchor({center,radius,sourceId,threadRef,machining}){
 const thread=machining?.thread?drawingThreadReference(machining.thread):threadRef;
 return {center:[...center],radius,...(sourceId?{sourceId}:{}),...(thread?{threadRef:thread}:{})};
}
export const lastHoleNumber=table=>Math.max(table?.lastNumber??0,...(table?.holes??[]).map((h,i)=>h.number??i+1));
export function unlistedDrawingHoles(table,candidates){
 return candidates.filter(hole=>!table.holes.some(row=>
  row.sourceId&&row.sourceId===hole.sourceId||sameDrawingThread(row.threadRef,hole.machining?.thread)||!row.review&&sameRim(row,hole)));
}

export function drawingHoleCandidates(view,name,features,targets,frontFrame){
 if(!view)return [];
 return associateDrawingHoleSources(drawingTableHoles(view),name,features,targets,frontFrame);
}

export function associateDrawingHoleSources(holes,name,features,targets,frontFrame){
 const projection=drawingProjections[name];
 if(!holes.length||!projection)return holes;
 const sources=new Map();
 const drawingPoint=p=>frontFrame?[dot(p,frontFrame.u),dot(p,frontFrame.v),dot(p,frontFrame.n)]:p;
 for(const f of features){
  if(f.kind!=='extrusion'||f.profile!=='circle'||f.operation!=='cut'||machiningSuppressed(f)||f.symmetric||f.taperAngle||!targets.includes(f.target)||
   typeof f.id!=='string'||!f.id.length||f.id.length>200)continue;
  const n=drawingPoint(basisFor(f).n.toArray()),side=dot(n,projection.normal)*(-Math.sign(f.depth));
  if(Math.abs(side)<1-1e-7)continue;
  const p=drawingPoint([f.x,f.y,f.z]),center=[dot(p,projection.horizontal),dot(p,projection.vertical)];
  const level=dot(p,projection.normal);
  const match=holes.filter(h=>{
   if(!h.machining||distance({center},h)>=epsilon||!sameRadius(f.diameter/2,h.radius))return false;
   const travel=h.machining.entryLevel-level;
   return side>0?Math.abs(travel)<epsilon:h.machining.through&&travel>0&&(f.throughAll||travel<=Math.abs(f.depth)+epsilon);
  });
  if(match.length===1)sources.set(match[0],sources.has(match[0])?null:f.id);
 }
 return holes.map(h=>sources.get(h)?{...h,sourceId:sources.get(h)}:h);
}

const validSourceId=id=>typeof id==='string'&&id.length>0&&id.length<=200;
export function validDrawingHoleCenterReference(ref){
 return !!ref&&!Array.isArray(ref)&&Object.keys(ref).every(key=>key==='sourceId'||key==='threadRef')&&
  (ref.sourceId!==undefined||ref.threadRef!==undefined)&&
  (ref.sourceId===undefined||validSourceId(ref.sourceId))&&validDrawingThreadReference(ref.threadRef);
}

export function drawingHoleCenterReference(hole){
 const ref={};
 if(validSourceId(hole.sourceId))ref.sourceId=hole.sourceId;
 if(hole.machining?.thread){
  const thread=drawingThreadReference(hole.machining.thread);
  if(validDrawingThreadReference(thread))ref.threadRef=thread;
 }
 return ref.sourceId||ref.threadRef?ref:undefined;
}

export function resolveDrawingHoleCenter(candidates,ref){
 const bySource=ref.sourceId?candidates.filter(hole=>hole.sourceId===ref.sourceId):[];
 if(bySource.length===1)return bySource[0].center;
 const byThread=ref.threadRef?candidates.filter(hole=>sameDrawingThread(ref.threadRef,hole.machining?.thread)):[];
 return byThread.length===1?byThread[0].center:null;
}

export function sameDrawingHoleCenterReference(a,b){
 if(!a||!b)return a===b;
 return a.sourceId===b.sourceId&&(!a.threadRef&&!b.threadRef||sameDrawingThread(a.threadRef,b.threadRef));
}

// Feature identity takes precedence over positions, including when equal-sized holes swap places.
// For geometry-only rows keep an inventory of unselected circles as well. An existing neighbour
// must never acquire the number of a hole that disappeared.
export const holeReferenceLimit=256;
export function holeReferenceInventory(candidates){
 return candidates.length<=holeReferenceLimit?candidates.map(holeAnchor):undefined;
}
export function reconcileHoleTable(table,candidates,viewBox,{targetsChanged=false,exactOnly=false}={}){
 const {review:legacyReview,references:oldReferences,...rest}=table;
 let rows=table.holes;
 if(!exactOnly&&!oldReferences&&rows.every(row=>row.number===undefined)){
  const seen=new Set();
  rows=rows.filter(row=>{
   const bore=candidates.find(h=>h.machining?.counterbore&&sameRim(row,h));
   if(!bore)return true;
   if(seen.has(bore))return false;
   seen.add(bore);return true;
  });
 }
 const claimed=new Set(),matches=new Map();
 function matchUnique(row,choices){
  if(choices.length===1&&!claimed.has(choices[0])){
   claimed.add(choices[0]);matches.set(row,choices[0]);
  }
 }
 for(const row of rows)if(row.sourceId)matchUnique(row,candidates.filter(h=>h.sourceId===row.sourceId));
 for(const row of rows)if(row.threadRef&&!matches.has(row))matchUnique(row,candidates.filter(h=>sameDrawingThread(row.threadRef,h.machining?.thread)));
 if(!targetsChanged){
  for(const row of rows)if(!row.sourceId&&!row.review)matchUnique(row,candidates.filter(h=>sameRim(row,h)));
 }
 if(!targetsChanged&&!exactOnly){
  const unmatched=rows.filter(row=>!row.sourceId&&!matches.has(row));
  const free=candidates.filter(h=>!claimed.has(h)&&!oldReferences?.some(old=>sameRim(old,h)));
  const limit=.2*Math.hypot(viewBox?.[2]??0,viewBox?.[3]??0);
  // Without an inventory (older drawings), require one missing and one possible new circle.
  const oldMissing=oldReferences?.filter(old=>!candidates.some(h=>sameRim(old,h)))??unmatched;
  if(oldReferences||unmatched.length===1&&free.length===1){
   const possible=(old,h)=>distance(old,h)<epsilon||sameRadius(old.radius,h.radius)&&distance(old,h)<=limit;
   for(const row of unmatched){
    if(row.review||legacyReview)continue;
    const choices=free.filter(h=>possible(row,h)&&oldMissing.filter(old=>possible(old,h)).length===1);
    matchUnique(row,choices);
   }
  }
 }
 const holes=rows.map((row,index)=>{
  const next=matches.get(row);
  return {number:row.number??index+1,...holeAnchor(next??row),...(!next?{review:true}:{})};
 });
 return {...rest,holes,references:holeReferenceInventory(candidates)};
}
