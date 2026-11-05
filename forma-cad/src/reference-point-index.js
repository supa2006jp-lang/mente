// Preserve the first reference within the tolerance without comparing every
// new point with the entire assembly. Neighbour cells cover bucket boundaries.
export function referencePointIndex(tolerance=1e-5){
 const buckets=new Map(),squared=tolerance*tolerance;
 return {add(point){
  const cell=point.map(value=>Math.floor(value/tolerance));
  for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++){
   for(const prior of buckets.get((cell[0]+x)+','+(cell[1]+y)+','+(cell[2]+z))||[]){
    const dx=point[0]-prior[0],dy=point[1]-prior[1],dz=point[2]-prior[2];if(dx*dx+dy*dy+dz*dz<squared)return false;
   }
  }
  const key=cell.join(',');if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push([...point]);return true;
 }};
}
