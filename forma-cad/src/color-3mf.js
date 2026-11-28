import {bodyPaint} from './body-face-paint.js';
import {cadPosition} from './cad-coordinates.js';
import {bodyColorHex,bodyColorValue} from './body-appearance.js';
import {colorChoiceRgb,isClearColor} from './color-choice.js';
import {indexedPrintSupportMesh,inspectIndexed3mfMesh} from './print-support-3mf-mesh.js';
import {inspectStlMesh} from './stl-mesh-health.js';
import {repairMeshOverlaps} from './stl-overlap-repair.js';
import {pack3mf,xmlAttribute} from './pack-3mf.js';
import {bambuA1MiniProject} from './bambu-a1-mini-project.js';

export function colorMeshSnapshot(mesh,name){
 const geometry=mesh.geometry,position=cadPosition(geometry),index=geometry.index;
 const base=bodyColorHex(bodyColorValue(mesh.userData.bodyAppearance));
 const paint=bodyPaint(geometry);
 const vertices=[];
 for(let i=0;i<position.count;i++)vertices.push(position.getX(i),position.getY(i),position.getZ(i));
 const triangles=index?Array.from(index.array):Array.from({length:position.count},(_,i)=>i);
 const colors=paint?Array.from(paint.slots,slot=>slot?paint.palette[slot-1]:base):null;
 const uniform=colors?.every(color=>color===colors[0]);
 return {name,vertices,triangles,color:uniform?colors[0]:base,colors:uniform?null:colors};
}

function preparedPart({id,name,color,group},mesh){
 return {id,name,color,group,...mesh};
}

function repairColorParts(entries,selection){
 if(!selection.some(entry=>entry.error&&entry.mesh&&entry.prepared===undefined))return;
 const outputs=[],rows=[];
 for(const entry of selection){
  if(!entry.mesh)continue;
  const {key,mesh,error}=entry;
  const audit=error?(entry.audit??inspectStlMesh(mesh)):{ok:true,complete:true,issues:[]};
  if(error&&(audit.ok||audit.removedDegenerate))continue;
  outputs.push({id:key,...mesh});
  rows.push({id:key,attempts:0,...audit});
 }
 const repaired=repairMeshOverlaps(outputs,rows,{color3mf:true});
 for(const result of repaired.outputs){
  if(!result.sourceFaces?.some(({id})=>entries[id].error&&entries[id].prepared===undefined))continue;
  let indexed;
  try{indexed=indexedPrintSupportMesh(result);}catch{continue;}
  const colors=[],ranges=[],names=[];
  for(const {id,indices} of result.sourceFaces){
   const {part,mesh}=entries[id];
   ranges.push({id:part.group?.id??part.id,color:part.color,start:colors.length,count:indices.length});
   names.push(part.name);
   for(const i of indices)colors.push(mesh.colors?.[i]??part.color);
  }
  const first=entries[result.id],part=preparedPart(first.part,indexed);
  if(colors.every(color=>color===colors[0]))part.color=colors[0];
  else part.colors=colors;
  part.name=names.join(' / ');
  part.sourceRanges=ranges;
  part.removedFaces=result.sourceFaces.reduce((n,{id,indices})=>n+entries[id].mesh.triangles.length/3-indices.length,0);
  for(const {id} of result.sourceFaces)entries[id].prepared=null;
  first.prepared=part;
 }
}

