import {basisFor} from './frames.js';
// Match rounded clipping vertices to CAD edges without extending the cell.
export function snapGridCellProfile(region,bodies){
 if(!region?.id?.startsWith('grid-cell-')||!bodies)return region;
 const {u,v,n}=basisFor(region),segments=[];
 const dot=(point,axis)=>point.reduce((sum,value,i)=>sum+value*axis.getComponent(i),0);
 for(const body of bodies.values()){
  const edges=body.edges;
  try{
   for(const edge of edges){
    if(edge.geomType!=='LINE')continue;
    const start=edge.startPoint,end=edge.endPoint;
    try{
     const a=start.toTuple(),b=end.toTuple();
     if(Math.abs(dot(a,n)-dot(b,n))>1e-6)continue;
     const p=[dot(a,u),dot(a,v)],q=[dot(b,u),dot(b,v)];
     if(Math.hypot(q[0]-p[0],q[1]-p[1])>1e-6)segments.push([p,q]);
    }finally{start.delete();end.delete();}
   }
  }finally{for(const edge of edges)edge.delete();}
 }
 const snap=point=>{
  let best=point,distance=1e-4;
  for(const [a,b] of segments){
   const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/(dx*dx+dy*dy)));
   const q=[a[0]+t*dx,a[1]+t*dy],d=Math.hypot(q[0]-point[0],q[1]-point[1]);
   if(d<distance){best=q;distance=d;}
  }
  return best;
 };
 return {...region,outer:region.outer.map(snap),holes:region.holes.map(ring=>ring.map(snap))};
}
