import * as R from 'replicad';
import {Vector3} from 'three';
import {solidMeshComplete} from './solid-mesh.js';

const EPS = 1e-5;
const nativePoint = point => new Vector3(point.X(),point.Y(),point.Z());
const contains = (shapes,shape) => shapes.some(item=>item.isSame(shape));

function sphereGeometry(face) {
 const adaptor=new (R.getOC().BRepAdaptor_Surface)(face.wrapped,true);
 let sphere,location;
 try {
  sphere=adaptor.Sphere();location=sphere.Location();
  return {center:nativePoint(location),radius:sphere.Radius()};
 } finally {location?.delete();sphere?.delete();adaptor.delete();}
}

function circleGeometry(edge) {
 const adaptor=new (R.getOC().BRepAdaptor_Curve)(edge.wrapped);
 let circle,location,axis,direction;
 try {
  circle=adaptor.Circle();location=circle.Location();axis=circle.Axis();direction=axis.Direction();
  return {center:nativePoint(location),radius:circle.Radius(),axis:nativePoint(direction)};
 } finally {direction?.delete();axis?.delete();location?.delete();circle?.delete();adaptor.delete();}
}

function capGeometry(face,sphereEdges,recesses,getEdges,sphere) {
 const edges=getEdges(face);
 if(edges.length!==2||edges.some(edge=>edge.geomType!=='CIRCLE'||!edge.isClosed))return null;
 const outer=edges.find(edge=>contains(sphereEdges,edge)),rim=edges.find(edge=>edge!==outer);
 if(!outer||contains(sphereEdges,rim))return null;
 const cap=circleGeometry(outer),hole=circleGeometry(rim);
 const displacement=cap.center.clone().sub(sphere.center);
 if(displacement.cross(cap.axis).length()>EPS||cap.center.distanceTo(hole.center)>EPS||
    cap.axis.clone().cross(hole.axis).length()>EPS||hole.radius>=cap.radius-EPS||
    Math.abs(Math.hypot(cap.center.distanceTo(sphere.center),cap.radius)-sphere.radius)>EPS)return null;
 const recess=recesses.find(item=>contains(getEdges(item),rim));
 if(!recess)return null;
 const profile=getEdges(recess).filter(edge=>edge.geomType==='BSPLINE_CURVE');
 if(profile.length!==1||getEdges(recess).filter(edge=>edge.geomType==='CIRCLE').length!==1)return null;
 return {...cap,face,recess,recessRadius:hole.radius,profile:profile[0]};
}

function pointOn(edge,parameter) {
 const point=edge.pointAt(parameter);
 try{return new Vector3(...point.toTuple());}
 finally{point.delete();}
}

function recessMeridian(cap,axis) {
 const ends=[0,1].map(t=>pointOn(cap.profile,t).sub(cap.center));
 for(const end of ends)end.addScaledVector(axis,-end.dot(axis));
 const radial=(ends[0].lengthSq()>ends[1].lengthSq()?ends[0]:ends[1]).normalize();
 const steps=512,normal=axis.clone().cross(radial);
 const coordinates=parameter=>{
  const point=pointOn(cap.profile,parameter).sub(cap.center);
  const axial=point.dot(axis),distance=point.dot(radial);
  if(Math.abs(point.dot(normal))>EPS||axial<-EPS||distance<-EPS)return null;
  return [Math.max(0,axial),Math.max(0,distance)];
 };
 const first=coordinates(0),last=coordinates(1);
 if(!first||!last)return null;
 const reversed=first[1]<last[1],read=t=>coordinates(reversed?1-t:t);
 const samples=Array.from({length:steps+1},(_,i)=>read(i/steps));
 if(samples.some((point,i)=>!point||i>0&&(point[0]<samples[i-1][0]-EPS||point[1]>samples[i-1][1]+EPS)))return null;
 if(Math.abs(samples[0][0])>EPS||Math.abs(samples[0][1]-cap.recessRadius)>EPS||
    samples.at(-1)[1]>EPS||samples.at(-1)[0]<=EPS)return null;
 return {samples,read,radial,depth:samples.at(-1)[0]};
}

function maximumOnMeridian({samples,read},score) {
 let best=0,value=score(samples[0]);
 for(let i=1;i<samples.length;i++){
  const next=score(samples[i]);
  if(next>value){best=i;value=next;}
 }
 const steps=samples.length-1;
 let a=Math.max(0,best-1)/steps,b=Math.min(steps,best+1)/steps;
 for(let i=0;i<26;i++){
  const u=(2*a+b)/3,v=(a+2*b)/3;
  if(score(read(u))<score(read(v)))a=u;else b=v;
 }
 return Math.max(value,score(read((a+b)/2)));
}

