import * as R from 'replicad';
import {patternCavityEntries} from './pattern-cavity-selection.js';
import {circularPositions,selectedCavityEntries} from './circular-pattern-options.js';

const bounds=shape=>{const box=shape.boundingBox;try{return box.bounds;}finally{box.delete();}};
const lowerDistance=(a,b)=>Math.hypot(...a[0].map((v,i)=>Math.max(0,v-b[1][i],b[0][i]-a[1][i])));
// Measure actual cavity solids, including blind-hole depth, rather than their
// projected circles or bounding boxes. Boxes only prune impossible minima.
export function circularPatternSpacing(base,p,onProgress){
 const positions=circularPositions(p),origin=p.origin||[0,0,0],axis=p.axisVector||{X:[1,0,0],Y:[0,1,0],Z:[0,0,1]}[p.axis]||[0,0,1];
 if(![origin,axis].every(v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite))||Math.hypot(...axis)<1e-8)throw Error('回転中心と回転軸を指定してください');
 const entries=patternCavityEntries(base,onProgress),copies=[];let tool;
 try{
  const selected=selectedCavityEntries(entries,p),rotated=p.operation==='切り取りのみ'?selected:entries;
  if(entries.length+rotated.length*positions.length>200)throw Error('穴間の確認は200配置以内にしてください。穴か配置数を減らしてください');
  for(const entry of entries)copies.push({...entry,position:0,owned:false});
  for(const position of positions)for(const entry of rotated){const shape=entry.shape.clone().rotate(p.angle*position/p.count,origin,axis);copies.push({...entry,shape,bounds:bounds(shape),position,owned:true});}
  if(copies.length<2)return {status:'insufficient',minimum:null,pair:[],holeCount:copies.length};
  const pairs=[];for(let i=0;i<copies.length;i++)for(let j=i+1;j<copies.length;j++)pairs.push({i,j,lower:lowerDistance(copies[i].bounds,copies[j].bounds)});
  pairs.sort((a,b)=>a.lower-b.lower);tool=new R.DistanceTool();let minimum=Infinity,pair=[];
  for(const [index,item]of pairs.entries()){
   if(item.lower>minimum+1e-7)break;
   onProgress?.({stage:'穴間の最短距離を測定しています',current:index+1,total:pairs.length});
   const a=copies[item.i],b=copies[item.j],distance=tool.distanceBetween(a.shape,b.shape);if(!Number.isFinite(distance)||distance< -1e-7)throw Error('穴間の距離を測定できませんでした');
   if(distance<minimum){minimum=Math.max(0,distance);pair=[a,b].map(({key,label,position})=>({key,label,position}));}
   if(minimum<=1e-6)break;
  }
  return {status:minimum<=1e-6?'connected':minimum<1?'thin':'clear',minimum,pair,holeCount:copies.length};
 }finally{tool?.delete();for(const copy of copies)if(copy.owned)copy.shape.delete();entries.forEach(entry=>entry.shape.delete());}
}
