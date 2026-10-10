// Keep the ball/socket fixed while positioning the lower half of the bent rod.
// Leave 0.5 mm between the tilted base's highest edge and the ball's bottom.
export function ballJointBaseTiltMinLength(radius){
 return Math.ceil(2*(radius*Math.SQRT1_2+.5)/(1+Math.SQRT1_2)*100)/100;
}
export function ballJointNeckLayout(s){
 const length=s.neckLength+s.neckExtension,half=length/2;
 const a=(s.neckBendDirection||0)*Math.PI/180,c=Math.SQRT1_2;
 const offset=s.neckBend?[half*c*Math.cos(a),half*c*Math.sin(a),half*(1-c)]:[0,0,0];
 const bottom=s.lowerEnd-s.neckExtension;
 return {length,offset,bottom,base:[offset[0],offset[1],bottom+offset[2]],bend:[0,0,s.splitPosition-s.r-half],direction:[-c*Math.cos(a),-c*Math.sin(a),c],tilt:s.neckBend&&s.neckBaseTilt?45:0,rotationAxis:[Math.sin(a),-Math.cos(a),0]};
}
// Points are expressed in the original, upright base frame, before placement.
export function ballJointBasePoint(s,point){
 const q=ballJointNeckLayout(s);
 if(!q.tilt)return point.map((v,i)=>v+q.offset[i]);
 const v=[point[0],point[1],point[2]-q.bottom],k=q.rotationAxis;
 const a=q.tilt*Math.PI/180,c=Math.cos(a),t=Math.sin(a),dot=k.reduce((sum,x,i)=>sum+x*v[i],0);
 const cross=[k[1]*v[2]-k[2]*v[1],k[2]*v[0]-k[0]*v[2],k[0]*v[1]-k[1]*v[0]];
 return v.map((x,i)=>q.base[i]+x*c+cross[i]*t+k[i]*dot*(1-c));
}
