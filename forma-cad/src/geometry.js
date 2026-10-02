import {taperGeometry,validateTaperAngle} from './taper.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {validateReferenceImage} from './reference-image-data.js';
import {basisFor,frameMatrix,validateFrame,worldPoint} from './frames.js';
import {sketchPoints,planeCoordinates} from './regions.js';
import {extrudeRegion,validateRegion} from './regions.js';
import * as THREE from 'three';
import {Brush,Evaluator,ADDITION,SUBTRACTION} from 'three-bvh-csg';
export const evaluator = new Evaluator(); evaluator.useGroups=false;
// Kernel meshes have positions and normals, but no texture UVs.
// Boolean operations only need the attributes used by our solid materials.
evaluator.attributes=['position','normal'];
const enums={profile:['point','rect','circle','line','region','spline','polyline'],mode:['solid','thin'],side:['inside','outside','center'],plane:['XY','XZ','YZ','CUSTOM'],operation:['new','join','cut']};
export function validateFeature(f){
 validateTaperAngle(f?.taperAngle??0);
 if(!f || typeof f!=='object') throw Error('形状データが不正です。');
 if(f.kind==='referenceImage')return validateReferenceImage(f);if(f.cadResult)validateFeature({kind:'cadop',...f.cadResult});if(f.kind==='plane'){validateFrame(f.frame);if(!Number.isFinite(f.offset)||Math.abs(f.offset)>10000)throw Error('平面位置が不正です');return f;}if(f.kind==='cadop'){if(!Array.isArray(f.outputs)||f.outputs.length>100||!Array.isArray(f.remove))throw Error('CAD工程が不正です');for(const o of f.outputs){if(typeof o.id!=='string'||!Array.isArray(o.vertices)||o.vertices.length>3000000||o.vertices.length%3||o.vertices.some(x=>!Number.isFinite(x)||Math.abs(x)>100000)||!Array.isArray(o.triangles)||o.triangles.length>3000000||o.triangles.length%3||o.triangles.some(x=>!Number.isInteger(x)||x<0||x>=o.vertices.length/3))throw Error('立体データが不正です');}return f;}if(f.contactOnly!==undefined&&typeof f.contactOnly!=='boolean')throw Error('接触部分だけの押し出し設定が不正です');if(f.untilSolid!==undefined&&typeof f.untilSolid!=='boolean')throw Error('ソリッド接触の設定が不正です');if(f.untilSolid&&(f.gridExtentPlane||f.throughAll||f.cutAllBodies))throw Error('ソリッド接触とグリッド・貫通は同時に使えません');if(f.cutAllBodies!==undefined&&typeof f.cutAllBodies!=='boolean')throw Error('全ボディ切り取りの設定が不正です');if(f.skipHoleWalls!==undefined&&typeof f.skipHoleWalls!=='boolean')throw Error('穴側の薄い押し出し設定が不正です');if(f.gridExtentPlane!==undefined&&!['XY','XZ','YZ'].includes(f.gridExtentPlane))throw Error('グリッド平面の設定が不正です');if(f.plane==='CUSTOM')validateFrame(f.frame);if(['spline','polyline'].includes(f.profile)&&(!Array.isArray(f.points)||f.points.length<2||f.points.length>(f.profile==='polyline'?20000:200)||f.points.some(p=>!Array.isArray(p)||p.length!==2||p.some(x=>!Number.isFinite(x)||Math.abs(x)>25000))))throw Error('スプラインの点が不正です');
 for(const [k,values] of Object.entries(enums)) if(!values.includes(f[k])) throw Error('設定が不正です: '+k);
 for(const k of ['width','height','diameter','depth','wall','x','y','z','angle']) if(typeof f[k]!=='number'||!Number.isFinite(f[k])||Math.abs(f[k])>10000) throw Error('寸法は有限の数値（±10000mm以内）で入力してください。');
 for(const k of ['width','height','diameter','wall']) if(f[k]<0.1) throw Error('寸法・壁厚は0.1mm以上で入力してください。');
 if(Math.abs(f.depth)<0.1) throw Error('押し出し距離は絶対値0.1mm以上にしてください。');
 if(f.holesOnly&&(f.operation!=='new'||f.mode!=='solid'||f.profile!=='region'||!f.region?.holes?.length))throw Error('新規（穴だけ）は穴のある平面を選択してください');
 if(f.profile==='line'&&f.mode!=='thin') throw Error('直線には薄い押し出しを使用してください。');
 if(f.profile==='point'&&f.kind!=='sketch')throw Error('点は押し出せません');
 if(f.kind==='sketch'&&f.profile==='region')throw Error('領域は押し出し工程にのみ使用できます');
 if(f.profile==='region'){validateRegion(f.region);if(f.region.plane!==f.plane)throw Error('領域の平面が一致しません');}
 if(f.mode==='thin'&&f.profile!=='line'&&f.profile!=='region'){
  const inward=f.side==='inside'?f.wall:f.side==='center'?f.wall/2:0;
  if((f.profile==='circle'?f.diameter:Math.min(f.width,f.height))-2*inward<0.1) throw Error('壁厚が大きすぎます。内側に0.1mm以上の空間を残してください。');
 }
 return f;
}
function rectPath(path,w,h){path.moveTo(-w/2,-h/2);path.lineTo(w/2,-h/2);path.lineTo(w/2,h/2);path.lineTo(-w/2,h/2);path.closePath();return path;}
export function makeGeometry(input){
 let f=validateFeature(input);if(f.holesOnly){const parts=f.region.holes.map(outer=>extrudeRegion({...f.region,outer,holes:[]},f.depth,'solid',2,'inside',false,f.taperAngle??0));const result=mergeGeometries(parts);for(const part of parts)part.dispose();return result;}if(f.capHoles&&f.mode==='solid'&&f.region)f={...f,region:{...f.region,holes:[]}};if(f.profile==='region')return extrudeRegion(f.region,f.depth,f.mode,f.wall,f.side,f.skipHoleWalls===true,f.taperAngle??0); let shape=new THREE.Shape();
 const outer=f.mode==='thin'?(f.side==='outside'?f.wall:f.side==='center'?f.wall/2:0):0;
 const inner=f.side==='inside'?f.wall:f.side==='center'?f.wall/2:0;
 if(f.profile==='rect'){
  rectPath(shape,f.width+2*outer,f.height+2*outer);
  if(f.mode==='thin') shape.holes.push(rectPath(new THREE.Path(),f.width-2*inner,f.height-2*inner));
 }else if(f.profile==='circle'){
  shape.absarc(0,0,f.diameter/2+outer,0,Math.PI*2,false);
  if(f.mode==='thin'){const hole=new THREE.Path();hole.absarc(0,0,f.diameter/2-inner,0,Math.PI*2,true);shape.holes.push(hole);}
 }else{
  rectPath(shape,f.width,f.wall);
  const shift=f.side==='inside'?f.wall/2:f.side==='outside'?-f.wall/2:0;
  // The line runs along local X; inside/outside means left/right of its direction.
  shape.getPoints(); shape.userData={shift};
 }
 const g=new THREE.ExtrudeGeometry(shape,{depth:Math.abs(f.depth),bevelEnabled:false,curveSegments:64,steps:1});
 taperGeometry(g,[shape],f.depth,f.taperAngle??0);
 if(f.profile==='line') g.translate(0,shape.userData.shift,0);
 if(f.depth<0) g.translate(0,0,f.depth);
 g.rotateZ(f.angle*Math.PI/180);
 if(f.frame)g.applyMatrix4(frameMatrix(f));else if(f.plane==='XZ') g.rotateX(-Math.PI/2);
 if(!f.frame&&f.plane==='YZ') g.rotateY(Math.PI/2);
 g.translate(f.x,f.y,f.z); return g;
}
export function rebuild(features){
 const bodies=new Map(),snapshots=new Map();features.forEach((f,i)=>{for(const o of (f.cadResult?.outputs||(f.kind==='cadop'?f.outputs:[])))snapshots.set(o.id,i);});
 try{
  for(let i=0;i<features.length;i++){let f=features[i];
   if(f.cadResult)f={kind:'cadop',...f.cadResult};if(f.kind==='sketch'||f.kind==='plane'||f.kind==='referenceImage')continue;if(f.kind==='cadop'){f={...f,outputs:f.outputs.filter(o=>snapshots.get(o.id)===i)};validateFeature(f);for(const id of f.remove){bodies.get(id)?.geometry.dispose();bodies.delete(id);}for(const o of f.outputs){bodies.get(o.id)?.geometry.dispose();const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(o.vertices,3));g.setIndex(o.triangles);if(Array.isArray(o.normals)&&o.normals.length===o.vertices.length&&o.normals.every(Number.isFinite))g.setAttribute('normal',new THREE.Float32BufferAttribute(o.normals,3));else g.computeVertexNormals();g.userData.faceGroups=o.faceGroups;g.userData.planarFaces=o.planarFaces;const b=new Brush(g);b.updateMatrixWorld(true);bodies.set(o.id,b);}continue;}
   if((snapshots.get(f.operation==='new'?f.id:f.target)??-1)>i)continue;
   const brush=new Brush(makeGeometry(f));brush.updateMatrixWorld(true);
   if(f.operation==='new') bodies.set(f.id,brush);
   else{
    const target=bodies.get(f.target);
    if(!target){brush.geometry.dispose();throw Error('編集対象のボディがありません。先に新規ボディを作成してください。');}
    let result;
    try{result=evaluator.evaluate(target,brush,f.operation==='cut'?SUBTRACTION:ADDITION);result.updateMatrixWorld(true);}
    finally{brush.geometry.dispose();}
    target.geometry.dispose();bodies.set(f.target,result);
   }
  }
  return bodies;
 }catch(e){for(const b of bodies.values()) b.geometry.dispose();throw e;}
}
export function volume(g){const p=g.attributes.position,idx=g.index;let v=0;const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();for(let i=0;i<(idx?idx.count:p.count);i+=3){a.fromBufferAttribute(p,idx?idx.getX(i):i);b.fromBufferAttribute(p,idx?idx.getX(i+1):i+1);c.fromBufferAttribute(p,idx?idx.getX(i+2):i+2);v+=a.dot(b.cross(c))/6;}return Math.abs(v);}
export const defaults={profile:'rect',mode:'solid',side:'inside',plane:'XY',operation:'new',target:'',width:60,height:40,diameter:30,depth:2,wall:2,x:0,y:0,z:0,angle:0,taperAngle:0};
export function validateProject(data){
 if(data?.format!=='forma-cad'||data.version!==1||!Array.isArray(data.features)||data.features.length>150)throw Error('対応するFORMA CADファイルではありません（最大150工程）。');
 const ids=new Set(),bodyIds=new Set();
 for(const f of data.features){if(f.kind!==undefined&&!['sketch','extrusion','cadop','plane','referenceImage'].includes(f.kind))throw Error('工程種別が不正です');validateFeature(f);if(typeof f.id!=='string'||!f.id||f.id.length>100||ids.has(f.id))throw Error('工程IDが不正です。');ids.add(f.id);if(f.kind==='plane'||f.kind==='referenceImage'){}else if(f.kind==='cadop'){for(const id of f.remove)bodyIds.delete(id);for(const o of f.outputs)bodyIds.add(o.id);}else if(f.kind==='sketch'){if(f.operation!=='new')throw Error('スケッチの操作が不正です');}else if(f.operation==='new')bodyIds.add(f.id);else if(!bodyIds.has(f.target))throw Error('ボディの参照が不正です。');if(typeof f.name!=='string'||f.name.length>100)throw Error('工程名が不正です。');}
 return data.features;
}

