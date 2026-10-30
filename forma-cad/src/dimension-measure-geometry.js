import * as THREE from 'three';
const vector=p=>p?.isVector3?p.clone():new THREE.Vector3(...p);
export function measurementDirection(input){const v=vector(input);if(!v.toArray().every(Number.isFinite)||v.length()<1e-9)throw Error('方向には0以外の値を指定してください');return v.normalize();}
export function measurePoints(a,b){a=vector(a);b=vector(b);if(![...a.toArray(),...b.toArray()].every(Number.isFinite))throw Error('測定点が不正です');return {a:a.toArray(),b:b.toArray(),distance:a.distanceTo(b)};}
export function firstMeasurementSegmentHit(origin,direction,segments){
 const o=vector(origin),d=measurementDirection(direction),ray=new THREE.Ray(o,d),onRay=new THREE.Vector3(),onSegment=new THREE.Vector3();let best=null;
 for(const s of segments){const a=vector(s.a),b=vector(s.b),length=a.distanceTo(b);if(length<1e-9)continue;const offset=a.clone().sub(o),cross=new THREE.Vector3().crossVectors(b.clone().sub(a),d);let point,t;
  if(cross.length()<1e-8*length&&new THREE.Vector3().crossVectors(offset,d).length()<1e-6){const ts=[a,b].map(p=>p.clone().sub(o).dot(d)).filter(v=>v>1e-6);if(!ts.length)continue;t=Math.min(...ts);point=o.clone().addScaledVector(d,t);}else{const distance=ray.distanceSqToSegment(a,b,onRay,onSegment);t=onRay.clone().sub(o).dot(d);if(distance>1e-10||t<=1e-6)continue;point=onRay.clone();}
  if(!best||t<best.distance)best={point,distance:t,label:s.label||'スケッチの線',sourceId:s.sourceId};
 }return best;
}
