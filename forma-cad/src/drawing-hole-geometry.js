import {Vector3} from 'three';

const tolerance=1e-5;
const parallel=(a,b)=>a.dot(b)>1-1e-7;

function circularRim(edge){
 const curve=edge.curve;
 try{
  if(curve.curveType!=='CIRCLE'||!curve.isClosed)return null;
  const circle=curve.wrapped.Circle(),p=circle.Location();
  try{return {edge,center:new Vector3(p.X(),p.Y(),p.Z()),radius:circle.Radius()};}
  finally{p.delete();circle.delete();}
 }finally{curve.delete();}
}

// Only a complete cylindrical wall between two circular wires establishes a depth.
function indexWall(face,byEdge,owned){
 const edges=face.edges;
 try{
  if(edges.length<2||edges.length>3)return;
  const rims=edges.map(circularRim).filter(Boolean);
  if(rims.length!==2||Math.abs(rims[0].radius-rims[1].radius)>tolerance)return;
  for(const [i,rim] of rims.entries()){
   rim.other=rims[1-i];
   const id=rim.edge.hashCode;
   if(byEdge.has(id)){byEdge.set(id,null);continue;}
   rim.edge=rim.edge.clone();owned.push(rim.edge);
   byEdge.set(id,rim);
  }
 }finally{edges.forEach(edge=>edge.delete());}
}

function attachPlane(face,byEdge){
 const wires=face.wires,outer=face.clone().outerWire();
 try{
  const plane={wireCount:wires.length,innerRims:[]};
  for(const wire of wires){
   const edges=wire.edges;
   try{
    if(edges.length!==1)continue;
    const rim=byEdge.get(edges[0].hashCode);
    if(!rim||!rim.edge.isSame(edges[0]))continue;
    if(!plane.normal){
     const n=face.normalAt();try{plane.normal=new Vector3(...n.toTuple());}finally{n.delete();}
    }
    rim.plane=plane;rim.inner=!wire.isSame(outer);
    if(rim.inner)plane.innerRims.push(rim);
   }finally{edges.forEach(edge=>edge.delete());}
  }
 }finally{outer.delete();wires.forEach(wire=>wire.delete());}
}

function boreSegment(entry){
 const end=entry.other;
 if(!entry.inner||!end.plane)return null;
 const direction=entry.center.clone().sub(end.center),depth=direction.length();
 if(depth<=tolerance||!parallel(direction.normalize(),entry.plane.normal))return null;
 if(end.inner&&entry.plane.normal.dot(end.plane.normal)<-1+1e-7)return {through:true};
 if(end.inner||!parallel(entry.plane.normal,end.plane.normal))return null;
 if(end.plane.wireCount===1)return {depth};
 const [pilot]=end.plane.innerRims;
 if(end.plane.wireCount===2&&pilot&&pilot.radius<entry.radius-tolerance&&pilot.center.distanceTo(end.center)<tolerance)return {depth,pilot};
 return null;
}

export function drawingHoleRims(shape){
 const faces=shape.faces,planes=[],byEdge=new Map(),owned=[];
 try{
  for(const face of faces){
   const type=face.geomType;
   if(type==='CYLINDRE')indexWall(face,byEdge,owned);
   else if(type==='PLANE')planes.push(face);
  }
  if(!byEdge.size)return [];
  for(const face of planes)attachPlane(face,byEdge);
  const rims=[...byEdge.values()].filter(rim=>rim?.plane);
  const segments=new Map(rims.map(rim=>[rim,boreSegment(rim)]));
  const pilots=new Set([...segments.values()].map(segment=>segment?.pilot).filter(Boolean));
  for(const [rim,segment] of segments){
   if(!segment||pilots.has(rim))continue;
   const pilot=segment.pilot;
   if(!pilot){rim.machining={radius:rim.radius,...segment};continue;}
   const lower=segments.get(pilot);
   if(!lower||lower.pilot)continue;
   rim.machining=pilot.machining={radius:pilot.radius,...(lower.through?{through:true}:{depth:segment.depth+lower.depth}),
    counterbore:{radius:rim.radius,depth:segment.depth}};
  }
  return rims.map(rim=>({center:rim.center,normal:rim.plane.normal,radius:rim.radius,machining:rim.machining}));
 }catch{
  // Some imported faces have no usable native surface or wire. Keep their projected geometry.
  return [];
 }finally{owned.forEach(edge=>edge.delete());faces.forEach(face=>face.delete());}
}

export function projectDrawingHoles(rims,projection){
 const normal=new Vector3(...projection.normal),horizontal=new Vector3(...projection.horizontal),vertical=new Vector3(...projection.vertical);
 const nearest=new Map();
 for(const rim of rims){
  if(!parallel(rim.normal,normal))continue;
  const center=[rim.center.dot(horizontal),rim.center.dot(vertical)],level=rim.center.dot(normal);
  const key=[...center,rim.radius].map(n=>Math.round(n/tolerance)).join(',');
  const previous=nearest.get(key);
  if(!previous||level>previous.level+tolerance)nearest.set(key,{center,level,machining:rim.machining});
  else if(Math.abs(level-previous.level)<=tolerance)previous.machining=undefined;
 }
 const found=new Map();
 for(const {center,machining} of nearest.values()){
  if(!machining)continue;
  const record=found.get(machining);
  if(record)record.rims++;
  else found.set(machining,{center,rims:1});
 }
 const holes=[];
 for(const [machining,{center,rims}] of found){
  if(!machining.counterbore||rims===2)holes.push({center,...machining});
 }
 return holes;
}
