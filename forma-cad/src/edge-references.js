// Sample every display chord of a recovered arc so faceted, trimmed sketch
// extrusions round the entire selection as well as native CAD circular edges.
export function edgeFilletReferences(edges){
 return edges.flatMap(({bodyId,point,a,b,arc,circle})=>{
  const curve=arc||circle;
  return curve?curve.points.slice(1).map((p,i)=>({bodyId,point:p.map((v,j)=>(v+curve.points[i][j])/2),a:curve.points[i],b:p,curved:true})):[{bodyId,point,...(a&&b?{a,b}:{})}];
 });
}
