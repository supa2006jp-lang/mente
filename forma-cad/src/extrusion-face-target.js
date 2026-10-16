import {basisFor} from './frames.js';

// The destination is a world-space plane position. Keeping its coordinates
// lets each selected profile calculate its own signed distance to that plane.
export function depthToFacePlane(feature,plane){
 if(!plane||!Array.isArray(plane.normal)||plane.normal.length!==3||plane.normal.some(v=>!Number.isFinite(v))||Math.abs(Math.hypot(...plane.normal)-1)>1e-5||!Number.isFinite(plane.offset)||Math.abs(plane.offset)>100000)throw Error('到達先の面の位置が不正です');
 const n=basisFor(feature.region||feature).n,alignment=n.toArray().reduce((sum,v,i)=>sum+v*plane.normal[i],0);
 if(Math.abs(alignment)<1-1e-6)throw Error('押し出し開始面と平行な平面を到達先に選択してください');
 const start=feature.region?feature.region.offset:n.x*feature.x+n.y*feature.y+n.z*feature.z,depth=plane.offset/alignment-start;
 if(!Number.isFinite(depth)||Math.abs(depth)<.1)throw Error('開始面と同じ位置です。0.1 mm以上離れた面を選択してください');
 if(Math.abs(depth)>10000)throw Error('到達先までの距離は10000 mm以下にしてください');
 return feature.symmetric?Math.abs(depth):depth;
}
