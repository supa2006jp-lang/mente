import {splineCurve,splineSamples} from './spline-curve.js';

const distance2=(a,b)=>(a[0]-b[0])**2+(a[1]-b[1])**2;
export function pointSegmentDistance2(p,a,b){const x=b[0]-a[0],y=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*x+(p[1]-a[1])*y)/(x*x+y*y||1)));return distance2(p,[a[0]+t*x,a[1]+t*y]);}
const boxDistance2=(p,b)=>Math.max(b[0]-p[0],0,p[0]-b[2])**2+Math.max(b[1]-p[1],0,p[1]-b[3])**2;
function tree(records){
 const box=[Infinity,Infinity,-Infinity,-Infinity];for(const r of records){box[0]=Math.min(box[0],r.box[0]);box[1]=Math.min(box[1],r.box[1]);box[2]=Math.max(box[2],r.box[2]);box[3]=Math.max(box[3],r.box[3]);}
 if(records.length<=8)return {box,records};const axis=box[2]-box[0]>=box[3]-box[1]?0:1;records.sort((a,b)=>a.box[axis]+a.box[axis+2]-b.box[axis]-b.box[axis+2]);const mid=records.length>>1;return {box,left:tree(records.slice(0,mid)),right:tree(records.slice(mid))};
}
function segments(points){return points.slice(1).map((b,i)=>{const a=points[i];return {a,b,index:i,box:[Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[0],b[0]),Math.max(a[1],b[1])]};}).filter(s=>distance2(s.a,s.b)>1e-20);}
export function curvePolyline(feature,precision=.02){
 if(feature.points.length<2)return feature.points.map(p=>[...p]);const curve=splineCurve(feature),intervals=feature.points.length-(feature.closed?0:1),out=[curve.getPoint(0).toArray().slice(0,2)];let limited=false;
 const sample=t=>curve.getPoint(t).toArray().slice(0,2),limit=8192;
 function split(t0,t1,a,b,depth){const mid=(t0+t1)/2,m=sample(mid),q=sample(t0+(t1-t0)/4),r=sample(t0+(t1-t0)*.75);if(depth<10&&out.length<limit&&Math.max(pointSegmentDistance2(m,a,b),pointSegmentDistance2(q,a,b),pointSegmentDistance2(r,a,b))>precision**2){split(t0,mid,a,m,depth+1);split(mid,t1,m,b,depth+1);}else{if(out.length>=limit)limited=true;out.push(b);}}
 for(let i=0;i<intervals;i++)split(i/intervals,(i+1)/intervals,out.at(-1),sample((i+1)/intervals),0);return Object.assign(out,{limited});
}
export function polylineDifference(a,b,limit=Infinity){
 function directed(points,other){const records=segments(other);if(!records.length)return Infinity;const root=tree(records);let max=0;for(const p of points){let best=Infinity;const visit=node=>{if(boxDistance2(p,node.box)>=best)return;if(node.records){for(const s of node.records)best=Math.min(best,pointSegmentDistance2(p,s.a,s.b));}else{const first=boxDistance2(p,node.left.box)<boxDistance2(p,node.right.box)?node.left:node.right;visit(first);visit(first===node.left?node.right:node.left);}};visit(root);max=Math.max(max,Math.sqrt(best));if(max>limit)return max;}return max;}
 const first=directed(a,b);return first>limit?first:Math.max(first,directed(b,a));
}
export function polylineIntersections(points,{closed=false,maxResults=100}={}){
 const records=segments(points);if(records.length<3)return [];const root=tree([...records]),out=[],seen=new Set(),eps=1e-8,last=points.length-2;
 const overlap=(a,b)=>a[0]<=b[2]+eps&&b[0]<=a[2]+eps&&a[1]<=b[3]+eps&&b[1]<=a[3]+eps,cross=(a,b)=>a[0]*b[1]-a[1]*b[0],sub=(a,b)=>[a[0]-b[0],a[1]-b[1]];
 for(const a of records){const visit=node=>{if(out.length>=maxResults||!overlap(a.box,node.box))return;if(!node.records){visit(node.left);visit(node.right);return;}for(const b of node.records){if(b.index<=a.index+1||closed&&a.index===0&&b.index===last||!overlap(a.box,b.box))continue;const r=sub(a.b,a.a),s=sub(b.b,b.a),d=sub(b.a,a.a),den=cross(r,s);let point;if(Math.abs(den)>1e-12*Math.sqrt(distance2(a.a,a.b)*distance2(b.a,b.b))){const t=cross(d,s)/den,u=cross(d,r)/den;if(t< -eps||t>1+eps||u< -eps||u>1+eps)continue;point=[a.a[0]+r[0]*t,a.a[1]+r[1]*t];}else{if(pointSegmentDistance2(b.a,a.a,a.b)>eps**2&&pointSegmentDistance2(b.b,a.a,a.b)>eps**2&&pointSegmentDistance2(a.a,b.a,b.b)>eps**2&&pointSegmentDistance2(a.b,b.a,b.b)>eps**2)continue;point=[b.a,b.b,a.a,a.b].find(p=>pointSegmentDistance2(p,a.a,a.b)<=eps**2&&pointSegmentDistance2(p,b.a,b.b)<=eps**2);if(!point)continue;}
 const key=point.map(n=>Math.round(n*1e6)).join(',');if(!seen.has(key)){seen.add(key);out.push({point,segments:[a.index,b.index]});}}
 };visit(root);if(out.length>=maxResults)break;}return out;
}
export function splineIntersections(feature){const points=splineSamples(feature);return {points,crossings:polylineIntersections(points,{closed:!!feature.closed})};}
