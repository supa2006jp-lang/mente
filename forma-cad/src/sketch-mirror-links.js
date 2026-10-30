import * as THREE from 'three';
import {basisFor,worldPoint} from './frames.js';
import {sketchPoints,planeCoordinates} from './regions.js';
import {mirrorSketch} from './sketch-mirror.js';

const shapeKeys=['profile','mode','side','plane','frame','x','y','z','angle','width','height','diameter','depth','wall','closed','points','arc','tangents','tangentLengths'];
const equal=(a,b)=>typeof a==='number'&&typeof b==='number'?Math.abs(a-b)<=1e-8:Array.isArray(a)&&Array.isArray(b)?a.length===b.length&&a.every((v,i)=>equal(v,b[i])):a&&b&&typeof a==='object'&&typeof b==='object'?Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(k=>equal(a[k],b[k])):a===b;
export const sameSketchMirrorShape=(a,b)=>!!a&&!!b&&shapeKeys.every(k=>equal(a[k],b[k]));
export function sketchMirrorAxis(feature,index){
 if(feature?.kind!=='sketch'||feature.arc||feature.textOutline||!['line','rect','polyline'].includes(feature.profile))throw Error('ミラーの基準は直線の辺を選択してください');const points=sketchPoints(feature);if(!Number.isInteger(index)||index<0||index>=points.length-1)throw Error('ミラーの基準辺がありません');const pair=[points[index],points[index+1]].map(p=>worldPoint({...feature,offset:planeCoordinates(feature).offset},p)),normal=pair[1].clone().sub(pair[0]).cross(basisFor(feature).n);if(normal.length()<1e-7)throw Error('ミラーの基準線が短すぎます');return {points:pair,spec:{mirrorNormal:normal.normalize().toArray(),mirrorOrigin:pair[0].toArray(),offset:0}};
}
export function sketchMirrorSourcePart(source,ref){
 if(source?.kind!=='sketch')throw Error('ミラー元のスケッチがありません');if(ref.whole)return structuredClone(source);if(source.arc||source.textOutline||!['line','rect','polyline'].includes(source.profile))throw Error('ミラー元の図形を選び直してください');const points=sketchPoints(source);if(ref.index<0||ref.index>=points.length-1)throw Error('ミラー元の辺がありません');if(source.profile==='line')return structuredClone(source);return {...structuredClone(source),profile:'polyline',closed:false,points:[points[ref.index],points[ref.index+1]]};
}
export function cleanSketchMirrorCopy(part,spec){const copy=mirrorSketch(part,spec);delete copy.sketchConstraints;delete copy.offsetLink;delete copy.textOutline;delete copy.sketchMirrorLink;return copy;}
export function validateSketchMirrorLinkData(f){
 const l=f?.sketchMirrorLink;if(l===undefined)return;if(f.kind!=='sketch'||!l||l.version!==1||l.ownerId!==f.id||typeof l.enabled!=='boolean')throw Error('ミラー追従のデータが不正です');for(const [name,r]of [['source',l.source],['axis',l.axis]])if(!r||typeof r.featureId!=='string'||!r.featureId||r.featureId.length>100||!Number.isInteger(r.index)||r.index<0||r.index>19999||name==='source'&&typeof r.whole!=='boolean'||name==='axis'&&r.whole!==undefined)throw Error('ミラー追従の参照が不正です');
}
export function validateSketchMirrorLinks(features){
 const byId=new Map(features.map(f=>[f.id,f])),visiting=new Set(),done=new Set();for(const f of features)validateSketchMirrorLinkData(f);
 function visit(f){if(done.has(f.id))return;if(visiting.has(f.id))throw Error('ミラー追従が循環しています');visiting.add(f.id);const l=f.sketchMirrorLink;if(l){const source=byId.get(l.source.featureId),axis=byId.get(l.axis.featureId);if(!source||!axis||source.id===f.id||axis.id===f.id)throw Error('ミラー追従元・基準線の参照がありません');if(l.enabled){const a=basisFor(source),b=basisFor(axis);if(source.groupId!==axis.groupId||Math.abs(a.n.dot(b.n))<1-1e-8||Math.abs(new THREE.Vector3(source.x-axis.x,source.y-axis.y,source.z-axis.z).dot(b.n))>1e-7)throw Error('ミラー追従元と基準線は同じスケッチ・作図面にしてください');sketchMirrorSourcePart(source,l.source);sketchMirrorAxis(axis,l.axis.index);}visit(source);visit(axis);}visiting.delete(f.id);done.add(f.id);}
 for(const f of features.filter(f=>f.sketchMirrorLink))visit(f);return byId;
}
export function resolveSketchMirrorLinks(features){
 if(!features.some(f=>f.sketchMirrorLink))return features;const byId=validateSketchMirrorLinks(features),resolved=new Map();function resolve(f){if(resolved.has(f.id))return resolved.get(f.id);const l=f.sketchMirrorLink;let next=f;if(l?.enabled){const source=resolve(byId.get(l.source.featureId)),axis=resolve(byId.get(l.axis.featureId)),copy=cleanSketchMirrorCopy(sketchMirrorSourcePart(source,l.source),sketchMirrorAxis(axis,l.axis.index).spec);if(!sameSketchMirrorShape(copy,f)){next={...copy,id:f.id,name:f.name,sketchMirrorLink:structuredClone(l)};for(const key of ['groupId','groupNumber','groupHidden','historyGroup','sketchConstraintsEnabled','sketchConstraints']){if(f[key]!==undefined)next[key]=structuredClone(f[key]);else delete next[key];}}}resolved.set(f.id,next);return next;}const next=features.map(resolve);return next.every((f,i)=>f===features[i])?features:next;
}
export function assertSketchMirrorLinks(features){const resolved=resolveSketchMirrorLinks(features);if(resolved.some((f,i)=>!sameSketchMirrorShape(f,features[i])))throw Error('保存されたミラーコピーが追従元の形状と一致しません');}
export function reconcileSketchMirrorLinks(next,before){
 const byId=new Map(next.map(f=>[f.id,f])),old=new Map(before.map(f=>[f.id,f]));return next.map(f=>{const l=f.sketchMirrorLink;if(!l)return f;let valid=l.ownerId===f.id&&l.source.featureId!==f.id&&l.axis.featureId!==f.id;for(const [r,whole]of [[l.source,l.source.whole],[l.axis,false]]){const now=byId.get(r.featureId),prior=old.get(r.featureId);if(!now||now.kind!=='sketch'||!whole&&prior&&sketchPoints(now).length!==sketchPoints(prior).length)valid=false;}if(valid)return f;const copy={...f};delete copy.sketchMirrorLink;return copy;});
}
export function setSketchMirrorFollowing(features,ids,enabled){
 if(typeof enabled!=='boolean'||!Array.isArray(ids)||!ids.length)throw Error('追従を切り替えるコピーを選択してください');validateSketchMirrorLinks(features);if(ids.some(id=>!features.some(f=>f.id===id&&f.sketchMirrorLink)))throw Error('この図形にはミラー追従元の記録がありません');return resolveSketchMirrorLinks(features.map(f=>ids.includes(f.id)?{...f,sketchMirrorLink:{...f.sketchMirrorLink,enabled}}:f));
}

