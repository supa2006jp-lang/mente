import Clipper from 'clipper-lib';
import * as THREE from 'three';
export function basisFor(f){if(f.frame)return Object.fromEntries(['u','v','n'].map(k=>[k,new THREE.Vector3(...f.frame[k])]));return f.plane==='XZ'?{u:new THREE.Vector3(1,0,0),v:new THREE.Vector3(0,0,-1),n:new THREE.Vector3(0,1,0)}:f.plane==='YZ'?{u:new THREE.Vector3(0,0,-1),v:new THREE.Vector3(0,1,0),n:new THREE.Vector3(1,0,0)}:{u:new THREE.Vector3(1,0,0),v:new THREE.Vector3(0,1,0),n:new THREE.Vector3(0,0,1)};}
export function validateFrame(frame){if(!frame||['u','v','n'].some(k=>!Array.isArray(frame[k])||frame[k].length!==3||frame[k].some(x=>!Number.isFinite(x))))throw Error('作図平面が不正です');const {u,v,n}=basisFor({frame});if([u,v,n].some(x=>Math.abs(x.length()-1)>1e-5)||u.clone().cross(v).distanceTo(n)>1e-5)throw Error('作図平面の軸が不正です');}
export function frameMatrix(f){const b=basisFor(f);return new THREE.Matrix4().makeBasis(b.u,b.v,b.n);}
export function worldPoint(r,p){const b=basisFor(r);return b.u.multiplyScalar(p[0]).addScaledVector(b.v,p[1]).addScaledVector(b.n,r.offset);}

// Reconstruct planar regions by polygon union, including T-junctions from CSG.
export function planarFace(geometry,triangle){
 const p=geometry.attributes.position,ix=geometry.index,count=ix?ix.count:p.count,point=i=>new THREE.Vector3().fromBufferAttribute(p,ix?ix.getX(i):i);
 const a=point(triangle*3),b=point(triangle*3+1),c=point(triangle*3+2),n=b.clone().sub(a).cross(c.clone().sub(a)).normalize(),offset=n.dot(a);
 const reference=Math.abs(n.x)<.9?new THREE.Vector3(1,0,0):new THREE.Vector3(0,1,0),u=reference.addScaledVector(n,-reference.dot(n)).normalize(),v=n.clone().cross(u),scale=100000;
 const paths=[];for(let i=0;i<count;i+=3){const ps=[point(i),point(i+1),point(i+2)],normal=ps[1].clone().sub(ps[0]).cross(ps[2].clone().sub(ps[0])).normalize();if(normal.dot(n)<.999999||ps.some(q=>Math.abs(n.dot(q)-offset)>1e-4))continue;const path=ps.map(q=>({X:Math.round(q.dot(u)*scale),Y:Math.round(q.dot(v)*scale)}));if(!Clipper.Clipper.Orientation(path))path.reverse();paths.push(path);}
 const union=new Clipper.Clipper();union.AddPaths(paths,Clipper.PolyType.ptSubject,true);let merged=[];union.Execute(Clipper.ClipType.ctUnion,merged,Clipper.PolyFillType.pftNonZero,Clipper.PolyFillType.pftNonZero);
 // Close only sub-micron mesh seams; preserve actual openings and disconnected faces.
 for(const delta of [20,-20]){const co=new Clipper.ClipperOffset(2);co.AddPaths(merged,Clipper.JoinType.jtMiter,Clipper.EndType.etClosedPolygon);const out=[];co.Execute(out,delta);merged=out;}
 const cl=new Clipper.Clipper();cl.AddPaths(merged,Clipper.PolyType.ptSubject,true);const tree=new Clipper.PolyTree();cl.Execute(Clipper.ClipType.ctUnion,tree,Clipper.PolyFillType.pftNonZero,Clipper.PolyFillType.pftNonZero);
 const center=a.clone().add(b).add(c).multiplyScalar(1/3),click={X:Math.round(center.dot(u)*scale),Y:Math.round(center.dot(v)*scale)};let selected=null;
 for(let node=tree.GetFirst();node;node=node.GetNext()){if(node.IsHole()||!Clipper.Clipper.PointInPolygon(click,node.Contour()))continue;if(node.Childs().some(h=>h.IsHole()&&Clipper.Clipper.PointInPolygon(click,h.Contour())))continue;selected=node;break;}
 if(!selected)throw Error('選択面の輪郭を取得できません');const outer=selected.Contour().map(q=>[q.X/scale,q.Y/scale]),holes=selected.Childs().filter(h=>h.IsHole()&&Math.abs(Clipper.Clipper.Area(h.Contour()))>scale*scale*1e-6).map(h=>h.Contour().map(q=>[q.X/scale,q.Y/scale]));const area=r=>Math.abs(r.reduce((s,p,i)=>s+p[0]*r[(i+1)%r.length][1]-p[1]*r[(i+1)%r.length][0],0)/2);
 return {id:'face-'+crypto.randomUUID(),plane:'CUSTOM',frame:{u:u.toArray(),v:v.toArray(),n:n.toArray()},offset,outer,holes,area:area(outer)-holes.reduce((s,h)=>s+area(h),0),sourceIds:[]};
}
