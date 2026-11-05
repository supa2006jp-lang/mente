import {bodyPaint} from './body-face-paint.js';
import {cadPosition} from './cad-coordinates.js';
import {bodyColorHex,bodyColorValue} from './body-appearance.js';
import {colorChoiceRgb,isClearColor} from './color-choice.js';
import {indexedPrintSupportMesh} from './print-support-3mf-mesh.js';
import {pack3mf,xmlAttribute} from './pack-3mf.js';

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

export async function createColor3mf(parts,{remesh,isCurrent=()=>true}={}){
 if(!parts.length)throw Error('表示中のソリッドがありません');
 const objects=[],palette=new Map(),build=[],groups=new Map();
 for(const [index,part] of parts.entries()){
  let mesh;
  try{mesh=indexedPrintSupportMesh(part);}catch(error){
   if(part.colors||!part.brep||!remesh)throw Error(part.name+' の3MF出力に失敗しました。'+error.message);
   try{mesh=indexedPrintSupportMesh(await remesh(part));}
   catch(failure){throw Error(part.name+' の3MF出力に失敗しました。'+failure.message);}
  }
  if(!isCurrent())throw Error('モデルが変更されたため3MF出力を中止しました。');
  function colorIndex(color){
   if(!palette.has(color))palette.set(color,palette.size);
   return palette.get(color);
  }
  const defaultIndex=colorIndex(mesh.colors?.[0]??part.color),vertices=[],triangles=[];
  for(let i=0;i<mesh.vertices.length;i+=3){
   const [x,y,z]=mesh.vertices.slice(i,i+3);
   vertices.push('<vertex x="'+x+'" y="'+y+'" z="'+z+'"/>');
  }
  for(let i=0;i<mesh.triangles.length;i+=3){
   const [a,b,c]=mesh.triangles.slice(i,i+3);
   const paint=mesh.colors?colorIndex(mesh.colors[i/3]):defaultIndex;
   triangles.push('<triangle v1="'+a+'" v2="'+b+'" v3="'+c+'" pid="1" p1="'+paint+'" p2="'+paint+'" p3="'+paint+'"/>');
  }
  objects.push('<object id="'+(index+2)+'" type="model" name="'+xmlAttribute(part.name)+'" pid="1" pindex="'+defaultIndex+'"><mesh><vertices>'+vertices.join('')+'</vertices><triangles>'+triangles.join('')+'</triangles></mesh></object>');
  const entry={id:index+2,name:part.name,filament:defaultIndex+1};
  if(part.group){
   let group=groups.get(part.group.id);
   if(!group){group={id:parts.length+2+groups.size,name:part.group.name,parts:[]};groups.set(part.group.id,group);build.push(group);}
   group.parts.push(entry);
  }else build.push(entry);
 }
 // Keep the chosen hue and give each filament a distinct swatch if RGB values coincide.
 const paletteColors=[...palette.keys()];
 const reserved=new Set(paletteColors.map(colorChoiceRgb));
 const used=new Set(paletteColors.filter(color=>!isClearColor(color)));
 const colors=paletteColors.map(color=>{
  let rgb=colorChoiceRgb(color);
  if(isClearColor(color)&&used.has(rgb)){
   let marker=parseInt(rgb.slice(1),16);
   do{marker=(marker-1+0x1000000)%0x1000000;rgb='#'+marker.toString(16).padStart(6,'0');}
   while(reserved.has(rgb));
   reserved.add(rgb);
  }
  used.add(rgb);
  return '<m:color color="'+rgb.toUpperCase()+'FF"/>';
 }).join('');
 for(const group of groups.values())objects.push('<object id="'+group.id+'" type="model" name="'+xmlAttribute(group.name)+'"><components>'+group.parts.map(part=>'<component objectid="'+part.id+'"/>').join('')+'</components></object>');
 const items=build.map(({id})=>'<item objectid="'+id+'"/>').join('');
 const bambu=groups.size?'<metadata name="BambuStudio:3mfVersion">1</metadata>':'';
 const model='<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xml:lang="ja" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:m="http://schemas.microsoft.com/3dmanufacturing/material/2015/02" requiredextensions="m"><metadata name="Application">FormaCAD</metadata>'+bambu+'<resources><m:colorgroup id="1">'+colors+'</m:colorgroup>'+objects.join('')+'</resources><build>'+items+'</build></model>';
 const meta=(key,value)=>'<metadata key="'+key+'" value="'+xmlAttribute(String(value))+'"/>';
 const objectsConfig=build.map(item=>'<object id="'+item.id+'">'+meta('name',item.name)+meta('extruder',item.filament??1)+(item.parts||[]).map(part=>'<part id="'+part.id+'" subtype="normal_part">'+meta('name',part.name)+meta('extruder',part.filament)+meta('matrix','1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1')+'</part>').join('')+'</object>').join('');
 const plate='<plate>'+meta('plater_id',1)+build.map((item,index)=>'<model_instance>'+meta('object_id',item.id)+meta('instance_id',0)+meta('identify_id',index+1)+'</model_instance>').join('')+'</plate>';
 const config=groups.size?{'Metadata/model_settings.config':'<?xml version="1.0" encoding="UTF-8"?><config>'+objectsConfig+plate+'</config>'}:undefined;
 return {data:pack3mf(model,config),colorCount:palette.size};
}
