import * as THREE from 'three';
import {basisFor,worldPoint} from './frames.js';
import {planeCoordinates} from './regions.js';
import {constraintEdges,constraintControlPoints,selectedConstraintEntities} from './sketch-constraints.js';
import {contactCurves} from './sketch-contact-curves.js';
import {selectedSketchParts} from './sketch-selection.js';
import {mirrorSketch} from './sketch-mirror.js';
import {validateFeature} from './geometry.js';

export function directSketchMirrorSelection(features,selection,{copySource=true}={}){
 const entities=selectedConstraintEntities(features,selection);if(entities.length!==2)throw Error('①コピーする線・図形、②基準にする直線の順に選択してください');const [first,second]=entities,source=features.find(f=>f.id===first.featureId),axis=features.find(f=>f.id===second.featureId),edge=!second.whole&&constraintEdges(axis)[second.index];
 if(!edge)throw Error('②はミラーの基準にする直線の辺を選択してください');const a=basisFor(source),b=basisFor(axis);if(source.groupId!==axis.groupId||Math.abs(a.n.dot(b.n))<1-1e-8||Math.abs(new THREE.Vector3(source.x-axis.x,source.y-axis.y,source.z-axis.z).dot(b.n))>1e-7)throw Error('同じスケッチ番号・作図面の①と②を選択してください');
 const points=edge.vertices.map(i=>worldPoint({...axis,offset:planeCoordinates(axis).offset},constraintControlPoints(axis)[i])),normal=points[1].clone().sub(points[0]).cross(b.n);if(normal.length()<1e-7)throw Error('②の基準線が短すぎます');normal.normalize();
 const parts=copySource?(first.whole||first.shape?[structuredClone(source)]:selectedSketchParts(source,new Set([first.index]))):[];if(copySource&&!parts.length)throw Error('①のコピー元を選択してください');
 return {first,second,source,axis,points,parts,spec:{mirrorNormal:normal.toArray(),mirrorOrigin:points[0].toArray(),offset:0}};
}
export function mirrorSelectedSketchEntity(features,selection){
 const chosen=directSketchMirrorSelection(features,selection);if(features.length+chosen.parts.length>150)throw Error('工程数は150までです');const copies=chosen.parts.map(part=>{const copy=mirrorSketch(part,chosen.spec);delete copy.sketchConstraints;delete copy.offsetLink;delete copy.textOutline;validateFeature(copy);return copy;});return {...chosen,copies,features:[...features,...copies]};
}
export function previewDirectSketchMirror(features,selection){
 const result=mirrorSelectedSketchEntity(features,selection),center=f=>{const paths=contactCurves(f,{whole:true}),points=paths.flatMap(c=>Array.from({length:Math.max(1,c.linear?c.steps:128)+1},(_,i)=>c.point(i/Math.max(1,c.linear?c.steps:128)))),box=new THREE.Box3().setFromPoints(points);return box.getCenter(new THREE.Vector3());},source=center(result.parts[0]),target=source.clone(),normal=new THREE.Vector3(...result.spec.mirrorNormal),origin=new THREE.Vector3(...result.spec.mirrorOrigin);target.addScaledVector(normal,2*origin.sub(source).dot(normal));const axisCenter=result.points[0].clone().add(result.points[1]).multiplyScalar(.5),ghosts=result.copies.flatMap(copy=>contactCurves(copy,{whole:true}).map(c=>Array.from({length:Math.max(1,c.linear?c.steps:128)+1},(_,i)=>c.point(i/Math.max(1,c.linear?c.steps:128)))));
 return {type:'sketchMirror',mode:'copy',points:[source,axisCenter],labels:['① コピー元','② ミラーの基準線'],source,target,distance:source.distanceTo(target),summary:'①のミラーコピーを追加',ghosts};
}
