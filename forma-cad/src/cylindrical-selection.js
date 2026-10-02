import * as THREE from 'three';
import {basisFor,worldPoint} from './frames.js';

// Recover cylindrical faces before treating tessellated walls as planar patches.
export function cylindricalSelection(features,bodyId,geometry,faceIndex,point){
 const pos=geometry.attributes.position,index=geometry.index;
 const vertex=i=>new THREE.Vector3().fromBufferAttribute(pos,index?index.getX(i):i);
 const normalAt=i=>{const a=vertex(i),b=vertex(i+1),c=vertex(i+2);return b.sub(a).cross(c.sub(a)).normalize();};
 const hitNormal=normalAt(faceIndex*3);
 const groups=geometry.userData.faceGroups,planar=geometry.userData.planarFaces;
 const group=groups?.find(g=>faceIndex*3>=g.start&&faceIndex*3<g.start+g.count);
 if(group&&planar?.includes(group.faceId))return null;
 let cylinder=null;
 for(const f of [...features].reverse()){
  if(f.kind==='sketch'||f.kind==='plane'||f.kind==='cadop'||(f.operation==='new'?f.id!==bodyId:f.target!==bodyId))continue;
  let origin,radius;
  if(f.profile==='circle'){origin=new THREE.Vector3(f.x,f.y,f.z);radius=f.diameter/2;}
  else if(f.profile==='region'&&!f.region.holes.length&&f.region.outer.length>=32){
   const pts=f.region.outer,center=pts.reduce((s,p)=>[s[0]+p[0]/pts.length,s[1]+p[1]/pts.length],[0,0]);
   radius=Math.hypot(pts[0][0]-center[0],pts[0][1]-center[1]);
   if(!pts.every(p=>Math.abs(Math.hypot(p[0]-center[0],p[1]-center[1])-radius)<1e-4))continue;
   origin=worldPoint(f.region,center);
  }else continue;
  const axis=basisFor(f).n,delta=point.clone().sub(origin),height=delta.dot(axis),radial=delta.addScaledVector(axis,-height);
  const tolerance=Math.max(.002,radius*.003),min=Math.min(0,f.depth),max=Math.max(0,f.depth);
  const radii=f.mode==='thin'?[radius+(f.side==='outside'?f.wall:f.side==='center'?f.wall/2:0),radius-(f.side==='inside'?f.wall:f.side==='center'?f.wall/2:0)]:[radius];
  radius=radii.find(r=>Math.abs(radial.length()-r)<=tolerance);
  if(radius===undefined||height<min-tolerance||height>max+tolerance||Math.abs(hitNormal.dot(axis))>.05)continue;
  cylinder={origin,axis,radius,min,max,tolerance,internal:hitNormal.dot(radial)<0};break;
 }
 if(!cylinder&&!(group&&planar&&!planar.includes(group.faceId)))return null;
 const positions=[];
 for(let i=group?.start||0,end=group?group.start+group.count:(index?index.count:pos.count);i<end;i+=3){
  if(group){if(i<group.start||i>=group.start+group.count)continue;}
  else{
   const {origin,axis,radius,min,max,tolerance}=cylinder;
   if(Math.abs(normalAt(i).dot(axis))>.05)continue;
   if(![0,1,2].every(k=>{const d=vertex(i+k).sub(origin),h=d.dot(axis);return h>=min-tolerance&&h<=max+tolerance&&Math.abs(d.addScaledVector(axis,-h).length()-radius)<=tolerance;}))continue;
  }
  for(let k=0;k<3;k++)positions.push(...vertex(i+k).toArray());
 }
 if(!positions.length)return null;
 const highlight=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 highlight.computeVertexNormals();
 return {geometry:highlight,internal:cylinder?.internal,radius:cylinder?.radius};
}
