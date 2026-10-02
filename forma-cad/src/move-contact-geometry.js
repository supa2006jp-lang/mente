import * as THREE from 'three';

// Intersect projected surface triangles so holes and sloping faces cannot cause
// the false contacts produced by comparing only object bounding boxes.
const cache = new WeakMap();
const EPS = 1e-9;

function heightEquation(p) {
 const [a,b,c]=p,du1=b.u-a.u,dv1=b.v-a.v,du2=c.u-a.u,dv2=c.v-a.v;
 const det=du1*dv2-du2*dv1;
 if(Math.abs(det)<1e-12)return null;
 const dh1=b.h-a.h,dh2=c.h-a.h;
 const u=(dh1*dv2-dh2*dv1)/det,v=(du1*dh2-du2*dh1)/det;
 return {u,v,c:a.h-u*a.u-v*a.v};
}

function surfaceTriangles(object,axis,direction,leading){
 const u=(axis+1)%3,v=(axis+2)%3,result=[];
 object.traverse(child=>{
  if(!child.isMesh||child.visible===false||!child.geometry?.attributes?.position)return;
  const g=child.geometry,attr=g.attributes.position,index=g.index,count=index?index.count:attr.count;
  const point=new THREE.Vector3(),positions=new Array(attr.count);
  for(let i=0;i<attr.count;i++){
   point.fromBufferAttribute(attr,i).applyMatrix4(child.matrixWorld);
   positions[i]=[point.x,point.y,point.z];
  }
  for(let i=0;i+2<count;i+=3){
   const a=positions[index?index.getX(i):i],b=positions[index?index.getX(i+1):i+1],c=positions[index?index.getX(i+2):i+2];
   const normal=(b[u]-a[u])*(c[v]-a[v])-(b[v]-a[v])*(c[u]-a[u]);
   if(normal*direction*(leading?1:-1)<=1e-12)continue;
   const p=[a,b,c].map(q=>({u:q[u],v:q[v],h:q[axis]})),height=heightEquation(p);
   if(!height)continue;
   result.push({p,height,minU:Math.min(...p.map(q=>q.u)),maxU:Math.max(...p.map(q=>q.u)),minV:Math.min(...p.map(q=>q.v)),maxV:Math.max(...p.map(q=>q.v))});
  }
 });
 return result;
}

function intersection(a,b){
 let polygon=a.p.map(({u,v})=>({u,v}));
 const q=b.p,sign=((q[1].u-q[0].u)*(q[2].v-q[0].v)-(q[1].v-q[0].v)*(q[2].u-q[0].u))>=0?1:-1;
 for(let i=0;i<3&&polygon.length;i++){
  const start=q[i],end=q[(i+1)%3],side=p=>sign*((end.u-start.u)*(p.v-start.v)-(end.v-start.v)*(p.u-start.u));
  const next=[];
  for(let j=0;j<polygon.length;j++){
   const p=polygon[j],r=polygon[(j+1)%polygon.length],sp=side(p),sr=side(r),insideP=sp>=-EPS,insideR=sr>=-EPS;
   if(insideP)next.push(p);
   if(insideP!==insideR){const t=sp/(sp-sr);next.push({u:p.u+(r.u-p.u)*t,v:p.v+(r.v-p.v)*t});}
  }
  polygon=next;
 }
 return polygon;
}

function indexTriangles(faces){
 if(!faces.length)return null;
 const bounds={minU:Infinity,maxU:-Infinity,minV:Infinity,maxV:-Infinity};
 for(const f of faces){bounds.minU=Math.min(bounds.minU,f.minU);bounds.maxU=Math.max(bounds.maxU,f.maxU);bounds.minV=Math.min(bounds.minV,f.minV);bounds.maxV=Math.max(bounds.maxV,f.maxV);}
 const cells=Math.min(48,Math.max(4,Math.ceil(Math.sqrt(faces.length/3))));
 const width=Math.max((bounds.maxU-bounds.minU)/cells,1e-8),height=Math.max((bounds.maxV-bounds.minV)/cells,1e-8);
 const interval=f=>[
  Math.max(0,Math.min(cells-1,Math.floor((f.minU-bounds.minU)/width))),
  Math.max(0,Math.min(cells-1,Math.floor((f.maxU-bounds.minU)/width))),
  Math.max(0,Math.min(cells-1,Math.floor((f.minV-bounds.minV)/height))),
  Math.max(0,Math.min(cells-1,Math.floor((f.maxV-bounds.minV)/height)))
 ];
 const buckets=new Map(),wide=[];
 faces.forEach((f,i)=>{
  const [u0,u1,v0,v1]=interval(f);
  if((u1-u0+1)*(v1-v0+1)>cells*cells/4){wide.push(i);return;}
  for(let u=u0;u<=u1;u++)for(let v=v0;v<=v1;v++){
   const key=u*cells+v;
   if(!buckets.has(key))buckets.set(key,[]);
   buckets.get(key).push(i);
  }
 });
 return {bounds,cells,interval,buckets,wide};
}

