export function liveCadOutputs(features){
 const live=new Map();
 for(const [featureIndex,feature] of features.entries()){
  const result=feature.cadResult||(feature.kind==='cadop'?feature:null);
  if(result){for(const id of result.remove||[])live.delete(id);for(const [outputIndex,output]of result.outputs.entries())live.set(output.id,{featureIndex,outputIndex,output,feature});}
  else if(feature.kind==='extrusion')live.delete(feature.operation==='new'?feature.id:feature.target);
 }
 return [...live.values()].filter(r=>r.output.brep);
}
export function applyProjectDisplayRepairs(features,records){
 if(!records.length)return features;
 const next=[...features];
 for(const record of records){
  const source=next[record.featureIndex],result=source.cadResult||source,outputs=[...result.outputs];
  outputs[record.outputIndex]={...outputs[record.outputIndex],...record.mesh,cadCoordinatePrecision:true};
  next[record.featureIndex]=source.cadResult?{...source,cadResult:{...result,outputs}}:{...source,outputs};
 }
 return next;
}
