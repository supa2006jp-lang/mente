import {unzipSync,strFromU8} from 'three/addons/libs/fflate.module.js';
import {supportSliceBounds,supportSlicePoint} from './print-support-slice-paths.js';

const modelPath='3D/3dmodel.model';
const configPath='Metadata/model_settings.config';
const tolerance=.035;
const bytesLimit=96*1024*1024;
const identity=[1,0,0,0,1,0,0,0,1,0,0,0];
const children=(parent,name)=>Array.from(parent?.children||[]).filter(node=>node.localName===name);
const child=(parent,name)=>children(parent,name)[0];
const meta=(node,key)=>children(node,'metadata').find(item=>item.getAttribute('key')===key)?.getAttribute('value');

function transform(node){
 const text=node.getAttribute('transform');
 if(!text)return identity.slice();
 const values=text.trim().split(/\s+/).map(Number);
 if(values.length!==12||values.some(v=>!Number.isFinite(v)))throw Error('3MFの配置情報を読み込めませんでした');
 return values;
}

function compatibleBuild(t){
 const a=[t[0],t[1]],b=[t[3],t[4]];
 return Math.abs(Math.hypot(...a)-1)<1e-4&&Math.abs(Math.hypot(...b)-1)<1e-4&&Math.abs(a[0]*b[0]+a[1]*b[1])<1e-4&&
  [t[2],t[5],t[6],t[7],t[8]-1].every(v=>Math.abs(v)<1e-4);
}

function pointGrid(vertices){
 const grid=new Map();
 for(let i=0;i<vertices.length;i+=3){
  const point=vertices.slice(i,i+3),cell=point.map(v=>Math.floor(v/tolerance)).join(',');
  if(!grid.has(cell))grid.set(cell,[]);
  grid.get(cell).push(point);
 }
 return grid;
}

function coincident(vertices,grid,delta){
 for(let i=0;i<vertices.length;i+=3){
  const p=delta.map((v,k)=>vertices[i+k]+v),[x,y,z]=p.map(v=>Math.floor(v/tolerance));
  let found=false;
  for(let a=x-1;a<=x+1&&!found;a++)for(let b=y-1;b<=y+1&&!found;b++)for(let c=z-1;c<=z+1&&!found;c++){
   found=grid.get(a+','+b+','+c)?.some(q=>Math.hypot(p[0]-q[0],p[1]-q[1],p[2]-q[2])<=tolerance);
  }
  if(!found)return false;
 }
 return true;
}

function matchParts(expected,available){
 if(available.length<expected.length)return null;
 const anchor=expected.find(part=>available.some(item=>item.name===part.id))??expected[0];
 const named=available.filter(part=>part.name===anchor.id);
 for(const start of named.length?named:available){
  const delta=start.bounds[0].map((v,i)=>v-anchor.bounds[0][i]),used=new Set();
  function same(part,placed){
   return [0,1].every(side=>part.bounds[side].every((v,i)=>Math.abs(v+delta[i]-placed.bounds[side][i])<=tolerance))&&
    coincident(part.vertices,placed.grid??=pointGrid(placed.vertices),delta)&&
    coincident(placed.vertices,part.grid??=pointGrid(part.vertices),delta.map(v=>-v));
  }
  if(expected.every(part=>{
   const named=available.filter(item=>item.name===part.id);
   const match=(part===anchor?[start]:named.length?named:available).find(item=>!used.has(item)&&same(part,item));
   if(match)used.add(match);
   return !!match;
  }))return delta;
 }
 return null;
}

