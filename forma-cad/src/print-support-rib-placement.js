// The profile already leaves 0.5 mm to the model's perimeter. Align the outer
// sides of the first/last fin to that profile instead of leaving half a pitch.
export function supportRibPlacement(low,high,p){
 const span=high-low,usable=Math.max(0,span-p.wallThickness);
 const count=p.edgeRibs?(usable<1e-6?1:Math.ceil(usable/p.wallPitch)+1):Math.max(1,Math.ceil(span/p.wallPitch));
 const centers=Array.from({length:count},(_,i)=>p.edgeRibs?(count===1?(low+high)/2:low+p.wallThickness/2+usable*i/(count-1)):low+span*(i+.5)/count);
 const cells=centers.map((center,i)=>p.edgeRibs?[i?(centers[i-1]+center)/2:low,i+1<count?(center+centers[i+1])/2:high]:[center-span/count/2,center+span/count/2]);
 return {count,centers,cells};
}
