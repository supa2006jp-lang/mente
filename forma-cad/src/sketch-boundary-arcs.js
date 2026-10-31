import * as THREE from 'three';
import {cadPosition} from './cad-coordinates.js';

// A circular-looking polygon is not evidence of an analytic curve. Require a
// circle recipe on this body as well as a matching current geometric rim.
export function solidBoundaryCircleHints(features,bodyId,edgeGeometry,basis,offset){
 const radii=[];for(const f of features){if(f.kind==='sketch'||f.kind==='plane'||(f.operation==='new'?f.id:f.target)!==bodyId)continue;const sources=f.profile==='circle'?[f]:features.filter(s=>f.region?.sourceIds?.includes(s.id)&&s.profile==='circle');for(const source of sources){const r=source.diameter/2;if(f.mode==='thin'){radii.push(r+(f.side==='outside'?f.wall:f.side==='center'?f.wall/2:0),r-(f.side==='inside'?f.wall:f.side==='center'?f.wall/2:0));}else radii.push(r);}}
 if(!radii.length)return [];const result=[];
 for(const curve of new Set([...(edgeGeometry?.userData.circularEdges?.values()||[]),...(edgeGeometry?.userData.arcEdges?.values()||[])])){
  if(!radii.some(r=>Math.abs(r-curve.radius)<=1e-5)||curve.points.length<3)continue;
  let points=curve.points.map(p=>new THREE.Vector3(...p));const a=points[0],normal=points[Math.floor(points.length/3)].clone().sub(a).cross(points[Math.floor(points.length*2/3)].clone().sub(a)).normalize();if(Math.abs(normal.dot(basis.n))<1-1e-8)continue;const center=new THREE.Vector3(...curve.center),radius=curve.radius;if(points.some(p=>Math.abs(p.distanceTo(center)-radius)>1e-5))continue;const height=offset-center.dot(basis.n);center.addScaledVector(basis.n,height);points=points.map(p=>p.addScaledVector(basis.n,height));if(points.some(p=>Math.abs(p.dot(basis.n)-offset)>1e-6))continue;
  const attr=cadPosition(edgeGeometry),segments=[];for(const map of [edgeGeometry.userData.circularEdges,edgeGeometry.userData.arcEdges])for(const [i,c]of map||[]){if(c!==curve)continue;segments.push([0,1].map(j=>{const p=new THREE.Vector3().fromBufferAttribute(attr,i+j).addScaledVector(basis.n,height);return [p.dot(basis.u),p.dot(basis.v)];}));}
  result.push({center:[center.dot(basis.u),center.dot(basis.v)],radius,points:points.map(p=>[p.dot(basis.u),p.dot(basis.v)]),segments});
 }
 return result;
}
const distance=(p,q)=>Math.hypot(p[0]-q[0],p[1]-q[1]);
function matches(a,b,c){if([a,b].some(p=>Math.abs(distance(p,c.center)-c.radius)>1e-5))return false;return (c.segments||c.points.slice(1).map((q,i)=>[c.points[i],q])).some(([p,q])=>{const dx=q[0]-p[0],dy=q[1]-p[1],l=dx*dx+dy*dy;return l>1e-14&&[a,b].every(v=>{const t=((v[0]-p[0])*dx+(v[1]-p[1])*dy)/l;return t>=-1e-6&&t<=1+1e-6&&Math.abs((v[0]-p[0])*dy-(v[1]-p[1])*dx)<=1e-5*Math.sqrt(l);});});}
export function boundaryArcRuns(run,circles){
 if(run.closed||!circles.length)return [run];const tags=run.points.slice(1).map((p,i)=>circles.find(c=>matches(run.points[i],p,c))||null),result=[];
 for(let start=0;start<tags.length;){let end=start+1;while(end<tags.length&&tags[end]===tags[start])end++;const points=run.points.slice(start,end+1),circle=tags[start];
  if(circle&&points.length>=3){let sweep=0,valid=true;for(let i=1;i<points.length;i++){const a=points[i-1].map((v,j)=>v-circle.center[j]),b=points[i].map((v,j)=>v-circle.center[j]),angle=Math.atan2(a[0]*b[1]-a[1]*b[0],a[0]*b[0]+a[1]*b[1]);if(Math.abs(angle)>Math.PI/3||i>1&&Math.sign(angle)!==Math.sign(sweep))valid=false;sweep+=angle;}if(valid&&Math.abs(sweep)>1e-5&&Math.abs(sweep)<2*Math.PI-1e-5){const p=points.at(-1),sign=Math.sign(sweep),radial=p.map((v,i)=>(v-circle.center[i])/circle.radius);result.push({points,closed:false,arc:{source:'solid-boundary',endTangent:[-radial[1]*sign,radial[0]*sign]}});}else result.push({points,closed:false});}
  else result.push({points,closed:false});start=end;
 }
 return result;
}
