import {ShapeUtils,Vector2} from 'three';
import {strFromU8,unzipSync,zipSync} from 'three/addons/libs/fflate.module.js';
import {PRINT_PLATE_SIZE,subtractFree} from './print-layout.js';
import {pack3mf,xmlAttribute} from './pack-3mf.js';
import {framePartBounds,framePartKey,framePartName,plateDimensions,plateKey,plateOutline} from './t-slot-frame.js';
import dimensions from './t-slot-dimensions.json' with {type:'json'};
import fineNozzle06 from './t-slot-nozzle-06.json' with {type:'json'};

// Allow both the 5 mm rail brims and a gap between neighbouring brims.
const margin=6,gap=11,usable=PRINT_PLATE_SIZE-2*margin,eps=1e-6;
export function framePrintPlates(bill) {
  const plates=[];
  const entries=bill.map(part=>{
    const [min,max]=framePartBounds(part);
    return {part,min,max,w:max[0]-min[0],h:max[1]-min[1]};
  }).sort((a,b)=>b.w*b.h-a.w*a.h);
  function place(plate,entry) {
    let best=null;
    for(const space of plate.free) for(const turn of [false,true]) {
      const w=(turn?entry.h:entry.w)+gap, h=(turn?entry.w:entry.h)+gap;
      if(w>space.w+eps||h>space.h+eps) continue;
      const score=Math.min(space.w-w,space.h-h), waste=space.w*space.h-w*h;
      if(!best||score<best.score-eps||(Math.abs(score-best.score)<eps&&waste<best.waste))
        best={x:space.x,y:space.y,w,h,score,waste,turn};
    }
    if(!best) return false;
    const {min,max,part}=entry, {x,y,w,h,turn}=best;
    const tx=x+margin-(turn?-max[1]:min[0]),ty=y+margin-(turn?min[0]:min[1]);
    const transform=[...(turn?[0,1,0,-1,0,0]:[1,0,0,0,1,0]),0,0,1,tx,ty,-min[2]];
    plate.placements.push({part,transform,min:[x+margin,y+margin,0],max:[x+margin+w-gap,y+margin+h-gap,max[2]-min[2]]});
    plate.free=subtractFree(plate.free,best);
    return true;
  }
  for(const item of entries) {
    if(Math.max(item.w,item.h)>usable+eps||item.max[2]-item.min[2]>PRINT_PLATE_SIZE+eps)
      throw Error(framePartName(item.part)+' がA1 miniの造形範囲を超えています。');
    // An identical footprint cannot fit in a previously rejected plate.
    let index=0;
    for(let i=0;i<item.part.count;i++) {
      while(plates[index]&&!place(plates[index],item)) index++;
      if(!plates[index]) {
        const plate={placements:[],free:[{x:0,y:0,w:usable+gap,h:usable+gap}]};
        place(plate,item);plates.push(plate);
      }
    }
  }
  return plates.map(({placements})=>({placements}));
}

