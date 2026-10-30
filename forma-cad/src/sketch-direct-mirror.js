import * as THREE from 'three';
import {basisFor} from './frames.js';
import {selectedConstraintEntities} from './sketch-constraints.js';
import {contactCurves} from './sketch-contact-curves.js';
import {sketchMirrorAxis,sketchMirrorSourcePart,cleanSketchMirrorCopy} from './sketch-mirror-links.js';
import {sketchMirrorDuplicateKey} from './sketch-mirror-duplicates.js';
import {validateFeature} from './geometry.js';

export function directSketchMirrorSelection(features,selection,{copySource=true,axis:explicitAxis,sourceRefs:explicitSources}={}){
 const entities=explicitSources||selectedConstraintEntities(features,selection);if(entities.length<(explicitAxis?1:2))throw Error('①などコピーする線・図形を選び、最後に基準にする直線を選択してください');const sources=explicitAxis?entities:entities.slice(0,-1),second=explicitAxis||entities.at(-1),axis=features.find(f=>f.id===second.featureId);if(second.whole)throw Error('②・最後の要素はミラーの基準にする直線の辺を選択してください');let reference;try{reference=sketchMirrorAxis(axis,second.index);}catch{throw Error('②・最後の要素はミラーの基準にする直線の辺を選択してください');}const b=basisFor(axis),sourceRefs=sources.map(ref=>({featureId:ref.featureId,index:ref.index,whole:!!(ref.whole||ref.shape)}));
 if(sourceRefs.some(ref=>!ref.whole&&ref.featureId===second.featureId&&ref.index===second.index))throw Error('コピー元と別の辺を基準にしてください');
 for(const ref of sourceRefs){const source=features.find(f=>f.id===ref.featureId);if(!source||source.kind!=='sketch')throw Error('コピー元のスケッチがありません');const a=basisFor(source);if(source.groupId!==axis.groupId||Math.abs(a.n.dot(b.n))<1-1e-8||Math.abs(new THREE.Vector3(source.x-axis.x,source.y-axis.y,source.z-axis.z).dot(b.n))>1e-7)throw Error('同じスケッチ番号・作図面の図形と基準線を選択してください');}
 const parts=copySource?sourceRefs.map(ref=>sketchMirrorSourcePart(features.find(f=>f.id===ref.featureId),ref)):[];return {first:sources[0],sources,sourceRefs,second,source:features.find(f=>f.id===sources[0].featureId),axis,points:reference.points,parts,spec:reference.spec};
}
export function mirrorSelectedSketchEntity(features,selection,{follow=false,excludeDuplicates=true,axis,sourceRefs}={}){
 const chosen=directSketchMirrorSelection(features,selection,{axis,sourceRefs}),seen=new Map(),copies=[],duplicates=[];if(excludeDuplicates)for(const f of features.filter(f=>f.kind==='sketch'&&!f.groupHidden)){const key=sketchMirrorDuplicateKey(f);if(key)seen.set(key,f.id);}
 for(const [index,part]of chosen.parts.entries()){const copy=cleanSketchMirrorCopy(part,chosen.spec),key=excludeDuplicates?sketchMirrorDuplicateKey(copy):null;if(key&&seen.has(key)){duplicates.push({candidate:copy,existingId:seen.get(key),source:chosen.sourceRefs[index]});continue;}copy.sketchMirrorLink={version:1,ownerId:copy.id,enabled:!!follow,source:structuredClone(chosen.sourceRefs[index]),axis:{featureId:chosen.second.featureId,index:chosen.second.index}};validateFeature(copy);copies.push(copy);if(key)seen.set(key,copy.id);}
 if(features.length+copies.length>150)throw Error('工程数は150までです');return {...chosen,copies,duplicates,skippedCount:duplicates.length,features:copies.length?[...features,...copies]:features};
}
export function previewDirectSketchMirror(features,selection,options={}){
 const result=mirrorSelectedSketchEntity(features,selection,options),sample=f=>contactCurves(f,{whole:true}).map(c=>Array.from({length:Math.max(1,c.linear?c.steps:128)+1},(_,i)=>c.point(i/Math.max(1,c.linear?c.steps:128)))),box=new THREE.Box3().setFromPoints(result.parts.flatMap(f=>sample(f).flat())),source=box.getCenter(new THREE.Vector3()),target=source.clone(),normal=new THREE.Vector3(...result.spec.mirrorNormal),origin=new THREE.Vector3(...result.spec.mirrorOrigin);target.addScaledVector(normal,2*origin.sub(source).dot(normal));const axisCenter=result.points[0].clone().add(result.points[1]).multiplyScalar(.5);
 return {type:'sketchMirror',mode:'copy',points:[source,axisCenter],labels:[result.parts.length>1?'コピー元 '+result.parts.length+'要素':'① コピー元',result.parts.length>1?'最後の線：ミラーの基準':'② ミラーの基準線'],source,target,distance:source.distanceTo(target),summary:'追加 '+result.copies.length+'個'+(result.skippedCount?' ／ 重複 '+result.skippedCount+'個を除外':''),ghosts:result.copies.flatMap(sample),duplicates:result.duplicates.flatMap(d=>sample(d.candidate)),addedCount:result.copies.length,skippedCount:result.skippedCount};
}