function measuredDistance(from,to,direction){
 const grid=indexTriangles(to);
 if(!grid)return null;
 let best=Infinity;
 for(const f of from){
  if(f.maxU<grid.bounds.minU-EPS||f.minU>grid.bounds.maxU+EPS||f.maxV<grid.bounds.minV-EPS||f.minV>grid.bounds.maxV+EPS)continue;
  const [u0,u1,v0,v1]=grid.interval(f),candidates=new Set(grid.wide);
  for(let u=u0;u<=u1;u++)for(let v=v0;v<=v1;v++)for(const i of grid.buckets.get(u*grid.cells+v)||[])candidates.add(i);
  for(const i of candidates){
   const t=to[i];
   if(f.maxU<t.minU-EPS||f.minU>t.maxU+EPS||f.maxV<t.minV-EPS||f.minV>t.maxV+EPS)continue;
   for(const {u,v} of intersection(f,t)){
    const source=f.height.u*u+f.height.v*v+f.height.c,dest=t.height.u*u+t.height.v*v+t.height.c;
    best=Math.min(best,direction*(dest-source));
   }
  }
 }
 return Number.isFinite(best)?direction*best:null;
}

function signature(object,axis,omitAxis){
 const values=object.matrixWorld.elements.map((value,i)=>omitAxis&&i===12+axis?null:value);
 object.traverse(child=>{
  if(!child.isMesh)return;
  values.push(child.geometry?.uuid||'',child.geometry?.index?.count||0,child.geometry?.attributes?.position?.count||0);
  if(child!==object)values.push(...child.matrix.elements);
 });
 return values;
}
const identical=(a,b)=>a.length===b.length&&a.every((value,i)=>value===b[i]);

/**
 * Signed world-axis translation (mm) needed to bring the leading surface of
 * `moving` into first contact with `target`. Returns null when their actual
 * triangulated surfaces do not overlap in the transverse plane. Both objects
 * can be THREE.Mesh or THREE.Group. axisIndex is 0=X, 1=Y, 2=Z; direction is
 * +1 or -1. Caches the geometry result during an axis-only drag.
 */
export function contactTranslation(moving,target,axisIndex,direction){
 if(!moving||!target||![0,1,2].includes(axisIndex)||![1,-1].includes(direction))return null;
 moving.updateMatrixWorld(true);target.updateMatrixWorld(true);
 const sourceBox=new THREE.Box3().setFromObject(moving),targetBox=new THREE.Box3().setFromObject(target);
 if(sourceBox.isEmpty()||targetBox.isEmpty())return null;
 const min=axisIndex===0?'x':axisIndex===1?'y':'z';
 if(direction===1&&targetBox.max[min]<sourceBox.min[min]-EPS)return null;
 if(direction===-1&&targetBox.min[min]>sourceBox.max[min]+EPS)return null;
 let targets=cache.get(moving);
 if(!targets){targets=new WeakMap();cache.set(moving,targets);}
 let entries=targets.get(target);
 if(!entries){entries=new Map();targets.set(target,entries);}
 const key=axisIndex+':'+direction,fromSignature=signature(moving,axisIndex,true),toSignature=signature(target,axisIndex,false);
 const axisPosition=moving.matrixWorld.elements[12+axisIndex],cached=entries.get(key);
 if(cached&&identical(cached.fromSignature,fromSignature)&&identical(cached.toSignature,toSignature))
  return cached.distance===null?null:cached.distance-(axisPosition-cached.axisPosition);
 const from=surfaceTriangles(moving,axisIndex,direction,true),to=surfaceTriangles(target,axisIndex,direction,false);
 const distance=from.length&&to.length?measuredDistance(from,to,direction):null;
 entries.set(key,{fromSignature,toSignature,axisPosition,distance});
 return distance;
}