// In a meridian, the required material around the retained recess is the
// envelope of discs of radius thickness centred on its actual CAD curve.
function recessedFloor(meridian,thickness) {
 const maximum=score=>maximumOnMeridian(meridian,score);
 const reach=maximum(([x,r])=>r+(x>=thickness?thickness:Math.sqrt(x*(2*thickness-x))));
 const points=Array.from({length:81},(_,i)=>{
  const r=reach*i/80;
  const x=maximum(([x,y])=>{
   const delta=r-y;
   return Math.abs(delta)<=thickness?x+Math.sqrt(Math.max(0,thickness**2-delta**2)):-Infinity;
  });
  return [Math.max(thickness,x),r];
 });
 points[points.length-1][0]=thickness;
 return points;
}

// An annular opening separates its centre recess from the rest of the shell.
// With permission to open that recess too, construct the inside from the
// smaller concentric sphere and the inset profile of the opposite end.
export function shellRecessedSphere(base,selected,thickness,includeRecess) {
 if(!(base instanceof R.Solid))return null;
 const faces=base.faces,edgeCache=new Map(),tools=[];
 let cavity,result,accepted=false;
 const getEdges=face=>{
  if(!edgeCache.has(face))edgeCache.set(face,face.edges);
  return edgeCache.get(face);
 };
 try {
  const spherical=faces.filter(face=>face.geomType==='SPHERE');
  const planes=faces.filter(face=>face.geomType==='PLANE');
  const recesses=faces.filter(face=>face.geomType==='REVOLUTION_SURFACE');
  if(faces.length!==5||spherical.length!==1||planes.length!==2||recesses.length!==2)return null;
  const sphere=sphereGeometry(spherical[0]);
  const caps=planes.map(face=>capGeometry(face,getEdges(spherical[0]),recesses,getEdges,sphere));
  if(caps.some(cap=>!cap)||caps[0].recess.isSame(caps[1].recess))return null;
  const opening=caps.find(cap=>contains(selected,cap.face)),bottom=caps.find(cap=>cap!==opening);
  if(!opening||!selected.every(face=>face.isSame(opening.face)||face.isSame(opening.recess)))return null;
  const axis=opening.center.clone().sub(bottom.center).normalize();
  const sphereX=sphere.center.clone().sub(bottom.center).dot(axis);
  const openingX=opening.center.distanceTo(bottom.center);
  if(axis.clone().cross(opening.axis).length()>EPS||axis.clone().cross(bottom.axis).length()>EPS||
     sphereX<=EPS||sphereX>=openingX-EPS)return null;
  const bottomProfile=recessMeridian(bottom,axis);
  const openingProfile=recessMeridian(opening,axis.clone().negate());
  if(!bottomProfile||!openingProfile||openingProfile.depth>=openingX-sphereX)return null;
  if(!includeRecess&&!contains(selected,opening.recess)) {
   const message='リング状の開口面だけでは中央のくぼみが切り離されます。「開口側のくぼみも取り除く」をオンにしてください。';
   throw Object.assign(Error(message),{code:'shell-opening-recess'});
  }
  const radius=sphere.radius-thickness,reach=openingX+.02;
  const radialAt=x=>Math.sqrt(radius*radius-(x-sphereX)**2);
  const bottomRadius=radialAt(thickness),openingRadius=radialAt(reach);
  if(radius<=EPS||thickness>=openingX||!(openingRadius>opening.recessRadius+EPS))return null;
  const floor=recessedFloor(bottomProfile,thickness);
  if(!(bottomRadius>floor.at(-1)[1]+EPS)||floor[0][0]>=sphereX)return null;
  const world=(x,r)=>bottom.center.clone().addScaledVector(axis,x).addScaledVector(bottomProfile.radial,r).toArray();
  const a=world(thickness,bottomRadius),b=world(reach,openingRadius),endAxis=world(reach,0);
  const floorPoints=floor.map(([x,r])=>world(x,r));
  tools.push(R.makeBSplineApproximation(floorPoints,{tolerance:.0004,degMin:3,degMax:5}));
  tools.push(R.makeLine(floorPoints.at(-1),a));
  tools.push(R.makeThreePointArc(a,world(sphereX,radius),b));
  tools.push(R.makeLine(b,endAxis));
  tools.push(R.makeLine(endAxis,floorPoints[0]));
  const wire=R.assembleWire(tools);tools.push(wire);
  const section=R.makeFace(wire);tools.push(section);
  cavity=R.revolution(section,sphere.center.toArray(),axis.toArray(),360);
  result=base.cut(cavity);
  const check=new (R.getOC().BRepCheck_Analyzer)(result.wrapped,true,false),solids=result.solids;
  try {
   if(!check.IsValid()||solids.length!==1||!solidMeshComplete(result))return null;
  } finally {check.delete();solids.forEach(solid=>solid.delete());}
  accepted=true;return result;
 } catch(error) {
  if(error?.code==='shell-opening-recess'||error instanceof WebAssembly.RuntimeError)throw error;
  return null;
 } finally {
  cavity?.delete();if(!accepted)result?.delete();
  tools.reverse().forEach(tool=>tool.delete());
  for(const edges of edgeCache.values())edges.forEach(edge=>edge.delete());
  faces.forEach(face=>face.delete());
 }
}
