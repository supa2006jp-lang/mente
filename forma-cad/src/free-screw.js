import * as R from 'replicad';
import {fuseSolid} from './solid-fuse.js';
import {screwCountersinkRatio,screwPanRounding} from './free-screw-settings.js';

function polygonPrism(points,z,height){
 let outline=R.draw(points[0]);
 for(const point of points.slice(1))outline=outline.lineTo(point);
 return outline.close().sketchOnPlane('XY',z).extrude(height);
}
function hexagon(across){
 const radius=across/Math.sqrt(3);
 return Array.from({length:6},(_,i)=>[radius*Math.cos(i*Math.PI/3),radius*Math.sin(i*Math.PI/3)]);
}
function screwHead({head,headSize,headHeight,length,diameter}){
 const radius=headSize/2,top=length+headHeight;
 if(head==='hex')return polygonPrism(hexagon(headSize),length,headHeight);
 if(head==='cylinder')return R.makeCylinder(radius,headHeight,[0,0,length]);
 let outline=R.draw([0,length]);
 if(head==='countersunk')outline=outline.lineTo([diameter/2,length])
  .lineTo([radius,length+headHeight*screwCountersinkRatio]).lineTo([radius,top]);
 else{
  const round=screwPanRounding(radius,headHeight),arc=round/Math.SQRT2;
  outline=outline.lineTo([radius,length]).lineTo([radius,top-round])
   .threePointsArcTo([radius-round,top],[radius-round+arc,top-round+arc]);
 }
 return outline.lineTo([0,top]).close()
  .sketchOnPlane(new R.Plane([0,0,0],[1,0,0],[0,-1,0])).revolve([0,0,1]);
}
function screwRecess({length,headHeight,drive,driveSize,driveDepth}){
 const z=length+headHeight-driveDepth,height=driveDepth+.05;
 if(drive==='hex')return polygonPrism(hexagon(driveSize),z,height);
 const end=driveSize/2,side=driveSize*.145;
 if(drive==='slot')return R.makeBox([-end,-side,z],[end,side,z+height]);
 return polygonPrism([
  [-side,-end],[side,-end],[side,-side],[end,-side],[end,side],[side,side],
  [side,end],[-side,end],[-side,side],[-end,side],[-end,-side],[-side,-side],
 ],z,height);
}

export function freeScrewBlank(settings){
 const {diameter,length,headHeight,drive,origin}=settings;
 const shaft=R.makeCylinder(diameter/2,length+Math.min(.05,headHeight/8));
 let head,tool,recessed,combined;
 try{
  head=screwHead(settings);
  if(drive!=='none'){tool=screwRecess(settings);recessed=head.cut(tool);}
  combined=fuseSolid(shaft,recessed??head);
  return combined.translate(origin);
 }finally{shaft.delete();head?.delete();tool?.delete();recessed?.delete();combined?.delete();}
}

export function freeScrewThread({id,diameter,pitch,length,leftHand,origin}){
 const [x,y,z]=origin;
 return {type:'thread',target:id,profile:'metric60',threadVersion:2,modeled:true,pitch,leftHand,fullLength:true,
  designation:'M'+diameter+' × '+pitch,surfacePoint:[x+diameter/2,y,z+length/2]};
}
