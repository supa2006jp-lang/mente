import * as R from 'replicad';
import {drawingSectionPlane} from './drawing-view-preferences.js';
import {drawingSilhouette} from './drawing-silhouette.js';
export function sectionPlane(s){
 const {axis,coordinate,keep,direction,horizontal:x}=drawingSectionPlane(s);
 return {axis,coordinate,keep,direction,x};
}
// Read only the planar caps from an already tessellated native cut.
export function sectionFaceTriangles(shape,axis,coordinate,project){
 const triangles=[],faces=shape.faces;
 try{
  for(const face of faces){
   if(face.geomType!=='PLANE')continue;
   const box=face.boundingBox;let bounds;
   try{bounds=box.bounds;}finally{box.delete();}
   if(bounds.some(point=>Math.abs(point[axis]-coordinate)>1e-5))continue;
   const mesh=face.triangulation();if(!mesh)continue;
   for(let i=0;i<mesh.trianglesIndexes.length;i+=3){
    triangles.push(mesh.trianglesIndexes.slice(i,i+3).map(j=>project(mesh.vertices.slice(j*3,j*3+3))));
   }
  }
  return triangles;
 }finally{faces.forEach(face=>face.delete());}
}
export function sectionProjection(compound,bounds,s,silhouettes=false){
 const {axis,coordinate,keep,direction,horizontal:x,vertical:y}=drawingSectionPlane(s);
 if(coordinate<=bounds[0][axis]+1e-6||coordinate>=bounds[1][axis]-1e-6)throw Error('切断線をソリッドの内側に置いてください');
 const pad=Math.max(1,...bounds[1].map((v,i)=>v-bounds[0][i]))*2,low=bounds[0].map(v=>v-pad),high=bounds[1].map(v=>v+pad);
 if(keep>0)high[axis]=coordinate;else low[axis]=coordinate;
 const cutter=R.makeBox(low,high),camera=new R.ProjectionCamera([0,0,0],direction,x);let cut;
 try{cut=compound.asShape3D().cut(cutter);if(R.measureVolume(cut)<1e-9)throw Error('この位置には断面がありません');
 const p=R.drawProjection(cut,camera),view={visible:p.visible.toSVGPaths().flat(Infinity),hidden:p.hidden.toSVGPaths().flat(Infinity),viewBox:p.visible.toSVGViewBox(0).trim().split(/\s+/).map(Number),triangles:[]};
 // Project only new planar cap faces. Triangulation respects inner wires (holes).
 const mesh=cut.mesh({tolerance:.015,angularTolerance:.1});
 if(silhouettes)view.silhouette=drawingSilhouette(mesh,direction,x);
 const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
 view.triangles=sectionFaceTriangles(cut,axis,coordinate,point=>[dot(point,x),dot(point,y)]);
 if(!view.triangles.length)throw Error('切断線が材質に交差していません。位置を変更してください');
 return view;
 }finally{cut?.delete();camera.delete();cutter.delete();}
}
