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
 const styles=new Map(),colors=new Map();
 for(const feature of features){
  const result=feature.cadResult||(feature.kind==='cadop'?feature:null);
  const inherited=styles.get(feature.spec?.target??feature.target);
  const outputs=bodyOutputs(feature).map(id=>[
   id,readAppearance(own(feature.bodyAppearance,id))||styles.get(id)||(result?inherited:undefined)
  ]);
  for(const id of result?.remove||[]){
   styles.delete(id);
   if(!outputs.some(([outputId])=>outputId===id))colors.delete(id);
  }
  for(const [id,style] of outputs){
   if(style)styles.set(id,style);
   const color=readAppearance({color:own(feature.bodyColors,id)})?.color;
   if(color)colors.set(id,color);
  }
 }
 // Apply an explicit color to its own body after resolving inherited appearance.
 for(const [id,color] of colors)styles.set(id,{...styles.get(id),color,customColor:true});
 return styles;
}

export function setBodyColor(features,id,color){
 const index=features.findIndex(feature=>bodyOutputs(feature).includes(id));
 if(index<0)return features;
 const feature=features[index],previous=own(feature.bodyColors,id);
 if(color===null?previous===undefined:color===previous)return features;
 const bodyColors={...feature.bodyColors,[id]:color};
 if(color===null)delete bodyColors[id];
 const next=features.slice();
 next[index]={...feature,bodyColors};
 return next;
}

export function inheritBodyColors(features,before){
 const colors=new Map(before.filter(feature=>feature.bodyColors).map(feature=>[feature.id,feature.bodyColors]));
 if(!colors.size)return features;
 return features.map(feature=>{
  if(feature.bodyColors||!colors.has(feature.id))return feature;
  const previous=colors.get(feature.id);
  const bodyColors=Object.fromEntries(bodyOutputs(feature).filter(id=>Object.hasOwn(previous,id)).map(id=>[id,previous[id]]));
  return Object.keys(bodyColors).length?{...feature,bodyColors}:feature;
 });
}

export function bodyMaterialOptions(style,{splitColor,vertexColors=false}={}){
 const opacity=splitColor===undefined&&!vertexColors?style?.opacity??1:1;
 const color=style?.customColor?style.color:splitColor??style?.color??0xa3a197;
 return {color:vertexColors?0xffffff:color,vertexColors,
  roughness:opacity<1?.28:.8,opacity,transparent:opacity<1,depthWrite:opacity===1};
}
