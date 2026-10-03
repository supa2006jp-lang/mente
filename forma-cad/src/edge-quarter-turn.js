import * as THREE from 'three';

export function edgeTurnFrame(edge){
 if(!edge||edge.circle||edge.arc)throw Error('回転軸にする直線の辺を1本選択してください');
 if(![edge.a,edge.b].every(p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite)))throw Error('辺の座標が不正です');
 let a=new THREE.Vector3(...edge.a),b=new THREE.Vector3(...edge.b);
 if(a.distanceTo(b)<1e-5)throw Error('長さのある直線の辺を選択してください');
 for(let i=0;i<3;i++)if(Math.abs(a.getComponent(i)-b.getComponent(i))>1e-5){if(a.getComponent(i)>b.getComponent(i))[a,b]=[b,a];break;}
 return {a,b,pivot:a.clone().add(b).multiplyScalar(.5),axis:b.clone().sub(a).normalize(),key:JSON.stringify([a.toArray(),b.toArray()].map(p=>p.map(v=>Number(v.toFixed(5)))))};
}
function worldVertices(mesh){
 mesh.updateWorldMatrix(true,false);const position=mesh.geometry.attributes.position,points=[];
 for(let i=0;i<position.count;i++)points.push(new THREE.Vector3().fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld));
 return points;
}
export function upperEdgeBody(meshes,edge){
 const {a,b}=edgeTurnFrame(edge),samples=[.2,.5,.8].map(t=>a.clone().lerp(b,t)),candidates=[];
 for(const mesh of meshes){
  if(!mesh.visible||!mesh.geometry?.attributes.position)continue;
  const points=worldVertices(mesh),box=new THREE.Box3().setFromPoints(points),tolerance=.02;
  if(!samples.every(point=>box.clone().expandByScalar(tolerance).containsPoint(point)))continue;
  const index=mesh.geometry.index,touched=samples.map(()=>false),triangle=new THREE.Triangle(),nearest=new THREE.Vector3();
  for(let i=0;i<(index?.count??points.length);i+=3){
   triangle.set(...[0,1,2].map(j=>points[index?index.getX(i+j):i+j]));
   for(let j=0;j<samples.length;j++)if(!touched[j]&&triangle.closestPointToPoint(samples[j],nearest).distanceToSquared(samples[j])<=tolerance*tolerance)touched[j]=true;
   if(touched.every(Boolean))break;
  }
  if(touched.every(Boolean))candidates.push({mesh,height:(box.min.z+box.max.z)/2,bottom:box.min.z});
 }
 candidates.sort((a,b)=>Math.abs(a.height-b.height)>1e-5?b.height-a.height:Math.abs(a.bottom-b.bottom)>1e-5?b.bottom-a.bottom:Number(b.mesh.userData.bodyId===edge.bodyId)-Number(a.mesh.userData.bodyId===edge.bodyId));
 if(!candidates.length)throw Error('選択した辺に接するソリッドがありません');
 return candidates[0].mesh;
}
export function edgeQuarterTurn(mesh,edge,continuedAngle=null){
 const {a,b,pivot,axis,key}=edgeTurnFrame(edge),points=worldVertices(mesh);
 if(!points.length)throw Error('回転するソリッドがありません');
 const heights=angle=>{const q=new THREE.Quaternion().setFromAxisAngle(axis,angle*Math.PI/180),point=new THREE.Vector3();let min=Infinity,max=-Infinity;for(const p of points){point.copy(p).sub(pivot).applyQuaternion(q).add(pivot);min=Math.min(min,point.z);max=Math.max(max,point.z);}return {min,max};};
 let angle=continuedAngle;
 if(angle!==null&&![-90,90].includes(angle))throw Error('回転角度が不正です');
 if(angle===null){const positive=heights(90),negative=heights(-90),safe=p=>p.min>=-1e-5;angle=safe(positive)!==safe(negative)?(safe(positive)?90:-90):Math.abs(positive.min-negative.min)>1e-5?(positive.min>negative.min?90:-90):positive.max>=negative.max?90:-90;}
 const quaternion=new THREE.Quaternion().setFromAxisAngle(axis,angle*Math.PI/180),euler=new THREE.Euler().setFromQuaternion(quaternion,'ZYX'),rotation=[euler.x,euler.y,euler.z].map(v=>Number((v*180/Math.PI).toFixed(10)));
 return {key,angle,range:heights(angle),axis:[a.toArray(),b.toArray()],transform:{x:0,y:0,z:0,pivot:pivot.toArray(),rotation}};
}
