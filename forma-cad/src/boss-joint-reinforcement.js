import * as R from 'replicad';
import {fuseSolid} from './solid-fuse.js';

export function bossReinforcementSettings(p){
 const type=p.reinforcement??'none',size=p.reinforcementSize??1.2;
 if(!['none','round','ribs'].includes(type))throw Error('根元の補強方法を選択してください');
 if(type!=='none'&&(!Number.isFinite(size)||size<.2||size>10))throw Error('根元の補強サイズを0.2〜10 mmで指定してください');
 return {type,size,padding:type==='none'?0:size};
}

// Add material only at an exposed internal root; keep the mating zone unchanged.
export function reinforceBossRoot(shape,{basis,uv,z,side,radius,height,type,size},hold){
 const amount=Math.min(size,height-.3);if(type==='none'||amount<.2)return {shape,amount:0};
 const origin=basis.u.clone().multiplyScalar(uv[0]).addScaledVector(basis.v,uv[1]).addScaledVector(basis.n,z),outward=basis.n.clone().multiplyScalar(side);
 const plane=new R.Plane(origin.toArray(),basis.u.toArray(),basis.u.clone().cross(outward).toArray());
 try{
  if(type==='round'){
   // Quarter-circle cove, revolved around the stem. The 0.05 mm overlap ensures fusion.
   const drawing=R.draw([radius-.05,-.05]).lineTo([radius+amount,-.05]).lineTo([radius+amount,0]).threePointsArcTo([radius,amount],[radius+amount-amount/Math.SQRT2,amount-amount/Math.SQRT2]).lineTo([radius-.05,amount]).close();
   const collar=hold(drawing.sketchOnPlane(plane).revolve(outward.toArray(),{origin:origin.toArray()}));
   return {shape:hold(fuseSolid(shape,collar)),amount};
  }
  const thickness=Math.min(1.6,Math.max(.8,amount*.7));
  for(const direction of [basis.u,basis.u.clone().negate(),basis.v,basis.v.clone().negate()]){
   const across=direction.clone().cross(outward).normalize(),start=origin.clone().addScaledVector(across,-thickness/2),ribPlane=new R.Plane(start.toArray(),direction.toArray(),across.toArray());
   try{const rib=hold(R.draw([radius-.1,-.05]).lineTo([radius+amount,-.05]).lineTo([radius-.1,amount]).close().sketchOnPlane(ribPlane).extrude(thickness));shape=hold(fuseSolid(shape,rib));}finally{ribPlane.delete();}
  }
  return {shape,amount};
 }finally{plane.delete();}
}
