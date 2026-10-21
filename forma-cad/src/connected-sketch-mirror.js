import * as THREE from 'three';
import {basisFor} from './frames.js';
import {pipeWorldPoints} from './pipe-path.js';
import {sketchSegments} from './sketch-selection.js';
import {mirrorSketch} from './sketch-mirror.js';

const EPS=1e-6;
export function sketchMirrorReference(features,reference){
 const source=features.find(f=>f.id===reference?.featureId&&f.kind==='sketch'&&!f.groupHidden);
 if(!source||source.arc||!['line','rect','polyline','region'].includes(source.profile))return null;
 const edge=sketchSegments(source).find(edge=>edge.index===reference.index);if(!edge||edge.a.distanceTo(edge.b)<EPS)return null;
 const normal=edge.b.clone().sub(edge.a).cross(basisFor(source).n).normalize();
 return {source,edge,spec:{mirrorNormal:normal.toArray(),mirrorOrigin:edge.a.toArray(),offset:0}};
}

// Only explicit shared endpoints/vertices connect strokes. A visual crossing or
// nearby sketch on a different plane/group must not pull in unrelated geometry.
export function connectedSketchSources(features,reference){
 const root=sketchMirrorReference(features,reference);if(!root)throw Error('ミラーの基準にする直線をクリックしてください');
 const {source}=root,n=basisFor(source).n,origin=new THREE.Vector3(source.x,source.y,source.z);
 const candidates=features.filter(f=>f.kind==='sketch'&&!f.groupHidden&&f.profile!=='point'&&f.groupId===source.groupId&&Math.abs(basisFor(f).n.dot(n))>1-1e-8&&Math.abs(new THREE.Vector3(f.x,f.y,f.z).sub(origin).dot(n))<EPS);
 const entries=candidates.map(feature=>{const points=pipeWorldPoints(feature).map(p=>new THREE.Vector3(...p)),curved=feature.arc||['spline','circle'].includes(feature.profile);return {feature,points:feature.profile==='circle'?[]:curved?[points[0],points.at(-1)]:points};});
 const buckets=new Map(),cell=p=>[p.x,p.y,p.z].map(v=>Math.floor(v/EPS));
 for(const entry of entries)for(const point of entry.points){const key=cell(point).join(',');if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push({entry,point});}
 const connected=new Set([source.id]),pending=[entries.find(e=>e.feature.id===source.id)];
 while(pending.length){const item=pending.pop();for(const point of item.points){const [x,y,z]=cell(point);for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)for(let k=-1;k<=1;k++)for(const neighbor of buckets.get([x+i,y+j,z+k].join(','))||[]){const {entry}=neighbor;if(connected.has(entry.feature.id)||point.distanceToSquared(neighbor.point)>EPS*EPS)continue;connected.add(entry.feature.id);pending.push(entry);}}}
 return {sources:features.filter(f=>connected.has(f.id)),spec:root.spec};
}

export function mirrorConnectedSketch(features,reference){
 const {sources,spec}=connectedSketchSources(features,reference),copies=sources.map(f=>mirrorSketch(f,spec));
 return {sources,copies,spec,features:[...features,...copies]};
}
