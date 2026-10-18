import * as R from 'replicad';
import {basisFor} from './frames.js';
import {pipeWorldPoints} from './pipe-path.js';
export function makePipe(feature,diameter,wall=0){
 if(!feature||feature.kind!=='sketch'||feature.profile==='point')throw Error('経路にするスケッチを選択してください');
 if(!Number.isFinite(diameter)||diameter<=0||!Number.isFinite(wall)||wall<0||wall>=diameter/2)throw Error('外径は0より大きく、肉厚は外径の半分未満で指定してください');
 if(feature.pathError)throw Error(feature.pathError);
 const pts=pipeWorldPoints(feature),edges=[];let spine,section,outer,innerSection,inner;
 try{
 if(feature.pathSegments){
  const segments=feature.pathSegments.map(({feature:f,reverse})=>({feature:f,points:reverse?pipeWorldPoints(f).reverse():pipeWorldPoints(f)}));
  if(!segments.length)throw Error('経路の長さがありません');
  for(let i=1;i<segments.length;i++){
   const a=segments[i-1].points.at(-1),b=segments[i].points[0];
   if(Math.hypot(...a.map((v,k)=>v-b[k]))>1e-6)throw Error('パイプ経路の接続が切れています');
   segments[i].points[0]=[...a];
  }
  if(feature.closed)segments.at(-1).points[segments.at(-1).points.length-1]=[...segments[0].points[0]];
  for(const {feature:f,points:p} of segments){
   if(f.arc&&p.length>=3)edges.push(R.makeThreePointArc(p[0],p[Math.floor(p.length/2)],p.at(-1)));
   else if(f.profile==='spline')edges.push(R.makeBSplineApproximation(p,{tolerance:.001}));
   else for(let i=1;i<p.length;i++)if(Math.hypot(...p[i].map((v,k)=>v-p[i-1][k]))>1e-7)edges.push(R.makeLine(p[i-1],p[i]));
  }
 }
 else if(feature.profile==='circle')edges.push(R.makeCircle(feature.diameter/2,[feature.x,feature.y,feature.z],basisFor(feature).n.toArray()));
 else if(feature.arc&&pts.length>=3)edges.push(R.makeThreePointArc(pts[0],pts[Math.floor(pts.length/2)],pts.at(-1)));
 else if(feature.profile==='spline')edges.push(R.makeBSplineApproximation(pts,{tolerance:.001}));
 else for(let i=1;i<pts.length;i++)if(Math.hypot(...pts[i].map((v,k)=>v-pts[i-1][k]))>1e-7)edges.push(R.makeLine(pts[i-1],pts[i]));
 if(!edges.length)throw Error('経路の長さがありません');
 spine=R.assembleWire(edges);const origin=edges[0].pointAt(0),normal=edges[0].tangentAt(0),plane=new R.Plane(origin,undefined,normal);
 section=R.drawCircle(diameter/2).sketchOnPlane(plane).wire;outer=R.genericSweep(section,spine,{transitionMode:'right'});
 if(wall){innerSection=R.drawCircle(diameter/2-wall).sketchOnPlane(plane).wire;inner=R.genericSweep(innerSection,spine,{transitionMode:'right'});return outer.cut(inner);}
 return outer.clone();
 }finally{inner?.delete();innerSection?.delete();outer?.delete();section?.delete();spine?.delete();for(const edge of edges)edge.delete();}
}
