import {sketchPoints,planeCoordinates} from './regions.js';
import {basisFor,worldPoint} from './frames.js';
const cross=(a,b)=>a[0]*b[1]-a[1]*b[0],sub=(a,b)=>[a[0]-b[0],a[1]-b[1]],eps=1e-7;
export function trimSketch(source,features,hit){
 const ps=sketchPoints(source),n=ps.length-1,basis=basisFor(source),offset=planeCoordinates(source).offset;
 if(n<1)return [];
 const closed=Math.hypot(...sub(ps[0],ps[n]))<eps,cuts=closed?[]:[0,n];
 // Shape corners are boundaries; tessellation vertices on curves are not.
 if(!['circle','spline'].includes(source.profile)&&!source.arc){for(let i=closed?0:1;i<n;i++){const a=sub(ps[i],ps[(i+n-1)%n]),b=sub(ps[i+1],ps[i]);if(Math.abs(Math.atan2(cross(a,b),a[0]*b[0]+a[1]*b[1]))>.2)cuts.push(i);}}
 for(const f of features){if(f.id===source.id||f.kind!=='sketch'||f.groupHidden)continue;const fb=basisFor(f),fo=planeCoordinates(f).offset;if(Math.abs(Math.abs(fb.n.dot(basis.n))-1)>1e-6||Math.abs(fo*fb.n.dot(basis.n)-offset)>1e-5)continue;
 const qs=sketchPoints(f).map(p=>{const w=worldPoint({...f,offset:fo},p);return [w.dot(basis.u),w.dot(basis.v)];});
 for(let i=0;i<n;i++)for(let j=1;j<qs.length;j++){const a=ps[i],r=sub(ps[i+1],a),b=qs[j-1],s=sub(qs[j],b),q=sub(b,a),den=cross(r,s);
 if(Math.abs(den)>1e-12){const t=cross(q,s)/den,u=cross(q,r)/den;if(t>=-eps&&t<=1+eps&&u>=-eps&&u<=1+eps)cuts.push(i+Math.max(0,Math.min(1,t)));}
 else if(Math.abs(cross(q,r))<eps){const len=r[0]*r[0]+r[1]*r[1];if(len>eps*eps)for(const p of [b,qs[j]]){const d=sub(p,a),t=(d[0]*r[0]+d[1]*r[1])/len;if(t>=0&&t<=1)cuts.push(i+t);}}
 }}
 const click=[hit.dot(basis.u),hit.dot(basis.v)];let at=0,best=Infinity;
 for(let i=0;i<n;i++){const r=sub(ps[i+1],ps[i]),q=sub(click,ps[i]),len=r[0]*r[0]+r[1]*r[1],t=Math.max(0,Math.min(1,(q[0]*r[0]+q[1]*r[1])/(len||1))),d=Math.hypot(q[0]-t*r[0],q[1]-t*r[1]);if(d<best){best=d;at=i+t;}}
 const sorted=cuts.map(t=>closed&&Math.abs(t-n)<eps?0:t).sort((a,b)=>a-b).filter((t,i,a)=>!i||t-a[i-1]>eps);
 if(closed&&sorted.length<2)return [];
 let lo,hi;if(closed){lo=sorted.filter(t=>t<=at+eps).at(-1)??sorted.at(-1)-n;hi=sorted.find(t=>t>at+eps)??sorted[0]+n;}else{lo=sorted.filter(t=>t<=at+eps).at(-1)??0;hi=sorted.find(t=>t>at+eps)??n;}
 const point=t=>{t=closed?((t%n)+n)%n:Math.max(0,Math.min(n,t));if(t===n)return [...ps[n]];const i=Math.floor(t),v=t-i;return ps[i].map((x,k)=>x+(ps[i+1][k]-x)*v);};
 const slice=(a,b)=>{if(b-a<eps)return [];const out=[point(a)];for(let i=Math.floor(a)+1;i<b-eps;i++)out.push(point(i));out.push(point(b));return out.filter((p,i)=>!i||Math.hypot(...sub(p,out[i-1]))>eps);};
 const parts=closed?[slice(hi,lo+n)]:[slice(0,lo),slice(hi,n)];
 return parts.filter(p=>p.length>=2).map((points,i)=>{const f={...structuredClone(source),id:i?crypto.randomUUID():source.id,profile:'polyline',points,closed:false};delete f.arc;return f;});
}
