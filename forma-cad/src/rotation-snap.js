export function softRotationSnap(angle){
 const step=Math.PI/12,target=Math.round(angle/step)*step;
 return Math.abs(target-angle)<=Math.PI/60?target:angle;
}

export function rotationAngleText(degrees){
 const text=degrees.toFixed(1);
 return text==='-0.0'?'0.0':text;
}
