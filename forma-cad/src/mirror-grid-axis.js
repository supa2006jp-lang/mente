import * as THREE from 'three';
import {roundPointMaterial} from './round-point-material.js';

export function mirrorGridPlane(points,normal){
 if(points.length!==2)throw Error('グリッド上の2点をクリックしてください');
 const direction=points[1].clone().sub(points[0]);
 if(direction.length()<1e-6)throw Error('2点目は1点目と異なる位置を選んでください');
 const n=direction.cross(normal);
 if(n.length()<1e-7)throw Error('グリッド上の異なる2点を選んでください');
 return {mirrorNormal:n.normalize().toArray(),mirrorOrigin:points[0].toArray()};
}

export function snapMirrorGridPoint(hit,{basis,offset},step,project,enabled){
 if(!enabled||!(step>0))return hit.clone();
 const u=hit.dot(basis.u),v=hit.dot(basis.v),su=Math.round(u/step)*step,sv=Math.round(v/step)*step;
 const at=(a,b)=>basis.u.clone().multiplyScalar(a).addScaledVector(basis.v,b).addScaledVector(basis.n,offset),p=project(hit);
 const distance=q=>{const s=project(q);return Math.hypot(s.x-p.x,s.y-p.y);};
 const intersection=at(su,sv);if(distance(intersection)<=8)return intersection;
 const candidates=[at(su,v),at(u,sv)].sort((a,b)=>distance(a)-distance(b));
 return distance(candidates[0])<=8?candidates[0]:hit.clone();
}

export function createMirrorGridAxis({scene,canvas,camera,project,active,getFrame,getSnap,onChange}){
 let points=[],frame=null,overlay=null;
 const ray=new THREE.Raycaster();
 function drop(){if(overlay){scene.remove(overlay);overlay.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});overlay=null;}}
 function draw(hover){
  drop();const ps=[...points];if(hover&&points.length<2)ps.push(hover);if(!ps.length)return;
  overlay=new THREE.Group();
  const markers=new THREE.Points(new THREE.BufferGeometry().setFromPoints(ps),roundPointMaterial({color:0xbd74ff,size:10,sizeAttenuation:false,depthTest:false}));markers.renderOrder=12;overlay.add(markers);
  if(ps.length===2&&ps[0].distanceTo(ps[1])>1e-6){const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(ps),new THREE.LineDashedMaterial({color:0xbd74ff,dashSize:2,gapSize:1,depthTest:false}));line.computeLineDistances();line.renderOrder=11;overlay.add(line);}
  scene.add(overlay);
 }
 function eventPoint(e){
  const f=frame||getFrame(),r=canvas.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2),camera);
  if(Math.abs(ray.ray.direction.dot(f.basis.n))<1e-6)return null;
  const hit=ray.ray.intersectPlane(new THREE.Plane(f.basis.n,-f.offset),new THREE.Vector3());if(!hit)return null;
  const snap=getSnap();return snapMirrorGridPoint(hit,f,snap.step,project,snap.enabled);
 }
 canvas.addEventListener('pointermove',e=>{if(!active()||points.length===2||e.buttons)return;draw(eventPoint(e));});
 canvas.addEventListener('pointerleave',()=>{if(active())draw();});
 return {
  get points(){return points.map(p=>p.clone());},
  get spec(){return mirrorGridPlane(points,frame?.basis.n);},
  pick(e){
   if(points.length===2)return;const p=eventPoint(e);
   if(!p){onChange('グリッドを選べる角度からクリックしてください');return;}
   if(points.length&&points[0].distanceTo(p)<1e-6){onChange('2点目は1点目と異なる位置を選んでください');return;}
   if(!frame){const f=getFrame();frame={basis:Object.fromEntries(Object.entries(f.basis).map(([k,v])=>[k,v.clone()])),offset:f.offset};}
   points.push(p);draw();onChange();
  },
  clear(){points=[];frame=null;drop();},
 };
}
