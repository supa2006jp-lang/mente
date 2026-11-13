const overlap=(a,b,k)=>Math.max(0,Math.min(a[1][k],b[1][k])-Math.max(a[0][k],b[0][k]));

export function ribExclusionLocations(ribs,ids,blockers){
 return ribs.filter(rib=>ids.includes(rib.id)||ids.includes(rib.ribId)).map(rib=>({
  id:rib.id,axis:rib.axis,center:rib.center,ceiling:rib.ceiling,bounds:rib.bounds,
  blocked:blockers.includes(rib.id)||blockers.includes(rib.ribId)
 }));
}

export function remapRibExclusions(locations,ribs){
 const proposals=locations.map(location=>{
  const exact=ribs.find(rib=>rib.id===location.id);
  if(exact)return {location,match:exact.id,candidates:[exact.id]};
  const other=1-location.axis;
  const sameFace=ribs.filter(rib=>Math.abs(rib.ceiling-location.ceiling)<1e-4&&overlap(location.bounds,rib.bounds,2)>1e-4);
  const sameDirection=sameFace.filter(rib=>rib.axis===location.axis&&
   location.center>=rib.band[0]-1e-5&&location.center<=rib.band[1]+1e-5&&overlap(location.bounds,rib.bounds,other)>1e-4);
  const across=sameFace.filter(rib=>rib.axis!==location.axis&&overlap(location.bounds,rib.bounds,0)>1e-4&&overlap(location.bounds,rib.bounds,1)>1e-4);
  const candidates=[...sameDirection,...across].map(rib=>rib.id);
  const single=sameDirection.length===1&&candidates.length===1?sameDirection[0]:null;
  const match=single&&[other,2].every(k=>overlap(location.bounds,single.bounds,k)>=.5*Math.max(
   location.bounds[1][k]-location.bounds[0][k],single.bounds[1][k]-single.bounds[0][k]))?single.id:null;
  return {location,match,candidates};
 });
 const matches=new Map();
 const review=[];
 for(const proposal of proposals){
  const {location,match,candidates}=proposal;
  const conflicts=match&&proposals.some(other=>other.match===match&&other.location.blocked!==location.blocked);
  if(match&&!conflicts)matches.set(match,location.blocked);
  else review.push({location,candidates});
 }
 return {ids:[...matches.keys()],blockers:[...matches].filter(([,blocked])=>blocked).map(([id])=>id),review};
}
