const EPS=1e-7,area=ps=>ps.reduce((sum,p,i)=>{const q=ps[(i+1)%ps.length];return sum+p[0]*q[1]-p[1]*q[0];},0)/2;
const clone=rings=>rings.map(r=>({...r,points:r.points.map(p=>[...p])}));
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const on=(p,a,b)=>Math.abs(cross(a,b,p))<EPS&&p[0]>=Math.min(a[0],b[0])-EPS&&p[0]<=Math.max(a[0],b[0])+EPS&&p[1]>=Math.min(a[1],b[1])-EPS&&p[1]<=Math.max(a[1],b[1])+EPS;
function intersects(a,b,c,d){const x=cross(a,b,c),y=cross(a,b,d),z=cross(c,d,a),w=cross(c,d,b);return x*y<0&&z*w<0||on(a,c,d)||on(b,c,d)||on(c,a,b)||on(d,a,b);}
function inside(p,ring){let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
export function validateTraceEdits(rings,width,height){
 if(![width,height].every(n=>Number.isInteger(n)&&n>=2&&n<=1024))throw Error('輪郭を編集する画像の大きさが不正です');
 if(!Array.isArray(rings)||!rings.length||rings.length>64||rings.reduce((n,r)=>n+(r.points?.length||0),0)>2000)throw Error('輪郭は64個・頂点は合計2,000個以内にしてください');
 const edges=[];
 rings.forEach((ring,r)=>{const ps=ring.points;if(!Array.isArray(ps)||ps.length<3)throw Error('閉じた輪郭には3個以上の頂点が必要です');if(ps.some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)||p[0]<0||p[0]>width||p[1]<0||p[1]>height))throw Error('頂点を画像内に配置してください');const signed=area(ps);if(Math.abs(signed)<EPS||signed*(ring.hole?-1:1)<=0)throw Error('輪郭がつぶれたり裏返ったりしています。頂点を戻してください');
  ps.forEach((a,i)=>{const b=ps[(i+1)%ps.length];if(Math.hypot(b[0]-a[0],b[1]-a[1])<1e-5)throw Error('頂点同士が重なっています。少し離してください');edges.push({a,b,r,i,count:ps.length});});
 });
 const sorted=edges.map(e=>({...e,minX:Math.min(e.a[0],e.b[0]),maxX:Math.max(e.a[0],e.b[0]),minY:Math.min(e.a[1],e.b[1]),maxY:Math.max(e.a[1],e.b[1])})).sort((a,b)=>a.minX-b.minX);let active=[];
 for(const edge of sorted){active=active.filter(e=>e.maxX>=edge.minX-EPS);for(const other of active){const adjacent=edge.r===other.r&&(Math.abs(edge.i-other.i)===1||Math.abs(edge.i-other.i)===edge.count-1);if(adjacent)continue;if(other.maxY<edge.minY-EPS||edge.maxY<other.minY-EPS)continue;if(intersects(edge.a,edge.b,other.a,other.b))throw Error('輪郭の線が交差または接触しています。頂点を動かして修正してください');}active.push(edge);}
 for(let i=0;i<rings.length;i++){const ring=rings[i],parents=rings.filter((other,j)=>j!==i&&inside(ring.points[0],other.points));if(ring.hole){if(parents.filter(r=>!r.hole).length!==1||parents.some(r=>r.hole))throw Error('穴の輪郭を外周の内側に配置してください');}else if(parents.some(r=>!r.hole))throw Error('外周同士が重なっています。輪郭を離してください');}
 return rings;
}
export function traceVertexAt(rings,point,radius){let best=null,distance=radius;for(const [ring,r]of rings.entries())for(const [index,p]of r.points.entries()){const d=Math.hypot(p[0]-point[0],p[1]-point[1]);if(d<=distance){best={ring,index};distance=d;}}return best;}
export function traceEdgeAt(rings,point,radius){let best=null,distance=radius;for(const [ring,r]of rings.entries())for(const [index,a]of r.points.entries()){const b=r.points[(index+1)%r.points.length],dx=b[0]-a[0],dy=b[1]-a[1],length=dx*dx+dy*dy,t=length?Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/length)):0,p=[a[0]+t*dx,a[1]+t*dy],d=Math.hypot(p[0]-point[0],p[1]-point[1]);if(d<=distance){best={ring,index,point:p};distance=d;}}return best;}
export function changeTraceVertex(rings,hit,action,point){
 if(!hit||!rings[hit.ring]?.points[hit.index])throw Error('編集する頂点か線分を選んでください');const next=clone(rings),ps=next[hit.ring].points;
 if(action==='move')ps[hit.index]=[...point];else if(action==='add'){if(next.reduce((n,r)=>n+r.points.length,0)>=2000)throw Error('頂点は合計2,000個以内にしてください');if(ps.some(p=>Math.hypot(p[0]-point[0],p[1]-point[1])<1e-5))throw Error('既存の頂点から少し離れた線上をクリックしてください');ps.splice(hit.index+1,0,[...point]);}
 else if(action==='delete'){if(ps.length<=3)throw Error('閉じた輪郭に必要な3個の頂点は残してください');ps.splice(hit.index,1);}else throw Error('頂点の編集方法が不正です');return next;
}

export function snapTraceVertex(rings,hit,point,tolerance,{enabled=true}={}){
 if(!enabled)return {point:[...point],guides:[]};let x=null,y=null,dx=tolerance,dy=tolerance;
 for(const [r,ring]of rings.entries())for(const [i,p]of ring.points.entries()){if(r===hit.ring&&i===hit.index)continue;const ax=Math.abs(p[0]-point[0]),ay=Math.abs(p[1]-point[1]);if(ax<dx||ax===dx&&x&&Math.abs(p[1]-point[1])<Math.abs(x[1]-point[1])){dx=ax;x=p;}if(ay<dy||ay===dy&&y&&Math.abs(p[0]-point[0])<Math.abs(y[0]-point[0])){dy=ay;y=p;}}
 const snapped=[x?x[0]:point[0],y?y[1]:point[1]],guides=[];if(x)guides.push({axis:'x',from:[...x],to:[...snapped]});if(y)guides.push({axis:'y',from:[...y],to:[...snapped]});return {point:snapped,guides};
}
