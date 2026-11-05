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
 const styles=new Map();
 for(const feature of features){
  const result=feature.cadResult||(feature.kind==='cadop'?feature:null);
  const inherited=styles.get(feature.spec?.target??feature.target);
  const outputs=bodyOutputs(feature).map(id=>[
   id,readAppearance(own(feature.bodyAppearance,id))||styles.get(id)||(result?inherited:undefined)
  ]);
  for(const id of result?.remove||[])styles.delete(id);
  for(const [id,style] of outputs)if(style)styles.set(id,style);
 }
 return styles;
}

export function bodyMaterialOptions(style,{splitColor,vertexColors=false}={}){
 const opacity=splitColor===undefined&&!vertexColors?style?.opacity??1:1;
 return {color:vertexColors?0xffffff:splitColor??style?.color??0xa3a197,vertexColors,
  roughness:opacity<1?.28:.8,opacity,transparent:opacity<1,depthWrite:opacity===1};
}
