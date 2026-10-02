export function softRotationSnap(angle){
 const step=Math.PI/4,target=Math.round(angle/step)*step;
 return Math.abs(target-angle)<=Math.PI/60?target:angle;
}
