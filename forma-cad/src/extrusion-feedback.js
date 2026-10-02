import * as THREE from 'three';
import {basisFor,worldPoint} from './frames.js';
import {taperLimit} from './taper.js';
export function taperArcPoint(center,radius,angle,rotation=0){const radians=(angle+rotation)*Math.PI/180;return {x:center.x+radius*Math.sin(radians),y:center.y-radius*Math.cos(radians)};}
export function taperDragAngle(point,center,rotation,current,{fine=false}={}){
 let angle=Math.atan2(point.x-center.x,center.y-point.y)*180/Math.PI-rotation;
 angle+=360*Math.round((current-angle)/360);const step=fine?.1:1;
 return Number((Math.max(-taperLimit,Math.min(taperLimit,Math.round(angle/step)*step))).toFixed(1));
}
function circleProfile(feature){
 if(feature.profile==='circle')return {center:new THREE.Vector3(feature.x,feature.y,feature.z)};
 const r=feature.region,p=r?.outer;if(!p||p.length<32)return null;
 const xs=p.map(q=>q[0]),ys=p.map(q=>q[1]),center=[(Math.min(...xs)+Math.max(...xs))/2,(Math.min(...ys)+Math.max(...ys))/2],radius=Math.hypot(p[0][0]-center[0],p[0][1]-center[1]);
 return radius>.01&&p.every(q=>Math.abs(Math.hypot(q[0]-center[0],q[1]-center[1])-radius)<Math.max(.001,radius*1e-4))?{center:worldPoint(r,center)}:null;
}
// Read the terminal cap in profile coordinates, independent of camera and world plane.
export function extrusionEndDimensions(feature,vertices,{round=true}={}){
 if(!vertices?.length)return null;const b=basisFor(feature.region||feature),sign=Math.sign(feature.depth)||1,p=new THREE.Vector3(),circle=round?circleProfile(feature):null;
 if(feature.profile!=='region'){const angle=(feature.angle||0)*Math.PI/180,u=b.u.clone(),v=b.v.clone();b.u.copy(u).multiplyScalar(Math.cos(angle)).addScaledVector(v,Math.sin(angle));b.v.copy(v).multiplyScalar(Math.cos(angle)).addScaledVector(u,-Math.sin(angle));}
 let end=-Infinity;for(let i=0;i<vertices.length;i+=3)end=Math.max(end,p.fromArray(vertices,i).dot(b.n)*sign);
 let minU=Infinity,maxU=-Infinity,minV=Infinity,maxV=-Infinity,radius=0,count=0;
 for(let i=0;i<vertices.length;i+=3){p.fromArray(vertices,i);if(Math.abs(p.dot(b.n)*sign-end)>Math.max(1e-5,Math.abs(end)*1e-8))continue;const u=p.dot(b.u),v=p.dot(b.v);minU=Math.min(minU,u);maxU=Math.max(maxU,u);minV=Math.min(minV,v);maxV=Math.max(maxV,v);count++;if(circle)radius=Math.max(radius,Math.hypot(u-circle.center.dot(b.u),v-circle.center.dot(b.v)));}
 if(count<3)return null;return circle?{diameter:radius*2}:{width:maxU-minU,height:maxV-minV};
}
