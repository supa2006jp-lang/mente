import * as R from 'replicad';
import {Vector3} from 'three';
import {lastBodyWriter} from './body-revolution-history.js';
import {solidMeshComplete} from './solid-mesh.js';

const EPS = 2e-6;
const vector = value => new Vector3(...value);
const nativePoint = point => new Vector3(point.X(),point.Y(),point.Z());
const isVector = value => Array.isArray(value) && value.length===3 && value.every(Number.isFinite);

function orthogonalFrame(features,spec) {
 if (spec.angle!==360 || !isVector(spec.origin) || !isVector(spec.axisVector)) return null;
 const writer = lastBodyWriter(features,spec.sourceBody), previous = writer?.feature.spec;
 if (previous?.type!=='revolve' || !previous.bodySweep || previous.angle!==360 || writer.feature.outputs.length!==1 ||
     !isVector(previous.origin) || !isVector(previous.axisVector)) return null;
 const pure = (previous.operation==='new' && previous.id===spec.sourceBody) ||
  (previous.operation==='join' && previous.target===spec.sourceBody && previous.sourceBody===spec.sourceBody);
 if (!pure) return null;
 const x=vector(spec.axisVector).normalize(), y=vector(previous.axisVector).normalize();
 if (Math.abs(x.dot(y))>1e-8 || !x.lengthSq() || !y.lengthSq()) return null;
 const start=vector(spec.origin), center=vector(previous.origin);
 center.addScaledVector(y,start.clone().sub(center).dot(y));
 if (center.clone().sub(start).cross(x).length()>1e-7) return null;
 return {center,x,y,normal:x.clone().cross(y).normalize()};
}

function axisymmetric(body,{center,y}) {
 const faces=body.faces;
 try {
  if (!faces.some(face=>face.geomType==='REVOLUTION_SURFACE')) return false;
  return faces.every(face => {
   if (face.geomType==='PLANE') {
    const normal=face.normalAt();
    try {return vector(normal.toTuple()).cross(y).length()<1e-7;}
    finally {normal.delete();}
   }
   if (!['CYLINDRE','REVOLUTION_SURFACE'].includes(face.geomType)) return false;
   const surface=face.surface, owned=[surface];
   try {
    const cylinder=face.geomType==='CYLINDRE'?surface.wrapped.Cylinder():null;
    if (cylinder) owned.push(cylinder);
    const axis=cylinder?cylinder.Axis():surface.wrapped.AxeOfRevolution();
    owned.push(axis);
    const location=axis.Location(), direction=axis.Direction();
    owned.push(location,direction);
    return nativePoint(direction).cross(y).length()<1e-7 &&
     nativePoint(location).sub(center).cross(y).length()<EPS;
   } finally {owned.reverse().forEach(item=>item.delete());}
  });
 } finally {faces.forEach(face=>face.delete());}
}

function sectionEdges(body,{center,normal}) {
 const oc=R.getOC(), point=new oc.gp_Pnt(...center.toArray()), direction=new oc.gp_Dir(...normal.toArray());
 const plane=new oc.gp_Pln(point,direction), section=new oc.BRepAlgoAPI_Section(body.wrapped,plane,false);
 let raw, shape;
 try {
  section.SetNonDestructive(true);
  section.Approximation(false);
  section.Build();
  if (!section.IsDone() || section.HasErrors()) return [];
  raw=section.Shape(); shape=R.cast(raw);
  return shape.edges;
 } finally {shape?.delete();raw?.delete();section.delete();plane.delete();direction.delete();point.delete();}
}

function controlPoints(edge) {
 if (edge.geomType==='LINE') return [];
 if (edge.geomType!=='BSPLINE_CURVE') return null;
 const curve=new (R.getOC().BRepAdaptor_Curve)(edge.wrapped);
 let spline;
 try {
  spline=curve.BSpline();
  const count=spline.NbPoles();
  if (count>4096 || spline.IsRational() || Math.abs(curve.FirstParameter()-spline.FirstParameter())>EPS ||
      Math.abs(curve.LastParameter()-spline.LastParameter())>EPS) return null;
  return Array.from({length:count},(_,i)=>{
   const point=spline.Pole(i+1);
   try {return nativePoint(point);}
   finally {point.delete();}
  });
 } finally {spline?.delete();curve.delete();}
}

