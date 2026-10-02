import * as THREE from 'three';
import Clipper from 'clipper-lib';
import {sketchPoints,planeCoordinates,findRegions} from './regions.js';
import {worldPoint} from './frames.js';
import {offsetSketch} from './sketch-offset.js';
export function sketchSegments(f){const ps=sketchPoints(f),r={...f,offset:planeCoordinates(f).offset};return ps.slice(1).map((b,i)=>({index:i,a:worldPoint(r,ps[i]),b:worldPoint(r,b)}));}
function segmentInRect(a,b,r){let lo=0,hi=1;for(const [p,q] of [[a.x-b.x,a.x-r.left],[b.x-a.x,r.right-a.x],[a.y-b.y,a.y-r.top],[b.y-a.y,r.bottom-a.y]]){if(Math.abs(p)<1e-12){if(q<0)return false;}else if(p<0)lo=Math.max(lo,q/p);else hi=Math.min(hi,q/p);}return lo<=hi;}
export function rangeSketchHits(features,camera,width,height,rect){const result=new Map(),inside=p=>p.z>=-1&&p.z<=1&&p.x>=rect.left&&p.x<=rect.right&&p.y>=rect.top&&p.y<=rect.bottom,project=v=>{const p=v.clone().project(camera);return {x:(p.x+1)*width/2,y:(1-p.y)*height/2,z:p.z};};
 for(const f of features.filter(f=>f.kind==='sketch'&&!f.groupHidden)){if(f.profile==='point'){if(inside(project(new THREE.Vector3(f.x,f.y,f.z))))result.set(f.id,new Set([0]));continue;}const segments=sketchSegments(f),tests=segments.map(s=>{const a=project(s.a),b=project(s.b);return rect.crossing?a.z>=-1&&a.z<=1&&b.z>=-1&&b.z<=1&&segmentInRect(a,b,rect):inside(a)&&inside(b);});
  if(['circle','spline'].includes(f.profile)){if(rect.crossing?tests.some(Boolean):tests.every(Boolean))result.set(f.id,new Set(segments.map(s=>s.index)));}else{const ids=segments.filter((s,i)=>tests[i]).map(s=>s.index);if(ids.length)result.set(f.id,new Set(ids));}
 }return result;
}
export function selectedSketchParts(f,indices,keepSelected=true){
 if(f.profile==='point')return indices.has(0)===keepSelected?[structuredClone(f)]:[];
 const points=sketchPoints(f),n=points.length-1,keep=i=>indices.has(i)===keepSelected;
 if(Array.from({length:n},(_,i)=>keep(i)).every(Boolean))return [structuredClone(f)];
 const parts=[];let chain=[];for(let i=0;i<n;i++){if(keep(i)){if(!chain.length)chain.push(points[i]);chain.push(points[i+1]);}else if(chain.length){parts.push(chain);chain=[];}}if(chain.length)parts.push(chain);
 const closed=Math.hypot(points[0][0]-points.at(-1)[0],points[0][1]-points.at(-1)[1])<1e-7;
 if(closed&&parts.length>1&&keep(0)&&keep(n-1)){const last=parts.pop();parts[0]=last.slice(0,-1).concat(parts[0]);}
 return parts.map((p,i)=>({...structuredClone(f),id:i?crypto.randomUUID():f.id,profile:'polyline',points:p,closed:false}));
}
export function deleteSketchSelection(features,selection){return features.flatMap(f=>selection.has(f.id)?selectedSketchParts(f,selection.get(f.id),false):[f]);}
export function offsetSketchSelection(features,selection,distance){
 const chosen=features.filter(f=>f.profile!=='point'&&selection.has(f.id)).flatMap(f=>selectedSketchParts(f,selection.get(f.id))),regions=findRegions(chosen),groups=new Map();
 if(!regions.length)return chosen.flatMap(f=>offsetSketch(f,distance));
 for(const r of regions){const key=JSON.stringify([r.plane,r.frame,r.offset]);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);}
 const used=new Set(regions.flatMap(r=>r.sourceIds));const result=chosen.filter(f=>!used.has(f.id)).flatMap(f=>offsetSketch(f,distance)),scale=100000;
 for(const rs of groups.values()){const clip=new Clipper.Clipper();for(const r of rs){const path=r.outer.map(([x,y])=>({X:Math.round(x*scale),Y:Math.round(y*scale)}));if(!Clipper.Clipper.Orientation(path))path.reverse();clip.AddPath(path,Clipper.PolyType.ptSubject,true);}const tree=new Clipper.PolyTree();clip.Execute(Clipper.ClipType.ctUnion,tree,Clipper.PolyFillType.pftNonZero,Clipper.PolyFillType.pftNonZero);
  for(let node=tree.GetFirst();node;node=node.GetNext()){if(node.IsHole())continue;const r=rs[0],p=worldPoint(r,[0,0]),source={...chosen[0],id:crypto.randomUUID(),name:'選択外周',kind:'sketch',profile:'polyline',plane:r.plane,frame:r.frame,x:p.x,y:p.y,z:p.z,points:node.Contour().map(q=>[q.X/scale,q.Y/scale]),closed:true};result.push(...offsetSketch(source,distance));}
 }return result;
}
