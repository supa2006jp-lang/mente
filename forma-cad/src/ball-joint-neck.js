import * as R from 'replicad';
import {fuseSolid} from './solid-fuse.js';
import {reinforceBallJointNeck} from './ball-joint-neck-root.js';

import {ballJointNeckLayout} from './ball-joint-neck-layout.js';

export function ballJointNeck(s,hold,baseRadius){
 if(!s.neckBend)return reinforceBallJointNeck(hold(R.makeCylinder(s.neckDiameter/2,s.r+s.neckLength+s.neckExtension+.3,[0,0,s.lowerEnd-s.neckExtension-.2])),s,baseRadius,hold);
 const q=ballJointNeckLayout(s),radius=s.neckDiameter/2;
 const upper=hold(R.makeCylinder(radius,s.r+q.length/2+.1,q.bend));
 const start=q.base.map((v,i)=>v-q.direction[i]*.2);
 const lower=hold(R.makeCylinder(radius,q.length/2+.4,start,q.direction));
 const elbow=hold(R.makeSphere(radius).translate(q.bend));
 return reinforceBallJointNeck(hold(fuseSolid(hold(fuseSolid(upper,elbow)),lower)),s,baseRadius,hold);
}

export function placeBallJointBase(shape,s,hold){
 if(!s.neckBend)return shape;
 const q=ballJointNeckLayout(s);
 if(q.tilt)shape=hold(shape.rotate(q.tilt,[0,0,q.bottom],q.rotationAxis));
 return hold(shape.translate(q.offset));
}
