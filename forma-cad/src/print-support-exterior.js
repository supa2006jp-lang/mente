import * as R from 'replicad';
import {cadMesh} from './cad-mesh.js';
import {supportBoundaryPaths} from './print-support-coverage.js';

const maximumLipWidth=3;
const minimumAspect=1.5;

export function isSmallExteriorLip(face,faceBounds,model,modelBounds,z,mesh){
 const spans=[0,1].map(i=>faceBounds[1][i]-faceBounds[0][i]);
 const area=R.measureArea(face);
 if(area>maximumLipWidth*Math.hypot(...spans)+1e-6)return false;
 const paths=supportBoundaryPaths(mesh||cadMesh(face));
 if(paths.length!==1)return false;
 const points=paths[0];
 let longest=0,direction;
 for(let i=1;i<points.length;i++){
  const x=points[i][0]-points[i-1][0],y=points[i][1]-points[i-1][1],length=Math.hypot(x,y);
  if(length>longest){longest=length;direction=[x/length,y/length];}
 }
 if(!direction)return false;
 const [ux,uy]=direction;
 const local=points.map(([x,y])=>[x*ux+y*uy,-x*uy+y*ux]);
 const lo=[Infinity,Infinity],hi=[-Infinity,-Infinity];
 for(const point of local)for(const axis of [0,1]){
  lo[axis]=Math.min(lo[axis],point[axis]);hi[axis]=Math.max(hi[axis],point[axis]);
 }
 const length=hi[0]-lo[0],width=hi[1]-lo[1];
 if(width>maximumLipWidth+1e-6||length<minimumAspect*width||area<.7*length*width)return false;
 const angle=Math.atan2(uy,ux)*180/Math.PI;
 const center=(hi[0]+lo[0])/2,half=Math.min(length/4,.6);
 const reach=Math.hypot(modelBounds[1][0]-modelBounds[0][0],modelBounds[1][1]-modelBounds[0][1])+1;
 function occupied(a,b){
  const box=R.makeBox([center-half,Math.min(a,b),z-.45],[center+half,Math.max(a,b),z-.12]);
  let probe,hit;
  try{
   probe=box.rotate(angle,[0,0,0],[0,0,1]);hit=probe.intersect(model);
   return R.measureVolume(hit);
  }finally{hit?.delete();probe?.delete();box.delete();}
 }
 for(const [wall,opening,sign] of [[lo[1],hi[1],-1],[hi[1],lo[1],1]]){
  if(occupied(wall+sign*.02,wall+sign*.42)<2*half*.4*.33*.65)continue;
  if(occupied(opening-sign*.02,opening-sign*reach)<.0001)return true;
 }
 return false;
}

export function ribPiecesReachingCeiling(wall,top){
 const pieces=wall.solids,kept=[];
 try{
  for(const piece of pieces){
   const box=piece.boundingBox;
   try{if(box.bounds[1][2]>=top-1e-5)kept.push(piece);}finally{box.delete();}
  }
  if(kept.length===pieces.length)return {shape:wall,omitted:0};
  const shape=kept.length===0?null:kept.length===1?kept[0].clone():R.makeCompound(kept);
  return {shape,omitted:pieces.length-kept.length};
 }finally{pieces.forEach(piece=>piece.delete());}
}
