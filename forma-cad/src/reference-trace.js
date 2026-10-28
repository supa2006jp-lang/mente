import Clipper from 'clipper-lib';

const area=ps=>ps.reduce((v,p,i)=>{const q=ps[(i+1)%ps.length];return v+p[0]*q[1]-q[0]*p[1];},0)/2;
const median=values=>values.sort((a,b)=>a-b)[Math.floor(values.length/2)];
export function traceCrop(crop={x:0,y:0,width:1,height:1}){
 if(!crop||![crop.x,crop.y,crop.width,crop.height].every(Number.isFinite)||crop.x<0||crop.y<0||crop.width<=0||crop.height<=0||crop.x+crop.width>1.000001||crop.y+crop.height>1.000001)throw Error('解析範囲を画像内に指定してください');
 return crop;
}
function background(rgba,w,h,rect){
 const colors=[[],[],[]],margin=Math.max(1,Math.round(Math.min(rect.width,rect.height)*.02));
 for(let y=rect.y;y<rect.y+rect.height;y++)for(let x=rect.x;x<rect.x+rect.width;x++){
  if(x>=rect.x+margin&&x<rect.x+rect.width-margin&&y>=rect.y+margin&&y<rect.y+rect.height-margin)continue;
  const i=(y*w+x)*4;if(rgba[i+3]<128)continue;for(let k=0;k<3;k++)colors[k].push(rgba[i+k]);
 }
 return colors.map(channel=>channel.length?median(channel):255);
}
function boundaries(labels,w,h,component){
 let edgeCount=0;const edges=new Map(),stride=w+1,add=(x,y,d)=>{if(++edgeCount>20000)throw Error('輪郭が複雑すぎます。解析範囲を狭めるか、ノイズ除去を強めてください');const key=y*stride+x;edges.set(key,(edges.get(key)||0)|(1<<d));},[xmin,ymin,xmax,ymax]=component.bounds,id=component.id;
 for(let y=ymin;y<=ymax;y++)for(let x=xmin;x<=xmax;x++){const i=y*w+x;if(labels[i]!==id)continue;if(y===0||labels[i-w]!==id)add(x,y,0);if(x===w-1||labels[i+1]!==id)add(x+1,y,1);if(y===h-1||labels[i+w]!==id)add(x+1,y+1,2);if(x===0||labels[i-1]!==id)add(x,y+1,3);}
 const rings=[],steps=[1,stride,-1,-stride];let total=0;
 while(edges.size){const start=edges.keys().next().value,points=[];let key=start,direction=0;while(!(edges.get(key)&(1<<direction)))direction++;
  do{points.push([key%stride,Math.floor(key/stride)]);const bits=edges.get(key)&~(1<<direction);if(bits)edges.set(key,bits);else edges.delete(key);key+=steps[direction];if(++total>20000)throw Error('輪郭が複雑すぎます。解析範囲を狭めるか、ノイズ除去を強めてください');if(key===start)break;const next=edges.get(key)||0;direction=[(direction+1)%4,direction,(direction+3)%4,(direction+2)%4].find(d=>next&(1<<d));if(direction===undefined)throw Error('閉じた輪郭を作れませんでした。検出条件を変更してください');}while(true);
  if(points.length>=4&&Math.abs(area(points))>=4)rings.push({points,hole:area(points)<0});if(rings.length>128)throw Error('輪郭が多すぎます。ノイズ除去を強めてください');
 }
 return rings;
}

