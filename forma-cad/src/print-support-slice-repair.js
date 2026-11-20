import {sameSupportFace} from './print-support-adjustments.js';
import {supportSliceBounds} from './print-support-slice-paths.js';
import {supportIntervals,supportMeshTriangles} from './print-support-bridges.js';

const mm=value=>Number(value.toFixed(4))+' mm';
const fields={upper:'roofLayers',lower:'bottomSkinLayers'};
const skinNames={upper:'上面の薄皮',lower:'底面の薄皮'};

function overrideSpec(input,face,values){
 const rows=input.faceOverrides||[];
 const before=rows.find(row=>sameSupportFace(row.selection,face.selection));
 const after={...before,...values,selection:face.selection};
 return {...input,faceOverrides:[...rows.filter(row=>row!==before),after]};
}

export function proposeSupportSliceRepair(row,entry,printSettings={}){
 if(!entry||!row.missingPoints?.length||!row.ceilingId)return null;
 const {input,result}=entry,preview=result.supportPreview;
 const face=preview.coverage?.find(face=>face.ceilingId===row.ceilingId&&face.editable);
 if(!face)return null;
 if(row.kind==='rib'){
  if(row.checked===0&&row.unsliced)return null;
  const rib=preview.ribs?.find(rib=>rib.id===row.id&&rib.ceilingId===row.ceilingId&&!rib.excluded);
  if(!rib)return null;
  const before=rib.thickness??input.wallThickness,line=printSettings.lineWidth??input.lineWidth;
  const width=Number(((Math.floor((before+1e-6)/line)+1)*line).toFixed(6));
  if(width>2||width<=before)return null;
  const saved=face.override.ribWidths||[];
  const settings=overrideSpec(input,face,{ribWidths:[...saved.filter(value=>value.id!==rib.id),{id:rib.id,width}]});
  return {kind:'rib',target:input.target,ceilingId:row.ceilingId,id:rib.id,value:width,settings,
   title:'リブ '+row.number+'の厚み '+mm(before)+' → '+mm(width),
   basis:(printSettings.lineWidth?'スライスの外周線幅 ':'指定の線幅 ')+mm(line)+'に合わせた案です。'};
 }
 const key=fields[row.kind];
 if(!key)return null;
 const before=face.override[key]??input[key],pitch=printSettings.layerHeight??input.layerHeight;
 const layers=Math.max(before+1,Math.ceil((pitch-1e-6)/input.layerHeight));
 if(layers>6||layers<=before)return null;
 return {kind:row.kind,target:input.target,ceilingId:row.ceilingId,value:layers,points:row.missingPoints,
  thickness:layers*input.layerHeight,settings:overrideSpec(input,face,{[key]:layers}),
  title:skinNames[row.kind]+' '+before+'層 → '+layers+'層',
  basis:(printSettings.layerHeight?'スライスの積層ピッチ ':'指定の積層ピッチ ')+mm(pitch)+'に対して、薄皮を'+mm(layers*input.layerHeight)+'にする案です。'};
}

export function supportSliceRepairApplied(plan,result){
 const preview=result.supportPreview;
 if(plan.kind==='rib')return !!preview?.ribs?.some(rib=>rib.id===plan.id&&!rib.excluded&&rib.thickness===plan.value);
 const face=preview?.coverage?.find(row=>row.ceilingId===plan.ceilingId);
 if(!face?.skin?.[plan.kind]?.present||face.settings[fields[plan.kind]]!==plan.value)return false;
 return preview.skins.flat().some(skin=>{
  if(skin.side!==plan.kind||skin.ceilingId!==plan.ceilingId)return false;
  const [lo,hi]=supportSliceBounds(skin.vertices);
  if(hi[2]-lo[2]<plan.thickness-1e-5)return false;
  const triangles=supportMeshTriangles(skin);
  return plan.points.some(([x,y])=>supportIntervals(triangles,0,x).some(([a,b])=>y>=a-1e-5&&y<=b+1e-5));
 });
}
