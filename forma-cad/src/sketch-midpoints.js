import {sketchPoints} from './regions.js';

// A curve's display chords are not separate sketch edges. Use the same
// corner threshold as trimming when recognizing older polyline curve data.
export function sketchMidpoints(feature){
 if(feature.arc||!['line','rect','polyline'].includes(feature.profile))return [];
 const points=sketchPoints(feature),n=points.length-1;
 const closed=n>1&&Math.hypot(points[0][0]-points[n][0],points[0][1]-points[n][1])<1e-7;
 const direction=i=>[points[i+1][0]-points[i][0],points[i+1][1]-points[i][1]];
 const smoothJoin=(i,j)=>{
  if(i<0||j>=n)return false;
  const a=direction(i),b=direction(j),bend=Math.abs(Math.atan2(a[0]*b[1]-a[1]*b[0],a[0]*b[0]+a[1]*b[1]));
  return bend>1e-7&&bend<=.2;
 };
 const result=[];
 for(let i=0;i<n;i++){
  if(feature.profile==='polyline'&&(smoothJoin(i?i-1:closed?n-1:-1,i)||smoothJoin(i,i<n-1?i+1:closed?0:n)))continue;
  result.push([(points[i][0]+points[i+1][0])/2,(points[i][1]+points[i+1][1])/2]);
 }
 return result;
}
