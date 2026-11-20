import * as R from 'replicad';
import {supportShapeBounds} from './print-support-solid-groups.js';

// The existing bridge warnings use 8 mm. Keep larger holes eligible for ribs.
const maximumDiameter=8,epsilon=1e-5;
const threadEntranceTolerance=.001;

function circleOf(edge){
 const curve=edge.curve;
 try{
  if(curve.curveType!=='CIRCLE')return null;
  const circle=curve.wrapped.Circle(),center=circle.Location();
  try{return {center:[center.X(),center.Y(),center.Z()],radius:circle.Radius()};}
  finally{center.delete();circle.delete();}
 }finally{curve.delete();}
}

function sameCircle(a,b,heightTolerance=epsilon){
 return Math.abs(a.radius-b.radius)<=epsilon&&
  a.center.every((value,axis)=>Math.abs(value-b.center[axis])<=(axis===2?heightTolerance:epsilon));
}

export function supportWireCircle(wire){
 const edges=wire.edges;
 try{
  const circles=edges.map(circleOf),circle=circles[0];
  return circle&&circles.every(candidate=>candidate&&sameCircle(candidate,circle))?circle:null;
 }finally{edges.forEach(edge=>edge.delete());}
}

export function roundOpenings(face){
 const wires=face.clone().innerWires(),round=[];
 try{
  for(const wire of wires){
   const circle=supportWireCircle(wire);
   if(circle)round.push(circle);
  }
  return round;
 }finally{wires.forEach(wire=>wire.delete());}
}

function insideOpening(box,{center,radius}){
 return [0,1].every(axis=>box[0][axis]>=center[axis]-radius-epsilon&&box[1][axis]<=center[axis]+radius+epsilon);
}

// The runout of a modeled thread can leave a tiny crescent in the plane of
// the surrounding underside. Its circular edge belongs to the larger hole;
// the spline is the end of the helical cut.
export function supportThreadRunoutPlan(ceilings,curves){
 const openings=ceilings.flatMap(({face})=>roundOpenings(face));
 const runouts=new Set(),internalFaces=new Set(),blocked=new Set();
 if(!openings.length)return {runouts,internalFaces,blockers:[]};
 for(const {face,index,b,z,override} of ceilings){
  if(override)continue;
  const candidates=openings.filter(opening=>Math.abs(z-opening.center[2])<=threadEntranceTolerance&&insideOpening(b,opening));
  if(!candidates.length)continue;
  const outline=face.clone().outerWire(),edges=outline.edges;
  try{
   if(!edges.some(edge=>edge.geomType==='BSPLINE_CURVE'))continue;
   const circles=edges.map(circleOf).filter(Boolean),area=R.measureArea(face);
   const opening=candidates.find(rim=>area<=.3*Math.PI*rim.radius**2&&circles.some(circle=>sameCircle(circle,rim,threadEntranceTolerance)));
   if(opening){runouts.add(index);blocked.add(opening);}
  }finally{edges.forEach(edge=>edge.delete());outline.delete();}
 }
 const blockers=[];
 for(const opening of blocked){
  const height=opening.center[2];
  let top=height;
  for(const {face,index,b} of [...curves].sort((a,b)=>a.b[0][2]-b.b[0][2])){
   if(b[0][2]<height-threadEntranceTolerance||b[0][2]>top+threadEntranceTolerance||!insideOpening(b,opening)||
    !['CYLINDRE','BSPLINE_SURFACE'].includes(face.geomType))continue;
   internalFaces.add(index);
   top=Math.max(top,b[1][2]);
  }
  blockers.push({...opening,top});
 }
 return {runouts,internalFaces,blockers};
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
   if(!next||!sameCircle(next,rim))
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
