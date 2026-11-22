export function suppressibleMachining(feature){
 return feature?.kind==='extrusion'&&feature.hole===true&&feature.operation==='cut'||
  feature?.kind==='cadop'&&feature.spec?.type==='shell';
}

export function machiningSuppressed(feature){
 return feature?.machiningSuppressed===true&&suppressibleMachining(feature);
}

export function toggleMachiningSuppression(features,id){
 const start=features.findIndex(feature=>feature.id===id);
 const previous=features[start];
 if(!suppressibleMachining(previous))throw Error('穴あけまたはシェルの工程を選択してください');
 const {machiningSuppressed:wasSuppressed,...feature}=previous,off=!wasSuppressed;
 if(off){
  feature.machiningSuppressed=true;
  const empty={outputs:[],remove:[]};
  if(feature.kind==='extrusion')feature.cadResult=empty;
  else{
   Object.assign(feature,empty);
   delete feature.analysis;
   delete feature.removed;
  }
 }
 const next=features.slice();
 next[start]=feature;
 return {before:features,features:next,start,off};
}
