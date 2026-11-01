import * as THREE from 'three';
import {basisFor,worldPoint} from './frames.js';
import {planeCoordinates,sketchPoints,regionContains} from './regions.js';
import {sketchSolidBoundaryCandidates} from './sketch-solid-boundary-fill.js';
import {validateSolidBoundaryLinks} from './solid-boundary-link-data.js';

function regionSeed(r){const points=[...r.outer,...r.holes.flat()],triangles=THREE.ShapeUtils.triangulateShape(r.outer.map(p=>new THREE.Vector2(...p)),r.holes.map(h=>h.map(p=>new THREE.Vector2(...p))));let best,size=0;for(const ids of triangles){const [a,b,c]=ids.map(i=>points[i]),area=Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]));if(area>size){size=area;best=[(a[0]+b[0]+c[0])/3,(a[1]+b[1]+c[1])/3];}}if(!best)throw Error('追従する囲みの内部を特定できません');return worldPoint(r,best).toArray();}
export function linkSolidBoundaryPlan(plan,source,boundaries,enabled=false){
 if(plan.bodyIds.length!==1){if(enabled)throw Error('追従は1つのソリッドの境界で囲む場合に使えます');return plan;}
 const info=boundaries.find(b=>b.bodyId===plan.bodyIds[0])?.info;if(!info?.bounds||enabled&&!info.topology){if(enabled)throw Error('境界情報を確認中です。少し待ってから確定してください');return plan;}
 const sourceIds=plan.region.sourceIds.filter(id=>!plan.added.some(f=>f.id===id)).sort((a,b)=>Number(b===source.id)-Number(a===source.id));if(!sourceIds.includes(source.id))throw Error('囲み元の線を特定できません');const bundleId=crypto.randomUUID(),base={version:1,bundleId,enabled,bodyId:plan.bodyIds[0],sourceIds,bounds:structuredClone(info.bounds),topology:info.topology||'',seed:regionSeed(plan.region),count:plan.added.length};
 return {...plan,added:plan.added.map((f,index)=>({...f,solidBoundaryLink:{...structuredClone(base),ownerId:f.id,index}}))};
}
export function setSolidBoundaryFollowing(features,ids,enabled){
 if(typeof enabled!=='boolean'||!ids.length)throw Error('追従する境界を選択してください');const selected=new Set(ids.map(id=>features.find(f=>f.id===id)?.solidBoundaryLink?.bundleId).filter(Boolean));if(!selected.size)throw Error('この線には境界の追従情報がありません');const next=features.map(f=>selected.has(f.solidBoundaryLink?.bundleId)?{...f,solidBoundaryLink:{...f.solidBoundaryLink,enabled}}:f);validateSolidBoundaryLinks(next);return next;
}
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function boundsMapper(a,b){return p=>p.map((v,i)=>{const d=a[1][i]-a[0][i];if(d<1e-6)throw Error('追従元のサイズを特定できません');return b[0][i]+(v-a[0][i])*(b[1][i]-b[0][i])/d;});}
function mapSketch(f,map){
 const b=basisFor(f),r={...f,offset:planeCoordinates(f).offset},world=(f.profile==='spline'?f.points:sketchPoints(f)).map(p=>new THREE.Vector3(...map(worldPoint(r,p).toArray()))),offset=world[0].dot(b.n);if(world.some(p=>Math.abs(p.dot(b.n)-offset)>1e-6))throw Error('作図面の向きが変わりました。追従をOFFにして囲み直してください');const points=world.map(p=>[p.dot(b.u),p.dot(b.v)]),closed=points.length>2&&Math.hypot(points[0][0]-points.at(-1)[0],points[0][1]-points.at(-1)[1])<1e-6;if(closed)points.pop();const origin=b.n.clone().multiplyScalar(offset),copy={...f,profile:'polyline',points,closed,x:origin.x,y:origin.y,z:origin.z};delete copy.arc;
 if(f.profile==='line'){const center=world[0].clone().add(world[1]).multiplyScalar(.5),d=world[1].clone().sub(world[0]);Object.assign(copy,{profile:'line',width:d.length(),angle:Math.atan2(d.dot(b.v),d.dot(b.u))*180/Math.PI,x:center.x,y:center.y,z:center.z});delete copy.points;delete copy.closed;}
 if(f.profile==='spline'){copy.profile='spline';copy.closed=f.closed;const anchor=worldPoint(r,f.points[0]),mappedAnchor=new THREE.Vector3(...map(anchor.toArray()));if(f.tangents){copy.tangents={...f.tangents};copy.tangentLengths={...f.tangentLengths};for(const [i,angle]of Object.entries(f.tangents)){if(angle===null)continue;const a=angle*Math.PI/180,tip=anchor.clone().addScaledVector(b.u,Math.cos(a)).addScaledVector(b.v,Math.sin(a)),d=new THREE.Vector3(...map(tip.toArray())).sub(mappedAnchor);copy.tangents[i]=Math.atan2(d.dot(b.v),d.dot(b.u))*180/Math.PI;if(f.tangentLengths?.[i]!==undefined)copy.tangentLengths[i]=f.tangentLengths[i]*d.length();}}}
 return copy;
}
export function refreshSolidBoundaryBundle(features,bundleId,getBoundaries){
 const groups=validateSolidBoundaryLinks(features),bundle=groups.get(bundleId)?.sort((a,b)=>a.solidBoundaryLink.index-b.solidBoundaryLink.index);if(!bundle?.length||!bundle[0].solidBoundaryLink.enabled)return features;const l=bundle[0].solidBoundaryLink,first=features.indexOf(bundle[0]),sources=l.sourceIds.map(id=>features.find(f=>f.id===id)),source=sources[0],input=features.slice(0,first).filter(f=>!bundle.includes(f)),initial=getBoundaries(input,source,l.bodyId),info=initial.find(b=>b.bodyId===l.bodyId)?.info;
 if(!info)throw Error('追従元のソリッドがありません。追従をOFFにしてください');if(l.topology&&l.topology!==info.topology)throw Error('元ソリッドの辺・面の構成が変わりました。追従をOFFにして囲み直してください');
 const moved=!equal(l.bounds,info.bounds),map=moved?boundsMapper(l.bounds,info.bounds):p=>p,updated=moved?sources.map(f=>mapSketch(f,map)):sources,byId=new Map(updated.map(f=>[f.id,f])),history=input.map(f=>byId.get(f.id)||f),seed=new THREE.Vector3(...map(l.seed));
 // Extrusion hides its input sketches for display. Their saved dependencies
 // still participate in replay, without changing the user's visibility state.
 const visibleHistory=history.map(f=>byId.has(f.id)?{...f,groupHidden:false}:f),visibleSource={...updated[0],groupHidden:false},plans=sketchSolidBoundaryCandidates(visibleHistory,visibleSource,getBoundaries(history,updated[0],l.bodyId)),matches=plans.filter(p=>{const b=basisFor(p.region);return p.bodyIds.length===1&&p.bodyIds[0]===l.bodyId&&p.added.length===l.count&&regionContains(p.region,[seed.dot(b.u),seed.dot(b.v)]);});
 if(matches.length!==1)throw Error('追従する囲みを一意に特定できません。追従をOFFにして囲み直してください');const plan=matches[0],available=[...plan.added],replacements=new Map(updated.map(f=>[f.id,f]));
 // Match whole paths, not unstable region IDs or tessellation indices.
 for(const old of bundle){const target=mapSketch(old,map),ps=sketchPoints(target),distance=f=>ps.reduce((s,p)=>s+Math.min(...sketchPoints(f).map(q=>Math.hypot(p[0]-q[0],p[1]-q[1]))),0)/ps.length,rank=available.map(f=>({f,cost:distance(f)})).sort((a,b)=>a.cost-b.cost);if(!rank.length||rank.length>1&&Math.abs(rank[0].cost-rank[1].cost)<1e-6)throw Error('追従する境界が曖昧です。囲み直してください');const f=rank[0].f;available.splice(available.indexOf(f),1);const next={...old,plane:f.plane,x:f.x,y:f.y,z:f.z,profile:f.profile,points:f.points,closed:f.closed,solidBoundaryLink:{...l,index:old.solidBoundaryLink.index,ownerId:old.id,bounds:structuredClone(info.bounds),topology:info.topology,seed:regionSeed(plan.region)}};if(f.frame)next.frame=f.frame;else delete next.frame;if(f.arc)next.arc=f.arc;else delete next.arc;replacements.set(old.id,next);}
 const next=features.map(f=>replacements.get(f.id)||f);return next.every((f,i)=>equal(f,features[i]))?features:next;
}
