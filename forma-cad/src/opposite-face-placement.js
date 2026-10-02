import * as THREE from 'three';

// Ground the supporting face opposite the chosen outward-facing plane.
// Only a real parallel face on the outermost supporting plane is eligible.
export function oppositeFacePlacement(geometry,face){
 const raw=face?.frame?.n;
 if(!Array.isArray(raw)||raw.length!==3||!raw.every(Number.isFinite))throw Error('ソリッドの平面を1つ選択してください');
 const normal=new THREE.Vector3(...raw);if(normal.lengthSq()<1e-12)throw Error('面の向きを取得できません');normal.normalize();
 const position=geometry?.attributes?.position,index=geometry?.index;
 if(!position?.count)throw Error('ソリッドの形状を取得できません');
 const point=i=>new THREE.Vector3().fromBufferAttribute(position,index?index.getX(i):i),bounds=new THREE.Box3().setFromBufferAttribute(position),pivot=bounds.getCenter(new THREE.Vector3());
 let low=Infinity,high=-Infinity;
 for(let i=0;i<position.count;i++){const d=new THREE.Vector3().fromBufferAttribute(position,i).dot(normal);low=Math.min(low,d);high=Math.max(high,d);}
 const tolerance=Math.max(1e-4,(high-low)*1e-6);
 if(high-low<tolerance)throw Error('厚みのあるソリッドを選択してください');
 const groups=geometry.userData.faceGroups,planar=geometry.userData.planarFaces;
 const planarIds=planar&&new Set(planar),planarGroups=groups&&planar?groups.filter(g=>planarIds.has(g.faceId)).sort((a,b)=>a.start-b.start):null;
 const count=index?index.count:position.count;let oppositeArea=0,groupIndex=0;
 for(let i=0;i<count;i+=3){
  if(planarGroups){while(groupIndex<planarGroups.length&&i>=planarGroups[groupIndex].start+planarGroups[groupIndex].count)groupIndex++;const group=planarGroups[groupIndex];if(!group||i<group.start)continue;}
  const a=point(i),b=point(i+1),c=point(i+2),cross=b.clone().sub(a).cross(c.clone().sub(a)),area=cross.length()/2;
  if(area<1e-10||cross.normalize().dot(normal)>-.999999)continue;
  if([a,b,c].some(p=>Math.abs(p.dot(normal)-low)>tolerance))continue;
  oppositeArea+=area;
 }
 if(oppositeArea<1e-6)throw Error('反対側に平行な接地面がありません。別の平面を選択してください');
 const quaternion=new THREE.Quaternion().setFromUnitVectors(normal,new THREE.Vector3(0,0,1)),euler=new THREE.Euler().setFromQuaternion(quaternion,'ZYX');
 const rotation=[euler.x,euler.y,euler.z].map(v=>Number((v*180/Math.PI).toFixed(10)));
 // Use the exact same sequential X/Y/Z rotations as the CAD kernel.
 const actualRotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation.map(v=>v*Math.PI/180),'ZYX'));
 let minZ=Infinity;
 for(let i=0;i<position.count;i++)minZ=Math.min(minZ,new THREE.Vector3().fromBufferAttribute(position,i).sub(pivot).applyQuaternion(actualRotation).add(pivot).z);
 return {rotation,pivot:pivot.toArray(),x:0,y:0,z:-minZ,oppositeArea,selectedNormal:normal.toArray()};
}
