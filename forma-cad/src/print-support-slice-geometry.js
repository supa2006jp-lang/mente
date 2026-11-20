export function supportSlicePoint(matrix,point){
 return [0,1,2].map(i=>matrix[i]*point[0]+matrix[i+3]*point[1]+matrix[i+6]*point[2]+matrix[i+9]);
}

// Project files accept only an orthogonal XY placement with Z unchanged.
export function supportSliceCadPoint(matrix,point){
 const x=point[0]-matrix[9],y=point[1]-matrix[10];
 return [matrix[0]*x+matrix[1]*y,matrix[3]*x+matrix[4]*y,point[2]-matrix[11]];
}

export function supportSliceBounds(vertices){
 const low=[Infinity,Infinity,Infinity],high=[-Infinity,-Infinity,-Infinity];
 for(let i=0;i<vertices.length;i++){
  const axis=i%3,value=vertices[i];
  if(value<low[axis])low[axis]=value;
  if(value>high[axis])high[axis]=value;
 }
 return [low,high];
}

const cellSize=4;
function addCell(cells,x,y,path,inserted){
 const key=Math.floor(x/cellSize)+','+Math.floor(y/cellSize);
 if(inserted.has(key))return;
 inserted.add(key);
 if(!cells.has(key))cells.set(key,[]);
 cells.get(key).push(path);
}

export function indexSupportPath(cells,path){
 const {ax,ay,bx,by}=path,count=Math.max(1,Math.ceil(Math.max(Math.abs(bx-ax),Math.abs(by-ay))/cellSize));
 const inserted=new Set();
 for(let i=0;i<=count;i++)addCell(cells,ax+(bx-ax)*i/count,ay+(by-ay)*i/count,path,inserted);
}

export function* supportPathCells(cells,x0,y0,x1,y1,margin=0){
 const lowX=Math.floor((x0-margin)/cellSize)-1,highX=Math.floor((x1+margin)/cellSize)+1;
 const lowY=Math.floor((y0-margin)/cellSize)-1,highY=Math.floor((y1+margin)/cellSize)+1;
 for(let i=lowX;i<=highX;i++)for(let j=lowY;j<=highY;j++){
  const paths=cells.get(i+','+j);
  if(paths)yield paths;
 }
}

export function pointOnSupportPath(path,t){
 return [path.ax+(path.bx-path.ax)*t,path.ay+(path.by-path.ay)*t];
}

export function closestPointOnSupportPath(path,x,y){
 const {ax,ay,bx,by}=path,dx=bx-ax,dy=by-ay,length2=dx*dx+dy*dy;
 const t=length2?Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/length2)):0;
 return pointOnSupportPath(path,t);
}

export function closestSupportPaths(a,b){
 const u=[a.bx-a.ax,a.by-a.ay],v=[b.bx-b.ax,b.by-b.ay],w=[b.ax-a.ax,b.ay-a.ay];
 const cross=([x,y],[p,q])=>x*q-y*p,c=cross(u,v);
 if(Math.abs(c)>1e-10){
  const t=cross(w,v)/c,s=cross(w,u)/c;
  if(t>=0&&t<=1&&s>=0&&s<=1){
   const point=pointOnSupportPath(a,t);
   return {a:point,b:point,distance:0};
  }
 }
 let best=null;
 function choose(p,q){
  const distance=Math.hypot(p[0]-q[0],p[1]-q[1]);
  if(!best||distance<best.distance)best={a:p,b:q,distance};
 }
 for(const point of [[a.ax,a.ay],[a.bx,a.by]])choose(point,closestPointOnSupportPath(b,...point));
 for(const point of [[b.ax,b.ay],[b.bx,b.by]])choose(closestPointOnSupportPath(a,...point),point);
 return best;
}

export function supportLayerHasPath(layer,x,y,filter){
 for(const bucket of supportPathCells(layer.cells,x,y,x,y)){
  for(const path of bucket){
   const [px,py]=closestPointOnSupportPath(path,x,y);
   if((x-px)**2+(y-py)**2<=(path.width/2+.04)**2&&(!filter||filter(path,px,py)))return true;
  }
 }
 return false;
}