function monotone(poles,start,end) {
 let maxX=start.x,maxY=start.y;
 for (const point of poles) {
  if (Math.abs(point.z)>EPS || point.x<maxX-EPS || point.y<maxY-EPS ||
      point.x>end.x+EPS || point.y>end.y+EPS) return false;
  maxX=Math.max(maxX,point.x);maxY=Math.max(maxY,point.y);
 }
 return true;
}

function meridian(edges,frame) {
 const {x,y,center,normal}=frame;
 const endpoint=(edge,key)=>{
  const point=edge[key];
  try {return vector(point.toTuple());}
  finally {point.delete();}
 };
 const project=(point,side=1)=>{
  const delta=point.clone().sub(center);
  return {x:delta.dot(x)*side,y:delta.dot(y),z:delta.dot(normal)};
 };
 const same=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)<=EPS;
 const rows=edges.map(edge=>({edge,ends:['startPoint','endPoint'].map(key=>endpoint(edge,key))}));
 const caps=rows.filter(({edge,ends})=>{
  const [a,b]=ends.map(point=>project(point));
  return edge.geomType==='LINE' && a.x*b.x<-EPS*EPS && Math.abs(a.x+b.x)<EPS && Math.abs(a.y-b.y)<EPS;
 });
 if (caps.length!==2) return null;
 if (caps.every(({ends})=>project(ends[0]).y<=EPS)) y.negate();
 caps.sort((a,b)=>project(a.ends[0]).y-project(b.ends[0]).y);
 const [bottom,top]=caps, high=project(top.ends[0]).y, radius=Math.abs(project(top.ends[0]).x);
 if (project(bottom.ends[0]).y<-EPS || high<EPS || radius<EPS) return null;
 const remaining=rows.filter(row=>!caps.includes(row));
 for (const side of [-1,1]) {
  let at=bottom.ends.map(point=>project(point,side)).find(point=>point.x>EPS);
  const end=top.ends.map(point=>project(point,side)).find(point=>point.x>EPS);
  while (!same(at,end)) {
   const index=remaining.findIndex(row=>row.ends.some(point=>same(project(point,side),at)));
   if (index<0) return null;
   const [{edge,ends}]=remaining.splice(index,1);
   const next=ends.map(point=>project(point,side)).find(point=>!same(point,at));
   const controls=controlPoints(edge);
   if (!next || !controls || next.x<at.x-EPS || next.y<at.y-EPS) return null;
   const poles=controls.map(point=>project(point,side));
   if (poles.length && !same(at,poles[0])) poles.reverse();
   if (poles.length && (!same(at,poles[0]) || !same(next,poles.at(-1)) || !monotone(poles,at,next))) return null;
   at=next;
  }
 }
 if (remaining.length) return null;
 return {top,mid:center.clone().addScaledVector(y,Math.hypot(high,radius))};
}

// A full sweep of this one-sided, widening meridian keeps the lower radial
// boundary. Its upper boundary is a sphere arc because both the original
// radius and the axial distance are maximal at the far cap.
export function orthogonalRoundedSweep(features,body,spec,onProgress) {
 const frame=orthogonalFrame(features,spec);
 if (!frame) return null;
 let edges=[], arc, wire, face, shape;
 try {
  if (!axisymmetric(body,frame)) return null;
  onProgress?.({stage:'回転済みボディのCAD断面を調べています'});
  edges=sectionEdges(body,frame);
  if (edges.length<4 || edges.length>64) return null;
  const outline=meridian(edges,frame);
  if (!outline) return null;
  onProgress?.({stage:'丸みを保って直交軸の全周回転を作成しています'});
  const [a,b]=outline.top.ends;
  arc=R.makeThreePointArc(a.toArray(),outline.mid.toArray(),b.toArray());
  wire=R.assembleWire([...edges.filter(edge=>edge!==outline.top.edge),arc]);
  face=R.makeFace(wire);
  shape=R.revolution(face,frame.center.toArray(),frame.x.toArray(),360);
  const check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);
  try {
   if (!(shape instanceof R.Solid) || !check.IsValid() ||
       R.measureVolume(shape)<R.measureVolume(body)-1e-5 || !solidMeshComplete(shape)) return null;
  } finally {check.delete();}
  const result=shape;shape=null;
  return result;
 } catch {
  return null;
 } finally {shape?.delete();face?.delete();wire?.delete();arc?.delete();edges.forEach(edge=>edge.delete());}
}
