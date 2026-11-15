import {bodyOutputIds} from './project-display-data.js';

const cachedNames=new WeakMap();
const validName=name=>typeof name==='string'&&!!name.trim()&&name.trim().length<=100;

export function customBodyName(features,id){
 let names=cachedNames.get(features);
 if(!names){
  names=new Map();
  for(const feature of features){
   if(!feature.bodyNames)continue;
   for(const id of bodyOutputIds(feature)){
    const name=Object.hasOwn(feature.bodyNames,id)?feature.bodyNames[id]:null;
    if(validName(name))names.set(id,name.trim());
   }
  }
  cachedNames.set(features,names);
 }
 return names.get(id);
}

export function setBodyName(features,id,name){
 if(!validName(name))throw Error('ボディ名は1〜100文字で入力してください');
 const index=features.findIndex(feature=>bodyOutputIds(feature).includes(id));
 if(index<0)throw Error('名前を変更するボディが見つかりません');
 const next=[...features],source=next[index];
 next[index]={...source,bodyNames:{...source.bodyNames,[id]:name.trim()}};
 return next;
}

export function inheritBodyNames(features,before){
 const namesByFeature=new Map(before.filter(feature=>feature.bodyNames).map(feature=>[feature.id,feature.bodyNames]));
 if(!namesByFeature.size)return features;
 return features.map(feature=>{
  const saved=namesByFeature.get(feature.id);
  if(!saved)return feature;
  const entries=bodyOutputIds(feature).filter(id=>Object.hasOwn(saved,id)&&!Object.hasOwn(feature.bodyNames||{},id));
  return entries.length?{...feature,bodyNames:{...feature.bodyNames,...Object.fromEntries(entries.map(id=>[id,saved[id]]))}}:feature;
 });
}
