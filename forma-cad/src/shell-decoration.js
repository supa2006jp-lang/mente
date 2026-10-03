// Only a trailing sequence of SVG operations can use the undecorated body.
// Other body edits invalidate this shortcut so their geometry is never lost.
export function decoratedShellHistory(features,target){
 let start=null;
 for(let i=features.length-1;i>=0;i--){
  const feature=features[i],result=feature.cadResult||feature;
  const affects=result.outputs?.some(output=>output.id===target)||result.remove?.includes(target)||
   feature.kind==='extrusion'&&(feature.operation==='new'?feature.id===target:feature.target===target||feature.targetBodies?.includes(target));
  if(!affects)continue;
  if(feature.spec?.type!=='svgWrap'||feature.spec.target!==target)break;
  start=i;
 }
 return start===null?null:features.slice(0,start);
}
