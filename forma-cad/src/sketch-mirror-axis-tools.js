import * as THREE from 'three';
import {basisFor} from './frames.js';
import {constraintEdges,selectedConstraintEntities,solveSketchConstraints} from './sketch-constraints.js';
import {contactCurves} from './sketch-contact-curves.js';
import {sketchMirrorAxis,sketchMirrorSourcePart,changeSketchMirrorAxis} from './sketch-mirror-links.js';
import {mirrorSelectedSketchEntity,previewDirectSketchMirror} from './sketch-direct-mirror.js';
import {createSketchMotionAxisPicker} from './sketch-motion-axis-picker.js';

export function sketchMirrorSources(features,selection){
 const refs=selectedConstraintEntities(features,selection).map(r=>({featureId:r.featureId,index:r.index,whole:!!(r.whole||r.shape)}));if(!refs.length)throw Error('コピー元の線・図形を選択してください');for(const r of refs)sketchMirrorSourcePart(features.find(f=>f.id===r.featureId),r);return refs;
}
export function sketchMirrorAxisChoices(features,sources,excludeIds=[]){
 const first=features.find(f=>f.id===sources[0]?.featureId);if(!first)return [];const b=basisFor(first),samePlane=f=>f?.kind==='sketch'&&f.groupId===first.groupId&&Math.abs(b.n.dot(basisFor(f).n))>1-1e-8&&Math.abs(new THREE.Vector3(f.x-first.x,f.y-first.y,f.z-first.z).dot(b.n))<1e-7;if(sources.some(r=>!samePlane(features.find(f=>f.id===r.featureId))))return [];
 return features.filter(f=>samePlane(f)&&!f.groupHidden&&!excludeIds.includes(f.id)).flatMap(f=>constraintEdges(f)).filter(e=>!sources.some(r=>!r.whole&&r.featureId===e.featureId&&r.index===e.index));
}
const sample=f=>contactCurves(f,{whole:true}).map(c=>Array.from({length:Math.max(1,c.linear?c.steps:128)+1},(_,i)=>c.point(i/Math.max(1,c.linear?c.steps:128))));
export function previewSketchMirrorAxisChange(features,ids,axis){
 const next=solveSketchConstraints(changeSketchMirrorAxis(features,ids,axis),{before:features}),selected=new Set(ids),before=features.filter(f=>selected.has(f.id)),after=next.filter(f=>selected.has(f.id)),center=fs=>new THREE.Box3().setFromPoints(fs.flatMap(f=>sample(f).flat())).getCenter(new THREE.Vector3()),source=center(before),target=center(after),rail=sketchMirrorAxis(features.find(f=>f.id===axis.featureId),axis.index).points;
 return {features:next,entities:ids.map(featureId=>({featureId,index:0,whole:true})),message:ids.length+'個のミラーの基準線を変更しました',data:{type:'sketchMirrorAxis',mode:'edit',source,target,distance:source.distanceTo(target),points:[source,rail[0].clone().add(rail[1]).multiplyScalar(.5)],labels:['変更するミラーコピー','新しい基準線'],summary:ids.length+'個の基準線を変更',referencePaths:[rail],ghosts:next.filter(f=>f.kind==='sketch'&&JSON.stringify(f)!==JSON.stringify(features.find(g=>g.id===f.id))).flatMap(sample)}};
}

export function createSketchMirrorAxisTool({camera,canvas,getFeatures,getSelection,canUse,getSettings,onUpdate,onCommit}){
 let state=null,lastKey='',result=null;
 const picker=createSketchMotionAxisPicker({camera,canvas,getFeatures,canUse,id:'sketch-mirror-axis-picker',getChoices:(_features,sources)=>sketchMirrorAxisChoices(_features,sources,state?.ids||[]),onHover:axis=>{if(state){state.hover=axis;lastKey='';onUpdate?.();}},onChange:()=>onUpdate?.(),onCancel:()=>stop(),onChoose:axis=>{if(!state)return;state.axis=axis;state.hover=null;lastKey='';const value=compute();if(state?.mode==='create'&&value&&!state.error)onCommit?.(value);else onUpdate?.();}});
 function stop(){if(!state)return false;state=null;lastKey='';result=null;picker.stop();onUpdate?.();return true;}
 function compute(){if(!state)return null;const axis=state.axis||state.hover,key=JSON.stringify([axis,getSettings()]);if(key===lastKey)return result;lastKey=key;state.error='';result=null;if(!axis)return null;try{if(state.mode==='change')result=previewSketchMirrorAxisChange(state.original,state.ids,axis);else{const options={...getSettings(),axis,sourceRefs:state.sources},made=mirrorSelectedSketchEntity(state.original,null,options);result={features:made.features,entities:made.copies.map(f=>({featureId:f.id,index:0,whole:true})),message:made.copies.length?made.copies.length+'個のミラーコピーを追加しました'+(made.skippedCount?'（重複 '+made.skippedCount+'個を除外）':''):'すべて重複するためコピーは追加しませんでした',data:previewDirectSketchMirror(state.original,null,options)};result.data.referencePaths=[sketchMirrorAxis(state.original.find(f=>f.id===axis.featureId),axis.index).points];}}catch(error){state.error=error.message;}return result;}
 function start(mode,ids=[]){stop();const original=getFeatures(),sources=mode==='create'?sketchMirrorSources(original,getSelection()):ids.map(id=>{const ref=original.find(f=>f.id===id)?.sketchMirrorLink?.source;if(!ref)throw Error('コピー元の記録があるミラーコピーを選択してください');return {...ref};});if(!sketchMirrorAxisChoices(original,sources,ids).length)throw Error('同じスケッチ・作図面に基準にできる別の直線がありません');state={mode,original,sources,ids,selection:JSON.stringify([...getSelection()].map(([id,indices])=>[id,[...indices]])),axis:null,hover:null,error:''};picker.start(mode,sources);onUpdate?.();}
 return {start,stop,update(){if(!state)return;if(!canUse()||getFeatures()!==state.original||JSON.stringify([...getSelection()].map(([id,indices])=>[id,[...indices]]))!==state.selection){stop();return;}picker.update();compute();},confirm(){const value=compute();if(state?.axis&&value&&!state.error)onCommit?.(value);},get active(){return !!state;},get picking(){return picker.active;},get state(){return state;},get preview(){return compute()?.data;},get error(){return state?.error||'';}};
}
