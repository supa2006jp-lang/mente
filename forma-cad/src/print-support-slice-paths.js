import {BufferAttribute,BufferGeometry,DoubleSide,Ray,Vector3} from 'three';
import {MeshBVH} from 'three-mesh-bvh';

export function supportSlicePoint(matrix,point){
 return [0,1,2].map(i=>matrix[i]*point[0]+matrix[i+3]*point[1]+matrix[i+6]*point[2]+matrix[i+9]);
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
const cell=(x,y)=>Math.floor(x/cellSize)+','+Math.floor(y/cellSize);
const direction=new Vector3(0,0,1);
const numeric='([-+]?(?:[0-9]+(?:\\.[0-9]*)?|\\.[0-9]+))';
const values=new RegExp('([XYZIJE])\\s*'+numeric,'ig');
const zHeight=new RegExp('^;\\s*Z_HEIGHT:\\s*'+numeric,'i');
const layerHeight=new RegExp('^;\\s*(?:LAYER_HEIGHT|HEIGHT):\\s*'+numeric,'i');
const pathWidth=new RegExp('^;\\s*LINE_WIDTH:\\s*'+numeric,'i');

function addPath(layer,path){
 const {ax,ay,bx,by}=path,count=Math.max(1,Math.ceil(Math.max(Math.abs(bx-ax),Math.abs(by-ay))/cellSize));
 const inserted=new Set();
 for(let i=0;i<=count;i++){
  const key=cell(ax+(bx-ax)*i/count,ay+(by-ay)*i/count);
  if(inserted.has(key))continue;
  inserted.add(key);
  if(!layer.cells.has(key))layer.cells.set(key,[]);
  layer.cells.get(key).push(path);
 }
}

function arcPoints(from,to,fields,clockwise){
 if(!('I' in fields||'J' in fields))return [to];
 const cx=from.x+(fields.I??0),cy=from.y+(fields.J??0),r=Math.hypot(from.x-cx,from.y-cy);
 if(r<.001)return [to];
 const angle=Math.atan2(from.y-cy,from.x-cx);
 let sweep=Math.atan2(to.y-cy,to.x-cx)-angle;
 if(clockwise&&sweep>=0)sweep-=Math.PI*2;
 if(!clockwise&&sweep<=0)sweep+=Math.PI*2;
 const count=Math.min(1024,Math.max(1,Math.ceil(Math.abs(sweep)/Math.min(.25,Math.sqrt(.08/r)))));
 return Array.from({length:count},(_,i)=>{
  if(i===count-1)return to;
  const a=angle+sweep*(i+1)/count;
  return {x:cx+Math.cos(a)*r,y:cy+Math.sin(a)*r};
 });
}

export function readSupportSliceLayers(gcode,objectId,lineWidth=.4){
 const layers=new Map(),pathBounds=[[Infinity,Infinity],[-Infinity,-Infinity]];
 let xyz={x:0,y:0,z:0},e=0,xyAbsolute=true,eAbsolute=true,layer,object,feature='custom',width=lineWidth,paths=0;
 for(let start=0;start<gcode.length;){
  const next=gcode.indexOf('\n',start),line=gcode.slice(start,next<0?gcode.length:next).trim();
  start=next<0?gcode.length:next+1;
  if(line.startsWith(';')){
   const z=zHeight.exec(line);
   if(z){
    const height=Number(z[1]);
    if(!layers.has(height))layers.set(height,{z:height,height:null,cells:new Map()});
    layer=layers.get(height);continue;
   }
   const h=layerHeight.exec(line);
   if(h&&layer){layer.height=Number(h[1]);continue;}
   const w=pathWidth.exec(line);
   if(w){const n=Number(w[1]);if(n>=.08&&n<=3)width=n;continue;}
   const kind=/^;\s*FEATURE:\s*(.*)/i.exec(line);
   if(kind){feature=kind[1].toLowerCase();continue;}
   const owner=/^;\s*OBJECT_ID:\s*(\d+)/i.exec(line);
   if(owner)object=owner[1];
   continue;
  }
  const command=/^([GMT]\d+)\b/i.exec(line)?.[1].toUpperCase();
  if(!command)continue;
  if(command==='G90'||command==='G91'){xyAbsolute=command==='G90';continue;}
  if(command==='M82'||command==='M83'){eAbsolute=command==='M82';continue;}
  if(!['G0','G1','G2','G3','G92'].includes(command))continue;
  const fields=Object.fromEntries([...line.split(';',1)[0].matchAll(values)].map(match=>[match[1].toUpperCase(),Number(match[2])]));
  if(command==='G92'){
   for(const axis of ['x','y','z'])if(axis.toUpperCase() in fields)xyz[axis]=fields[axis.toUpperCase()];
   if('E' in fields)e=fields.E;
   continue;
  }
  const dest={};
  for(const axis of ['x','y','z']){
   const value=fields[axis.toUpperCase()];
   dest[axis]=value===undefined?xyz[axis]:xyAbsolute?value:xyz[axis]+value;
  }
  const extrusion=fields.E===undefined?0:eAbsolute?fields.E-e:fields.E;
  if(fields.E!==undefined)e=eAbsolute?fields.E:e+fields.E;
  if(extrusion>1e-7&&layer&&(!objectId||!object||object===objectId)&&Math.abs(dest.z-layer.z)<.015&&
   !/^(?:custom|skirt|brim|wipe tower|purge)/.test(feature)){
   const normal=!/^support/.test(feature);
   const points=command==='G2'||command==='G3'?arcPoints(xyz,dest,fields,command==='G2'):[dest];
   let from=xyz;
   for(const to of points){
    if(Math.hypot(to.x-from.x,to.y-from.y)>.0001){
     if(++paths>1_600_000)throw Error('積層経路が多すぎます。確認するプレートを分けて書き出してください');
     addPath(layer,{ax:from.x,ay:from.y,bx:to.x,by:to.y,width,normal});
     if(normal)for(const [i,axis] of ['x','y'].entries()){
      pathBounds[0][i]=Math.min(pathBounds[0][i],from[axis],to[axis]);
      pathBounds[1][i]=Math.max(pathBounds[1][i],from[axis],to[axis]);
     }
    }
    from=to;
   }
  }
  xyz=dest;
 }
 if(!paths||!Number.isFinite(pathBounds[0][0]))throw Error('照合できる積層経路が見つかりませんでした');
 const sorted=[...layers.values()].sort((a,b)=>a.z-b.z);
 let last=0;
 for(const row of sorted){
  if(!(row.height>0&&row.height<=2))row.height=row.z-last;
  row.mid=row.z-row.height/2;
  last=row.z;
 }
 return {layers:sorted,pathBounds};
}

function hasPath(layer,x,y,normalOnly){
 const cx=Math.floor(x/cellSize),cy=Math.floor(y/cellSize);
 for(let i=cx-1;i<=cx+1;i++)for(let j=cy-1;j<=cy+1;j++){
  for(const path of layer.cells.get(i+','+j)||[]){
   if(normalOnly&&!path.normal)continue;
   const {ax,ay,bx,by,width}=path,dx=bx-ax,dy=by-ay;
   const t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy)));
   if((x-ax-t*dx)**2+(y-ay-t*dy)**2<=(width/2+.04)**2)return true;
  }
 }
 return false;
}

