export function rotationSnapTarget(angle,previous=null,stepDegrees=15){
 const step=stepDegrees*Math.PI/180,enter=step*.3,release=step*.4;
 // A wider release range keeps the angle steady near the edge of the snap zone.
 if(previous!==null&&Math.abs(angle-previous)<=release+1e-10)return previous;
 const target=Math.round(angle/step)*step;
 return Math.abs(target-angle)<=enter+1e-10?target:null;
}

export function rotationAngleText(degrees){
 const text=degrees.toFixed(1);
 return text==='-0.0'?'0.0':text;
}
