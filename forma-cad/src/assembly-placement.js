import * as THREE from 'three';
export const assemblyAnchors=[['center','中心'],['u-','横−端'],['u+','横＋端'],['v-','縦−端'],['v+','縦＋端'],['u-v-','横−・縦−の角'],['u+v-','横＋・縦−の角'],['u-v+','横−・縦＋の角'],['u+v+','横＋・縦＋の角']];
export function assemblyBasis(normal){
 const n=new THREE.Vector3(...normal).normalize(),u=Math.abs(n.x)<.9?new THREE.Vector3(1,0,0):new THREE.Vector3(0,1,0);u.addScaledVector(n,-u.dot(n)).normalize();return {u,v:n.clone().cross(u).normalize(),n};
}
export function assemblyAdjustment(spec){
 const values={u:spec.slideU??0,v:spec.slideV??0,angle:spec.twist??0};
 if(![values.u,values.v].every(v=>Number.isFinite(v)&&Math.abs(v)<=10000)||!Number.isFinite(values.angle)||Math.abs(values.angle)>36000)throw Error('面上の移動は±10000 mm、回転は±36000°以内で指定してください');
 return values;
}
export function assemblySnap(value,{step,enabled,pixelsPerUnit,shift=false,angle=false}){
 if(shift||!enabled||!Number.isFinite(step)||step<=0)return {value,snapped:false};
 const nearest=Math.round(value/step)*step,limit=angle?3:Math.min(step*.2,7/Math.max(.001,pixelsPerUnit));
 return Math.abs(value-nearest)<=limit?{value:nearest===0?0:nearest,snapped:true}:{value,snapped:false};
}
export function assemblyFastMatrix(base,values){
 const b=base.basis,destination=new THREE.Vector3(...base.destination.anchor).addScaledVector(new THREE.Vector3(...b.u),values.u).addScaledVector(new THREE.Vector3(...b.v),values.v).addScaledVector(new THREE.Vector3(...b.n),values.offset);
 return new THREE.Matrix4().makeTranslation(...destination.toArray()).multiply(new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(...b.n),(values.angle-base.adjustment.angle)*Math.PI/180)).multiply(new THREE.Matrix4().makeTranslation(...base.contactAnchor.map(v=>-v)));
}