function stlMesh(bytes) {
  const raw=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),count=raw.getUint32(80,true);
  if(bytes.byteLength!==84+count*50) throw Error('フレーム部品のSTLを読み込めません。');
  const vertices=[],triangles=[],ids=new Map();
  for(let i=0;i<count;i++) for(let j=0;j<3;j++) {
    const offset=96+i*50+j*12, p=[0,4,8].map(n=>raw.getFloat32(offset+n,true)),key=p.join(',');
    if(!ids.has(key)){ids.set(key,vertices.length/3);vertices.push(...p);}
    triangles.push(ids.get(key));
  }
  return {vertices,triangles};
}
function prismMesh(rings,height,key=null) {
  const vectors=rings.map((ring,i)=>{
    const points=ring.map(p=>new Vector2(...p));
    return ShapeUtils.isClockWise(points)===(i>0)?points:points.reverse();
  });
  // Earcut must recognise exactly collinear T-slot edges. Use integer planar
  // predicates for the caps while keeping the original coordinates in the mesh.
  function capTriangles(contours) {
    const scaled=contours.map(ring=>ring.map(({x,y})=>new Vector2(Math.round(x*1e5),Math.round(y*1e5))));
    return ShapeUtils.triangulateShape(scaled[0],scaled.slice(1));
  }
  const flat=vectors.flat(),n=flat.length;
  const faces=capTriangles(vectors),vertices=[],triangles=[];
  for(const z of [0,height]) for(const {x,y} of flat) vertices.push(x,y,z);
  for(const [a,b,c] of faces) {
    triangles.push(c,b,a);
    if(!key)triangles.push(a+n,b+n,c+n);
  }
  let start=0;
  for(const ring of rings){
    for(let i=0;i<ring.length;i++){
      const a=start+i,b=start+(i+1)%ring.length;
      triangles.push(a,b,b+n,a,b+n,a+n);
    }
    start+=ring.length;
  }
  if(key) {
    const hx=key.halfLength;
    const section=w=>[[-hx,-w],[hx,-w],[hx,w],[-hx,w]];
    const foot=section(key.levels[0][1]).map(p=>new Vector2(...p));
    // The first key ring immediately follows the plate's top vertices. Leave
    // its footprint open in that cap and share its four edges with the neck.
    const cap=capTriangles([...vectors,foot]);
    for(const [a,b,c] of cap)triangles.push(n+a,n+b,n+c);
    let previous=null;
    for(const [z,w] of key.levels) {
      const first=vertices.length/3;
      for(const [x,y] of section(w))vertices.push(x,y,z);
      if(previous!==null)for(let i=0;i<4;i++) {
        const j=(i+1)%4;
        triangles.push(previous+i,previous+j,first+j,previous+i,first+j,first+i);
      }
      previous=first;
    }
    triangles.push(previous,previous+1,previous+2,previous,previous+2,previous+3);
  }
  return {vertices,triangles};
}
export function readFrameStock(bytes) {
  const archive=unzipSync(bytes),stock=new Map();
  return {
    mesh(part){
      if(part.kind==='rail')return prismMesh([dimensions.profile],part.length);
      const plate=plateDimensions(part);
      if(plate){
        const {holes,height}=plate;
        const rings=holes.map(x=>Array.from({length:64},(_,i)=>{
          const a=-2*Math.PI*i/64;return [x+4.5*Math.cos(a),4.5*Math.sin(a)];
        }));
        return prismMesh([plateOutline(part),...rings],height,plateKey(part));
      }
      const key=framePartKey(part);
      if(!stock.has(key))stock.set(key,stlMesh(archive[key+'.stl']));
      return stock.get(key);
    },
    settings(rails,fasteners,nozzle=.4){
      if(nozzle!==.4&&nozzle!==.6)throw Error('対応するノズル径は0.4 mmと0.6 mmです。');
      const preset=JSON.parse(strFromU8(archive[nozzle===.6||!rails||fasteners?'small-settings.json':'rail-settings.json']));
      // The 0.6 mm estimate and its export use the same Fine process on all plates.
      if(nozzle===.6)Object.assign(preset,structuredClone(fineNozzle06));
      if(rails){preset.brim_type='outer_only';preset.brim_width='5';}
      return preset;
    }
  };
}
let stockPromise;
export function loadFrameStock() {
  if(!stockPromise)stockPromise=fetch(new URL('t-slot-m8.dat?v=3',import.meta.url)).then(async response=>{
    if(!response.ok)throw Error('M8フレーム部品を読み込めませんでした。');
    return readFrameStock(new Uint8Array(await response.arrayBuffer()));
  }).catch(error=>{stockPromise=undefined;throw error;});
  return stockPromise;
}
const xmlHead='<?xml version="1.0" encoding="UTF-8"?>';
const meta=(key,value)=>'<metadata key="'+key+'" value="'+xmlAttribute(value)+'"/>';
function meshXML(mesh) {
  const {vertices,triangles}=mesh, v=[],t=[];
  for(let i=0;i<vertices.length;i+=3){
    const [x,y,z]=vertices.slice(i,i+3).map(x=>Number(x.toPrecision(9)));
    v.push('<vertex x="'+x+'" y="'+y+'" z="'+z+'"/>');
  }
  for(let i=0;i<triangles.length;i+=3)t.push('<triangle v1="'+triangles[i]+'" v2="'+triangles[i+1]+'" v3="'+triangles[i+2]+'"/>');
  return '<mesh><vertices>'+v.join('')+'</vertices><triangles>'+t.join('')+'</triangles></mesh>';
}
export function framePlate3mf(plate,stock,cache=new Map(),nozzle=.4) {
  const objects=[],items=[],settings=[],instances=[],types=new Map();
  for(const {part,transform} of plate.placements) {
    if(!types.has(part.key)){
      const id=types.size+1,name=framePartName(part);
      types.set(part.key,{id,count:0});
      if(!cache.has(part.key))cache.set(part.key,meshXML(stock.mesh(part)));
      objects.push('<object id="'+id+'" type="model" name="'+xmlAttribute(name)+'">'+cache.get(part.key)+'</object>');
      settings.push('<object id="'+id+'">'+meta('name',name)+meta('extruder',1)+'</object>');
    }
    const type=types.get(part.key);
    items.push('<item objectid="'+type.id+'" transform="'+transform.join(' ')+'"/>');
    instances.push('<model_instance>'+meta('object_id',type.id)+meta('instance_id',type.count++)+meta('identify_id',items.length)+'</model_instance>');
  }
  // Studio only imports the embedded A1 mini settings in its native project dialect.
  const model=xmlHead+'<model unit="millimeter" xml:lang="ja" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:BambuStudio="http://schemas.bambulab.com/package/2021"><metadata name="Application">BambuStudio-02.04.00.70</metadata><metadata name="Designer">Forma CAD</metadata><metadata name="BambuStudio:3mfVersion">1</metadata><resources>'+objects.join('')+'</resources><build>'+items.join('')+'</build></model>';
  const config=xmlHead+'<config>'+settings.join('')+'<plate>'+meta('plater_id',1)+instances.join('')+'</plate></config>';
  const uses=kind=>plate.placements.some(p=>p.part.kind===kind);
  return pack3mf(model,{'Metadata/model_settings.config':config,'Metadata/project_settings.config':JSON.stringify(stock.settings(uses('rail'),uses('nut')||uses('bolt'),nozzle))});
}
export async function saveFramePlates(plates,{download,name,isCurrent,progress,nozzle=.4}) {
  const stock=await loadFrameStock(),files=Object.create(null),cache=new Map();
  for(const [index,plate] of plates.entries()) {
    if(!isCurrent())return false;
    progress(index+1,plates.length);
    await new Promise(resolve=>setTimeout(resolve,0));
    if(!isCurrent())return false;
    const buffer=framePlate3mf(plate,stock,cache,nozzle);
    if(plates.length===1){download(buffer,name+'.3mf','model/3mf');return true;}
    files['plate-'+String(index+1).padStart(2,'0')+'.3mf']=buffer;
  }
  if(!isCurrent())return false;
  download(zipSync(files,{level:0}),name+'.zip','application/zip');
  return true;
}
