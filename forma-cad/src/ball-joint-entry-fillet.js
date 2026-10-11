import * as R from 'replicad';
import {ballJointEntryFilletDimensions} from './ball-joint-entry-dimensions.js';
export function roundBallJointEntry(socket,s){
 const d=ballJointEntryFilletDimensions(s),f=d.radius;
 if(!f)return socket.clone();
 const endAngle=Math.atan2(d.contact[1]-d.centerZ,d.contact[0]-d.entryRadius)-2*Math.PI;
 const midAngle=(-Math.PI/2+endAngle)/2,mid=[d.entryRadius+f*Math.cos(midAngle),d.centerZ+f*Math.sin(midAngle)];
 const tool=R.draw([0,s.mouth-.01]).lineTo([d.entryRadius,s.mouth-.01]).lineTo([d.entryRadius,s.mouth])
  .threePointsArcTo(d.contact,mid).lineTo([0,d.contact[1]]).close()
  .sketchOnPlane(new R.Plane([0,0,0],[1,0,0],[0,-1,0])).revolve([0,0,1]);
 try{return socket.cut(tool);}finally{tool.delete();}
}
