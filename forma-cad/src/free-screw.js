import * as R from 'replicad';
import {fuseSolid} from './solid-fuse.js';
import {screwBarStemRadius,screwCountersinkRatio,screwKnobValley,screwPanRounding,screwWorldZ} from './free-screw-settings.js';

function polygonPrism(points,z,height){
 let outline=R.draw(points[0]);
 for(const point of points.slice(1))outline=outline.lineTo(point);
 return outline.close().sketchOnPlane('XY',z).extrude(height);
}
function hexagon(across){
 const radius=across/Math.sqrt(3);
 return Array.from({length:6},(_,i)=>[radius*Math.cos(i*Math.PI/3),radius*Math.sin(i*Math.PI/3)]);
}
function knobHead(radius,diameter,z,height){
 const step=Math.PI/3,lobeWidth=.22*step,valley=screwKnobValley(radius,diameter);
 const polar=(r,angle)=>[r*Math.cos(angle),r*Math.sin(angle)];
 const start=polar(radius,-lobeWidth);
 let outline=R.draw(start);
 for(let i=0;i<6;i++){
  const angle=i*step;
  outline=outline.threePointsArcTo(polar(radius,angle+lobeWidth),polar(radius,angle))
   .threePointsArcTo(i===5?start:polar(radius,angle+step-lobeWidth),polar(valley,angle+step/2));
 }
 return outline.close().sketchOnPlane('XY',z).extrude(height);
}
function barHead({headSize,headHeight,barThickness,length,diameter}){
 const radius=barThickness/2,half=headSize/2,end=half-radius,stemHeight=headHeight-barThickness;
 const bar=R.draw([-end,-radius]).lineTo([end,-radius]).threePointsArcTo([end,radius],[half,0])
  .lineTo([-end,radius]).threePointsArcTo([-end,-radius],[-half,0])
  .close().sketchOnPlane('XY',length+stemHeight).extrude(barThickness);
 let stem;
 try{
  stem=R.makeCylinder(screwBarStemRadius(diameter),stemHeight+Math.min(.05,barThickness/8),[0,0,length]);
  return fuseSolid(stem,bar);
 }finally{stem?.delete();bar.delete();}
}
function screwHead(settings){
 const {head,headSize,headHeight,length,diameter}=settings;
 const radius=headSize/2,top=length+headHeight;
 if(head==='hex')return polygonPrism(hexagon(headSize),length,headHeight);
 if(head==='cylinder')return R.makeCylinder(radius,headHeight,[0,0,length]);
 if(head==='knob')return knobHead(radius,diameter,length,headHeight);
 if(head==='bar')return barHead(settings);
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
 const {diameter,length,headHeight,drive,origin,headDown}=settings;
 const shaft=R.makeCylinder(diameter/2,length+Math.min(.05,headHeight/8));
 let head,tool,recessed,combined,flipped;
 try{
  head=screwHead(settings);
  if(drive!=='none'){tool=screwRecess(settings);recessed=head.cut(tool);}
  combined=fuseSolid(shaft,recessed??head);
  if(!headDown)return combined.translate(origin);
  flipped=combined.rotate(180,[0,0,0],[1,0,0]);
  return flipped.translate([origin[0],origin[1],screwWorldZ(settings,0)]);
 }finally{shaft.delete();head?.delete();tool?.delete();recessed?.delete();combined?.delete();flipped?.delete();}
}

export function freeScrewThread(settings){
 const {id,diameter,pitch,length,threadLength,leftHand,origin:[x,y]}=settings;
 const fromTip=Math.min(length/4,threadLength/2);
 return {type:'thread',target:id,profile:'metric60',threadVersion:2,modeled:true,pitch,leftHand,
  fullLength:threadLength===length,length:threadLength,offset:0,
  designation:'M'+diameter+' × '+pitch,surfacePoint:[x+diameter/2,y,screwWorldZ(settings,fromTip)]};
}
