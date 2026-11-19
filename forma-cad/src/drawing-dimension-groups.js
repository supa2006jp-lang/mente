const near=(a,b)=>Math.abs(a-b)<1e-5;
const samePoint=(a,b)=>a.every((n,i)=>near(n,b[i]));
const styleKeys=['precision','fontSize','tolerance','note','lineColor','textColor','hidden','pinned','automatic'];
// Only round features of the same view, true radius and annotation style merge.
// Equal rounded label text alone is never evidence that features are equal.
export function groupDrawingDimensions(dimensions){
 const result=[];
 for(const dimension of dimensions){
  if(!['diameter','radius'].includes(dimension.kind)||dimension.review){result.push(structuredClone(dimension));continue;}
  const members=dimension.centers??[dimension.center];
  const group=result.find(d=>!d.review&&d.view===dimension.view&&d.kind===dimension.kind&&near(d.radius,dimension.radius)&&
   styleKeys.every(key=>d[key]===dimension[key])&&(d.centers??[d.center]).length+members.length<=200&&
   members.every(p=>!(d.centers??[d.center]).some(q=>samePoint(p,q))));
  if(!group){result.push(structuredClone(dimension));continue;}
  group.centers=[...(group.centers??[group.center]),...members.map(p=>p.slice())];group.count=group.centers.length;
 }
 return result;
}
