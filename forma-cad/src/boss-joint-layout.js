import * as THREE from 'three';

export function moveBossJoint(analysis,index,uv,symmetric=true,step=.1){
 if(!analysis?.positions?.[index]||uv.length!==2||uv.some(v=>!Number.isFinite(v)))throw Error('接合位置が不正です');
 const points=analysis.positions.map(p=>[...p.uv]),center=analysis.layout?.center||points.reduce((a,p)=>a.map((v,i)=>v+p[i]/points.length),[0,0]);
 const next=uv.map(v=>Math.round(v/step)*step);points[index]=next;
 if(symmetric&&points.length===2){const axis=analysis.layout?.long??0;points[1-index]=next.map((v,i)=>i===axis?2*center[i]-v:v);}
 if(symmetric&&points.length===4){const long=analysis.layout?.long??0,bit=(j,axis)=>axis===long?Math.floor(j/2):j%2;for(let j=0;j<points.length;j++)if(j!==index)points[j]=next.map((v,i)=>center[i]+(bit(j,i)===bit(index,i)?1:-1)*(v-center[i]));
 }
 return points.map(p=>p.map(v=>Number(v.toFixed(4))));
}

export function bossJointTransform(analysis,part=0){
 const placement=analysis.placements?.[part];if(!placement)return new THREE.Matrix4();
 return new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(...placement.axis).normalize(),placement.angle*Math.PI/180).premultiply(new THREE.Matrix4().makeTranslation(...placement.translation));
}
export function bossJointPoint(analysis,uv,part=0){
 const {u,v,n}=analysis.frame,z=analysis.offset-(part?analysis.length:0);
 return new THREE.Vector3(...u).multiplyScalar(uv[0]).addScaledVector(new THREE.Vector3(...v),uv[1]).addScaledVector(new THREE.Vector3(...n),z).applyMatrix4(bossJointTransform(analysis,part));
}