// Rebuild even independent copies once, then restore each copy's follow switch.
export function changeSketchMirrorAxis(features,ids,axis){
 validateSketchMirrorLinks(features);if(!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length)throw Error('基準線を変更するミラーコピーを選択してください');const selected=new Set(ids),byId=new Map(features.map(f=>[f.id,f]));for(const id of ids){const f=byId.get(id);if(!f?.sketchMirrorLink)throw Error('コピー元の記録があるミラーコピーを選択してください');if(axis?.featureId===id)throw Error('ミラーコピー自身を基準線にできません');const source=byId.get(f.sketchMirrorLink.source.featureId),reference=byId.get(axis?.featureId);sketchMirrorAxis(reference,axis?.index);const a=basisFor(source),b=basisFor(reference);if(source.groupId!==reference.groupId||Math.abs(a.n.dot(b.n))<1-1e-8||Math.abs(new THREE.Vector3(source.x-reference.x,source.y-reference.y,source.z-reference.z).dot(b.n))>1e-7)throw Error('コピー元と同じスケッチ・作図面の直線を選択してください');}
 const next=resolveSketchMirrorLinks(features.map(f=>selected.has(f.id)?{...f,sketchMirrorLink:{...f.sketchMirrorLink,enabled:true,axis:{featureId:axis.featureId,index:axis.index}}}:f));return next.map(f=>selected.has(f.id)?{...f,sketchMirrorLink:{...f.sketchMirrorLink,enabled:byId.get(f.id).sketchMirrorLink.enabled}}:f);
}
