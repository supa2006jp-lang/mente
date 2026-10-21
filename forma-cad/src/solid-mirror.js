import * as R from 'replicad';
import * as THREE from 'three';
import {nativeMirrorPlane} from './mirror-reference.js';
import {fuseSolids} from './solid-fuse.js';

export function mirrorSolids(bodies,spec,emit,onProgress){
 const ids=[...new Set(spec.targets??[spec.target])];
 if(!ids.length||ids.some(id=>!bodies.has(id)))throw Error('ミラーするボディを選択してください');
 if(ids.length>60)throw Error('一度にミラーできるボディは60個までです');
 const mode=spec.mirrorMode==='複製'?'コピー':spec.mirrorMode||'コピー';
 if(!['コピー','反転移動','ミラー＋結合'].includes(mode))throw Error('ミラーの操作を選択してください');
 const exact=spec.mirrorFace?nativeMirrorPlane(bodies,spec.mirrorFace):null,p={...spec,...exact};
 const n=new THREE.Vector3(...(p.mirrorNormal||{XY:[0,0,1],XZ:[0,1,0],YZ:[1,0,0]}[p.plane]||[]));
 if(!Number.isFinite(p.offset??0)||!n.toArray().every(Number.isFinite)||n.lengthSq()<1e-12)throw Error('ミラーの基準面を選び直してください');
 n.normalize();const origin=new THREE.Vector3(...(p.mirrorOrigin||[0,0,0])).addScaledVector(n,p.offset||0);
 if(!origin.toArray().every(Number.isFinite))throw Error('ミラーの基準面の位置が不正です');
 const u=(Math.abs(n.x)<.9?new THREE.Vector3(1,0,0):new THREE.Vector3(0,1,0));u.addScaledVector(n,-u.dot(n)).normalize();
 const plane=new R.Plane(origin.toArray(),u.toArray(),n.toArray()),results=[];
 try{for(const [index,id] of ids.entries()){
  onProgress?.({stage:(index+1)+' / '+ids.length+' ボディをミラーしています'});
  const base=bodies.get(id);let mirrored,joined;
  try{
   mirrored=base.clone().mirror(plane);
   if(mode==='ミラー＋結合'&&R.measureDistanceBetween(base,mirrored)<=1e-7){
    joined=fuseSolids([base,mirrored],{onProgress});const parts=joined.solids;
    try{if(parts.length===1){emit(id,joined,id);results.push({bodyId:id,outputId:id,action:'joined'});continue;}}
    finally{parts.forEach(part=>part.delete());}
   }
   const outputId=mode==='反転移動'?id:index?spec.id+'-mirror-'+index:spec.id;
   emit(outputId,mirrored,id);results.push({bodyId:id,outputId,action:mode==='反転移動'?'moved':'copied'});
  }finally{joined?.delete();mirrored?.delete();}
 }}finally{plane.delete();}
 return {...(exact?{mirrorPlane:exact}:{}),mirrors:results};
}
