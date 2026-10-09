import * as R from 'replicad';
import {fuseSolid} from './solid-fuse.js';

// Same complementary 60-degree profile as the normal nominal-diameter thread tool.
// Work from the free end toward the shoulder; rotate the socket base, never mirror it.
export function ballJointMountBase(radius,height,s,role){
 if(!s.mountThread||(s.mountSide!=='both'&&s.mountSide!==role))return R.makeCylinder(radius,height);
 const owned=[],hold=shape=>(owned.push(shape),shape),pitch=s.mountPitch,length=s.mountLength;
 const major=radius-s.mountClearance,root=major-pitch*.561266,lead=Math.min(.6,pitch*.4),slope=.325/.561266;
 const crestHalf=pitch*(.05+.02*slope),rootHalf=pitch*(.375+.04*slope);
 let wire,path;
 const edges=[],pieces=[];
 try{
  const core=hold(R.makeCylinder(root,height)),shoulder=hold(R.makeCylinder(radius,height-length,[0,0,length]));
  let base=hold(fuseSolid(core,shoulder));
  const points=[[-pitch*.02,-rootHalf],[pitch*.561266,-crestHalf],[pitch*.561266,crestHalf],[-pitch*.02,rootHalf]];
  let drawing=R.draw(points[0]);for(const pt of points.slice(1))drawing=drawing.lineTo(pt);
  const start=-pitch;
  wire=drawing.close().sketchOnPlane(new R.Plane([root,0,start],[1,0,0],[0,-1,0])).wire;
  for(let z=0;z<length+2*pitch-1e-7;z+=pitch){const part=R.makeHelix(pitch,Math.min(pitch,length+2*pitch-z),root).translate([0,0,start+z]);pieces.push(part);edges.push(...part.edges);}
  path=R.assembleWire(edges);
  const swept=hold(R.genericSweep(wire,path,{frenet:true}).rotate(180,[0,0,0],[0,0,1]));
  const clip=hold(R.makeCylinder(major+.01,length-.0002,[0,0,.0001])),teeth=hold(swept.intersect(clip));
  base=hold(fuseSolid(base,teeth));
  // A lead-in removes only the first thread crest and keeps the original end plane.
  const envelope=hold(R.draw([0,0]).lineTo([root+.05,0]).lineTo([major,lead]).lineTo([radius,lead]).lineTo([radius,height]).lineTo([0,height]).close().sketchOnPlane(new R.Plane([0,0,0],[1,0,0],[0,-1,0])).revolve([0,0,1]));
  base=hold(base.intersect(envelope));
  if(role==='socket')base=hold(hold(base.rotate(180,[0,0,0],[1,0,0])).translate([0,0,height]));
  return base.clone();
 }finally{wire?.delete();path?.delete();edges.forEach(e=>e.delete());pieces.forEach(e=>e.delete());owned.reverse().forEach(shape=>shape.delete());}
}
