import * as R from 'replicad';
import Clipper from 'clipper-lib';
import {sectionFaceTriangles} from './drawing-section.js';
import {screwWorldZ} from './free-screw-settings.js';

const scale=1e5,fill=Clipper.PolyFillType.pftNonZero,axis=[0,0,1];

function sectionOutline(brep,offset,pitch){
 const body=R.deserializeShape(brep).asShape3D();
 let translated,turned,cut;
 try{
  translated=body.translate(offset);
  // The plane still passes through the axis. A slight azimuth offset keeps it
  // away from the common cylindrical and helical seam.
  turned=translated.rotate(7.5,[0,0,0],axis);
  cut=turned.cutPlane('XZ',0,'positive');
  if(!cut)throw Error('軸を通る断面を作成できませんでした');
  cut.mesh({tolerance:Math.min(.003,pitch*.01),angularTolerance:.08});
  const triangles=sectionFaceTriangles(cut,1,0,([x,,z])=>({X:Math.round(x*scale),Y:Math.round(z*scale)}));
  const clipper=new Clipper.Clipper(),outline=[];
  for(const triangle of triangles){
   const area=Clipper.Clipper.Area(triangle);
   if(area)clipper.AddPath(area>0?triangle:triangle.reverse(),Clipper.PolyType.ptSubject,true);
  }
  clipper.Execute(Clipper.ClipType.ctUnion,outline,fill,fill);
  if(!outline.length)throw Error('軸を通る断面を作成できませんでした');
  return outline;
 }finally{cut?.delete();turned?.delete();translated?.delete();body.delete();}
}

export function freeScrewFitSection(settings,screwBrep,nutBrep,nutPosition,onProgress){
 const {origin:[x,y,z],pitch,threadLength,nut}=settings;
 if(!nut||typeof screwBrep!=='string'||typeof nutBrep!=='string'||!Array.isArray(nutPosition)||
  nutPosition.length!==3||nutPosition.some(value=>!Number.isFinite(value)))throw Error('ねじとナットを作成してから断面を確認してください');
 const threadStart=Math.min(screwWorldZ(settings,0),screwWorldZ(settings,threadLength))-z;
 // With equal pitch and lead the threads match again after any whole turn.
 // Use the whole-turn position nearest the centre of the useful thread.
 const nutBottom=threadStart+Math.floor(Math.max(0,threadLength-nut.height)/(2*pitch)+1e-8)*pitch;
 onProgress?.({stage:'ねじとナットの断面を計算しています'});
 const screw=sectionOutline(screwBrep,[-x,-y,-z],pitch);
 const nutSection=sectionOutline(nutBrep,[-nutPosition[0],-nutPosition[1],nutBottom-nutPosition[2]],pitch);
 const clipper=new Clipper.Clipper(),overlap=[];
 clipper.AddPaths(screw,Clipper.PolyType.ptSubject,true);
 clipper.AddPaths(nutSection,Clipper.PolyType.ptClip,true);
 clipper.Execute(Clipper.ClipType.ctIntersection,overlap,fill,fill);
 const polygons=paths=>paths.map(path=>path.map(({X,Y})=>[X/scale,Y/scale]));
 const overlapArea=Math.abs(overlap.reduce((area,path)=>area+Clipper.Clipper.Area(path),0))/scale**2;
 return {screw:polygons(screw),nut:polygons(nutSection),overlap:polygons(overlap),overlapArea,nutBottom,nutTop:nutBottom+nut.height};
}
