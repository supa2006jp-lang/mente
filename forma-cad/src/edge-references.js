// Sample every display chord of a recovered arc so faceted, trimmed sketch
// extrusions round the entire selection as well as native CAD circular edges.
export function edgeFilletReferences(edges){
 return edges.flatMap(({bodyId,point,arc})=>arc?arc.points.slice(1).map((p,i)=>({bodyId,point:p.map((v,j)=>(v+arc.points[i][j])/2)})):[{bodyId,point}]);
}