export function makeSketchGeometry(f){if(f.profile==='point')return new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(f.x,f.y,f.z)]);if(f.frame||f.profile==='spline'||f.profile==='polyline'){return new THREE.BufferGeometry().setFromPoints(sketchPoints(f).map(p=>worldPoint({...f,offset:planeCoordinates(f).offset},p)));}
 const values=[f.width,f.height,f.diameter,f.x,f.y,f.z,f.angle];
 if(!values.every(Number.isFinite)||values.some(v=>Math.abs(v)>10000)||f.width<.1||f.height<.1||f.diameter<.1)throw Error('スケッチ寸法を正しく入力してください。');
 const points=[];
 if(f.profile==='rect')for(const [x,y] of [[-1,-1],[1,-1],[1,1],[-1,1],[-1,-1]])points.push(new THREE.Vector3(x*f.width/2,y*f.height/2,0));
 else if(f.profile==='circle')for(let i=0;i<=128;i++){const a=i/128*Math.PI*2;points.push(new THREE.Vector3(Math.cos(a)*f.diameter/2,Math.sin(a)*f.diameter/2,0));}
 else if(f.profile==='line')points.push(new THREE.Vector3(-f.width/2,0,0),new THREE.Vector3(f.width/2,0,0));
 else throw Error('スケッチ形状が不正です。');
 const g=new THREE.BufferGeometry().setFromPoints(points);g.rotateZ(f.angle*Math.PI/180);
 if(f.plane==='XZ')g.rotateX(-Math.PI/2);else if(f.plane==='YZ')g.rotateY(Math.PI/2);else if(f.plane!=='XY')throw Error('平面が不正です');
 g.translate(f.x,f.y,f.z);return g;
}
