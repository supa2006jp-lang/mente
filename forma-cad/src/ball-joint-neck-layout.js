// Keep the ball and its socket fixed. The base stays parallel to its original
// end face while the lower half of the rod runs at 45 degrees to the upper half.
export function ballJointNeckLayout(s){
 const length=s.neckLength+s.neckExtension,half=length/2;
 const a=(s.neckBendDirection||0)*Math.PI/180,c=Math.SQRT1_2;
 const offset=s.neckBend?[half*c*Math.cos(a),half*c*Math.sin(a),half*(1-c)]:[0,0,0];
 const bottom=s.lowerEnd-s.neckExtension;
 return {length,offset,base:[offset[0],offset[1],bottom+offset[2]],bend:[0,0,s.splitPosition-s.r-half],direction:[-c*Math.cos(a),-c*Math.sin(a),c]};
}
