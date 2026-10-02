import {basisFor} from './frames.js';
export function throughDepth(f,bounds){
 const n=basisFor(f.region||f).n,origin=f.region?f.region.offset:n.x*f.x+n.y*f.y+n.z*f.z,sign=Math.sign(f.depth)||1;
 let far=0;for(const x of [bounds[0][0],bounds[1][0]])for(const y of [bounds[0][1],bounds[1][1]])for(const z of [bounds[0][2],bounds[1][2]])far=Math.max(far,sign*(n.x*x+n.y*y+n.z*z-origin));
 return sign*Math.max(.1,far+.1);
}

export function depthToGridPlane(feature, gridPlane){
 if(!['XY','XZ','YZ'].includes(gridPlane))throw Error('到達先の基準グリッドを XY・XZ・YZ から選択してください。');
 const normal=basisFor(feature.region||feature).n,gridNormal=basisFor({plane:gridPlane}).n;
 const alignment=normal.dot(gridNormal);
 if(!Number.isFinite(alignment)||Math.abs(alignment)<1-1e-6)throw Error('押し出し面と基準グリッドが平行ではないため、グリッド位置まで押し出せません。');
 const offset=feature.region?feature.region.offset:normal.x*feature.x+normal.y*feature.y+normal.z*feature.z;
 const depth=-offset;
 if(!Number.isFinite(depth))throw Error('押し出し開始位置が不正です。');
 if(Math.abs(depth)<.1)throw Error('押し出し開始面がグリッド上、または距離が 0.1 mm 未満です。');
 if(Math.abs(depth)>10000)throw Error('グリッドまでの押し出し距離は 10000 mm 以下にしてください。');
 return depth;
}
