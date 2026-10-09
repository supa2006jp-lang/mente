// Dimensions of the actual swept profile, measured in its radial/axial section.
export function ballJointThreadDimensions(s){
 const pitch=s.threadPitch,gap=s.threadClearance;
 if(!s.printSafe){const depth=pitch*.5;return {mode:'legacy',depth,maleCrestWidth:pitch*.2,femaleCrestWidth:pitch*.32-gap*.6+pitch*.0576/(depth+.12),flankAngle:Math.atan2(pitch*.24,depth+.12)*180/Math.PI};}
 const nozzle=s.threadNozzle,depth=nozzle*1.5,maleCrestWidth=nozzle*1.5,axialGap=Math.max(.1,nozzle*.25,gap*.6),slope=1.1;
 const minPitch=Math.ceil((maleCrestWidth+2*depth*slope+2*axialGap+nozzle*2-1e-8)*2)/2;
 return {mode:'print',nozzle,depth,maleCrestWidth,femaleCrestWidth:pitch-maleCrestWidth-2*depth*slope-2*axialGap,axialGap,slope,minPitch,flankAngle:Math.atan(slope)*180/Math.PI};
}
export function ballJointThreadSection(s,gap){
 if(!s.printSafe){const half=s.threadPitch*.34+gap*.3,tip=s.threadPitch*.1+gap*.3;return [[-.12+gap,-half],[s.depth+gap,-tip],[s.depth+gap,tip],[-.12+gap,half]];}
 const t=ballJointThreadDimensions(s),tip=t.maleCrestWidth/2+(gap?t.axialGap:0),half=tip+(t.depth+.12)*t.slope;
 return [[-.12+gap,-half],[t.depth+gap,-tip],[t.depth+gap,tip],[-.12+gap,half]];
}
