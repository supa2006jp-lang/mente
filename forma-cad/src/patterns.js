import * as THREE from 'three';
import {basisFor,worldPoint} from './frames.js';
import {planeCoordinates} from './regions.js';
export function patternTransforms(p){
 if(!Number.isInteger(p.count)||p.count<1||p.count>20)throw Error('個数は1〜20の整数にしてください');
 const out=[];
 if(p.type==='rectangular'){
  if(!Number.isInteger(p.count2)||p.count2<1||p.count2>20||p.count*p.count2>60||!Number.isFinite(p.spacing+p.spacing2))throw Error('個数と間隔を確認してください（最大60個）');
  for(let i=0;i<p.count;i++)for(let j=0;j<p.count2;j++)if(i||j)out.push(new THREE.Matrix4().makeTranslation(i*p.spacing,j*p.spacing2,0));
 }else{
  if(!Number.isFinite(p.angle))throw Error('角度を指定してください');
  const origin=new THREE.Vector3(...(p.origin||[0,0,0])),axis=new THREE.Vector3(...(p.axisVector||{X:[1,0,0],Y:[0,1,0],Z:[0,0,1]}[p.axis]||[0,0,1])).normalize();
  for(let i=1;i<p.count;i++)out.push(new THREE.Matrix4().makeTranslation(...origin.toArray()).multiply(new THREE.Matrix4().makeRotationAxis(axis,p.angle*i/p.count*Math.PI/180)).multiply(new THREE.Matrix4().makeTranslation(...origin.clone().negate().toArray())));
 }
 return out;
}
export function patternSketch(source,p){return patternTransforms(p).map((matrix,i)=>{
 const f=structuredClone(source),b=basisFor(f),rot=new THREE.Matrix4().extractRotation(matrix),next=Object.fromEntries(Object.entries(b).map(([k,v])=>[k,v.clone().applyMatrix4(rot)]));
 const position=new THREE.Vector3(f.x,f.y,f.z).applyMatrix4(matrix);
 if(['polyline','spline'].includes(f.profile)){
  const offset=planeCoordinates(f).offset,origin=worldPoint({...f,offset},[0,0]).applyMatrix4(matrix);
  f.points=f.points.map(([x,y])=>[x+origin.dot(next.u),y+origin.dot(next.v)]);
  position.copy(next.n).multiplyScalar(origin.dot(next.n));
 }
 return {...f,id:crypto.randomUUID(),name:f.name+' パターン '+(i+1),plane:'CUSTOM',frame:Object.fromEntries(Object.entries(next).map(([k,v])=>[k,v.toArray()])),x:position.x,y:position.y,z:position.z};
});}
