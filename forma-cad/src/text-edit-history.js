import * as THREE from 'three';
import {findRegions,regionContains,planeCoordinates} from './regions.js';
import {basisFor} from './frames.js';
import {TEXT_FONTS,DEFAULT_TEXT_FONT} from './text-fonts.js';
import {featureReads} from './history-impact.js';
import {reverseExtrusionFrame} from './extrusion-direction.js';
const copy=value=>structuredClone(value);
export function textGroup(features,key){
 let id=features.find(f=>f.id===key)?.textOutline?.id||key;
 const feature=features.find(f=>f.id===key);if(feature&&!feature.textOutline){const source=feature.sourceSketchIds?.[0]||feature.region?.sourceIds?.[0];id=features.find(f=>f.id===source)?.textOutline?.id;}
 if(typeof id!=='string'||!id)return null;const sketches=features.filter(f=>f.kind==='sketch'&&f.textOutline?.id===id);if(!sketches.length)return null;
 const ids=new Set(sketches.map(f=>f.id)),extrusions=features.filter(f=>f.kind==='extrusion'&&[...(f.sourceSketchIds||[]),...(f.region?.sourceIds||[])].some(id=>ids.has(id)));
 return {id,sketches,extrusions,index:features.findIndex(f=>ids.has(f.id))};
}
export function textEditSettings(group){
 const first=group.sketches[0],saved=first.textOutline,b=basisFor(first),fontId=saved.fontId||TEXT_FONTS.find(f=>f.name===saved.fontName)?.id||(saved.fontName==='Noto Sans CJK JP'?DEFAULT_TEXT_FONT:'custom');
 return {id:group.id,groupId:first.groupId,groupNumber:first.groupNumber,spec:{text:saved.text,height:saved.height,spacing:saved.spacing??0,angle:saved.angle??0,align:saved.align||'left',writingMode:saved.writingMode||'horizontal',fontId,fontName:saved.fontName,u:saved.u??0,v:saved.v??0},placement:{plane:first.plane,frame:{u:b.u.toArray(),v:b.v.toArray(),n:b.n.toArray()},offset:planeCoordinates(first).offset,...copy(saved.surface||{}),label:saved.surface?.label||'配置済み文字の面'},inferOrigin:saved.u===undefined||saved.v===undefined,sketches:group.sketches,extruded:group.extrusions.length>0};
}
export function inferTextOrigin(sketches,layout){const points=sketches.flatMap(f=>f.points||[]);return {u:Math.min(...points.map(p=>p[0]))-layout.bounds.min[0],v:Math.min(...points.map(p=>p[1]))-layout.bounds.min[1]};}
export function textGroupAtRay(features,ray,bodyHit=null){
 const groups=[...new Set(features.filter(f=>f.textOutline).map(f=>f.textOutline.id))].map(id=>textGroup(features,id)),matches=[];
 for(const group of groups){if(!group)continue;const related=new Set(group.extrusions.flatMap(f=>[f.id,f.target,...(f.cadResult?.outputs||[]).map(o=>o.id)]));if(group.sketches.every(f=>f.groupHidden)&&(!group.extrusions.length||!bodyHit||!related.has(bodyHit.object.userData.bodyId)))continue;
  for(const region of findRegions(group.sketches)){const b=basisFor(region),hit=ray.intersectPlane(new THREE.Plane(b.n,-region.offset),new THREE.Vector3());if(!hit||!regionContains(region,[hit.dot(b.u),hit.dot(b.v)]))continue;const distance=ray.origin.distanceTo(hit);if(bodyHit&&bodyHit.distance<distance-.01&&!related.has(bodyHit.object.userData.bodyId))continue;matches.push({group,distance});break;}
 }
 return matches.sort((a,b)=>a.distance-b.distance)[0]?.group||null;
}
export function planTextEdit(before,key,replacement){
 const group=textGroup(before,key);if(!group)throw Error('再編集する文字が見つかりません');const oldIds=new Set(group.sketches.map(f=>f.id)),first=group.sketches[0],batch=copy(replacement);
 const unused=[...group.sketches];for(const f of batch){const index=unused.findIndex(old=>old.textOutline.hole===f.textOutline.hole),old=index<0?null:unused.splice(index,1)[0];f.id=old?.id||f.id;f.groupId=first.groupId;f.groupNumber=first.groupNumber;f.groupHidden=first.groupHidden;f.historyGroup=first.historyGroup;f.textOutline.id=group.id;}
 const directIds=new Set(group.extrusions.map(f=>f.id)),oldRegions=findRegions(group.sketches),newRegions=findRegions(batch),replacements=new Map(),removed=new Set(unused.map(f=>f.id));
 for(const f of before)if(!oldIds.has(f.id)&&!directIds.has(f.id)&&[...featureReads(f)].some(id=>oldIds.has(id)))throw Error('文字の輪郭を直接参照する後続工程があります。その工程の参照を変更してから文字を再編集してください');
 let run=[];const flush=()=>{if(!run.length)return;const covered=new Set(run.map(f=>f.region?.id));if(covered.size!==oldRegions.length||oldRegions.some(r=>!covered.has(r.id)))throw Error('この文字は一部の輪郭だけを加工しています。文字全体の押し出しにそろえてから再編集してください');
  const settings=f=>JSON.stringify([f.operation,f.depth,f.mode,f.wall,f.side,f.taperAngle,f.taperMode??'all',f.taperSide??'u+',f.target,f.targetBodies,f.targetAllBodies,f.untilSolid,f.barrier]);if(run.some(f=>settings(f)!==settings(run[0])))throw Error('文字ごとに加工条件が異なるため、一括で文字を置き換えられません');
  const generated=newRegions.map((region,i)=>{const template=copy(run[i]||run[0]),oldNormal=basisFor(run[0].region).n;if(oldNormal.dot(basisFor(region).n)<0)region=reverseExtrusionFrame({profile:'region',region,plane:region.plane,frame:region.frame}).region;
   const n=basisFor(region).n,id=run[i]?.id||crypto.randomUUID();return {...template,id,region:copy(region),sourceSketchIds:[...region.sourceIds],plane:region.plane,frame:region.frame,x:n.x*region.offset,y:n.y*region.offset,z:n.z*region.offset,cadResult:template.cadResult||{outputs:[]}};});
  replacements.set(run[0].id,generated);for(const old of run.slice(1))replacements.set(old.id,[]);for(const old of run.slice(generated.length))removed.add(old.id);run=[];};
 for(const f of before){if(directIds.has(f.id))run.push(f);else flush();}flush();
 for(const f of before)if(!oldIds.has(f.id)&&!directIds.has(f.id)&&[...featureReads(f)].some(id=>removed.has(id)))throw Error('削除される文字の輪郭やボディを後続工程が参照しています。その工程の参照を変更してから再編集してください');
 const next=[];let inserted=false;for(const f of before){if(oldIds.has(f.id)){if(!inserted){next.push(...batch);inserted=true;}continue;}next.push(...(replacements.get(f.id)||[copy(f)]));}if(next.length>150)throw Error('工程数が150を超えます。文字数を減らしてください');
 const oldById=new Map(before.map(f=>[f.id,f])),newSketchIds=new Set(batch.map(f=>f.id)),alignedBefore=next.map(f=>copy(newSketchIds.has(f.id)?f:oldById.get(f.id)||f));
 return {features:next,before:alignedBefore,start:next.findIndex(f=>directIds.has(f.id)),sketches:batch,regions:newRegions,hasExtrusions:group.extrusions.length>0,textId:group.id};
}