function intervalsFor(mesh){
 const geometry=new BufferGeometry().setAttribute('position',new BufferAttribute(new Float32Array(mesh.vertices),3)).setIndex(Array.from(mesh.triangles));
 const origin=new Vector3(),ray=new Ray(origin,direction),tree=new MeshBVH(geometry,{indirect:true});
 const bottom=supportSliceBounds(mesh.vertices)[0][2]-1;
 return {at(x,y){
  origin.set(x,y,bottom);
  const sorted=tree.raycast(ray,DoubleSide).map(result=>result.point.z).sort((a,b)=>a-b);
  const heights=sorted.filter((z,i)=>!i||z-sorted[i-1]>1e-5);
  if(heights.length%2)return [];
  return Array.from({length:heights.length/2},(_,i)=>heights.slice(i*2,i*2+2));
 },dispose(){geometry.dispose();}};
}

const valuesAcross=(low,high,count)=>Array.from({length:count},(_,i)=>low+(high-low)*(i+.5)/count);
function searchLayer(layers,z){
 let a=0,b=layers.length;
 while(a<b){const i=(a+b)>>1;if(layers[i].mid<z)a=i+1;else b=i;}
 return a;
}

function sliceZones(source){
 const zones=[],ribs=source.ribs.filter(rib=>!rib.excluded);
 for(const rib of ribs){
  const [lo,hi]=rib.bounds,axis=rib.axis,other=1-axis;
  zones.push({kind:'rib',number:rib.number,bounds:rib.bounds,ceiling:rib.ceiling,probes:valuesAcross(lo[other],hi[other],9).map(value=>{
   const p=[];p[axis]=rib.center;p[other]=value;return p;
  })});
 }
 const numbers={upper:0,lower:0};
 for(const skin of source.skins){
  const [lo,hi]=skin.bounds,neighbors=ribs.filter(rib=>skin.ribs.includes(rib.id));
  const probes=valuesAcross(lo[0],hi[0],7).flatMap(x=>valuesAcross(lo[1],hi[1],7).map(y=>[x,y]));
  zones.push({kind:skin.side,number:++numbers[skin.side],bounds:skin.bounds,
   ceiling:skin.side==='upper'?hi[2]+source.topGap:null,
   probes:probes.filter(p=>!neighbors.some(rib=>Math.abs(p[rib.axis]-rib.center)<=source.wallThickness/2+.04))});
 }
 for(const [i,column] of source.columns.entries()){
  const [x,y,z]=column.point,r=column.radius;
  zones.push({kind:'column',number:i+1,ceiling:z,bounds:[[x-r,y-r,column.bottom],[x+r,y+r,column.top]],
   probes:[[x,y],[x+r*.62,y],[x-r*.62,y],[x,y+r*.62],[x,y-r*.62]]});
 }
 return zones;
}

