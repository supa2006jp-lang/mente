const epsilon=1e-6;

export function supportMeshTriangles({vertices,triangles}){
 const result=[];
 for(let i=0;i<triangles.length;i+=3){
  result.push([0,1,2].map(j=>Array.from(vertices.slice(3*triangles[i+j],3*triangles[i+j]+3))));
 }
 return result;
}

export function supportIntervals(triangles,axis,at){
 const spans=[];
 for(const triangle of triangles){
  const points=[];
  for(let i=0;i<3;i++){
   const a=triangle[i],b=triangle[(i+1)%3],delta=b[axis]-a[axis];
   if(Math.abs(delta)<epsilon)continue;
   const t=(at-a[axis])/delta;
   if(t>=0&&t<=1)points.push(a[1-axis]+t*(b[1-axis]-a[1-axis]));
  }
  if(points.length>=2)spans.push([Math.min(...points),Math.max(...points)]);
 }
 spans.sort((a,b)=>a[0]-b[0]);
 const merged=[];
 for(const span of spans){
  const last=merged.at(-1);
  if(last&&span[0]<=last[1]+epsilon)last[1]=Math.max(last[1],span[1]);
  else merged.push(span);
 }
 return merged;
}

// Sample across the rib rows, keeping holes and separate ceiling islands apart.
export function supportBridgeSpans(ceiling,landings,axis,limit,{regions=false}={}){
 if(!ceiling.length)return null;
 const other=1-axis;
 let low=Infinity,high=-Infinity;
 for(const triangle of ceiling)for(const point of triangle){
  low=Math.min(low,point[other]);high=Math.max(high,point[other]);
 }
 if(high-low<=epsilon)return null;
 const samples=Math.min(100,Math.max(1,Math.ceil((high-low)/1.5)),Math.max(12,Math.floor(180000/(ceiling.length+landings.length)))),step=(high-low)/samples;
 const bands=[];let max=0,unbraced=0;
 for(let i=0;i<samples;i++){
  const from=low+i*step,to=from+step;
  const at=(from+to)/2,covered=supportIntervals(landings,other,at);
  for(const [start,end] of supportIntervals(ceiling,other,at)){
   let last=start,anchored=false;
   const add=(a,b,both)=>{
    const width=b-a;
    if(width<=epsilon)return;
    if(both)max=Math.max(max,width);else unbraced=Math.max(unbraced,width);
    if(regions)bands.push({from,to,start:a,end:b,width,both,risk:both?(width>limit?'wide':'bridge'):'edge'});
   };
   for(const [left,right] of covered){
    const a=Math.max(left,start),b=Math.min(right,end);
    if(b-a<=epsilon)continue;
    add(last,a,anchored);last=b;anchored=true;
   }
   add(last,end,false);
  }
 }
 return {axis,max,unbraced,bands};
}

