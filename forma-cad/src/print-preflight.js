import * as THREE from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {printDimensions} from './print-dimensions.js';
const pause=()=>new Promise(resolve=>setTimeout(resolve,0));
const cancelled=check=>{if(check?.())throw Object.assign(new Error('確認をキャンセルしました'),{name:'AbortError'});};
export async function analyzePrintPreflight(outputs,{capacity=[180,180,180],shouldCancel,onProgress}={}){
 const items=[],issues=[],models=[],parts=[];let count=0;
 try{
  for(const [bodyIndex,output] of outputs.entries()){
   cancelled(shouldCancel);onProgress?.({stage:(bodyIndex+1)+' / '+outputs.length+' ボディの面と接続を確認中'});
   const {id,vertices,triangles}=output,min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity],points=[],weld=new Map(),edges=new Map(),parents=Array.from({length:triangles.length/3},(_,i)=>i),partBounds=new Map();let degenerate=0;
   const root=x=>{while(parents[x]!==x){parents[x]=parents[parents[x]];x=parents[x];}return x;},connect=(a,b)=>{parents[root(a)]=root(b);};
   for(let i=0;i<vertices.length;i+=3){const point=vertices.slice(i,i+3);if(point.some(v=>!Number.isFinite(v)))throw Error('メッシュ座標が不正です');point.forEach((v,j)=>{min[j]=Math.min(min[j],v);max[j]=Math.max(max[j],v);});const key=point.map(v=>Math.round(v/1e-5)).join(',');if(!weld.has(key))weld.set(key,weld.size);points.push(weld.get(key));}
   items.push({id,min,max});
   for(let i=0;i<triangles.length;i+=3){
    if(i%6000===0){cancelled(shouldCancel);await pause();}
    const indices=triangles.slice(i,i+3);if(indices.some(v=>!Number.isInteger(v)||v<0||v>=points.length))throw Error('メッシュの面データが不正です');
    const ids=indices.map(v=>points[v]),a=new THREE.Vector3().fromArray(vertices,indices[0]*3),b=new THREE.Vector3().fromArray(vertices,indices[1]*3),c=new THREE.Vector3().fromArray(vertices,indices[2]*3);
    if(new Set(ids).size<3||new THREE.Triangle(a,b,c).getArea()<1e-10){degenerate++;continue;}
    for(let j=0;j<3;j++){const a=ids[j],b=ids[(j+1)%3],key=a<b?a+':'+b:b+':'+a,entry=edges.get(key);if(entry){entry.count++;entry.direction+=a<b?1:-1;connect(i/3,entry.triangle);}else edges.set(key,{count:1,direction:a<b?1:-1,triangle:i/3,segment:[...vertices.slice(indices[j]*3,indices[j]*3+3),...vertices.slice(indices[(j+1)%3]*3,indices[(j+1)%3]*3+3)]});}
   }
   const bad=[...edges.values()].filter(edge=>edge.count!==2||edge.direction!==0),open=bad.filter(edge=>edge.count===1).length,nonmanifold=bad.filter(edge=>edge.count>2).length,inverted=bad.filter(edge=>edge.count===2&&edge.direction!==0).length;
   if(bad.length)issues.push({bodyId:id,type:'topology',severity:'error',message:'開いた辺 '+open+' / 非多様体の辺 '+nonmanifold+' / 面の向き不整合 '+inverted,segments:bad.slice(0,10000).flatMap(edge=>edge.segment)});
   if(degenerate)issues.push({bodyId:id,type:'degenerate',severity:'warning',message:'面積がほぼ0の面 '+degenerate+' 枚'});
   for(let t=0;t<triangles.length/3;t++){if(t%2000===0){cancelled(shouldCancel);await pause();}const key=root(t);let part=partBounds.get(key);if(!part){part={bodyId:id,min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity],samples:[],volume:0};partBounds.set(key,part);}const trianglePoints=[0,1,2].map(j=>new THREE.Vector3().fromArray(vertices,triangles[t*3+j]*3));part.volume+=trianglePoints[0].dot(trianglePoints[1].clone().cross(trianglePoints[2]))/6;for(let j=0;j<3;j++){const point=vertices.slice(triangles[t*3+j]*3,triangles[t*3+j]*3+3);if(point[2]<part.min[2]-.05)part.samples=[];point.forEach((v,k)=>{part.min[k]=Math.min(part.min[k],v);part.max[k]=Math.max(part.max[k],v);});if(point[2]<=part.min[2]+.05&&part.samples.length<256)part.samples.push(point);}}
   for(const part of partBounds.values())parts.push(part);
   if(partBounds.size>1)issues.push({bodyId:id,type:'components',severity:'warning',message:'1ボディ内に '+partBounds.size+' 個の分離した面群があります（空洞の内壁を含む場合があります）'});
   const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(triangles);models.push({id,geometry,bvh:new MeshBVH(geometry,{indirect:true})});count+=triangles.length/3;
   await pause();
  }
  // Support is tested against the actual surface; overlapping bounding boxes
  // alone do not establish contact. Bed height remains world Z=0.
  for(const part of parts){
   cancelled(shouldCancel);if(part.min[2]<=.05||part.volume< -1e-6)continue;
   const samples=part.samples.filter(p=>p[2]<=part.min[2]+.05),down=new THREE.Vector3(0,0,-1);let supported=false;
   for(const point of samples){const ray=new THREE.Ray(new THREE.Vector3(...point).addScaledVector(down,-.02),down);if(models.some(model=>model.id!==part.bodyId&&model.bvh.raycastFirst(ray,THREE.DoubleSide,.001,.12))){supported=true;break;}}
   if(!supported)issues.push({bodyId:part.bodyId,type:'floating',severity:'warning',message:'床から '+Number(part.min[2].toFixed(3))+' mm 浮いた面群があります。接地・サポートを確認してください。',bounds:{min:part.min,max:part.max}});
  }
  const dimensions=printDimensions(items,capacity);for(const body of dimensions.bodies)if(body.size.some((v,i)=>v>capacity[i]+1e-5))issues.push({bodyId:body.id,type:'size',severity:'error',message:'造形範囲を超えます：'+body.size.map(v=>Number(v.toFixed(2))).join(' × ')+' mm'});
  cancelled(shouldCancel);return {dimensions,issues,triangles:count,bodies:items.length};
 }finally{for(const model of models)model.geometry.dispose();}
}
