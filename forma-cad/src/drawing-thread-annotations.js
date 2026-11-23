import {adjustedDrawingThreadLabel} from './drawing-dimensions.js';

const mm=value=>Number(value.toFixed(4));
const designation=thread=>'M'+mm(thread.diameter)+'×'+mm(thread.pitch);
const hand=thread=>thread.leftHand?'左ねじ':'右ねじ';
const pitch=thread=>'ピッチ '+mm(thread.pitch)+' mm';
const adjustedBore=thread=>thread.adjustedDiameter===undefined?'':adjustedDrawingThreadLabel(
 Number(thread.adjustedDiameter.toFixed(3)),thread.diameter);

export function drawingThreadTableText(thread){
 const bore=adjustedBore(thread);
 return (bore?bore+'\n'+pitch(thread):designation(thread))+' / '+mm(thread.length)+' mm / '+hand(thread);
}
export function drawingThreadNoteText(thread){
 const bore=adjustedBore(thread),size=bore?bore+'\n'+pitch(thread):designation(thread);
 return size+'\nねじ深さ '+mm(thread.length)+' mm · '+hand(thread)+
  (thread.offset?'\n入口から '+mm(thread.offset)+' mm':'');
}

export function drawingThreadReference({id,bodyId,end}){
 return {id,bodyId,end};
}

export function validDrawingThreadReference(ref){
 return ref===undefined||ref&&[ref.id,ref.bodyId].every(id=>typeof id==='string'&&id.length>0&&id.length<=100)&&
  ['low','high'].includes(ref.end);
}

export function sameDrawingThread(a,b){
 return a&&b&&a.id===b.id&&a.bodyId===b.bodyId&&a.end===b.end;
}

export function drawingThreadLeader(view,hole,at){
 const radius=hole.counterbore?.radius??hole.radius;
 const x=at[0]-hole.center[0],y=at[1]-hole.center[1],dist=Math.hypot(x,y);
 const direction=dist>1e-6?[x/dist,y/dist]:[1,0];
 return {view,anchor:hole.center.map((n,i)=>n+radius*direction[i]),at,text:drawingThreadNoteText(hole.thread),
  threadRef:drawingThreadReference(hole.thread)};
}

export function reconcileDrawingThreadLeaders(leaders,views){
 return leaders.map(note=>{
  if(!note.threadRef)return note;
  const hole=views[note.view]?.holeMachining?.find(row=>sameDrawingThread(note.threadRef,row.thread));
  if(!hole)return {...note,review:true};
  const {review,...leader}=note;
  return {...leader,...drawingThreadLeader(note.view,hole,note.at)};
 });
}