export async function prepareColor3mfParts(parts,{remesh,isCurrent=()=>true}={}){
 if(!parts.length)throw Error('表示中のソリッドがありません');
 const checkCurrent=()=>{if(!isCurrent())throw Error('モデルが変更されたため3MF出力を中止しました。');};
 const entries=[];
 let lastYield=performance.now();
 for(const [key,part] of parts.entries()){
  if(performance.now()-lastYield>50){
   await new Promise(resolve=>setTimeout(resolve,0));
   lastYield=performance.now();
  }
  checkCurrent();
  try{entries.push({key,part,...inspectIndexed3mfMesh(part)});}catch(error){entries.push({key,part,error});}
 }
 if(entries.some(entry=>entry.error)){
  // Explicit filament volumes must stay independently closed, even where two
  // materials meet. Prefer repairing each body on its own, including painted
  // shells. Combine touching surface-coloured bodies only if they need it.
  for(const entry of entries)if(entry.error)repairColorParts(entries,[entry]);
  const surfaces=entries.filter(entry=>!entry.part.group);
  if(surfaces.length>1)repairColorParts(entries,surfaces);
 }
 const prepared=[];
 for(const entry of entries){
  checkCurrent();
  const {part}=entry;
  if(entry.prepared===null)continue;
  if(entry.prepared){prepared.push(entry.prepared);continue;}
  let {mesh,error}=entry;
  if(error){
   if(!part.colors&&part.brep&&remesh){
    try{mesh=indexedPrintSupportMesh(await remesh(part));error=null;}catch(failure){error=failure;}
    checkCurrent();
   }
   if(error)throw Error(part.name+' の3MF出力に失敗しました。'+error.message);
  }
  prepared.push(preparedPart(part,mesh));
 }
 return prepared;
}

export function color3mfRepairMessage(parts){
 const count=parts.reduce((sum,part)=>sum+(part.removedFaces??0),0);
 return count?'重複面・内部面を'+count+'枚取り除き、閉じた形状であることを確認しました。':'';
}

export function color3mfPreviewParts(parts){
 return parts.flatMap(part=>{
  const ranges=part.sourceRanges??[{id:part.group?.id??part.id,color:part.color,start:0,count:part.triangles.length/3}];
  return ranges.filter(range=>range.count>0).map(({id,color,start,count})=>{
   const whole=count===part.triangles.length/3;
   const triangles=whole?part.triangles:part.triangles.slice(start*3,(start+count)*3);
   const paints=whole?part.colors:part.colors?.slice(start,start+count);
   const mixed=paints?.some(value=>value!==paints[0]);
   return {id,vertices:part.vertices,triangles,color:colorChoiceRgb(mixed?color:(paints?.[0]??color)),
    ...(mixed?{faceColors:paints.map(colorChoiceRgb)}:{})};
  });
 });
}

// Bambu stores an unsplit painted triangle as a stream of reversed hex nibbles.
// State 0 inherits the volume's filament. Filament slots are one-based.
export function bambuPaintCode(filament){
 if(filament<3)return String(filament*4);
 const extra=filament-3;
 return (extra%15).toString(16).toUpperCase()+'F'.repeat(Math.floor(extra/15))+'C';
}

