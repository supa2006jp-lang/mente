import {bodyPaint} from './body-face-paint.js';
import {cadPosition} from './cad-coordinates.js';
import {bodyColorHex,bodyMaterialOptions} from './body-appearance.js';
import {indexedPrintSupportMesh} from './print-support-3mf-mesh.js';
import {pack3mf,xmlAttribute} from './pack-3mf.js';

export function colorMeshSnapshot(mesh,name){
 const geometry=mesh.geometry,position=cadPosition(geometry),index=geometry.index;
 const base=bodyColorHex(bodyMaterialOptions(mesh.userData.bodyAppearance).color);
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
 const objects=[],palette=new Map();
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
 }
 const colors=[...palette.keys()].map(color=>'<m:color color="'+color.toUpperCase()+'FF"/>').join('');
 const items=objects.map((_,index)=>'<item objectid="'+(index+2)+'"/>').join('');
 const model='<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xml:lang="ja" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:m="http://schemas.microsoft.com/3dmanufacturing/material/2015/02" requiredextensions="m"><metadata name="Application">FormaCAD</metadata><resources><m:colorgroup id="1">'+colors+'</m:colorgroup>'+objects.join('')+'</resources><build>'+items+'</build></model>';
 return {data:pack3mf(model),colorCount:palette.size};
}
