import * as R from 'replicad';
import {sectionFaceTriangles} from './drawing-section.js';
import {freeScrewFitPose,freeScrewSectionAngle,freeScrewSectionOutline,freeScrewSectionOverlap} from './free-screw-section-data.js';

const axis=[0,0,1];

function sectionOutline(body,offset,meshOptions,rotation=0){
 let translated,turned,cut;
 try{
  translated=body.translate(offset);
  // The plane still passes through the axis. A slight azimuth offset keeps it
  // away from the common cylindrical and helical seam.
  turned=translated.rotate(freeScrewSectionAngle+rotation,[0,0,0],axis);
  cut=turned.cutPlane('XZ',0,'positive');
  if(!cut)throw Error('軸を通る断面を作成できませんでした');
  cut.mesh(meshOptions);
  const outline=freeScrewSectionOutline(sectionFaceTriangles(cut,1,0,([x,,z])=>[x,z]));
  if(!outline.length)throw Error('軸を通る断面を作成できませんでした');
  return outline;
 }finally{cut?.delete();turned?.delete();translated?.delete();}
}

export function freeScrewFitSection(settings,screwBrep,nutBrep,nutPosition,onProgress){
 const {origin:[x,y,z],pitch,nut}=settings;
 if(!nut||typeof screwBrep!=='string'||typeof nutBrep!=='string'||!Array.isArray(nutPosition)||
  nutPosition.length!==3||nutPosition.some(value=>!Number.isFinite(value)))throw Error('ねじとナットを作成してから断面を確認してください');
 const pose=freeScrewFitPose(settings),meshOptions={tolerance:Math.min(.003,pitch*.01),angularTolerance:.08};
 const [nx,ny,nz]=nutPosition;
 onProgress?.({stage:'ねじとナットの断面を計算しています'});
 const screwBody=R.deserializeShape(screwBrep).asShape3D();
 let nutBody;
 try{
  nutBody=R.deserializeShape(nutBrep).asShape3D();
  const screw=sectionOutline(screwBody,[-x,-y,-z],meshOptions);
  const mesh=nutBody.mesh(meshOptions);
  const vertices=Float64Array.from(mesh.vertices,(value,index)=>value-nutPosition[index%3]);
  let nutRadius=0;
  for(let i=0;i<vertices.length;i+=3)nutRadius=Math.max(nutRadius,Math.hypot(vertices[i],vertices[i+1]));
  const nutMesh={vertices,triangles:Uint32Array.from(mesh.triangles)};
  const nutSection=sectionOutline(nutBody,[-nx,-ny,pose.nutBottom-nz],meshOptions,pose.rotation);
  return {screw,nut:nutSection,...freeScrewSectionOverlap(screw,nutSection),...pose,nutMesh,nutRadius};
 }finally{nutBody?.delete();screwBody.delete();}
}
