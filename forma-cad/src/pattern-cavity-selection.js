import * as R from 'replicad';
import {patternCavities} from './pattern-cavities.js';
const bounds=s=>{const box=s.boundingBox;try{return box.bounds;}finally{box.delete();}},touch=(a,b)=>a[0].every((lo,i)=>lo<=b[1][i]+1e-6&&a[1][i]>=b[0][i]-1e-6);
// Join adjacent sections of one stepped hole before presenting a selection.
// Stable geometric keys survive save/reload; a changed hole needs reselection.
export function patternCavityEntries(base,onProgress){
 const shapes=patternCavities(base,onProgress);let completed=false;
 try{
  for(let i=0;i<shapes.length;i++)for(let j=i+1;j<shapes.length;j++){
   if(!touch(bounds(shapes[i]),bounds(shapes[j])))continue;let joined;
   try{joined=shapes[i].fuse(shapes[j]);const parts=joined.solids;let connected;try{connected=parts.length===1;}finally{parts.forEach(s=>s.delete());}if(!connected)continue;shapes[i].delete();shapes[j].delete();shapes[i]=joined;joined=null;shapes.splice(j,1);j=i;}
   finally{joined?.delete();}
  }
  const entries=shapes.map(shape=>{const box=bounds(shape),volume=Math.abs(R.measureVolume(shape)),point=box[0].map((v,i)=>(v+box[1][i])/2),key=[...box.flat(),volume].map(v=>Math.round(v*1e5)/1e5).join(':');return {shape,key,bounds:box,point,volume};});
  entries.sort((a,b)=>a.point[0]-b.point[0]||a.point[1]-b.point[1]||a.point[2]-b.point[2]||a.volume-b.volume);
  completed=true;return entries.map((e,i)=>({...e,label:'穴・くぼみ '+(i+1)}));
 }finally{if(!completed)shapes.forEach(s=>s.delete());}
}
