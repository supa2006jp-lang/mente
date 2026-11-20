import {BufferAttribute,BufferGeometry,DoubleSide,Ray,Vector3} from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {supportSlicePoint,supportSliceBounds,indexSupportPath,supportLayerHasPath} from './print-support-slice-geometry.js';
import {measureSupportCeilings,measureSupportLateralGaps} from './print-support-slice-measurements.js';
import {compareSupportSlices} from './print-support-slice-comparison.js';
export {supportSlicePoint,supportSliceBounds} from './print-support-slice-geometry.js';
const direction=new Vector3(0,0,1);
const numeric='([-+]?(?:[0-9]+(?:\\.[0-9]*)?|\\.[0-9]+))';
const values=new RegExp('([XYZIJE])\\s*'+numeric,'ig');
const zHeight=new RegExp('^;\\s*Z_HEIGHT:\\s*'+numeric,'i');
const layerHeight=new RegExp('^;\\s*(?:LAYER_HEIGHT|HEIGHT):\\s*'+numeric,'i');
const pathWidth=new RegExp('^;\\s*LINE_WIDTH:\\s*'+numeric,'i');

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
 const outerWidths=new Map(),heights=new Map();
 let xyz={x:0,y:0,z:0},e=0,xyAbsolute=true,eAbsolute=true,layer,object,feature='custom',width=lineWidth,hasWidth=false,paths=0;
 for(let start=0;start<gcode.length;){
  const next=gcode.indexOf('\n',start),line=gcode.slice(start,next<0?gcode.length:next).trim();
  start=next<0?gcode.length:next+1;
  if(line.startsWith(';')){
   const z=zHeight.exec(line);
   if(z){
    const height=Number(z[1]);
    if(!layers.has(height))layers.set(height,{z:height,height:null,cells:new Map(),paths:[]});
    layer=layers.get(height);continue;
   }
   const h=layerHeight.exec(line);
   if(h&&layer){layer.height=Number(h[1]);continue;}
   const w=pathWidth.exec(line);
   if(w){const n=Number(w[1]);if(n>=.08&&n<=3){width=n;hasWidth=true;}continue;}
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
    const length=Math.hypot(to.x-from.x,to.y-from.y);
    if(length>.0001){
     if(++paths>1_600_000)throw Error('積層経路が多すぎます。確認するプレートを分けて書き出してください');
     const path={ax:from.x,ay:from.y,bx:to.x,by:to.y,width,normal,widthKnown:hasWidth};
     layer.paths.push(path);indexSupportPath(layer.cells,path);
     if(hasWidth&&feature==='outer wall'){
      const rounded=Number(width.toFixed(3));
      outerWidths.set(rounded,(outerWidths.get(rounded)||0)+length);
     }
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
  if(row.height>0&&row.height<=2&&(last>0||sorted.length===1)){
   const rounded=Number(row.height.toFixed(4));
   heights.set(rounded,(heights.get(rounded)||0)+1);
  }
  last=row.z;
 }
 const mode=values=>[...values].sort((a,b)=>b[1]-a[1]||a[0]-b[0])[0]?.[0];
 return {layers:sorted,pathBounds,printSettings:{lineWidth:mode(outerWidths),layerHeight:mode(heights)}};
}

function hasPath(layer,x,y,normalOnly){
 return supportLayerHasPath(layer,x,y,normalOnly?path=>path.normal:null);
}

function intervalsFor(mesh){
 const geometry=new BufferGeometry().setAttribute('position',new BufferAttribute(new Float32Array(mesh.vertices),3)).setIndex(Array.from(mesh.triangles));
 const origin=new Vector3(),ray=new Ray(origin,direction),tree=new MeshBVH(geometry,{indirect:true});
 const bounds=supportSliceBounds(mesh.vertices),bottom=bounds[0][2]-1,cache=new Map();
 function at(x,y){
  if(x<bounds[0][0]-1e-6||x>bounds[1][0]+1e-6||y<bounds[0][1]-1e-6||y>bounds[1][1]+1e-6)return [];
  const key=x.toFixed(6)+','+y.toFixed(6);
  if(cache.has(key))return cache.get(key);
  origin.set(x,y,bottom);
  const sorted=tree.raycast(ray,DoubleSide).map(result=>result.point.z).sort((a,b)=>a-b);
  const heights=sorted.filter((z,i)=>!i||z-sorted[i-1]>1e-5);
  const ranges=heights.length%2?[]:Array.from({length:heights.length/2},(_,i)=>heights.slice(i*2,i*2+2));
  if(cache.size>=30000)cache.clear();
  cache.set(key,ranges);
  return ranges;
 }
 return {id:mesh.id,bounds,at,contains(x,y,z){
  return z>=bounds[0][2]-1e-6&&z<=bounds[1][2]+1e-6&&at(x,y).some(([low,high])=>z>=low-1e-6&&z<=high+1e-6);
 },dispose(){cache.clear();geometry.dispose();}};
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
  zones.push({kind:'rib',id:rib.id,ceilingId:rib.ceilingId,number:rib.number,bounds:rib.bounds,ceiling:rib.ceiling,probes:valuesAcross(lo[other],hi[other],9).map(value=>{
   const p=[];p[axis]=rib.center;p[other]=value;return p;
  })});
 }
 const numbers={upper:0,lower:0};
 for(const skin of source.skins){
  const [lo,hi]=skin.bounds,neighbors=ribs.filter(rib=>skin.ribs.includes(rib.id));
  const probes=valuesAcross(lo[0],hi[0],7).flatMap(x=>valuesAcross(lo[1],hi[1],7).map(y=>[x,y]));
  zones.push({kind:skin.side,ceilingId:skin.ceilingId,number:++numbers[skin.side],bounds:skin.bounds,
   ceiling:skin.side==='upper'?hi[2]+source.topGap:null,
   probes:probes.filter(p=>!neighbors.some(rib=>Math.abs(p[rib.axis]-rib.center)<=(rib.thickness??source.wallThickness)/2+.04))});
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
    gaps.push({role:'upper',layers:i-prior-1,gap,surface:main[0],point:[x,y,center(zone.ceiling,top)]});break;
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
     surface:landing[1],point:[x,y,center(landing[1],bottom)]});break;
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
 return {kind:zone.kind,id:zone.id,ceilingId:zone.ceilingId,number:zone.number,checked,found,unsliced,missingPoints,contacts};
}

