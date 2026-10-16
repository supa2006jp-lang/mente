import * as R from 'replicad';
import {cutWithClearance} from './cut-clearance.js';
import {validateExtrusionBarrier} from './extrusion-barrier-options.js';

// Keep the source/join anchor connected. All other bodies are immutable barriers.
// A true surface offset creates clearance around sides and corners as well.
export function barrierExtrusion(tool,bodies,f){
 validateExtrusionBarrier(f);
 const gap=f.barrierGap??.4,source=f.region?.cadFace?.bodyId||f.region?.bodyId||f.region?.gridSourceBodyId;
 const blockers=[...bodies].filter(([id,shape])=>id!==source&&!(f.operation==='join'&&id===f.target)&&R.measureDistanceBetween(tool,shape)<=gap+1e-6).map(([,shape])=>shape);
 if(!blockers.length)return tool.clone();
 let result;
 try{
  result=cutWithClearance(tool,blockers,gap);
  const check=new (R.getOC().BRepCheck_Analyzer)(result.wrapped,true,false);
  try{if(!check.IsValid()||!Number.isFinite(R.measureVolume(result))||R.measureVolume(result)<=1e-9)throw Error('障害物とすき間で押し出し形状がなくなるか、不正になります。距離・すき間を調整してください');}finally{check.delete();}
  for(const blocker of blockers)if(R.measureDistanceBetween(result,blocker)<gap-1e-5)throw Error('指定したバリアのすき間を確保できませんでした。すき間を小さくするか、障害物の形状を確認してください');
  const output=result;result=null;return output;
 }finally{result?.delete();}
}