// Runs only on a bounded local raster. Pixel edges, rather than disconnected
// edge-detector strokes, guarantee that the imported outlines are closed.
export function traceReferencePixels({width:w,height:h,data},settings={}){
 if(!Number.isInteger(w)||!Number.isInteger(h)||w<2||h<2||w>1024||h>1024||data?.length!==w*h*4)throw Error('輪郭解析用の画像が不正です');
 const p={mode:'background',threshold:35,invert:false,smoothing:1,crop:{x:0,y:0,width:1,height:1},...settings};traceCrop(p.crop);
 if(!['background','dark','alpha'].includes(p.mode)||!Number.isFinite(p.threshold)||p.threshold<1||p.threshold>254||typeof p.invert!=='boolean'||!Number.isInteger(p.smoothing)||p.smoothing<0||p.smoothing>2)throw Error('輪郭の検出条件を確認してください');
 const rect={x:Math.floor(p.crop.x*w),y:Math.floor(p.crop.y*h),width:Math.max(1,Math.round(p.crop.width*w)),height:Math.max(1,Math.round(p.crop.height*h))};rect.width=Math.min(rect.width,w-rect.x);rect.height=Math.min(rect.height,h-rect.y);if(rect.width<4||rect.height<4)throw Error('解析範囲をもう少し広くしてください');
 const bg=background(data,w,h,rect);let mask=new Uint8Array(w*h);
 for(let y=rect.y;y<rect.y+rect.height;y++)for(let x=rect.x;x<rect.x+rect.width;x++){
  const i=y*w+x,k=i*4,a=data[k+3],rgb=[0,1,2].map(c=>data[k+c]*a/255+255*(1-a/255));let inside=p.mode==='alpha'?a>=p.threshold:p.mode==='dark'?.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]<p.threshold:Math.hypot(...rgb.map((v,c)=>v-bg[c]))>p.threshold;
  if(p.invert)inside=!inside;mask[i]=inside&&a>0?1:0;
 }
 for(let pass=0;pass<p.smoothing;pass++){const next=new Uint8Array(mask.length);for(let y=rect.y;y<rect.y+rect.height;y++)for(let x=rect.x;x<rect.x+rect.width;x++){let sum=0,n=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const a=x+dx,b=y+dy;if(a<rect.x||a>=rect.x+rect.width||b<rect.y||b>=rect.y+rect.height)continue;sum+=mask[b*w+a];n++;}next[y*w+x]=sum>n/2?1:0;}mask=next;}
 const labels=new Uint32Array(w*h),queue=new Int32Array(w*h),components=[];let id=0;
 for(let i=0;i<mask.length;i++)if(mask[i]&&!labels[i]){let head=0,tail=1;queue[0]=i;labels[i]=++id;const c={id,area:0,bounds:[w,h,0,0],touchesBoundary:false};
  while(head<tail){const j=queue[head++],x=j%w,y=Math.floor(j/w);c.area++;c.bounds[0]=Math.min(c.bounds[0],x);c.bounds[1]=Math.min(c.bounds[1],y);c.bounds[2]=Math.max(c.bounds[2],x);c.bounds[3]=Math.max(c.bounds[3],y);if(x===rect.x||y===rect.y||x===rect.x+rect.width-1||y===rect.y+rect.height-1)c.touchesBoundary=true;for(const next of [x>0?j-1:-1,x<w-1?j+1:-1,y>0?j-w:-1,y<h-1?j+w:-1])if(next>=0&&mask[next]&&!labels[next]){labels[next]=id;queue[tail++]=next;}}
  if(c.area>=Math.max(9,rect.width*rect.height*.0001))components.push(c);
 }
 components.sort((a,b)=>b.area-a.area);const selected=components.slice(0,16);for(const component of selected)component.rings=boundaries(labels,w,h,component);
 return {width:w,height:h,labels,components:selected,background:bg,omitted:Math.max(0,components.length-selected.length)};
}

function simplifyOpen(points,epsilon,budget){
 const keep=new Uint8Array(points.length),stack=[[0,points.length-1]];keep[0]=keep[points.length-1]=1;
 while(stack.length){const [first,last]=stack.pop(),a=points[first],b=points[last],dx=b[0]-a[0],dy=b[1]-a[1],length=dx*dx+dy*dy;let far=-1,distance=epsilon*epsilon;
  for(let i=first+1;i<last;i++){if(++budget.count>2000000)throw Error('輪郭が複雑すぎます。線分の細かさを大きくするか、解析範囲を狭めてください');const p=points[i],t=length?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/length)):0,d=(p[0]-a[0]-t*dx)**2+(p[1]-a[1]-t*dy)**2;if(d>distance){distance=d;far=i;}}
  if(far>=0){keep[far]=1;stack.push([first,far],[far,last]);}
 }
 return points.filter((_,i)=>keep[i]);
}
export function simplifyTraceRings(component,epsilon,{holes=false}={}){
 if(!component?.rings||!Number.isFinite(epsilon)||epsilon<=0)throw Error('線分の細かさを確認してください');
 const paths=[],budget={count:0};for(const ring of component.rings){if(ring.hole&&!holes)continue;const ps=ring.points.filter((p,i,a)=>{const b=a[(i+a.length-1)%a.length],c=a[(i+1)%a.length];return (p[0]-b[0])*(c[1]-p[1])-(p[1]-b[1])*(c[0]-p[0])!==0;});if(ps.length<3)continue;let far=1;for(let i=2;i<ps.length;i++)if(Math.hypot(ps[i][0]-ps[0][0],ps[i][1]-ps[0][1])>Math.hypot(ps[far][0]-ps[0][0],ps[far][1]-ps[0][1]))far=i;const result=[...simplifyOpen(ps.slice(0,far+1),epsilon,budget).slice(0,-1),...simplifyOpen([...ps.slice(far),ps[0]],epsilon,budget).slice(0,-1)];if(result.length<3)throw Error('輪郭が小さすぎます。線分の細かさを小さな数値にしてください');paths.push(result.map(([X,Y])=>({X,Y})));}
 // Split any touching pixel corners into simple polygons before CAD import.
 const clean=Clipper.Clipper.SimplifyPolygons(paths,Clipper.PolyFillType.pftNonZero),rings=clean.map(path=>({points:path.map(p=>[p.X,p.Y]),hole:Clipper.Clipper.Area(path)<0}));
 const total=rings.reduce((n,r)=>n+r.points.length,0);if(!rings.length||rings.length>64||total>2000)throw Error('線分が多すぎます。線分の細かさを大きくするか、解析範囲を狭めてください');return rings;
}