export function readSupportSliceProject(bytes,parts){
 if(!parts.length)throw Error('照合する精密プレビューを作成してください');
 if(bytes.byteLength>bytesLimit)throw Error('スライス済み3MFは96 MB以下のファイルを選んでください');
 let size=0,files;
 try{
  files=unzipSync(bytes,{filter({name,originalSize}){
   if(name!==configPath&&!/^3D\/.*\.model$/i.test(name)&&!/^Metadata\/plate_\d+\.gcode$/i.test(name))return false;
   size+=originalSize;
   if(size>bytesLimit*2)throw Error('size');
   return true;
  }});
 }catch(error){
  throw Error(error.message==='size'?'3MF内のモデルと経路が大きすぎます':'3MFを開けませんでした。Bambu Studioのスライス済み3MFを選んでください');
 }
 const gcodeNames=Object.keys(files).filter(name=>/^Metadata\/plate_\d+\.gcode$/i.test(name));
 if(!gcodeNames.length)throw Error('3MFに積層経路がありません。Bambu Studioでスライスしてから、スライス済みファイルを出力してください');
 const documents=new Map();
 function parse(path,root){
  if(documents.has(path))return documents.get(path);
  if(!files[path])throw Error('スライス済み3MFのモデル情報が見つかりません');
  const source=strFromU8(files[path]);
  if(/<!DOCTYPE/i.test(source))throw Error('3MFのモデル情報を読み込めませんでした');
  const node=new DOMParser().parseFromString(source,'application/xml').documentElement;
  if(node.localName!==root||root==='model'&&node.getAttribute('unit')&&node.getAttribute('unit')!=='millimeter')
   throw Error('3MFのモデル情報を読み込めませんでした');
  documents.set(path,node);return node;
 }
 const model=parse(modelPath,'model'),config=parse(configPath,'config');
 const wanted=parts.map(part=>({id:part.id,vertices:part.vertices,bounds:supportSliceBounds(part.vertices)})),matches=[];
 let badOrientation=false;
 for(const item of children(child(model,'build'),'item')){
  if(item.getAttribute('printable')==='0')continue;
  const id=item.getAttribute('objectid');
  const object=children(child(model,'resources'),'object').find(node=>node.getAttribute('id')===id);
  const settings=children(config,'object').find(node=>node.getAttribute('id')===id);
  const normalParts=new Map(children(settings,'part').filter(part=>part.getAttribute('subtype')==='normal_part')
   .map(part=>[part.getAttribute('id'),meta(part,'name')]));
  if(normalParts.size<wanted.length)continue;
  const available=[];
  for(const component of children(child(object,'components'),'component')){
   const componentId=component.getAttribute('objectid');
   if(!normalParts.has(componentId))continue;
   const path=Array.from(component.attributes).find(attribute=>attribute.localName==='path')?.value.replace(/^\//,'')??modelPath;
   const componentModel=parse(path,'model');
   const meshObject=children(child(componentModel,'resources'),'object').find(node=>node.getAttribute('id')===componentId);
   const vertices=[],matrix=transform(component);
   for(const vertex of children(child(child(meshObject,'mesh'),'vertices'),'vertex')){
    vertices.push(...supportSlicePoint(matrix,['x','y','z'].map(axis=>Number(vertex.getAttribute(axis)))));
   }
   if(vertices.length&&vertices.every(Number.isFinite))
    available.push({name:normalParts.get(componentId),vertices,bounds:supportSliceBounds(vertices)});
  }
  const delta=matchParts(wanted,available);
  if(!delta)continue;
  const matrix=transform(item);
  if(!compatibleBuild(matrix)){badOrientation=true;continue;}
  const translation=supportSlicePoint(matrix,delta);
  matrix.splice(9,3,...translation);
  const plates=children(config,'plate').flatMap(plate=>children(plate,'model_instance')
   .filter(instance=>meta(instance,'object_id')===id).map(instance=>({
    path:meta(plate,'gcode_file')??'Metadata/plate_'+meta(plate,'plater_id')+'.gcode',
    id:meta(instance,'identify_id'),
   }))).filter(plate=>gcodeNames.includes(plate.path));
  if(!plates.length&&gcodeNames.length===1)plates.push({path:gcodeNames[0],id:null});
  if(plates.length===1)matches.push({matrix,plate:plates[0]});
 }
 if(matches.length!==1)throw Error(matches.length>1?'同じ配置が複数あります。照合する配置を1組にして書き出してください':
  badOrientation?'積層方向を変えた配置です。CADと同じ上下の向きでスライスしてください':
  '現在の本体・サポートと一致する配置を確認できませんでした。同じ配置のスライス済み3MFを選んでください');
 const {matrix,plate}=matches[0];
 return {matrix,objectId:plate.id,gcode:strFromU8(files[plate.path]),plate:Number(plate.path.match(/(\d+)\.gcode$/i)[1])};
}
