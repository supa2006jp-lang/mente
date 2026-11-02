import * as R from 'replicad';
import {basisFor} from './frames.js';
import {fuseSolids} from './solid-fuse.js';

export const THIN_SOURCE_FILL_LIMIT=20;
export const thinSourceBodyId=f=>f.region?.cadFace?.bodyId||f.region?.bodyId||f.region?.gridSourceBodyId||f.gridSourceBodyId;
export const thinSourceFillEnabled=f=>f.thinSourceFill===true&&f.mode==='thin'&&f.side==='outside'&&f.operation!=='cut'&&!f.symmetric&&!f.barrier&&!!thinSourceBodyId(f);
const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
function directionalRange(shape,d){
 let aligned=shape.clone();
 try{const axis=[d[1],-d[0],0],length=Math.hypot(...axis);if(length>1e-9)aligned=aligned.rotate(Math.acos(Math.max(-1,Math.min(1,d[2])))*180/Math.PI,[0,0,0],axis.map(v=>v/length));else if(d[2]<0)aligned=aligned.rotate(180,[0,0,0],[1,0,0]);const box=aligned.boundingBox;try{return [box.bounds[0][2],box.bounds[1][2]];}finally{box.delete();}}finally{aligned.delete();}
}

// Extend only the starting cap backwards. The user's end distance and taper
// are unchanged, and the exact contact calculation still starts at the sketch.
// The caller supplies an isolated source and owns the input tool.
export function fillThinSource(tool,feature,bodies,makeProfile){
 if(!thinSourceFillEnabled(feature))return tool;
 const source=bodies?.get(thinSourceBodyId(feature));if(!source)return tool;
 const n=basisFor(feature.region||feature).n.toArray(),sign=Math.sign(feature.depth),d=n.map(v=>v*sign),start=sign*(feature.region?.offset??dot([feature.x,feature.y,feature.z],n));
 let witness,material,result;const caps=[],extensions=[],materialParts=[];
 try{
  // Measure the material immediately inside the outline. A remote central
  // post or another plate below an air gap is not the thickness of this rim.
  witness=makeProfile({...feature,thinSourceFill:false,mode:'thin',side:'inside',wall:.01,symmetric:false,untilSolid:false,endPlane:undefined,throughAll:false,barrier:false,overlapOnly:false,holesOnly:false,taperAngle:0,depth:-sign*(THIN_SOURCE_FILL_LIMIT+.05)});
  material=source.intersect(witness);if(Math.abs(R.measureVolume(material))<1e-7)return tool;
  materialParts.push(...material.solids);const touching=materialParts.map(part=>({part,range:directionalRange(part,d)})).filter(({range})=>Math.abs(range[1]-start)<1e-4);if(!touching.length)return tool;const low=Math.min(...touching.map(({range})=>range[0])),high=Math.max(...touching.map(({range})=>range[1]));let thickness=start-low;
  if(Math.abs(high-start)>1e-4||thickness<1e-5||thickness>THIN_SOURCE_FILL_LIMIT+1e-6)return tool;
  // Prefer an exact planar back face to the bounding box's modelling tolerance.
  const faces=touching.flatMap(({part})=>part.faces);try{for(const face of faces){if(face.geomType!=='PLANE')continue;const normal=face.normalAt(),center=face.center;try{const plane=dot(center.toTuple(),d);if(dot(normal.toTuple(),d)<-.999999&&Math.abs(plane-low)<1e-5)thickness=start-plane;}finally{normal.delete();center.delete();}}}finally{faces.forEach(f=>f.delete());}
  thickness=Math.min(THIN_SOURCE_FILL_LIMIT,thickness);caps.push(...tool.faces);
  for(const cap of caps){if(cap.geomType!=='PLANE')continue;const normal=cap.normalAt(),center=cap.center;try{if(dot(normal.toTuple(),d)>-.999999||Math.abs(dot(center.toTuple(),d)-start)>1e-5)continue;const vector=new R.Vector(d.map(v=>-v*thickness));try{extensions.push(R.basicFaceExtrusion(cap,vector));}finally{vector.delete();}}finally{normal.delete();center.delete();}}
  if(!extensions.length)return tool;result=fuseSolids([tool,...extensions]);tool.delete();const output=result;result=null;return output;
 }catch(error){result?.delete();tool.delete();throw error;}
 finally{witness?.delete();materialParts.forEach(s=>s.delete());material?.delete();caps.forEach(f=>f.delete());extensions.forEach(s=>s.delete());}
}
