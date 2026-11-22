import Clipper from 'clipper-lib';

export const freeScrewSectionAngle=7.5;
const scale=1e5,fill=Clipper.PolyFillType.pftNonZero;
const clipPoint=([x,z])=>({X:Math.round(x*scale),Y:Math.round(z*scale)});
const polygons=paths=>paths.map(path=>path.map(({X,Y})=>[X/scale,Y/scale]));

export function freeScrewFitPose({pitch,length,threadLength,headHeight,headDown,leftHand,nut:{height}},advance){
 const tip=headDown?length+headHeight:0;
 const threadStart=headDown?tip-threadLength:0;
 const direction=headDown?-1:1;
 const entry=headDown?tip:tip-height;
 // Start near the middle of the thread, at a whole-turn alignment.
 const fitStart=threadStart+Math.floor(Math.max(0,threadLength-height)/(2*pitch)+1e-8)*pitch;
 advance=Math.max(0,Math.min(length,advance??(fitStart-entry)*direction));
 const nutBottom=entry+direction*advance;
 // The axial change and rotation must preserve the helix phase in world Z.
 const turns=(nutBottom-threadStart)/pitch;
 const rotation=(turns-Math.round(turns))*360*(leftHand?-1:1);
 return {advance,nutBottom,nutTop:nutBottom+height,rotation};
}

export function freeScrewSectionOutline(triangles){
 const clipper=new Clipper.Clipper(),outline=[];
 for(const points of triangles){
  const triangle=points.map(clipPoint),area=Clipper.Clipper.Area(triangle);
  if(area)clipper.AddPath(area>0?triangle:triangle.reverse(),Clipper.PolyType.ptSubject,true);
 }
 clipper.Execute(Clipper.ClipType.ctUnion,outline,fill,fill);
 return polygons(outline);
}

export function freeScrewSectionOverlap(screw,nut){
 const clipper=new Clipper.Clipper(),overlap=[];
 clipper.AddPaths(screw.map(ring=>ring.map(clipPoint)),Clipper.PolyType.ptSubject,true);
 clipper.AddPaths(nut.map(ring=>ring.map(clipPoint)),Clipper.PolyType.ptClip,true);
 clipper.Execute(Clipper.ClipType.ctIntersection,overlap,fill,fill);
 const overlapArea=Math.abs(overlap.reduce((area,path)=>area+Clipper.Clipper.Area(path),0))/scale**2;
 return {overlap:polygons(overlap),overlapArea};
}
