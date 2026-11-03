import * as R from 'replicad';import {nativeSketchFeature} from './native-sketch-arcs.js';import {reverseExtrusionFrame} from './extrusion-direction.js';
const bounds=shape=>{const box=shape.boundingBox;try{return box.bounds.map(p=>[...p]);}finally{box.delete();}};
function intersectionVolume(a,b){
 const x=bounds(a),y=bounds(b);if(x[0].some((v,i)=>Math.min(x[1][i],y[1][i])-Math.max(v,y[0][i])<=1e-5))return 0;
 const oc=R.getOC(),builder=new oc.BRepAlgoAPI_Common(),args=new oc.NCollection_List_TopoDS_Shape(),tools=new oc.NCollection_List_TopoDS_Shape();let result;
 try{args.Append(a.wrapped);tools.Append(b.wrapped);builder.SetArguments(args);builder.SetTools(tools);builder.SetNonDestructive(true);builder.Build();if(builder.HasErrors())throw Error('重なりを確認できませんでした');result=R.cast(builder.Shape());const volume=Math.abs(R.measureVolume(result));if(!Number.isFinite(volume))throw Error('重なりの体積を確認できませんでした');return volume;}finally{result?.delete();builder.delete();args.delete();tools.delete();}
}
export function nativeExtrusionProbe(history,spec,{bodies:makeBodies,solid}){
 const bodies=makeBodies(history);const matches=(feature,source)=>{
  const sourceFace=!feature.symmetric&&source&&feature.region?.outer&&bodies.has(source);if(sourceFace&&feature.depth<0&&!feature.region.gridSourceBodyId)return [{id:source,volume:Infinity}];
  const f=nativeSketchFeature({...feature,operation:'new',holesOnly:false,throughAll:false},history),tool=solid(f,bodies),found=[];
  try{for(const [id,body]of bodies){if(sourceFace&&feature.depth>=0&&id===source)continue;const volume=intersectionVolume(body,tool);if(volume>1e-5)found.push({id,volume});}return found.sort((a,b)=>b.volume-a.volume);}finally{tool.delete();}
 };
 try{if(!spec.direction)return {matches:matches(spec.feature,spec.source)};return {features:spec.features.map(feature=>{if(feature.symmetric||feature.operation==='cut'||feature.region?.gridSourceBodyId||!bodies.size)return feature;const probe={...feature,depth:Math.max(.1,Math.abs(feature.depth)),taperAngle:0};if(!matches(probe).length||matches({...probe,depth:-probe.depth}).length)return feature;return reverseExtrusionFrame(feature);})};}finally{bodies.forEach(s=>s.delete());}
}
