import * as R from 'replicad';
import * as THREE from 'three';
const message='未加工の円柱・直方体・凸多角形の角柱を選択してください。穴・段差・テーパー・凹形状には対応していません';
const tuple=v=>{try{return v.toTuple();}finally{v.delete();}};
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function hull(points){const unique=points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]).filter((p,i,a)=>!i||distance(p,a[i-1])>1e-6),cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]),half=list=>{const h=[];for(const p of list){while(h.length>1&&cross(h.at(-2),h.at(-1),p)<=1e-8)h.pop();h.push(p);}return h;};return [...half(unique).slice(0,-1),...half([...unique].reverse()).slice(0,-1)];}
function areaCenter(points){let twice=0,x=0,y=0;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],cross=a[0]*b[1]-b[0]*a[1];twice+=cross;x+=(a[0]+b[0])*cross;y+=(a[1]+b[1])*cross;}return {area:twice/2,center:[x/(3*twice),y/(3*twice)]};}
function capPoints(face){const holes=face.clone().innerWires();try{if(holes.length)return null;}finally{holes.forEach(w=>w.delete());}const wire=face.clone().outerWire(),edges=wire.edges;try{if(edges.length<3||edges.length>64||edges.some(e=>e.geomType!=='LINE'))return null;return edges.flatMap(e=>[tuple(e.startPoint),tuple(e.endPoint)]);}finally{edges.forEach(e=>e.delete());wire.delete();}}
export function prismJointInfo(base,p={},preferredAxis){
 if(!base)throw Error('変換するソリッドを選択してください');const faces=base.faces;
 try{
  if(faces.length<5||faces.length>66||faces.some(f=>f.geomType!=='PLANE'))throw Error(message);
  const data=faces.map(face=>({face,normal:new THREE.Vector3(...tuple(face.normalAt())).normalize(),center:new THREE.Vector3(...tuple(face.center))})),axes=[];
  for(const d of data){const n=d.normal.clone(),major=n.toArray().reduce((a,v,i,arr)=>Math.abs(v)>Math.abs(arr[a])?i:a,0);if(n.getComponent(major)<0)n.negate();if(!axes.some(a=>Math.abs(a.dot(n))>1-1e-8))axes.push(n);}
  const manual={X:[1,0,0],Y:[0,1,0],Z:[0,0,1]}[p.jointAxis],preferred=new THREE.Vector3(...(manual||preferredAxis||[0,0,1])).normalize(),options=[];
  for(const axis of axes){
   if(manual&&Math.abs(axis.dot(preferred))<1-1e-7)continue;
   const caps=data.filter(d=>Math.abs(d.normal.dot(axis))>1-1e-7);if(caps.length!==2||data.some(d=>!caps.includes(d)&&Math.abs(d.normal.dot(axis))>1e-7))continue;
   caps.sort((a,b)=>a.center.dot(axis)-b.center.dot(axis));const height=caps[1].center.clone().sub(caps[0].center).dot(axis);if(height<.01)continue;
   const ends=caps.map(d=>capPoints(d.face));if(ends.some(p=>!p))continue;
   const rotation=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),axis),u=new THREE.Vector3(1,0,0).applyQuaternion(rotation),v=new THREE.Vector3(0,1,0).applyQuaternion(rotation),outlines=ends.map(points=>hull(points.map(p=>{const point=new THREE.Vector3(...p);return [point.dot(u),point.dot(v)];}))),outline=outlines[0];
   if(outline.length<3||outline.length!==outlines[1].length||outline.some((p,i)=>distance(p,outlines[1][i])>1e-5))continue;
   const {area,center}=areaCenter(outline);if(!(area>1e-6)||Math.abs(area-R.measureArea(caps[0].face))>Math.max(.001,area*1e-6))continue;
   const expected=area*height;if(Math.abs(R.measureVolume(base)-expected)>Math.max(.001,expected*1e-6))continue;
   const profile=outline.map(p=>[p[0]-center[0],p[1]-center[1]]),radius=Math.min(...profile.map((a,i)=>{const b=profile[(i+1)%profile.length];return Math.abs(a[0]*b[1]-a[1]*b[0])/distance(a,b);})),outerRadius=Math.max(...profile.map(p=>Math.hypot(...p))),origin=u.clone().multiplyScalar(center[0]).addScaledVector(v,center[1]).addScaledVector(axis,caps[0].center.dot(axis));
   if(radius<=.01)continue;options.push({radius,outerRadius,height,origin:origin.toArray(),axis:axis.toArray(),profile,shapeType:'polygon',score:Math.abs(axis.dot(preferred))});
  }
  options.sort((a,b)=>b.score-a.score||b.height-a.height);if(!options.length)throw Error(message);const {score,...info}=options[0];return info;
 }finally{faces.forEach(f=>f.delete());}
}
export function polygonCylinder(profile,height,z=0){const edges=profile.map((a,i)=>{const b=profile[(i+1)%profile.length];return R.makeLine([a[0],a[1],z],[b[0],b[1],z]);});let wire,face,vector;try{wire=R.assembleWire(edges);face=R.makeFace(wire);vector=new R.Vector([0,0,height]);return R.basicFaceExtrusion(face,vector);}finally{vector?.delete();face?.delete();wire?.delete();edges.forEach(e=>e.delete());}}
