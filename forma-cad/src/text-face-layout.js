import * as THREE from 'three';
import Clipper from 'clipper-lib';
import {planarFace,worldPoint} from './frames.js';
import {preciseGeometry} from './cad-coordinates.js';
import {cadFaceGroup} from './face-selection.js';
const bounds=rings=>{const points=rings.flat();return {min:[0,1].map(i=>Math.min(...points.map(p=>p[i]))),max:[0,1].map(i=>Math.max(...points.map(p=>p[i])))};};
export function textInkRings(layout){const a=layout.angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a),rings=layout.localContours||[{points:[[layout.localBounds.min[0],layout.localBounds.min[1]],[layout.localBounds.max[0],layout.localBounds.min[1]],layout.localBounds.max,[layout.localBounds.min[0],layout.localBounds.max[1]]],hole:false}];return rings.map(r=>({hole:r.hole,points:r.points.map(([x,y])=>[layout.u+x*c-y*s,layout.v+x*s+y*c])}));}
export function faceInFrame(region,frame){const axes=['u','v'].map(key=>new THREE.Vector3(...frame[key])),ring=points=>points.map(p=>{const w=worldPoint(region,p);return axes.map(axis=>w.dot(axis));});return {outer:ring(region.outer),holes:region.holes.map(ring)};}
function validFace(face){return face&&Array.isArray(face.outer)&&Array.isArray(face.holes)&&face.holes.length<=150&&[face.outer,...face.holes].reduce((n,r)=>n+(Array.isArray(r)?r.length:20001),0)<=20000&&[face.outer,...face.holes].every(r=>Array.isArray(r)&&r.length>=3&&r.every(p=>Array.isArray(p)&&p.length===2&&p.every(n=>Number.isFinite(n)&&Math.abs(n)<=100000)));}
export function createTextFaceResolver({getMeshes=()=>[]}){
 const cache=new WeakMap();return placement=>{if(validFace(placement.face))return placement.face;if(!placement.bodyId||!Number.isInteger(placement.faceIndex))return null;const mesh=getMeshes().find(m=>m.userData.bodyId===placement.bodyId);if(!mesh)return null;mesh.updateWorldMatrix(true,false);const geometry=mesh.geometry,group=cadFaceGroup(geometry,placement.faceIndex),key=JSON.stringify([group?.faceId??placement.faceIndex,placement.frame,...mesh.matrixWorld.elements]);let faces=cache.get(geometry);if(!faces){faces=new Map();cache.set(geometry,faces);}if(faces.has(key))return faces.get(key);const world=preciseGeometry(geometry);try{world.applyMatrix4(mesh.matrixWorld);const face=faceInFrame(planarFace(world,placement.faceIndex),placement.frame);faces.set(key,face);return face;}catch{return null;}finally{world.dispose();}};
}
export function alignTextToFace(layout,face,{horizontal='free',vertical='free',margin=0}={}){
 const text=bounds(textInkRings(layout).map(r=>r.points)),target=bounds([face.outer]),delta=(axis,mode)=>mode==='center'?(target.min[axis]+target.max[axis]-text.min[axis]-text.max[axis])/2:mode==='min'?target.min[axis]+margin-text.min[axis]:mode==='max'?target.max[axis]-margin-text.max[axis]:0;
 return {u:layout.u+delta(0,horizontal),v:layout.v+delta(1,vertical)};
}
export function snapTextToFace(layout,face,{margin=0,tolerance=1,enabled=true}={}){
 const result={u:layout.u,v:layout.v,guides:[]};if(!enabled||!face)return result;
 for(const [axis,key] of [[0,'u'],[1,'v']]){const candidates=['center','min','max'].map(mode=>{const value=alignTextToFace(layout,face,{horizontal:axis===0?mode:'free',vertical:axis===1?mode:'free',margin})[key];return {mode,value,distance:Math.abs(value-layout[key])};}).sort((a,b)=>a.distance-b.distance);if(candidates[0].distance<=tolerance){result[key]=candidates[0].value;result.guides.push({axis,mode:candidates[0].mode});}}
 return result;
}
const SCALE=100000;
function paths(rings){return rings.map(r=>{const path=r.points.map(([x,y])=>({X:Math.round(x*SCALE),Y:Math.round(y*SCALE)}));if(Clipper.Clipper.Orientation(path)===!!r.hole)path.reverse();return path;});}
export function textFaceFit(layout,face,margin=0){
 if(!face)return null;if(!Number.isFinite(margin)||margin<0||margin>1000)throw Error('端からの余白は0〜1000 mmで指定してください');
 let area=paths([{points:face.outer,hole:false},...face.holes.map(points=>({points,hole:true}))]);if(margin){const offset=new Clipper.ClipperOffset(2);offset.AddPaths(area,Clipper.JoinType.jtMiter,Clipper.EndType.etClosedPolygon);area=[];offset.Execute(area,-margin*SCALE);}
 const clip=new Clipper.Clipper(),outside=[];clip.AddPaths(paths(textInkRings(layout)),Clipper.PolyType.ptSubject,true);if(area.length)clip.AddPaths(area,Clipper.PolyType.ptClip,true);clip.Execute(Clipper.ClipType.ctDifference,outside,Clipper.PolyFillType.pftNonZero,Clipper.PolyFillType.pftNonZero);const outsideArea=Math.abs(outside.reduce((sum,path)=>sum+Clipper.Clipper.Area(path),0))/SCALE**2;
 return {fits:outsideArea<1e-5,outsideArea,margin};
}
