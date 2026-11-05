// Limit screen labels before running collision-free placement. With hundreds of
// bodies, treating every previous label as an obstacle creates a very large
// Cartesian search. The full body list remains available in the section panel.
export const SECTION_LABEL_LIMIT=12;
export function sectionLabelIndices(points,limit=SECTION_LABEL_LIMIT){
 return new Set(points.map((point,index)=>({point,index}))
  .filter(({point:p})=>p&&p.z>=-1&&p.z<=1&&Math.abs(p.x)<=1&&Math.abs(p.y)<=1)
  .sort((a,b)=>a.point.x*a.point.x+a.point.y*a.point.y-b.point.x*b.point.x-b.point.y*b.point.y||a.index-b.index)
  .slice(0,limit).map(({index})=>index));
}
