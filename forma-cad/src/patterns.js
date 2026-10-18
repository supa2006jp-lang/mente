import * as THREE from 'three';
import {basisFor,worldPoint} from './frames.js';
import {planeCoordinates} from './regions.js';
import {circularPositions} from './circular-pattern-options.js';
import {betweenPattern,rectangularOffsets} from './rectangular-pattern.js';
export function patternTransforms(p){
 if(p.type==='rectangular')return rectangularOffsets(p).filter((_,i)=>betweenPattern(p)||i>0).map(offset=>new THREE.Matrix4().makeTranslation(...offset));
 if(!Number.isInteger(p.count)||p.count<1||p.count>20)throw Error('個数は1〜20の整数にしてください');
 const out=[];
 if(!Number.isFinite(p.angle))throw Error('角度を指定してください');
 const origin=new THREE.Vector3(...(p.origin||[0,0,0])),axis=new THREE.Vector3(...(p.axisVector||{X:[1,0,0],Y:[0,1,0],Z:[0,0,1]}[p.axis]||[0,0,1])).normalize();
 for(const i of circularPositions(p))out.push(new THREE.Matrix4().makeTranslation(...origin.toArray()).multiply(new THREE.Matrix4().makeRotationAxis(axis,p.angle*i/p.count*Math.PI/180)).multiply(new THREE.Matrix4().makeTranslation(...origin.clone().negate().toArray())));
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
 return {...f,id:crypto.randomUUID(),name:f.name+' パターン '+(p.type==='circular'?circularPositions(p)[i]:i+1),plane:'CUSTOM',frame:Object.fromEntries(Object.entries(next).map(([k,v])=>[k,v.toArray()])),x:position.x,y:position.y,z:position.z};
});}
