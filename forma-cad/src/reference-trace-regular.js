import {traceShapeCandidates} from './reference-trace-shapes.js';
import {polylineDifference} from './spline-analysis.js';
import {validateTraceEdits} from './reference-trace-edit.js';
const TAU=2*Math.PI;
function leastSquares(rows,values){const n=rows[0].length,m=Array.from({length:n},(_,i)=>[...Array.from({length:n},(_,j)=>rows.reduce((s,r)=>s+r[i]*r[j],0)),rows.reduce((s,r,k)=>s+r[i]*values[k],0)]);for(let i=0;i<n;i++){let pivot=i;for(let j=i+1;j<n;j++)if(Math.abs(m[j][i])>Math.abs(m[pivot][i]))pivot=j;if(Math.abs(m[pivot][i])<1e-10)return null;[m[i],m[pivot]]=[m[pivot],m[i]];const q=m[i][i];for(let k=i;k<=n;k++)m[i][k]/=q;for(let j=0;j<n;j++)if(j!==i){const q=m[j][i];for(let k=i;k<=n;k++)m[j][k]-=q*m[i][k];}}return m.map(r=>r[n]);}
function resample(ps,count=256){const lengths=ps.map((p,i)=>Math.hypot(p[0]-ps[(i+1)%ps.length][0],p[1]-ps[(i+1)%ps.length][1])),total=lengths.reduce((a,b)=>a+b,0);if(total<1e-6)return [];let index=0,start=0;return Array.from({length:count},(_,i)=>{const d=i*total/count;while(index<ps.length-1&&d>start+lengths[index])start+=lengths[index++];const t=(d-start)/(lengths[index]||1),p=ps[index],q=ps[(index+1)%ps.length];return p.map((v,k)=>v+(q[k]-v)*t);});}
function candidates(ps){const points=resample(ps);if(!points.length)return [];const origin=[0,1].map(k=>points.reduce((s,p)=>s+p[k],0)/points.length),scale=Math.max(...points.map(p=>Math.hypot(p[0]-origin[0],p[1]-origin[1])));if(scale<.01)return [];const normalized=points.map(p=>p.map((v,k)=>(v-origin[k])/scale)),out=[],c=leastSquares(normalized.map(([x,y])=>[x,y,1]),normalized.map(([x,y])=>-x*x-y*y));
 if(c){const center=[-c[0]/2,-c[1]/2],r=Math.sqrt(center[0]**2+center[1]**2-c[2]);if(Number.isFinite(r)&&r>0)out.push({type:'circle',center:center.map((v,k)=>v*scale+origin[k]),radii:[r*scale,r*scale],angle:0});}
 const e=leastSquares(normalized.map(([x,y])=>[x*y,y*y,x,y,1]),normalized.map(([x,y])=>-x*x));if(e){const [B,C,D,E,F]=e,det=C-B*B/4;if(det>1e-8){const center=[(B*E/2-C*D)/(2*det),(B*D/2-E)/(2*det)],k=center[0]**2+B*center[0]*center[1]+C*center[1]**2-F,delta=Math.hypot(1-C,B),l1=(1+C+delta)/2,l2=(1+C-delta)/2;if(k>0&&l2>1e-8){const radii=[Math.sqrt(k/l1)*scale,Math.sqrt(k/l2)*scale];if(Math.max(...radii)/Math.min(...radii)<100)out.push({type:'ellipse',center:center.map((v,i)=>v*scale+origin[i]),radii,angle:.5*Math.atan2(B,1-C)});}}}return out;
}
const signedArea=ps=>ps.reduce((a,p,i)=>a+p[0]*ps[(i+1)%ps.length][1]-p[1]*ps[(i+1)%ps.length][0],0);
const countKeys={circle:'circles',ellipse:'ellipses',rectangle:'rectangles',roundedRectangle:'roundedRectangles',slot:'slots',dShape:'dShapes'};
export function* traceRegularCandidates(r,scale=[1,1],precision=.005){
 const physical=r.points.map(p=>p.map((v,k)=>v*scale[k])),dense=resample(physical,1024);if(!dense.length)return;
 const round=candidates(physical),fits=[...round.filter(f=>f.type==='circle'),...traceShapeCandidates(physical,precision),...round.filter(f=>f.type==='ellipse')];
 for(const fit of fits){let points=fit.points,pieces=fit.pieces;
  if(!points){const radius=Math.max(...fit.radii),count=Math.max(128,Math.ceil(TAU*Math.sqrt(radius/(8*precision))));if(count>1800)continue;const c=Math.cos(fit.angle),s=Math.sin(fit.angle);points=Array.from({length:count},(_,i)=>{const a=i*TAU/count,x=fit.radii[0]*Math.cos(a),y=fit.radii[1]*Math.sin(a);return [fit.center[0]+x*c-y*s,fit.center[1]+x*s+y*c];});}
  if(points.length>1800)continue;const closed=[...points,points[0]],difference=Math.max(polylineDifference([...dense,dense[0]],closed),polylineDifference([...physical,physical[0]],closed))+2*precision;
  if(signedArea(points)*signedArea(physical)<0){points=[...points].reverse();if(pieces)pieces=[...pieces].reverse().map(p=>({...p,points:[...p.points].reverse(),startTangent:p.endTangent?.map(n=>-n),endTangent:p.startTangent?.map(n=>-n)}));}
  const ring={hole:r.hole,points:points.map(p=>p.map((v,k)=>v/scale[k])),regularType:fit.type,dimensions:fit.dimensions||{type:fit.type,center:[...fit.center],angle:fit.angle,width:fit.radii[0]*2,height:fit.radii[1]*2,radius:0},...(pieces?{pieces:pieces.map(p=>({...p,points:p.points.map(point=>point.map((v,k)=>v/scale[k]))}))}:{}),...(fit.type==='circle'?{circle:{center:fit.center.map((v,k)=>v/scale[k]),radius:fit.radii[0]}}:{})};
  yield {ring,error:difference,type:fit.type};
 }
}
export function regularizeTraceRings(rings,tolerance,scale=[1,1],size=[1024,1024],{shape='auto',contours=[]}={}){
 if(!Number.isFinite(tolerance)||tolerance<.01||tolerance>10||!scale.every(n=>Number.isFinite(n)&&n>0))throw Error('整理の許容誤差は0.01〜10 mmで指定してください');
 if(!['auto',...Object.keys(countKeys)].includes(shape))throw Error('整理する形を選んでください');validateTraceEdits(rings,...size);
 const counts=Object.fromEntries(Object.values(countKeys).map(k=>[k,0]));let error=0;
 const result=rings.map((r,i)=>{const option=contours[i]||{};if(option.skip===true)return structuredClone(r);const limit=option.tolerance===undefined?tolerance:Number(option.tolerance),kind=option.shape||shape;if(!Number.isFinite(limit)||limit<.01||limit>10||!['auto',...Object.keys(countKeys)].includes(kind))throw Error('輪郭ごとの整理条件を確認してください');
  for(const fit of traceRegularCandidates(r,scale,Math.min(.005,limit/20)))if((kind==='auto'||fit.type===kind)&&fit.error<=limit){counts[countKeys[fit.type]]++;error=Math.max(error,fit.error);return fit.ring;}
  return structuredClone(r);
 });validateTraceEdits(result,...size);return {rings:result,...counts,error,original:rings.reduce((n,r)=>n+r.points.length,0),regular:true};
}
