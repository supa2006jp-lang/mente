import * as THREE from 'three';
import {cadPosition} from './cad-coordinates.js';
import {supportRibPlacement} from './print-support-rib-placement.js';
const epsilon=1e-6;
function contains(t,x,y){const [a,b,c]=t,d=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(d)<1e-12)return false;const u=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/d,v=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/d;return u>=-epsilon&&v>=-epsilon&&u+v<=1+epsilon;}
function intervals(triangles,axis,at){
 const spans=[];for(const t of triangles){const points=[];for(let i=0;i<3;i++){const a=t[i],b=t[(i+1)%3],d=b[axis]-a[axis];if(Math.abs(d)<epsilon){if(Math.abs(at-a[axis])<epsilon)points.push(a[1-axis],b[1-axis]);continue;}const s=(at-a[axis])/d;if(s>=-epsilon&&s<=1+epsilon)points.push(a[1-axis]+s*(b[1-axis]-a[1-axis]));}if(points.length>1)spans.push([Math.min(...points),Math.max(...points)]);}
 spans.sort((a,b)=>a[0]-b[0]);const merged=[];for(const s of spans){const last=merged.at(-1);if(last&&s[0]<=last[1]+epsilon)last[1]=Math.max(last[1],s[1]);else merged.push([...s]);}return merged;
}
function skinGuide(triangle,face,margin,z){
 let polygon=triangle.map(p=>p.slice(0,2));
 for(const [axis,sign,at]of [[0,1,face.low[0]+margin],[0,-1,face.high[0]-margin],[1,1,face.low[1]+margin],[1,-1,face.high[1]-margin]]){const next=[];for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length],inside=sign*(a[axis]-at)>=0,other=sign*(b[axis]-at)>=0;if(inside)next.push(a);if(inside!==other){const t=(at-a[axis])/(b[axis]-a[axis]);next.push(a.map((v,k)=>v+t*(b[k]-v)));}}polygon=next;}
 const positions=[];for(let i=1;i+1<polygon.length;i++)for(const p of [polygon[0],polygon[i],polygon[i+1]])positions.push(p[0],p[1],z);return positions;
}
// Display only: no BREP, booleans, history writes, or export data. Exact CAD still
// owns holes, sloping obstacles, exclusions, reinforcement and all safety checks.
export function createSupportFastPreview({scene,host}){
 let target=null,faces=[],floors=[],group=null,available=false;
 function clear(){if(group){group.removeFromParent();group.traverse(o=>{o.geometry?.dispose();if(o.material) o.material.dispose();});group=null;}delete host.dataset.supportFastPreview;}
 function prepare(bodies,id){
  clear();target=id;faces=[];floors=[];available=true;let count=0;
  for(const [bodyId,body]of bodies){const g=body.geometry,p=cadPosition(g),ix=g.index,groups=g.userData.faceGroups||[],map=new Map();let cursor=0;
   for(let i=0,n=ix?.count??p.count;i<n;i+=3){if(++count>12000){available=false;faces=[];floors=[];return;}const t=[0,1,2].map(k=>{const j=ix?ix.getX(i+k):i+k;return [p.getX(j),p.getY(j),p.getZ(j)];});if(t.flat().some(v=>!Number.isFinite(v)))continue;if(Math.max(...t.map(a=>a[2]))-Math.min(...t.map(a=>a[2]))>epsilon)continue;const area=(t[1][0]-t[0][0])*(t[2][1]-t[0][1])-(t[1][1]-t[0][1])*(t[2][0]-t[0][0]);if(Math.abs(area)<1e-10)continue;
    if(area>0){floors.push(t);continue;}while(cursor<groups.length&&i>=groups[cursor].start+groups[cursor].count)cursor++;const key=groups[cursor]?.faceId??t[0][2],f=map.get(key)||{bodyId,z:t[0][2],triangles:[],low:[Infinity,Infinity],high:[-Infinity,-Infinity]};f.triangles.push(t);for(const a of t)for(let k=0;k<2;k++){f.low[k]=Math.min(f.low[k],a[k]);f.high[k]=Math.max(f.high[k],a[k]);}map.set(key,f);
   }faces.push(...map.values());
  }
 }
 function show(p){
  clear();if(!available||p.style!=='walls')return false;const selected=faces.filter(f=>f.bodyId===target&&f.z>p.bedZ+p.topGap+1&&(p.mode!=='face'||p.faces.some(ref=>Math.abs(ref.point[2]-f.z)<.001&&f.triangles.some(t=>contains(t,ref.point[0],ref.point[1])))));
  if(!selected.length)return false;const start=performance.now();group=new THREE.Group();scene.add(group);let count=0;
  function landing(x,y,top){let z=p.bedZ;for(const t of floors)if(t[0][2]>z&&t[0][2]<top-epsilon&&contains(t,x,y))z=t[0][2];return z;}
  function box(low,high,skin=false){if(count>=1024||high.some((v,i)=>v-low[i]<epsilon))return;const size=high.map((v,i)=>v-low[i]),g=new THREE.BoxGeometry(...size),m=new THREE.MeshBasicMaterial({color:skin?0x36aab0:0xdba33e,transparent:true,opacity:skin?.25:.38,depthWrite:false}),mesh=new THREE.Mesh(g,m);mesh.position.set(...low.map((v,i)=>(v+high[i])/2));group.add(mesh);count++;}
  for(const f of selected){const axis=p.wallDirection==='x'?1:p.wallDirection==='y'?0:f.high[0]-f.low[0]>=f.high[1]-f.low[1]?0:1,other=1-axis,top=f.z-p.topGap,low=f.low[axis]+(p.edgeMargin??.5),high=f.high[axis]-(p.edgeMargin??.5);if(high-low<p.wallThickness)continue;const placement=supportRibPlacement(low,high,p);if(placement.count>96)continue;
   for(const center of placement.centers){if(count>=1024||performance.now()-start>40)break;for(const [a,b]of intervals(f.triangles,axis,center)){const margin=p.edgeMargin??.5,lo=a+(Math.abs(a-f.low[other])<epsilon?margin:.5),hi=b-(Math.abs(b-f.high[other])<epsilon?margin:.5);if(hi<=lo)continue;const parts=Math.min(24,Math.max(1,Math.ceil((hi-lo)/8)));for(let i=0;i<parts;i++){if(performance.now()-start>40)break;const u=lo+(hi-lo)*i/parts,v=lo+(hi-lo)*(i+1)/parts,xy=[];xy[axis]=center;xy[other]=(u+v)/2;const bottom=landing(...xy,top);if(p.baseMode==='bed'&&bottom>p.bedZ+epsilon)continue;const l=[...xy,bottom],h=[...xy,top];l[axis]-=p.wallThickness/2;h[axis]+=p.wallThickness/2;l[other]=u;h[other]=v;box(l,h);}}
   }
   // The translucent skin surface is a placement guide; exact holes and seam
   // widths appear when CAD completes. No guide can be committed or exported.
   for(const t of f.triangles){if(count>=1024)break;const x=t.reduce((s,v)=>s+v[0]/3,0),y=t.reduce((s,v)=>s+v[1]/3,0),bottom=landing(x,y,top);for(const z of [p.wallRoof?top:null,p.wallBottomSkin?bottom:null])if(z!==null&&(p.baseMode!=='bed'||bottom<=p.bedZ+epsilon)){const positions=skinGuide(t,f,p.edgeMargin??.5,z);if(!positions.length)continue;const g=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(positions,3)),m=new THREE.MeshBasicMaterial({color:0x36aab0,side:THREE.DoubleSide,transparent:true,opacity:.25,depthWrite:false});group.add(new THREE.Mesh(g,m));count++;}}
  }
  if(!count){clear();return false;}host.dataset.supportFastPreview=JSON.stringify({approximate:true,parts:count,faces:selected.length,milliseconds:performance.now()-start,edgeMargin:p.edgeMargin??.5,wallPitch:p.wallPitch,wallRoof:p.wallRoof,wallBottomSkin:p.wallBottomSkin});return true;
 }
 return {prepare,show,clear,set target(id){target=id;}};
}
