import * as THREE from 'three';
const vector=p=>p?.isVector3?p.clone():new THREE.Vector3(...p);
export function measurementGridPoint(point,basis,offset,step){
 if(!Number.isFinite(step)||step<=0||!Number.isFinite(offset))return null;
 const p=vector(point),u=Math.round(p.dot(basis.u)/step)*step,v=Math.round(p.dot(basis.v)/step)*step;
 return basis.u.clone().multiplyScalar(u).addScaledVector(basis.v,v).addScaledVector(basis.n,offset);
}
export function measurementDirection(input){const v=vector(input);if(!v.toArray().every(Number.isFinite)||v.length()<1e-9)throw Error('方向には0以外の値を指定してください');return v.normalize();}
export function measurePoints(a,b){a=vector(a);b=vector(b);if(![...a.toArray(),...b.toArray()].every(Number.isFinite))throw Error('測定点が不正です');return {a:a.toArray(),b:b.toArray(),distance:a.distanceTo(b)};}
export function measurePointComponent(a,b,component='direct'){
 if(!['direct','x','y','z'].includes(component))throw Error('寸法の方向が不正です');const value=measurePoints(a,b);
 return {...value,type:component==='direct'?'point':'component',component,distance:component==='direct'?value.distance:Math.abs(value.b['xyz'.indexOf(component)]-value.a['xyz'.indexOf(component)])};
}
export function measurementEndpoints(value){const a=vector(value.a),b=vector(value.b);if(value.type==='component'){const p=a.clone(),index='xyz'.indexOf(value.component);if(index>=0)p.setComponent(index,b.getComponent(index));return [a,p];}return [a,b];}
export function measureCircle(edge,kind='circumference',point){
 const circle=edge.circle;if(!circle||!Number.isFinite(circle.radius)||circle.radius<=0||!['circumference','diameter','radius'].includes(kind))throw Error('円の寸法を取得できません');
 const center=vector(circle.center),normal=measurementDirection(circle.normal),radial=vector(point||edge.segments[0].a).sub(center);radial.addScaledVector(normal,-radial.dot(normal));if(radial.length()<1e-9)throw Error('円周上の点を選択してください');radial.normalize();
 const rim=center.clone().addScaledVector(radial,circle.radius),a=kind==='diameter'?center.clone().addScaledVector(radial,-circle.radius):center,b=rim;
 return {a:a.toArray(),b:b.toArray(),distance:circle.radius*(kind==='circumference'?2*Math.PI:kind==='diameter'?2:1),type:'circle',circle:structuredClone(circle),circleKind:kind,curved:kind==='circumference',labelPoint:rim.toArray(),label:{circumference:'円周の長さ',diameter:'円の直径',radius:'円の半径'}[kind],edges:edge.segments?[edge.segments.map(s=>({a:vector(s.a).toArray(),b:vector(s.b).toArray()}))]:undefined};
}
// Closest points on finite 3D segments, including parallel and zero-length cases.
export function closestMeasurementSegments(first,second){
 const a=vector(first.a),b=vector(first.b),c=vector(second.a),d=vector(second.b),u=b.clone().sub(a),v=d.clone().sub(c),r=a.clone().sub(c),aa=u.dot(u),ee=v.dot(v),f=v.dot(r),clamp=t=>Math.max(0,Math.min(1,t));let s=0,t=0;
 if(aa<=1e-18)t=ee<=1e-18?0:clamp(f/ee);
 else{const cc=u.dot(r);if(ee<=1e-18)s=clamp(-cc/aa);else{const bb=u.dot(v),denom=aa*ee-bb*bb;if(denom>aa*ee*1e-12)s=clamp((bb*f-cc*ee)/denom);t=(bb*s+f)/ee;if(t<0){t=0;s=clamp(-cc/aa);}else if(t>1){t=1;s=clamp((bb-cc)/aa);}}}
 return measurePoints(a.addScaledVector(u,s),c.addScaledVector(v,t));
}
export function measureEdgeLength(edge){
 if(!edge.segments?.length)throw Error('測定する線・辺がありません');
 const segments=edge.segments.map(s=>({a:vector(s.a),b:vector(s.b)})),length=Number.isFinite(edge.length)?edge.length:segments.reduce((sum,s)=>sum+s.a.distanceTo(s.b),0);
 if(length<=1e-9)throw Error('長さが0の辺は測定できません');
 return {...measurePoints(segments[0].a,segments.at(-1).b),distance:length,type:'edge-length',curved:!edge.straight,label:edge.label||'線・辺の長さ',approximate:!!edge.approximate,edges:[segments.map(s=>({a:s.a.toArray(),b:s.b.toArray()}))]};
}
export function measureEdgePair(first,second){
 if(!first.segments?.length||!second.segments?.length)throw Error('2本の線・辺を選択してください');
 let best=null;for(const a of first.segments)for(const b of second.segments){const hit=closestMeasurementSegments(a,b);if(!best||hit.distance<best.distance)best=hit;}
 let angle=null;if(first.straight&&second.straight){const a=first.segments[0],b=second.segments[0],u=vector(a.b).sub(vector(a.a)).normalize(),v=vector(b.b).sub(vector(b.a)).normalize();angle=Math.acos(Math.min(1,Math.abs(u.dot(v))))*180/Math.PI;}
 return {...best,type:'edge-pair',angle,label:'2本の線・辺の最短距離',approximate:!!first.approximate||!!second.approximate||!first.straight||!second.straight,edges:[first,second].map(edge=>edge.segments.map(s=>({a:vector(s.a).toArray(),b:vector(s.b).toArray()})))};
}
export function firstMeasurementSegmentHit(origin,direction,segments){
 const o=vector(origin),d=measurementDirection(direction),ray=new THREE.Ray(o,d),onRay=new THREE.Vector3(),onSegment=new THREE.Vector3();let best=null;
 for(const s of segments){const a=vector(s.a),b=vector(s.b),length=a.distanceTo(b);if(length<1e-9)continue;const offset=a.clone().sub(o),cross=new THREE.Vector3().crossVectors(b.clone().sub(a),d);let point,t;
  if(cross.length()<1e-8*length&&new THREE.Vector3().crossVectors(offset,d).length()<1e-6){const ts=[a,b].map(p=>p.clone().sub(o).dot(d)).filter(v=>v>1e-6);if(!ts.length)continue;t=Math.min(...ts);point=o.clone().addScaledVector(d,t);}else{const distance=ray.distanceSqToSegment(a,b,onRay,onSegment);t=onRay.clone().sub(o).dot(d);if(distance>1e-10||t<=1e-6)continue;point=onRay.clone();}
  if(!best||t<best.distance)best={point,distance:t,label:s.label||'スケッチの線',sourceId:s.sourceId};
 }return best;
}
