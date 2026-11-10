import * as R from 'replicad';
import {skinClearanceError} from './print-support-skin-clearance.js';
const bounds=shape=>{const b=shape.boundingBox;try{return b.bounds;}finally{b.delete();}};
const overlap=(a,b)=>{const common=a.intersect(b);try{return R.measureVolume(common);}finally{common.delete();}};

// Bridge only between the outermost fins: the roof must not cantilever beyond
// them. Intersect with the original inset prism to preserve its outline/holes.
export function makeWallRoof(records,prism,bodies,p,top,onProgress){
 if(records.length<2)return null;
 const thickness=p.roofLayers*p.layerHeight,b=bounds(prism),axis=records[0].axis;
 if(top-thickness<=p.bedZ+p.layerHeight)throw skinClearanceError('薄皮を置く高さが足りません。薄皮の層数を減らしてください','upper',top,thickness);
 const low=[b[0][0]-1,b[0][1]-1,top-thickness],high=[b[1][0]+1,b[1][1]+1,top+1];
 low[axis]=Math.min(...records.map(r=>r.center))-p.wallThickness/2;high[axis]=Math.max(...records.map(r=>r.center))+p.wallThickness/2;
 const slab=R.makeBox(low,high);let roof;
 try{
  onProgress?.({stage:'リブ上面の薄皮を作成しています'});roof=prism.intersect(slab);
  for(const model of bodies.values()){
   const collision=roof.intersect(model);
   try{if(R.measureVolume(collision)>.0001)throw skinClearanceError('上面の薄皮が本体・別のボディに干渉します。対象面を選び直すか薄皮をオフにしてください','upper',top,thickness,collision);}
   finally{collision.delete();}
  }
  const parts=roof.solids;
  try{for(const part of parts){let contacts=0;for(const record of records)if(overlap(part,record.shape)>.0001)contacts++;if(contacts<2)throw Object.assign(Error('薄皮を両側から支えるリブがありません。薄壁の間隔を狭くするか薄皮をオフにしてください'),{code:'support-skin-anchor'});}if(!parts.length)throw Error('上面の薄皮を作成できません');}finally{parts.forEach(s=>s.delete());}
  const answer=roof;roof=null;return answer;
 }finally{roof?.delete();slab.delete();}
}
