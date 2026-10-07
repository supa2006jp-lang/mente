import * as THREE from 'three';
import {basisFor} from './frames.js';
import {extrusionEndDimensions} from './extrusion-feedback.js';
// Read the opening boundaries from the actual terminal cap, including tapered
// and CAD previews. Subtracting twice the wall thickness is wrong for these.
export function mergeDimensionMeshes(meshes){
 const vertices=[],triangles=[];
 for(const mesh of meshes){const offset=vertices.length/3;for(const value of mesh.vertices)vertices.push(value);if(mesh.triangles)for(const i of mesh.triangles)triangles.push(offset+i);else for(let i=0;i<mesh.vertices.length/3;i++)triangles.push(offset+i);}
 return {vertices,triangles};
}
function inside(point,ring){let result=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])result=!result;}return result;}
function extents(ring){let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;for(const p of ring){minX=Math.min(minX,p[0]);maxX=Math.max(maxX,p[0]);minY=Math.min(minY,p[1]);maxY=Math.max(maxY,p[1]);}return {minX,maxX,minY,maxY};}
function bounds(ring){const b=extents(ring);return {width:b.maxX-b.minX,height:b.maxY-b.minY};}
function area(ring){return Math.abs(ring.reduce((s,p,i)=>{const q=ring[(i+1)%ring.length];return s+p[0]*q[1]-p[1]*q[0];},0)/2);}
function rectangle(ring){const b=bounds(ring);return Math.abs(area(ring)-b.width*b.height)<Math.max(.001,b.width*b.height*1e-5);}
export function thinEndDimensions(feature,mesh,{round=true}={}){
 if(feature.mode!=='thin')return null;const outer=extrusionEndDimensions(feature,mesh.vertices,{round});if(!outer)return null;
 if(feature.profile==='line'||['spline','polyline'].includes(feature.profile)&&!feature.closed)return {outer,inners:[],kind:'open'};
 const b=basisFor(feature.region||feature),p=new THREE.Vector3(),sign=Math.sign(feature.depth)||1;
 if(feature.profile!=='region'){const a=(feature.angle||0)*Math.PI/180,u=b.u.clone(),v=b.v.clone();b.u.copy(u).multiplyScalar(Math.cos(a)).addScaledVector(v,Math.sin(a));b.v.copy(v).multiplyScalar(Math.cos(a)).addScaledVector(u,-Math.sin(a));}
 const projected=[];let end=-Infinity;
 for(let i=0;i<mesh.vertices.length;i+=3){p.fromArray(mesh.vertices,i);const v=[p.dot(b.u),p.dot(b.v),p.dot(b.n)*sign];projected.push(v);end=Math.max(end,v[2]);}
 const tolerance=Math.max(1e-5,Math.abs(end)*1e-8),points=[],keys=new Map(),ids=projected.map(v=>{if(Math.abs(v[2]-end)>tolerance)return -1;const key=Math.round(v[0]*1e5)+','+Math.round(v[1]*1e5);if(!keys.has(key)){keys.set(key,points.length);points.push(v);}return keys.get(key);}),edges=new Map();
 const count=mesh.triangles?.length??projected.length;
 for(let i=0;i+2<count;i+=3){const tri=[0,1,2].map(j=>ids[mesh.triangles?mesh.triangles[i+j]:i+j]);if(tri.some(v=>v<0)||new Set(tri).size<3)continue;for(let j=0;j<3;j++){const a=tri[j],c=tri[(j+1)%3],key=Math.min(a,c)+','+Math.max(a,c);const edge=edges.get(key);if(edge)edge.count++;else edges.set(key,{a,c,count:1});}}
 const neighbors=new Map();for(const {a,c,count} of edges.values())if(count===1){if(!neighbors.has(a))neighbors.set(a,[]);if(!neighbors.has(c))neighbors.set(c,[]);neighbors.get(a).push(c);neighbors.get(c).push(a);}
 if(!neighbors.size||[...neighbors.values()].some(n=>n.length!==2))return {outer,inners:null,kind:'bounds'};
 const used=new Set(),rings=[];
 for(const start of neighbors.keys()){if(used.has(start))continue;let previous=-1,current=start;const ring=[];
  do{if(used.has(current))return {outer,inners:null,kind:'bounds'};used.add(current);ring.push(points[current]);const next=neighbors.get(current).find(n=>n!==previous);previous=current;current=next;}while(current!==start);
  if(ring.length>=3)rings.push(ring);
 }
 const enclosed=rings.filter(r=>rings.filter(other=>other!==r&&inside(r[0],other)).length%2===1).sort((a,c)=>area(c)-area(a));
 const circleSize=ring=>{if(ring.length<16)return null;const b=extents(ring),cx=(b.minX+b.maxX)/2,cy=(b.minY+b.maxY)/2;let min=Infinity,max=0;for(const p of ring){const r=Math.hypot(p[0]-cx,p[1]-cy);min=Math.min(min,r);max=Math.max(max,r);}return max-min<Math.max(.005,max*1e-4)?{diameter:2*max}:null;};
 const circular=outer.diameter!==undefined&&rings.length===2&&rings.every(r=>circleSize(r));
 // A circular source can be clipped to a non-circular terminal cap by contact.
 const measuredOuter=outer.diameter!==undefined&&!circular?bounds([...neighbors.keys()].map(i=>points[i])):outer;
 const inners=enclosed.map(r=>{if(!circular)return bounds(r);return circleSize(r);});
 return {outer:measuredOuter,inners,kind:circular?'circle':rings.length===2&&rings.every(rectangle)?'rect':'bounds'};
}
export function thinDimensionsText(d,fmt){
 if(!d)return '';const dimension=size=>size.diameter!==undefined?fmt(size.diameter)+' mm':'幅 '+fmt(size.width)+' × 奥行き '+fmt(size.height)+' mm';
 const note=d.kind==='bounds'?'（外接）':'',lines=[(d.outer.diameter!==undefined?'外径 ':('外寸'+note+'：'))+dimension(d.outer)];
 if(d.inners===null)lines.push('内寸：取得できません');else if(!d.inners.length)lines.push(d.kind==='open'?'内寸：なし（開いた線）':'内寸：なし');
 else for(const [i,size]of d.inners.entries())lines.push((size.diameter!==undefined?'内径':'内寸'+note)+(d.inners.length>1?' '+(i+1):'')+(size.diameter!==undefined?' ':'：')+dimension(size));
 return lines.join('\n');
}