export function inspectSupportSlicePaths({gcode,objectId,matrix,sources,models,previous},onProgress){
 onProgress?.({stage:'スライス済みの積層経路を解析しています'});
 const {layers,pathBounds,printSettings}=readSupportSliceLayers(gcode,objectId,sources[0]?.lineWidth);
 const vertices=models.flatMap(mesh=>{
  const [low,high]=supportSliceBounds(mesh.vertices);
  return [low[0],high[0]].flatMap(x=>[low[1],high[1]].flatMap(y=>[low[2],high[2]].flatMap(z=>supportSlicePoint(matrix,[x,y,z]))));
 });
 const [low,high]=supportSliceBounds(vertices);
 if([0,1].some(i=>pathBounds[1][i]<low[i]||pathBounds[0][i]>high[i]))
  throw Error('プレート上のモデル位置と積層経路を照合できませんでした');
 const checks=new Map(),activeSources=[];
 try{
  for(const mesh of models)checks.set(mesh.id,intervalsFor(mesh));
  const rows=[];
  for(const source of sources){
   const solid=intervalsFor(source.mesh);
   const model=checks.get(source.target),baseModels=source.baseIds.map(id=>checks.get(id)).filter(Boolean);
   activeSources.push({...source,solid,model});
   for(const [i,zone] of sliceZones(source).entries()){
    if(i%15===0)onProgress?.({stage:'リブ・薄皮の積層経路と接点を照合しています'});
    rows.push({target:source.target,...checkZone(zone,{layers,matrix,source,model,baseModels,solid})});
   }
  }
  const context={sources:activeSources,layers,matrix,models:[...checks.values()],searchLayer};
  const lateral=measureSupportLateralGaps(context,onProgress),ceilings=measureSupportCeilings(context,onProgress);
  const comparison=compareSupportSlices(previous,rows,context);
  return {rows,layerCount:layers.length,printSettings,lateral,ceilings,comparison};
 }finally{
  for(const check of checks.values())check.dispose();
  for(const source of activeSources)source.solid.dispose();
 }
}
