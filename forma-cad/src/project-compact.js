// Apply BREP-only edits to a save snapshot. Keep the live history and every
// render/STL vertex, triangle, dimension and operation unchanged.
export function compactProjectFeatures(features,records){
 if(!records.length)return features;
 const byFeature=new Map();for(const record of records){const list=byFeature.get(record.featureIndex)||[];list.push(record);byFeature.set(record.featureIndex,list);}
 return features.map((feature,index)=>{
  const records=byFeature.get(index);if(!records)return feature;
  const source=feature.cadResult||feature,outputs=source.outputs.map((output,i)=>{const record=records.find(r=>r.outputIndex===i);return record?{...output,brep:record.brep}:output;}),result={...source,outputs};
  return feature.cadResult?{...feature,cadResult:result}:result;
 });
}
