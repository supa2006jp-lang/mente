import * as R from 'replicad';
import {verifiedCadMesh} from './verified-cad-mesh.js';
import {liveCadOutputs} from './project-display-data.js';

export function displayMeasures(mesh){
 const p=mesh.vertices,t=mesh.triangles;let area=0,volume=0;
 for(let i=0;i<t.length;i+=3){const a=t[i]*3,b=t[i+1]*3,c=t[i+2]*3,ux=p[b]-p[a],uy=p[b+1]-p[a+1],uz=p[b+2]-p[a+2],vx=p[c]-p[a],vy=p[c+1]-p[a+1],vz=p[c+2]-p[a+2];area+=Math.hypot(uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx)/2;volume+=(p[a]*(p[b+1]*p[c+2]-p[b+2]*p[c+1])+p[a+1]*(p[b+2]*p[c]-p[b]*p[c+2])+p[a+2]*(p[b]*p[c+1]-p[b+1]*p[c]))/6;}
 return {area,volume};
}
export function repairProjectDisplay(features,onProgress){
 const entries=liveCadOutputs(features),records=[],warnings=[],cache=new Map();
 for(const [i,entry]of entries.entries()){
  onProgress?.({stage:'保存された面の表示を確認しています',current:i+1,total:entries.length});
  const {output,featureIndex,outputIndex}=entry,key=JSON.stringify([output.brep,output.displayMesh||null]);
  try{
   let reference=cache.get(key);
   if(!reference){const shape=R.deserializeShape(output.brep).asShape3D();try{const mesh=verifiedCadMesh(shape,output.displayMesh||{tolerance:.08,angularTolerance:.15}),faces=shape.faces;try{const planarFaces=mesh.planarFaces||faces.filter(f=>f.geomType==='PLANE').map(f=>f.hashCode);reference={mesh:{...mesh,planarFaces},measures:displayMeasures(mesh)};cache.set(key,reference);}finally{faces.forEach(f=>f.delete());}}finally{shape.delete();}}
   const actual=displayMeasures(output),expected=reference.measures;
   if(!Number.isFinite(actual.area)||!Number.isFinite(actual.volume)||Math.abs(actual.area-expected.area)>Math.max(.001,expected.area*1e-5)||Math.abs(actual.volume-expected.volume)>Math.max(.001,Math.abs(expected.volume)*1e-5))records.push({featureIndex,outputIndex,mesh:reference.mesh});
  }catch(error){warnings.push({bodyId:output.id,message:error.message});}
 }
 return {records,checked:entries.length,warnings};
}