export function packColor3mf(parts,{assemblyName,bambuA1Mini=false,placement}={}){
 const objects=[],palette=new Map(),build=[],groups=new Map();
 const assembly=assemblyName&&parts.length>1?{id:Symbol(),name:assemblyName}:null;
 for(const [index,part] of parts.entries()){
  function colorIndex(color){
   if(!palette.has(color)){
    if(bambuA1Mini&&palette.size===32)throw Error('Bambu Studioの面の色分けは32色までです。色数を減らすか「3MF（色付き）」で保存してください。');
    palette.set(color,palette.size);
   }
   return palette.get(color);
  }
  const defaultIndex=colorIndex(part.colors?.[0]??part.color),vertices=[],triangles=[];
  for(let i=0;i<part.vertices.length;i+=3){
   const [x,y,z]=part.vertices.slice(i,i+3);
   vertices.push('<vertex x="'+x+'" y="'+y+'" z="'+z+'"/>');
  }
  for(let i=0;i<part.triangles.length;i+=3){
   const [a,b,c]=part.triangles.slice(i,i+3);
   const paint=part.colors?colorIndex(part.colors[i/3]):defaultIndex;
   const assignment=bambuA1Mini&&part.colors?' paint_color="'+bambuPaintCode(paint+1)+'"':'';
   triangles.push('<triangle v1="'+a+'" v2="'+b+'" v3="'+c+'" pid="1" p1="'+paint+'" p2="'+paint+'" p3="'+paint+'"'+assignment+'/>');
  }
  objects.push('<object id="'+(index+2)+'" type="model" name="'+xmlAttribute(part.name)+'" pid="1" pindex="'+defaultIndex+'"><mesh><vertices>'+vertices.join('')+'</vertices><triangles>'+triangles.join('')+'</triangles></mesh></object>');
  const entry={id:index+2,name:part.name,filament:defaultIndex+1};
  const parent=assembly||part.group;
  if(parent){
   let group=groups.get(parent.id);
   if(!group){group={id:parts.length+2+groups.size,name:parent.name,filament:entry.filament,parts:[]};groups.set(parent.id,group);build.push(group);}
   group.parts.push(entry);
  }else build.push(entry);
 }
 // Keep the chosen hue and give each filament a distinct swatch if RGB values coincide.
 const paletteColors=[...palette.keys()];
 const reserved=new Set(paletteColors.map(colorChoiceRgb));
 const used=new Set(paletteColors.filter(color=>!isClearColor(color)));
 const swatches=paletteColors.map(color=>{
  let rgb=colorChoiceRgb(color);
  if(isClearColor(color)&&used.has(rgb)){
   let marker=parseInt(rgb.slice(1),16);
   do{marker=(marker-1+0x1000000)%0x1000000;rgb='#'+marker.toString(16).padStart(6,'0');}
   while(reserved.has(rgb));
   reserved.add(rgb);
  }
  used.add(rgb);
  return rgb.toUpperCase();
 });
 const colors=swatches.map(rgb=>'<m:color color="'+rgb+'FF"/>').join('');
 for(const group of groups.values())objects.push('<object id="'+group.id+'" type="model" name="'+xmlAttribute(group.name)+'"><components>'+group.parts.map(part=>'<component objectid="'+part.id+'"/>').join('')+'</components></object>');
 const transform=placement?' transform="'+[placement.scale,0,0,0,placement.scale,0,0,0,placement.scale,...placement.offset].join(' ')+'"':'';
 const items=build.map(({id})=>'<item objectid="'+id+'"'+transform+'/>').join('');
 // Studio opens project settings only for its native Application signature.
 const header=bambuA1Mini?'<metadata name="Application">BambuStudio-02.04.00.70</metadata><metadata name="Designer">FORMA CAD</metadata><metadata name="BambuStudio:3mfVersion">1</metadata>':
  '<metadata name="Application">FormaCAD</metadata>'+(groups.size?'<metadata name="BambuStudio:3mfVersion">1</metadata>':'');
 const model='<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xml:lang="ja" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:m="http://schemas.microsoft.com/3dmanufacturing/material/2015/02" xmlns:BambuStudio="http://schemas.bambulab.com/package/2021" requiredextensions="m">'+header+'<resources><m:colorgroup id="1">'+colors+'</m:colorgroup>'+objects.join('')+'</resources><build>'+items+'</build></model>';
 const meta=(key,value)=>'<metadata key="'+key+'" value="'+xmlAttribute(String(value))+'"/>';
 const objectsConfig=build.map(item=>'<object id="'+item.id+'">'+meta('name',item.name)+meta('extruder',item.filament??1)+(item.parts||[]).map(part=>'<part id="'+part.id+'" subtype="normal_part">'+meta('name',part.name)+meta('extruder',part.filament)+meta('matrix','1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1')+'</part>').join('')+'</object>').join('');
 const plate='<plate>'+meta('plater_id',1)+build.map((item,index)=>'<model_instance>'+meta('object_id',item.id)+meta('instance_id',0)+meta('identify_id',index+1)+'</model_instance>').join('')+'</plate>';
 const config={};
 if(bambuA1Mini||groups.size)config['Metadata/model_settings.config']='<?xml version="1.0" encoding="UTF-8"?><config>'+objectsConfig+plate+'</config>';
 if(bambuA1Mini)config['Metadata/project_settings.config']=JSON.stringify(bambuA1MiniProject(swatches));
 return {data:pack3mf(model,config),colorCount:palette.size};
}

export async function createColor3mf(parts,options){
 return packColor3mf(await prepareColor3mfParts(parts,options));
}