export function bridgeRibSuggestion(row,point,risk){
 const {axis,bands}=row.bridges,other=1-axis;
 const band=bands.find(item=>(!risk||item.risk===risk)&&point[other]>=item.from-epsilon&&point[other]<=item.to+epsilon&&
  point[axis]>=item.start-epsilon&&point[axis]<=item.end+epsilon);
 if(!band||band.risk==='bridge')return null;
 const {wallThickness:thickness,bridgePlacement:placement}=row;
 if(!placement||band.width<thickness+.2)return {band};
 const {bounds,margin,stripes}=placement,half=thickness/2;
 const center=Number(((band.start+band.end)/2).toFixed(4));
 if(center<bounds[0][axis]+half-epsilon||center>bounds[1][axis]-half+epsilon)return {band};

 const ceiling=supportMeshTriangles(row.face);
 let ranges=[[band.from-40,band.to+40]];
 for(const offset of [-half-margin,0,half+margin]){
  const line=Math.min(bounds[1][axis],Math.max(bounds[0][axis],center+offset));
  const spans=supportIntervals(ceiling,axis,line);
  ranges=ranges.flatMap(([lo,hi])=>spans.map(([a,b])=>[Math.max(lo,a+margin),Math.min(hi,b-margin)]).filter(([a,b])=>b-a>=2));
 }
 const blocked=[];
 for(const stripe of stripes)if(Math.abs(center-stripe.center)<thickness+.001){
  if(!stripe.rib)return {band};
  blocked.push([stripe.rib.at[other]-stripe.rib.length/2,stripe.rib.at[other]+stripe.rib.length/2]);
 }
 for(const zone of row.override.noSupport||[])if(center+half>zone[axis]&&center-half<zone[axis+2])blocked.push([zone[other],zone[other+2]]);
 for(const [lo,hi] of blocked){
  ranges=ranges.flatMap(([a,b])=>hi<=a||lo>=b?[[a,b]]:[[a,lo-.001],[hi+.001,b]].filter(([x,y])=>y-x>=2));
 }
 const sample=(band.from+band.to)/2;
 const usable=ranges.find(([a,b])=>sample>=a&&sample<=b);
 if(!usable)return {band};

 const adjacent=bands.filter(item=>item.risk!=='bridge'&&center-half>item.start&&center+half<item.end);
 let from=band.from,to=band.to;
 const connected=[];
 for(const {from:start,to:end} of adjacent){
  const last=connected.at(-1);
  if(last&&start<=last[1]+epsilon)last[1]=Math.max(last[1],end);
  else connected.push([start,end]);
 }
 const interval=connected.find(([a,b])=>a<=sample&&b>=sample);
 if(interval)[from,to]=interval;
 from=Math.max(usable[0],from);to=Math.min(usable[1],to);
 const samplesIn=(start,end)=>adjacent.filter(item=>{
  const at=(item.from+item.to)/2;
  return at>=start-epsilon&&at<=end+epsilon;
 });
 function plan(start,end,sections){
  const length=Math.min(40,usable[1]-usable[0],Math.max(2,Math.ceil((end-start)*100)/100));
  if(length<2)return null;
  const preferred=Math.min(end-length/2,Math.max(start+length/2,point[other]));
  const along=Math.min(usable[1]-length/2,sample+length/2,Math.max(usable[0]+length/2,sample-length/2,preferred));
  const at=axis===0?[center,along]:[along,center];
  const zone=axis===0?[center-half,along-length/2,center+half,along+length/2]:
   [along-length/2,center-half,along+length/2,center+half];
  const comparisonBands=samplesIn(along-length/2,along+length/2);
  if(!comparisonBands.includes(band))comparisonBands.push(band);
  const maxAfter=Math.max(...comparisonBands.map(item=>Math.max(center-half-item.start,item.end-center-half)));
  return {rib:{at,length},zone,sections,comparisonBands,maxAfter};
 }
 const individual=plan(from,to,1);
 if(!individual)return {band};
 const nearby=connected.map(([a,b])=>[Math.max(a,usable[0]),Math.min(b,usable[1])]).filter(([a,b])=>b-a>=2);
 const selected=nearby.findIndex(([a,b])=>a<=sample&&b>=sample);
 let combined=null;
 if(selected>=0)for(const neighbor of [selected-1,selected+1]){
  const range=nearby[neighbor];
  if(!range)continue;
  const start=Math.min(from,range[0]),end=Math.max(to,range[1]);
  const gap=Math.max(from-range[1],range[0]-to);
  if(gap>8||end-start>40)continue;
  const candidate=plan(start,end,2);
  if(candidate&&samplesIn(...range).some(item=>candidate.comparisonBands.includes(item))&&
   (!combined||candidate.rib.length<combined.rib.length))combined=candidate;
 }
 return {band,...individual,combined,after:Math.max(center-half-band.start,band.end-center-half)};
}

// Compare the same strips of ceiling using the actual landings from both previews.
export function compareBridgeWidths(before,after){
 if(before.axis!==after?.axis||!before.areas.length)return null;
 const widths=(bands,areas)=>Math.max(0,...areas.map(area=>{
  const along=(area.from+area.to)/2;
  let width=0;
  for(const band of bands)if(along>=band.from-epsilon&&along<=band.to+epsilon){
   width=Math.max(width,Math.min(band.end,area.end)-Math.max(band.start,area.start));
  }
  return width;
 }));
 return {before:Math.max(...before.areas.map(area=>area.width)),after:widths(after.bands,before.areas)};
}
