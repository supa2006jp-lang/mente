import {currentBodyMeshRecords} from './mesh-quality.js';
import {CLEAR_OPACITY,colorChoiceRgb,isClearColor,isColorChoice} from './color-choice.js';
import {bodyPaint,remapFacePaint,samePaintedFace,updateBodyPaint} from './body-face-paint.js';

function bodyOutputs(feature){
 const result=feature.cadResult||(feature.kind==='cadop'?feature:null);
 return result?result.outputs.map(output=>output.id):
  feature.operation==='new'&&(!feature.kind||feature.kind==='extrusion')?[feature.id]:[];
}

function readAppearance(value){
 if(typeof value?.color!=='string'||!/^#[0-9a-f]{6}$/i.test(value.color))return;
 const color=value.color.toLowerCase(),opacity=value.opacity;
 return Number.isFinite(opacity)&&opacity>=.1&&opacity<1?{color,opacity}:{color};
}

export const bodyColorHex=color=>typeof color==='string'?color.toLowerCase():'#'+color.toString(16).padStart(6,'0');
function own(record,id){return record&&Object.hasOwn(record,id)?record[id]:undefined;}

// Fold file-level colours from older models into the feature that creates
// each body, so saves, draft recovery and history replay retain appearance.
export function importBodyAppearance(features,modelInfo){
 const colors=modelInfo?.displayColors,opacities=modelInfo?.displayOpacity;
 if(!colors||typeof colors!=='object'||Array.isArray(colors))return features;
 const seen=new Set();
 return features.map(feature=>{
  const entries=[];
  for(const id of bodyOutputs(feature)){
   if(seen.has(id))continue;
   seen.add(id);
   const appearance=readAppearance(own(feature.bodyAppearance,id))||
    readAppearance({color:own(colors,id),opacity:own(opacities,id)});
   if(appearance)entries.push([id,appearance]);
  }
  return entries.length?{...feature,bodyAppearance:{...feature.bodyAppearance,...Object.fromEntries(entries)}}:feature;
 });
}

export function bodyAppearances(features){
 const styles=new Map(),colors=new Map(),automatic=new Map();
 for(const feature of features){
  const result=feature.cadResult||(feature.kind==='cadop'?feature:null);
  const inherited=styles.get(feature.spec?.target??feature.target);
  const outputs=bodyOutputs(feature).map(id=>[
   id,readAppearance(own(feature.bodyAppearance,id))||styles.get(id)||(result?inherited:undefined)
  ]);
  for(const id of result?.remove||[]){
   styles.delete(id);
   if(!outputs.some(([outputId])=>outputId===id)){colors.delete(id);automatic.delete(id);}
  }
  for(const [id,style] of outputs){
   if(style)styles.set(id,style);
   const savedMaterial=result?.outputs?.find(output=>output.id===id)?.materialColor;
   const material=isColorChoice(savedMaterial?.color)?{color:savedMaterial.color,
    ...(Number.isFinite(savedMaterial.opacity)&&savedMaterial.opacity>=.1&&savedMaterial.opacity<1?{opacity:savedMaterial.opacity}:{})}:null;
   if(material){styles.set(id,{...material,customColor:true});colors.delete(id);automatic.delete(id);}
   const color=own(feature.bodyColors,id);
   if(isColorChoice(color))colors.set(id,color.toLowerCase());
   const generated=own(feature.automaticBodyColors,id);
   if(isColorChoice(generated))automatic.set(id,generated.toLowerCase());
  }
 }
 // Apply an explicit color to its own body after resolving inherited appearance.
 for(const [id,color] of automatic)if(!styles.has(id)&&!colors.has(id))styles.set(id,{color,customColor:true,automatic:true});
 for(const [id,color] of colors)styles.set(id,{...styles.get(id),color,customColor:true});
 return styles;
}

const paintFields=['bodyColors','automaticBodyColors','bodyFaceColors'];

function setBodyPaint(features,id,field,update,index=features.findIndex(feature=>bodyOutputs(feature).includes(id))){
 if(index<0)return features;
 const feature=features[index],previous=own(feature[field],id),value=update(previous);
 if(previous===value)return features;
 const next=features.slice(),entries={...feature[field]};
 if(value===undefined)delete entries[id];else entries[id]=value;
 next[index]={...feature,[field]:entries};
 return next;
}

export function setBodyColor(features,id,color,{automatic=false}={}){
 const record=currentBodyMeshRecords(features).get(id),painted=features.findLastIndex(feature=>bodyOutputs(feature).includes(id)&&(own(feature.bodyColors,id)!==undefined||own(feature.automaticBodyColors,id)!==undefined));
 const index=record?.output?.materialParts||record?.output?.materialColor?record.index:painted>=0?painted:undefined;
 if(!automatic)features=setBodyPaint(features,id,'automaticBodyColors',()=>undefined,index);
 return setBodyPaint(features,id,automatic?'automaticBodyColors':'bodyColors',()=>color??undefined,index);
}

export function faceColorsByBody(features){
 const result=new Map();
 for(const feature of features)for(const id of bodyOutputs(feature)){
  const entries=own(feature.bodyFaceColors,id);
  if(Array.isArray(entries))result.set(id,entries);
 }
 return result;
}

export function remapBodyFaceColors(features,bodies,previousMeshes){
 return features.map(feature=>{
  if(!feature.bodyFaceColors)return feature;
  const entries={...feature.bodyFaceColors};
  let changed=false;
  for(const [id,faces] of Object.entries(entries)){
   const geometry=bodies.get(id)?.geometry;
   if(!geometry||!Array.isArray(faces))continue;
   const previous=previousMeshes?.get(id)?.geometry;
   const mapped=faces.map(face=>remapFacePaint(geometry,face,previous));
   entries[id]=mapped.map((face,index)=>{
    if(!face||face.unresolved||face===faces[index])return face;
    const conflict=mapped.some((other,i)=>i!==index&&other&&!other.unresolved&&samePaintedFace(other,face));
    return conflict?{...faces[index],unresolved:true}:face;
   });
   changed||=entries[id].some((face,index)=>face!==faces[index]);
  }
  return changed?{...feature,bodyFaceColors:entries}:feature;
 });
}

export function setBodyFaceColor(features,id,reference,color,sameFace){
 return setBodyPaint(features,id,'bodyFaceColors',previous=>{
  const entries=Array.isArray(previous)?previous:[];
  const index=entries.findIndex(entry=>sameFace(entry,reference));
  if((index<0&&color===null)||entries[index]?.color===color)return previous;
  const next=entries.filter((_,i)=>i!==index);
  if(color!==null)next.push({...reference,color});
  return next.length?next:undefined;
 });
}

export function inheritBodyColors(features,before){
 const previous=new Map(before.filter(feature=>paintFields.some(field=>feature[field])).map(feature=>[feature.id,feature]));
 if(!previous.size)return features;
 return features.map(feature=>{
  const source=previous.get(feature.id);
  if(!source)return feature;
  const outputIds=bodyOutputs(feature),inherited={};
  for(const field of paintFields){
   if(feature[field]||!source[field])continue;
   const entries=outputIds.filter(id=>Object.hasOwn(source[field],id)).map(id=>[id,source[field][id]]);
   if(entries.length)inherited[field]=Object.fromEntries(entries);
  }
  return Object.keys(inherited).length?{...feature,...inherited}:feature;
 });
}

export function bodyColorValue(style,splitColor){
 return style?.customColor?style.color:splitColor??style?.color??0xa3a197;
}

export function bodyMaterialOptions(style,{splitColor,vertexColors=false,opaque=vertexColors}={}){
 const value=bodyColorValue(style,splitColor);
 const opacity=isClearColor(value)?CLEAR_OPACITY:splitColor===undefined&&!opaque?style?.opacity??1:1;
 return {color:vertexColors?0xffffff:colorChoiceRgb(value),vertexColors,
  roughness:opacity<1?.28:.8,opacity,transparent:opacity<1,depthWrite:opacity===1};
}

export function bodyMeshMaterialOptions(geometry,style,splitColor){
 const paint=bodyPaint(geometry);
 const options=bodyMaterialOptions(style,{splitColor,vertexColors:!!paint,opaque:!!geometry.userData.qrColors});
 if(!paint?.layers.length)return options;
 // The shader multiplies vertex alpha by material opacity.
 return {...options,opacity:1,transparent:paint.transparent,depthWrite:!paint.transparent};
}

export function applyBodyMeshPaint(geometry,style,splitColor){
 const paint=bodyPaint(geometry);
 if(paint){
  const base=bodyMaterialOptions(style,{splitColor,opaque:!!geometry.userData.qrColors});
  updateBodyPaint(geometry,base.color,paint.layers.length?base.opacity:1);
 }
 return bodyMeshMaterialOptions(geometry,style,splitColor);
}
