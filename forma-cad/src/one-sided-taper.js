import * as R from 'replicad';
import {basisFor,worldPoint} from './frames.js';
import {validateTaperOptions} from './taper.js';

// Stretch the cap in one direction about its opposite edge. Lofting exact
// curves preserves arcs and holes, including their inner boundaries.
export function oneSidedTaper(shape,f){
 validateTaperOptions(f);
 const profile=f.region||f,basis=basisFor(profile),normal=basis.n.clone().multiplyScalar(Math.sign(f.depth)),origin=f.region?worldPoint(profile,profile.outer[0]).toArray():[f.x,f.y,f.z],side=f.taperSide??'u+',direction=(side[0]==='u'?basis.u:basis.v).clone();
 if(!f.region)direction.applyAxisAngle(basis.n,(f.angle??0)*Math.PI/180);
 const faces=shape.faces,caps=[],parts=[];let result;
 const coordinate=p=>(p[0]-origin[0])*normal.x+(p[1]-origin[1])*normal.y+(p[2]-origin[2])*normal.z;
 const info=face=>{const uv=face.uvCoordinates(origin),next=face.uvCoordinates(origin.map((v,i)=>v+direction.toArray()[i])),d=[next[0]-uv[0],next[1]-uv[1]],rotation=Math.atan2(d[1],d[0])*180/Math.PI,drawing=R.drawFaceOutline(face),bounds=drawing.rotate(-rotation,uv).boundingBox.bounds;return {face,uv,d,rotation,drawing,min:bounds[0][0]-uv[0],max:bounds[1][0]-uv[0]};};
 try{
  let height=0;const vertices=shape.mesh({tolerance:.1,angularTolerance:.2}).vertices;for(let i=0;i<vertices.length;i+=3)height=Math.max(height,coordinate(vertices.slice(i,i+3)));
  for(const face of faces){if(face.geomType!=='PLANE')continue;const n=face.normalAt(),center=face.center;try{if(Math.abs(n.x*normal.x+n.y*normal.y+n.z*normal.z)/n.Length>.999999&&Math.abs(coordinate(center.toTuple()))<1e-5)caps.push(info(face));}finally{n.delete();center.delete();}}
  if(!caps.length)throw Error('押し出し元の輪郭を取得できません');
  const shift=height*Math.tan(f.taperAngle*Math.PI/180),min=Math.min(...caps.map(c=>c.min)),max=Math.max(...caps.map(c=>c.max)),width=max-min,anchor=side[1]==='+'?min:max,ratio=1+shift/width;
  if(height<1e-7||width<1e-7||ratio*width<.001)throw Error('この角度では片側テーパーが潰れます。角度や距離を小さくしてください');
  const band=entry=>{
   const {face,drawing,uv,d}=entry,anchorUV=[uv[0]+d[0]*anchor,uv[1]+d[1]*anchor],sketches=[];let end;
   try{
    const base=drawing.sketchOnFace(face,'original');sketches.push(base);
    end=drawing.stretch(ratio,[-d[1],d[0]],anchorUV).sketchOnFace(face,'original');let wire;
    const original=base.wire.edges,edges=end.wire.edges,lines=[];
    try{if(original.every(e=>e.geomType==='LINE')){for(const edge of edges){const a=edge.startPoint,b=edge.endPoint;try{lines.push(R.makeLine(a,b));}finally{a.delete();b.delete();}}wire=R.assembleWire(lines).translate(normal.clone().multiplyScalar(height).toArray());}else wire=end.wire.clone().translate(normal.clone().multiplyScalar(height).toArray());}finally{original.forEach(e=>e.delete());edges.forEach(e=>e.delete());lines.forEach(e=>e.delete());}
    sketches.push(new R.Sketch(wire));
    return sketches[0].loftWith(sketches.slice(1),{ruled:true});
   }finally{for(const sketch of sketches)sketch.delete();end?.delete();}
  };
  for(const cap of caps){let solid=band(cap);try{for(const wire of cap.face.clone().innerWires()){let holeFace,tool;try{holeFace=R.makeFace(wire);tool=band(info(holeFace));const cut=solid.cut(tool);solid.delete();solid=cut;}finally{tool?.delete();holeFace?.delete();wire.delete();}}parts.push(solid);solid=null;}finally{solid?.delete();}}
  for(const part of parts){const next=result?result.fuse(part):part.clone();result?.delete();result=next;}
  const check=new (R.getOC().BRepCheck_Analyzer)(result.wrapped,true,false);try{if(!check.IsValid()||R.measureVolume(result)<1e-7)throw Error('この角度では有効な片側テーパーを作れません');}finally{check.delete();}
  const output=result;result=null;return output;
 }finally{result?.delete();parts.forEach(p=>p.delete());faces.forEach(p=>p.delete());shape.delete();}
}
