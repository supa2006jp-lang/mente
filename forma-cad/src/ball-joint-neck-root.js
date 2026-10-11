import * as R from 'replicad';
import {fuseSolid} from './solid-fuse.js';
import {ballJointNeckLayout} from './ball-joint-neck-layout.js';

export function ballJointNeckRootDimensions(s,baseRadius){
 const q=ballJointNeckLayout(s),radius=s.neckDiameter/2;
 const oblique=s.neckBend&&!q.tilt,normalZ=oblique?Math.SQRT1_2:1;
 // A bent rod meets a horizontal base in an ellipse. Keep the whole flare
 // inside the base, and below the elbow (or the ball on a straight rod).
 const width=Math.max(0,Math.min(1.2,radius*.35,baseRadius*normalZ-radius-.3));
 const segment=q.length*(s.neckBend ? .5 : 1)*normalZ;
 return {radius,width,height:Math.min(width,segment*.6),normalZ,oblique,bottom:q.bottom};
}

export function reinforceBallJointNeck(neck,s,baseRadius,hold){
 const d=ballJointNeckRootDimensions(s,baseRadius);
 if(d.width<.05||d.height<.05)return neck;
 const angle=(s.neckBendDirection||0)*Math.PI/180,u=[Math.cos(angle),Math.sin(angle),0];
 const section=(z,r)=>{
  const shift=d.oblique?-z:0,origin=[u[0]*shift,u[1]*shift,d.bottom+z];
  const plane=new R.Plane(origin,u,[0,0,1]);
  try{return (d.oblique?R.drawEllipse(r/d.normalZ,r):R.drawCircle(r)).sketchOnPlane(plane);}finally{plane.delete();}
 };
 // Start inside the base and finish inside the rod, so fusion never relies
 // on coincident faces. The support stays solid and follows a tilted base.
 const collar=hold(section(-.1,d.radius+d.width).loftWith(section(d.height,d.radius-.03),{ruled:true}));
 let placed=collar;
 const q=ballJointNeckLayout(s);
 if(q.tilt)placed=hold(placed.rotate(q.tilt,[0,0,q.bottom],q.rotationAxis));
 if(s.neckBend)placed=hold(placed.translate(q.offset));
 return hold(fuseSolid(neck,placed));
}
