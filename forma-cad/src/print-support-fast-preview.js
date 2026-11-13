import * as THREE from 'three';
import {cadPosition} from './cad-coordinates.js';
import {supportRibPlacement} from './print-support-rib-placement.js';
import {supportBridgeSpans,supportIntervals as intervals} from './print-support-bridges.js';
const epsilon=1e-6;
function contains(t,x,y){const [a,b,c]=t,d=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(d)<1e-12)return false;const u=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/d,v=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/d;return u>=-epsilon&&v>=-epsilon&&u+v<=1+epsilon;}
function skinGuide(triangle,face,margin,z){
 let polygon=triangle.map(p=>p.slice(0,2));
 for(const [axis,sign,at]of [[0,1,face.low[0]+margin],[0,-1,face.high[0]-margin],[1,1,face.low[1]+margin],[1,-1,face.high[1]-margin]]){const next=[];for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length],inside=sign*(a[axis]-at)>=0,other=sign*(b[axis]-at)>=0;if(inside)next.push(a);if(inside!==other){const t=(at-a[axis])/(b[axis]-a[axis]);next.push(a.map((v,k)=>v+t*(b[k]-v)));}}polygon=next;}
 const positions=[];for(let i=1;i+1<polygon.length;i++)for(const p of [polygon[0],polygon[i],polygon[i+1]])positions.push(p[0],p[1],z);return positions;
}
// Display only: no BREP, booleans, history writes, or export data. Exact CAD still
// owns holes, sloping obstacles, exclusions, reinforcement and all safety checks.
export function createSupportFastPreview({scene,host}){
 let target=null,faces=[],floors=[],obstacles=[],group=null,available=false;
 function clear(){if(group){group.removeFromParent();group.traverse(o=>{o.geometry?.dispose();if(o.material) o.material.dispose();});group=null;}delete host.dataset.supportFastPreview;}
 function prepare(bodies,id){
  clear();target=id;faces=[];floors=[];obstacles=[];available=true;let count=0;
  for(const [bodyId,body]of bodies){const g=body.geometry,p=cadPosition(g),ix=g.index,groups=g.userData.faceGroups||[],map=new Map();let cursor=0;
   for(let i=0,n=ix?.count??p.count;i<n;i+=3){if(++count>12000){available=false;faces=[];floors=[];obstacles=[];return;}const t=[0,1,2].map(k=>{const j=ix?ix.getX(i+k):i+k;return [p.getX(j),p.getY(j),p.getZ(j)];});if(t.flat().some(v=>!Number.isFinite(v)))continue;if(Math.max(...t.map(a=>a[2]))-Math.min(...t.map(a=>a[2]))>epsilon){obstacles.push(t.map(point=>new THREE.Vector3(...point)));continue;}const area=(t[1][0]-t[0][0])*(t[2][1]-t[0][1])-(t[1][1]-t[0][1])*(t[2][0]-t[0][0]);if(Math.abs(area)<1e-10)continue;
    if(area>0){floors.push(t);continue;}while(cursor<groups.length&&i>=groups[cursor].start+groups[cursor].count)cursor++;const key=groups[cursor]?.faceId??t[0][2],f=map.get(key)||{bodyId,z:t[0][2],triangles:[],low:[Infinity,Infinity],high:[-Infinity,-Infinity]};f.triangles.push(t);for(const a of t)for(let k=0;k<2;k++){f.low[k]=Math.min(f.low[k],a[k]);f.high[k]=Math.max(f.high[k],a[k]);}map.set(key,f);
   }faces.push(...map.values());
  }
 }
 const targetFaces=p=>faces.filter(f=>f.bodyId===target&&f.z>p.bedZ+p.topGap+1&&(p.mode!=='face'||p.faces.some(ref=>Math.abs(ref.point[2]-f.z)<.001&&f.triangles.some(t=>contains(t,ref.point[0],ref.point[1])))));
 function compare(p){
  if(!available||p.style!=='walls')return [];
  const selected=targetFaces(p);
  if(!selected.length)return [];
  const ray=new THREE.Ray(),hit=new THREE.Vector3();
  return ['x','y'].flatMap(wallDirection=>[-.25,0,.25].map(wallOffset=>{
   const axis=wallDirection==='x'?1:0,other=1-axis;
   let volume=0,max=0,unbraced=0;
   const samples=[];
   for(const face of selected){
    const override=p.faceOverrides?.find(row=>Math.abs(row.selection.point[2]-face.z)<.001&&face.triangles.some(t=>contains(t,...row.selection.point)));
    const settings={...p,...override,wallOffset},top=face.z-p.topGap,half=p.wallThickness/2;
    const low=face.low[axis]+p.edgeMargin,high=face.high[axis]-p.edgeMargin;
    if(high-low<p.wallThickness)continue;
    const {centers}=supportRibPlacement(low,high,{...settings,edgeRibs:p.edgeRibs||settings.edgeAssist,ribAxis:axis});
    const lines=centers.map(center=>({center,start:-Infinity,end:Infinity}));
    for(const rib of settings.localRibs||[])if(!centers.some(center=>Math.abs(center-rib.at[axis])<p.wallThickness))
     lines.push({center:rib.at[axis],start:rib.at[other]-rib.length/2,end:rib.at[other]+rib.length/2});
    const landings=[];
    for(const {center,start,end} of lines){
     if(center<low+half-epsilon||center>high-half+epsilon)continue;
     for(const [a,b] of intervals(face.triangles,axis,center)){
      const lo=Math.max(start,a+p.edgeMargin),hi=Math.min(end,b-p.edgeMargin);
      if(hi<=lo)continue;
      const breaks=[lo,hi];
      for(const zone of settings.noSupport||[])if(center>=zone[axis]&&center<=zone[axis+2]){
       for(const pos of [zone[other],zone[other+2]])if(pos>lo&&pos<hi)breaks.push(pos);
      }
      const n=Math.min(8,Math.ceil((hi-lo)/8));
      for(let i=1;i<n;i++)breaks.push(lo+(hi-lo)*i/n);
      breaks.sort((x,y)=>x-y);
      for(let i=1;i<breaks.length;i++){
       const from=breaks[i-1],to=breaks[i];if(to-from<=epsilon)continue;
       const point=(x,y)=>axis===0?[x,y]:[y,x],xy=point(center,(from+to)/2);
       if(settings.noSupport?.some(zone=>xy[0]>=zone[0]&&xy[0]<=zone[2]&&xy[1]>=zone[1]&&xy[1]<=zone[3]))continue;
       let bottom=p.bedZ;
       for(const t of floors)if(t[0][2]>bottom&&t[0][2]<top-epsilon&&contains(t,...xy))bottom=t[0][2];
       if(p.baseMode==='bed'&&bottom>p.bedZ+epsilon)continue;
       const [u,v,w,q]=[point(center-half,from),point(center+half,from),point(center+half,to),point(center-half,to)];
       landings.push([u,v,w],[u,w,q]);volume+=(to-from)*p.wallThickness*(top-bottom);
       samples.push([...xy,(bottom+top)/2]);
      }
     }
    }
    const spans=supportBridgeSpans(face.triangles,landings,axis,8);
    max=Math.max(max,spans?.max||0);unbraced=Math.max(unbraced,spans?.unbraced||0);
   }
   const stride=Math.max(1,Math.ceil(samples.length/12)),points=samples.filter((_,i)=>i%stride===0);
   const open=points.length?[[0,-1],[0,1],[1,-1],[1,1]].filter(([k,sign])=>{
    ray.direction.set(0,0,0).setComponent(k,sign);
    return points.every(point=>{
     ray.origin.fromArray(point);
     return !obstacles.some(([a,b,c])=>ray.intersectTriangle(a,b,c,false,hit)&&hit.distanceToSquared(ray.origin)>1e-8);
    });
   }).map(([k,sign])=>'XY'[k]+(sign<0?'−':'+')):[];
   return {wallDirection,wallOffset,max,unbraced,volume,open};
  }));
 }
 function show(p){
  clear();if(!available||p.style!=='walls'||p.faceOverrides?.some(row=>row.noSupport?.length||row.edgeAssist||row.localRibs?.length))return false;const selected=targetFaces(p);
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
 return {prepare,show,clear,compare,set target(id){target=id;}};
}
