import * as R from 'replicad';
import {supportShapeBounds} from './print-support-solid-groups.js';

// The existing bridge warnings use 8 mm. Keep larger holes eligible for ribs.
const maximumDiameter=8,epsilon=1e-5;

function circleOf(edge){
 const curve=edge.curve;
 try{
  if(curve.curveType!=='CIRCLE')return null;
  const circle=curve.wrapped.Circle(),center=circle.Location();
  try{return {center:[center.X(),center.Y(),center.Z()],radius:circle.Radius()};}
  finally{center.delete();circle.delete();}
 }finally{curve.delete();}
}

export function smallSupportBoreFloor(face,box,model){
 const spans=[0,1].map(axis=>box[1][axis]-box[0][axis]);
 if(Math.max(...spans)>maximumDiameter+epsilon||Math.abs(spans[0]-spans[1])>epsilon)return false;
 const wire=face.clone().outerWire(),edges=wire.edges;
 try{
  const rim=edges[0]&&circleOf(edges[0]);
  if(!rim||rim.radius*2>maximumDiameter+epsilon||spans.some(span=>Math.abs(span-2*rim.radius)>epsilon))return false;
  for(const edge of edges.slice(1)){
   const next=circleOf(edge);
   if(!next||Math.abs(next.radius-rim.radius)>epsilon||next.center.some((value,i)=>Math.abs(value-rim.center[i])>epsilon))
    return false;
  }
  // A bore has material around the outside of its rim just below the floor.
  // A projecting round boss has open space there.
  const {center:[x,y,z],radius}=rim,width=Math.min(.35,radius*.22),depth=.14;
  const outer=R.makeCylinder(radius+width,depth,[x,y,z-depth-.015]);
  const inside=R.makeCylinder(radius,depth,[x,y,z-depth-.015]);
  let ring,common;
  try{
   ring=outer.cut(inside);
   common=ring.intersect(model);
   return Math.abs(R.measureVolume(common))>=.83*Math.PI*((radius+width)**2-radius**2)*depth;
  }finally{common?.delete();ring?.delete();inside.delete();outer.delete();}
 }finally{edges.forEach(edge=>edge.delete());wire.delete();}
}

export function supportHoleBounds(face){
 const holes=face.clone().innerWires();
 try{return holes.map(supportShapeBounds);}finally{holes.forEach(wire=>wire.delete());}
}

export function tinyRibAtSupportHole(box,holes,settings){
 const [lo,hi]=box,minWidth=Math.min(settings.lineWidth,settings.wallThickness);
 if(Math.min(hi[0]-lo[0],hi[1]-lo[1])>=minWidth-epsilon)return false;
 const pad=.5+settings.sideGap+epsilon;
 return holes.some(([start,end])=>[0,1].every(axis=>lo[axis]<=end[axis]+pad&&hi[axis]>=start[axis]-pad));
}
