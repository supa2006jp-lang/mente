import {basisFor,worldPoint} from './frames.js';
import {planeCoordinates,sketchPoints} from './regions.js';
const wrap=a=>((a+180)%360+360)%360-180;
const segmentDistance=(p,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy,t=den?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/den)):0;return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);};
// Match only straight geometry on the active sketch plane. Screen distance
// controls proximity while the angle is computed in local plane coordinates.
export function snapSplineTangent({angle,feature,features,endpoint,handle,project,disabled=false}){
 angle=wrap(angle);if(disabled)return {angle,label:''};
 const basis=basisFor(feature),offset=planeCoordinates(feature).offset,origin=project(endpoint),tip=project(handle);
 let best=null;
 for(const f of features){
  if(f.kind!=='sketch'||f.id===feature.id||f.groupHidden||f.arc||!['line','rect','polyline'].includes(f.profile))continue;
  const other=basisFor(f);if(Math.abs(other.n.dot(basis.n))<1-1e-6)continue;
  const local=sketchPoints(f).map(p=>worldPoint({...f,offset:planeCoordinates(f).offset},p));
  if(local.some(p=>Math.abs(p.dot(basis.n)-offset)>1e-4))continue;
  for(let i=1;i<local.length;i++){
   const a=[local[i-1].dot(basis.u),local[i-1].dot(basis.v)],b=[local[i].dot(basis.u),local[i].dot(basis.v)],pa=project(a),pb=project(b);
   if(pa.z<-1||pa.z>1||pb.z<-1||pb.z>1||Math.hypot(b[0]-a[0],b[1]-a[1])<1e-7)continue;
   const distance=Math.min(segmentDistance(origin,pa,pb),segmentDistance(tip,pa,pb));if(distance>32)continue;
   const direction=Math.atan2(b[1]-a[1],b[0]-a[0])*180/Math.PI;
   for(const target of [direction,direction+180]){const difference=Math.abs(wrap(target-angle));if(difference>4)continue;const score=difference+distance/32;if(!best||score<best.score)best={angle:wrap(target),score,label:'直線に平行',guide:[a,b]};}
  }
 }
 if(best)return {angle:best.angle,label:best.label+' · '+Number(best.angle.toFixed(2))+'°',guide:best.guide};
 const target=wrap(Math.round(angle/45)*45);
 if(Math.abs(wrap(target-angle))<=3)return {angle:target,label:(target%180===0?'水平':Math.abs(target)%180===90?'垂直':'45°方向')+' · '+target+'°'};
 return {angle,label:''};
}
