import * as R from 'replicad';
import {allThreadPullSpec} from './thread-pull-spec.js';
import {offsetThreadProfile} from './thread-pull.js';
import {ballJointFixDimensions} from './ball-joint-settings.js';
import {fuseThread} from './thread-fuse.js';

// Use the normal nominal-diameter female thread and its all-face auto-pull.
// Work inward from each free end. A rotation keeps both holes right-handed.
export function ballJointFixHole(base,height,s,role){
 if(!s.fixHole||(s.fixSide!=='both'&&s.fixSide!==role))return base.clone();
 const {diameter,pitch,depth:length}=ballJointFixDimensions(s,role),radius=diameter/2,spec=allThreadPullSpec({pitch},-.2),owned=[],hold=shape=>(owned.push(shape),shape),pieces=[],edges=[];let wire,path;
 const place=shape=>role==='socket'?hold(hold(shape.rotate(180,[0,0,0],[1,0,0])).translate([0,0,height])):shape;
 try{
  const offsets=[...spec.threadFaceOffsets];offsets[3]=Math.max(offsets[3]||0,-spec.threadCylinderOffset);
  const points=offsetThreadProfile([[pitch*.02,-pitch*.45],[-pitch*.541266,-pitch*.125],[-pitch*.541266,pitch*.125],[pitch*.02,pitch*.45]],offsets);
  let profile=R.draw(points[0]);for(const pt of points.slice(1))profile=profile.lineTo(pt);
  wire=profile.close().sketchOnPlane(new R.Plane([radius,0,0],[1,0,0],[0,-1,0])).wire;
  for(let z=0;z<length-1e-8;z+=pitch){const part=R.makeHelix(pitch,Math.min(pitch,length-z),radius).translate([0,0,z]);pieces.push(part);edges.push(...part.edges);}
  path=R.assembleWire(edges);
  const swept=hold(R.genericSweep(wire,path,{frenet:true})),clip=hold(R.makeCylinder(radius+pitch*2,length-.0002,[0,0,.0001])),ridge=hold(swept.intersect(clip));
  const tool=place(hold(R.makeCylinder(radius-spec.threadCylinderOffset,length+.01,[0,0,-.01]))),bored=hold(base.cut(tool));
  const result=hold(fuseThread(bored,place(ridge),{requireJoined:true}));
  if(!(R.measureVolume(result)<R.measureVolume(base)-1e-4))throw Error('固定用ねじ穴を正常に作成できませんでした');
  return result.clone();
 }finally{wire?.delete();path?.delete();edges.forEach(e=>e.delete());pieces.forEach(p=>p.delete());owned.reverse().forEach(shape=>shape.delete());}
}
