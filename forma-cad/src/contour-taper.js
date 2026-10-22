// Material-outward normals, independent of contour winding or sketch axes.
const cross=(a,b)=>a[0]*b[1]-a[1]*b[0],sub=(a,b)=>[a[0]-b[0],a[1]-b[1]],dot=(a,b)=>a[0]*b[0]+a[1]*b[1];
export function contourEdges(ring,hole=false){
 const area=ring.reduce((s,p,i)=>s+cross(p,ring[(i+1)%ring.length]),0)/2,sign=(area>0?1:-1)*(hole?-1:1);
 return ring.map((a,i)=>{const b=ring[(i+1)%ring.length],d=sub(b,a),length=Math.hypot(...d);if(length<1e-8)throw Error('テーパーの輪郭に短すぎる辺があります');return {a,b,n:[sign*d[1]/length,-sign*d[0]/length],d:d.map(v=>v/length),length};});
}
// A channel's recessed chain lies inside its convex hull. Find its opposite
// material faces by casting through the material, so the end faces stay fixed.
export function channelSides(ring){
 const edges=contourEdges(ring),extent=Math.max(...ring.flat().map(Math.abs),1),eps=extent*1e-8;
 const inner=edges.map(e=>ring.some(p=>dot(sub(p,e.a),e.n)>eps)),outer=edges.map(()=>false);
 if(!inner.some(Boolean))throw Error('内側を判定できません。コの字などの凹んだ輪郭、または穴のある輪郭を選択してください');
 for(let i=0;i<edges.length;i++)if(inner[i]){
  const e=edges[i],mid=e.a.map((v,k)=>(v+e.b[k])/2),ray=e.n.map(v=>-v);let hit=-1,best=Infinity;
  for(let j=0;j<edges.length;j++){if(i===j||inner[j])continue;const q=edges[j],v=sub(q.b,q.a),den=cross(ray,v);if(Math.abs(den)<1e-10)continue;const w=sub(q.a,mid),t=cross(w,v)/den,u=cross(w,ray)/den;if(t>eps&&u>=-1e-7&&u<=1+1e-7&&t<best&&dot(e.n,q.n)<-.5){best=t;hit=j;}}
  if(hit<0)throw Error('内側と外側の対応を判定できません。輪郭を分けて押し出してください');outer[hit]=true;
 }
 return {inner,outer};
}
export function contourTaperPlan(rings,mode){
 const closed=rings.length>1,sides=closed?null:channelSides(rings[0]);
 return rings.map((ring,index)=>{const edges=contourEdges(ring,index>0),selected=closed?edges.map(()=>mode==='inner'?index>0:index===0):sides[mode];return {ring,edges,selected};});
}
export function contourTaperCorners(plan){
 return plan.flatMap(({ring,edges,selected})=>ring.map((p,i)=>{
  const previous=(i+ring.length-1)%ring.length,a=edges[previous].n,b=edges[i].n,da=selected[previous]?1:0,db=selected[i]?1:0,den=cross(a,b);let delta;
  if(Math.abs(den)<1e-9){if(dot(a,b)<0||da!==db)throw Error('テーパーの輪郭の接続を判定できません');delta=a.map(v=>v*da);}
  else delta=[(da*b[1]-a[1]*db)/den,(a[0]*db-da*b[0])/den];
  return {x:p[0],y:p[1],dx:delta[0],dy:delta[1]};
 }));
}
