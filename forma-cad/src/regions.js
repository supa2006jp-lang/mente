import {basisFor,frameMatrix,validateFrame} from './frames.js';
import * as THREE from 'three';
import Clipper from 'clipper-lib';
const EPS=1e-6,SCALE=100000;
const cross=(a,b)=>a[0]*b[1]-a[1]*b[0],sub=(a,b)=>[a[0]-b[0],a[1]-b[1]],dot=(a,b)=>a[0]*b[0]+a[1]*b[1];
export const ringArea=p=>p.reduce((s,a,i)=>s+cross(a,p[(i+1)%p.length]),0)/2;
export function pointInRing(p,ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
export function regionContains(r,p){return pointInRing(p,r.outer)&&!r.holes.some(h=>pointInRing(p,h));}
export function planeCoordinates(f){if(f.frame){const b=basisFor(f),p=new THREE.Vector3(f.x,f.y,f.z);return {u:p.dot(b.u),v:p.dot(b.v),offset:p.dot(b.n)};}return f.plane==='XY'?{u:f.x,v:f.y,offset:f.z}:f.plane==='XZ'?{u:f.x,v:-f.z,offset:f.y}:{u:-f.z,v:f.y,offset:f.x};}
export function sketchPoints(f){if(f.profile==='point'){const o=planeCoordinates(f);return [[o.u,o.v]];}
 const local=[];if(f.profile==='polyline'){const points=f.points.map(p=>[...p]);if(f.closed)points.push([...points[0]]);return points;}if(f.profile==='spline'){const curve=new THREE.CatmullRomCurve3(f.points.map(p=>new THREE.Vector3(...p,0)),!!f.closed,'centripetal');return curve.getPoints(Math.max(32,f.points.length*16)).map(p=>[p.x,p.y]);}if(f.profile==='line')local.push([-f.width/2,0],[f.width/2,0]);
 else if(f.profile==='rect')local.push([-f.width/2,-f.height/2],[f.width/2,-f.height/2],[f.width/2,f.height/2],[-f.width/2,f.height/2],[-f.width/2,-f.height/2]);
 else if(f.profile==='circle')for(let i=0;i<=128;i++)local.push([Math.cos(i*Math.PI/64)*f.diameter/2,Math.sin(i*Math.PI/64)*f.diameter/2]);
 const a=f.angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a),o=planeCoordinates(f);return local.map(([x,y])=>[o.u+x*c-y*s,o.v+x*s+y*c]);
}
const key=p=>Math.round(p[0]/EPS)+','+Math.round(p[1]/EPS);
const lerp=(s,t)=>[s.a[0]+(s.b[0]-s.a[0])*t,s.a[1]+(s.b[1]-s.a[1])*t];
function splitPair(a,b){
 const r=sub(a.b,a.a),s=sub(b.b,b.a),q=sub(b.a,a.a),den=cross(r,s);
 if(Math.abs(den)>1e-10){const t=cross(q,s)/den,u=cross(q,r)/den;if(t>=-EPS&&t<=1+EPS&&u>=-EPS&&u<=1+EPS){a.ts.push(Math.max(0,Math.min(1,t)));b.ts.push(Math.max(0,Math.min(1,u)));}}
 else if(Math.abs(cross(q,r))<EPS*Math.sqrt(dot(r,r))){for(const p of [b.a,b.b]){const t=dot(sub(p,a.a),r)/dot(r,r);if(t>0&&t<1)a.ts.push(t);}for(const p of [a.a,a.b]){const t=dot(sub(p,b.a),s)/dot(s,s);if(t>0&&t<1)b.ts.push(t);}}
}
function facesForSegments(segments){
 const sorted=segments.map(s=>({...s,ts:[0,1],minX:Math.min(s.a[0],s.b[0]),maxX:Math.max(s.a[0],s.b[0]),minY:Math.min(s.a[1],s.b[1]),maxY:Math.max(s.a[1],s.b[1])})).sort((a,b)=>a.minX-b.minX);
 let active=[];for(const s of sorted){active=active.filter(a=>a.maxX>=s.minX-EPS);for(const a of active)if(a.maxY>=s.minY-EPS&&a.minY<=s.maxY+EPS)splitPair(a,s);active.push(s);}
 const nodes=new Map(),edges=new Map();const get=p=>{const k=key(p);if(!nodes.has(k))nodes.set(k,{key:k,p,neighbors:new Set()});return nodes.get(k);};
 for(const s of sorted){s.ts.sort((a,b)=>a-b);for(let i=1;i<s.ts.length;i++){const a=get(lerp(s,s.ts[i-1])),b=get(lerp(s,s.ts[i]));if(a.key===b.key)continue;const k=[a.key,b.key].sort().join('|');if(!edges.has(k)){edges.set(k,[a,b]);a.neighbors.add(b);b.neighbors.add(a);}}}
 // Remove bridges, including dangling lines: they cannot bound a face.
 let time=0;const bridges=[];for(const root of nodes.values()){if(root.disc)continue;root.disc=root.low=++time;const stack=[{n:root,parent:null,next:[...root.neighbors],i:0}];while(stack.length){const f=stack.at(-1);if(f.i<f.next.length){const n=f.next[f.i++];if(n===f.parent)continue;if(!n.disc){n.disc=n.low=++time;stack.push({n,parent:f.n,next:[...n.neighbors],i:0});}else f.n.low=Math.min(f.n.low,n.disc);}else{stack.pop();if(f.parent){f.parent.low=Math.min(f.parent.low,f.n.low);if(f.n.low>f.parent.disc)bridges.push([f.n,f.parent]);}}}}
 for(const [a,b] of bridges){a.neighbors.delete(b);b.neighbors.delete(a);}
 for(const n of nodes.values())n.order=[...n.neighbors].sort((a,b)=>Math.atan2(a.p[1]-n.p[1],a.p[0]-n.p[0])-Math.atan2(b.p[1]-n.p[1],b.p[0]-n.p[0]));
 const visited=new Set(),rings=[];
 for(const a of nodes.values())for(const b of a.order){let u=a,v=b;const path=[],start=a.key+'>'+b.key;if(visited.has(start))continue;for(let guard=0;guard<edges.size*2+2;guard++){const k=u.key+'>'+v.key;if(visited.has(k))break;visited.add(k);path.push(u.p);const order=v.order,index=order.indexOf(u),w=order[(index-1+order.length)%order.length];u=v;v=w;if(u===a&&v===b)break;}
  if(u===a&&v===b&&path.length>=3&&ringArea(path)>1e-7)rings.push(path);
 }
 return rings;
}
function interiorPoint(r){const a=r[0],b=r[1],d=sub(b,a),len=Math.hypot(...d),eps=Math.min(len*1e-5,1e-4);return [(a[0]+b[0])/2-d[1]/len*eps,(a[1]+b[1])/2+d[0]/len*eps];}
function hash(s){let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return (h>>>0).toString(36);}
function canonical(r){const a=r.map(key),start=a.reduce((j,k,i)=>k<a[j]?i:j,0);return [...a.slice(start),...a.slice(0,start)].join(';');}
export function findRegions(features){
 const groups=new Map();for(const f of features.filter(f=>f.kind==='sketch')){const fb=basisFor(f),o=planeCoordinates(f),n=fb.n.clone(),components=n.toArray(),dominant=components.reduce((j,x,i)=>Math.abs(x)>Math.abs(components[j])?i:j,0);if(components[dominant]<0)n.negate();const offset=o.offset*fb.n.dot(n),k=n.toArray().map(x=>Math.round(x/EPS)).join(',')+':'+Math.round(offset/EPS);if(!groups.has(k)){let plane='CUSTOM',frame;for(const name of ['XY','XZ','YZ'])if(basisFor({plane:name}).n.distanceTo(n)<EPS)plane=name;if(plane==='CUSTOM'){const ref=Math.abs(n.z)<.9?new THREE.Vector3(0,0,1):new THREE.Vector3(0,1,0),u=ref.cross(n).normalize(),v=n.clone().cross(u);frame={u:u.toArray(),v:v.toArray(),n:n.toArray()};}groups.set(k,{plane,frame,offset,segments:[],sourceIds:[]});}const g=groups.get(k),gb=basisFor(g),p=sketchPoints(f).map(([u,v])=>{const world=fb.u.clone().multiplyScalar(u).addScaledVector(fb.v,v).addScaledVector(fb.n,o.offset);return [world.dot(gb.u),world.dot(gb.v)];});g.sourceIds.push(f.id);for(let i=1;i<p.length;i++)if(Math.hypot(...sub(p[i],p[i-1]))>EPS)g.segments.push({a:p[i-1],b:p[i],sourceId:f.id});}
 const regions=[];for(const [groupKey,g] of groups){if(g.segments.length>20000)throw Error('スケッチが複雑すぎます。線の数を減らしてください。');const rings=facesForSegments(g.segments);const entries=rings.map(outer=>({outer,holes:[],area:ringArea(outer),parent:null}));for(const child of entries){const p=interiorPoint(child.outer);const parents=entries.filter(r=>r.area>child.area+EPS&&pointInRing(p,r.outer));if(parents.length){child.parent=parents.sort((a,b)=>a.area-b.area)[0];child.parent.holes.push(child.outer);}}
  for(const e of entries){const area=e.area-e.holes.reduce((sum,h)=>sum+ringArea(h),0);if(area<1e-6)continue;regions.push({id:groupKey+':'+hash(canonical(e.outer)+e.holes.map(canonical).sort().join('/')),plane:g.plane,frame:g.frame,offset:g.offset,outer:e.outer,holes:e.holes,area,sourceIds:boundarySources(e,g.segments)});}
 }
 return regions;
}
export function validateRegion(r){if(!r||!['XY','XZ','YZ','CUSTOM'].includes(r.plane)||!Number.isFinite(r.offset)||Math.abs(r.offset)>10000||!Array.isArray(r.outer)||!Array.isArray(r.holes)||r.holes.length>150)throw Error('領域データが不正です。');if(r.plane==='CUSTOM')validateFrame(r.frame);let total=0;for(const ring of [r.outer,...r.holes]){if(!Array.isArray(ring)||ring.length<3||(total+=ring.length)>20000||ring.some(p=>!Array.isArray(p)||p.length!==2||p.some(x=>!Number.isFinite(x)||Math.abs(x)>25000)))throw Error('輪郭データが不正です。');}return r;}
function pathToShape(r){const shape=new THREE.Shape(r.outer.map(p=>new THREE.Vector2(...p)));for(const h of r.holes)shape.holes.push(new THREE.Path(h.map(p=>new THREE.Vector2(...p))));return shape;}
function transform(g,r){if(r.frame){const b=basisFor(r);g.applyMatrix4(frameMatrix(r));g.translate(...b.n.multiplyScalar(r.offset).toArray());return g;}if(r.plane==='XZ')g.rotateX(-Math.PI/2);if(r.plane==='YZ')g.rotateY(Math.PI/2);if(r.plane==='XY')g.translate(0,0,r.offset);else if(r.plane==='XZ')g.translate(0,r.offset,0);else g.translate(r.offset,0,0);return g;}
export function regionFaceGeometry(r){validateRegion(r);return transform(new THREE.ShapeGeometry(pathToShape(r)),r);}
// CAD face tessellation can include nearly identical adjacent vertices. A mitered
// wall offset amplifies those microscopic edges into visible spikes.
function withoutNearDuplicateVertices(ring){
 const minEdge=0.001,clean=[];
 for(const point of ring){const previous=clean.at(-1);if(!previous||Math.hypot(point[0]-previous[0],point[1]-previous[1])>=minEdge)clean.push(point);}
 while(clean.length>3&&Math.hypot(clean[0][0]-clean.at(-1)[0],clean[0][1]-clean.at(-1)[1])<minEdge)clean.pop();
 return clean.length>=3?clean:ring;
}
export function thinShapes(r,wall,side,skipHoleWalls=false){
 const paths=[r.outer,...(skipHoleWalls?[]:r.holes)].map((ring,i)=>{let p=withoutNearDuplicateVertices(ring).map(([x,y])=>({X:Math.round(x*SCALE),Y:Math.round(y*SCALE)}));if(Clipper.Clipper.Orientation(p)!==(i===0))p.reverse();return p;});
 const offset=delta=>{if(delta===0)return paths;const o=new Clipper.ClipperOffset(4);o.AddPaths(paths,Clipper.JoinType.jtMiter,Clipper.EndType.etClosedPolygon);const result=[];o.Execute(result,delta*SCALE);return result;};
 const out=side==='outside'?wall:side==='center'?wall/2:0,inn=side==='inside'?wall:side==='center'?wall/2:0;
 const outer=offset(out),inner=offset(-inn);if(!inner.length)throw Error('壁厚が大きすぎます。内側の空間を残してください。');
 const c=new Clipper.Clipper();c.AddPaths(outer,Clipper.PolyType.ptSubject,true);c.AddPaths(inner,Clipper.PolyType.ptClip,true);const tree=new Clipper.PolyTree();c.Execute(Clipper.ClipType.ctDifference,tree,Clipper.PolyFillType.pftNonZero,Clipper.PolyFillType.pftNonZero);
 const shapes=[];for(let n=tree.GetFirst();n;n=n.GetNext()){if(n.IsHole())continue;shapes.push(pathToShape({outer:n.Contour().map(p=>[p.X/SCALE,p.Y/SCALE]),holes:n.Childs().filter(x=>x.IsHole()).map(h=>h.Contour().map(p=>[p.X/SCALE,p.Y/SCALE]))}));}if(!shapes.length)throw Error('薄い押し出しの領域を作成できません。');return shapes;
}
export function extrudeRegion(r,depth,mode='solid',wall=2,side='inside',skipHoleWalls=false){
 validateRegion(r);const shapes=mode==='thin'?thinShapes(r,wall,side,skipHoleWalls):[pathToShape(r)];const g=new THREE.ExtrudeGeometry(shapes,{depth:Math.abs(depth),bevelEnabled:false,steps:1});if(depth<0)g.translate(0,0,depth);return transform(g,r);
}

function boundarySources(region,segments){
 const ids=new Set();for(const ring of [region.outer,...region.holes])for(let i=0;i<ring.length;i++){
  const a=ring[i],b=ring[(i+1)%ring.length],p=[(a[0]+b[0])/2,(a[1]+b[1])/2];
  for(const s of segments){const d=sub(s.b,s.a),q=sub(p,s.a),l=dot(d,d),t=dot(q,d)/l;if(t>=-EPS&&t<=1+EPS&&Math.abs(cross(q,d))<=EPS*Math.sqrt(l))ids.add(s.sourceId);}
 }return [...ids].sort();
}