function gapAt(layers,{x,y,matrix,zone,model,baseModels,source,top,bottom,last,first}){
 const gaps=[],shift=matrix[11],center=(a,b)=>(a+b)/2;
 if(last>=0&&Number.isFinite(zone.ceiling)&&Math.abs(top+source.topGap-zone.ceiling)<.05){
  const main=model?.at(x,y).find(([lo])=>Math.abs(lo-zone.ceiling)<.045);
  if(main){
   const start=Math.max(last+1,searchLayer(layers,main[0]+shift-.015));
   for(let i=start;i<layers.length&&layers[i].mid<Math.min(main[1],main[0]+1.5)+shift;i++){
    const [px,py]=supportSlicePoint(matrix,[x,y,0]);
    if(!hasPath(layers[i],px,py,true))continue;
    let prior=i-1;
    while(prior>last&&!hasPath(layers[prior],px,py,false))prior--;
    const gap=Math.max(0,layers[i].z-layers[i].height-layers[prior].z);
    gaps.push({role:'upper',layers:i-prior-1,gap,point:[x,y,center(zone.ceiling,top)]});break;
   }
  }
 }
 if(first>=0&&bottom>source.bedZ+.04){
  const landing=baseModels.flatMap(base=>base.at(x,y)).filter(([,hi])=>hi<=bottom+.02&&bottom-hi<=1.55).sort((a,b)=>b[1]-a[1])[0];
  if(landing){
   const [px,py]=supportSlicePoint(matrix,[x,y,0]);
   let base=Math.min(first-1,searchLayer(layers,landing[1]+shift-.001)-1);
   for(;base>=0&&layers[base].mid>=Math.max(landing[0],landing[1]-1.5)+shift;base--){
    if(!hasPath(layers[base],px,py,true))continue;
    let prior=first-1;
    while(prior>base&&!hasPath(layers[prior],px,py,false))prior--;
    gaps.push({role:'lower',layers:first-prior-1,gap:Math.max(0,layers[first].z-layers[first].height-layers[prior].z),
     point:[x,y,center(landing[1],bottom)]});break;
   }
  }
 }
 return gaps;
}

function checkZone(zone,context){
 const {layers,matrix,source,model,baseModels,solid}=context,shift=matrix[11],missingPoints=[],contacts=[];
 let checked=0,found=0,unsliced=0;
 for(const [x,y] of zone.probes){
  const [px,py]=supportSlicePoint(matrix,[x,y,0]);
  for(const [lo,hi] of solid.at(x,y)){
   const bottom=Math.max(lo,zone.bounds[0][2]),top=Math.min(hi,zone.bounds[1][2]);
   if(top-bottom<.001)continue;
   const start=searchLayer(layers,bottom+shift-.001);
   let first=-1,last=-1,used=0;
   for(let i=start;i<layers.length&&layers[i].mid<top+shift-.001;i++){
    checked++;used++;
    if(hasPath(layers[i],px,py,true)){found++;last=i;if(first<0)first=i;}
    else if(missingPoints.length<24)missingPoints.push([x,y,layers[i].mid-shift]);
   }
   if(!used){
    unsliced++;
    if(missingPoints.length<24)missingPoints.push([x,y,(bottom+top)/2]);
   }
   if(last>=0)contacts.push(...gapAt(layers,{x,y,matrix,zone,model,baseModels,source,top,bottom,last,first}));
  }
 }
 return {kind:zone.kind,number:zone.number,checked,found,unsliced,missingPoints,contacts};
}

export function inspectSupportSlicePaths({gcode,objectId,matrix,sources,models},onProgress){
 onProgress?.({stage:'スライス済みの積層経路を解析しています'});
 const {layers,pathBounds}=readSupportSliceLayers(gcode,objectId,sources[0]?.lineWidth);
 const vertices=models.flatMap(mesh=>{
  const [low,high]=supportSliceBounds(mesh.vertices);
  return [low[0],high[0]].flatMap(x=>[low[1],high[1]].flatMap(y=>[low[2],high[2]].flatMap(z=>supportSlicePoint(matrix,[x,y,z]))));
 });
 const [low,high]=supportSliceBounds(vertices);
 if([0,1].some(i=>pathBounds[1][i]<low[i]||pathBounds[0][i]>high[i]))
  throw Error('プレート上のモデル位置と積層経路を照合できませんでした');
 const checks=new Map();
 try{
  for(const mesh of models)checks.set(mesh.id,intervalsFor(mesh));
  const rows=[];
  for(const source of sources){
   const solid=intervalsFor(source.mesh);
   try{
    const model=checks.get(source.target),baseModels=source.baseIds.map(id=>checks.get(id)).filter(Boolean);
    for(const [i,zone] of sliceZones(source).entries()){
     if(i%15===0)onProgress?.({stage:'リブ・薄皮の積層経路と接点を照合しています'});
     rows.push({target:source.target,...checkZone(zone,{layers,matrix,source,model,baseModels,solid})});
    }
   }finally{solid.dispose();}
  }
  return {rows,layerCount:layers.length};
 }finally{for(const check of checks.values())check.dispose();}
}
