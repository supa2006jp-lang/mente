import * as R from 'replicad';
import {supportBoundaryPaths,supportHorizontalCap} from './print-support-coverage.js';
import {supportBridgeSpans,supportMeshTriangles} from './print-support-bridges.js';

function inspectSkinLayer(face,landings,axis,lineWidth){
 if(!face)return null;
 const other=1-axis;
 const stations=[face,landings].filter(Boolean).flatMap(mesh=>supportBoundaryPaths(mesh)
  .flatMap(path=>path.map(point=>point[other])));
 const result=supportBridgeSpans(supportMeshTriangles(face),landings?supportMeshTriangles(landings):[],axis,8,{regions:true,stations});
 if(!result)return null;
 // Ignore unsupported fringes smaller than half a printed line.
 const bands=result.bands.filter(band=>band.risk==='wide'||band.risk==='edge'&&band.width>=lineWidth/2);
 return {...result,bands,face,landings,lineWidth};
}

export function supportSkinLayer(roof,records,axis,top,p){
 const z=top-p.layerHeight*p.roofLayers;
 const face=supportHorizontalCap(roof,z);
 if(!face)return null;
 const probe=z-p.layerHeight/2;
 const box=roof.boundingBox;
 let low,high;
 try{[low,high]=box.bounds;}finally{box.delete();}
 const slab=R.makeBox([low[0]-1,low[1]-1,probe-p.layerHeight/2],[high[0]+1,high[1]+1,probe]);
 const ribs=R.makeCompound(records.map(record=>record.shape.clone()));
 let cut;
 try{
  cut=ribs.intersect(slab);
  return inspectSkinLayer(face,supportHorizontalCap(cut,probe,z),axis,p.lineWidth);
 }finally{cut?.delete();ribs.delete();slab.delete();}
}

export function refreshSupportSkinLayer(layer,roof){
 const z=layer.face.vertices[2];
 return inspectSkinLayer(supportHorizontalCap(roof,z),layer.landings,layer.axis,layer.lineWidth);
}
