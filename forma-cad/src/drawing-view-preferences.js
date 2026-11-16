// Orthogonal dimensions always retain their measured values. Per-view scales
// are explicitly labelled when the presentation differs from the base scale.
export const defaultDrawingViews=['top','front','right'];
export const drawingProjections={
 top:{label:'TOP',title:'上面',normal:[0,0,1],horizontal:[1,0,0],vertical:[0,-1,0]},
 front:{label:'FRONT',title:'正面',normal:[0,-1,0],horizontal:[1,0,0],vertical:[0,0,-1]},
 right:{label:'RIGHT',title:'右側面',normal:[1,0,0],horizontal:[0,1,0],vertical:[0,0,-1]},
 left:{label:'LEFT',title:'左側面',normal:[-1,0,0],horizontal:[0,-1,0],vertical:[0,0,-1]},
 back:{label:'BACK',title:'背面',normal:[0,1,0],horizontal:[-1,0,0],vertical:[0,0,-1]},
 bottom:{label:'BOTTOM',title:'底面',normal:[0,0,-1],horizontal:[1,0,0],vertical:[0,1,0]},
};
export const drawingProjectionNames=Object.keys(drawingProjections);
export const defaultDrawingViewOrder=['front','top','right','left','back','bottom'];
export function drawingViewVisible(name,options={}){
 if(name==='iso')return options.isoMode!=='hidden';
 if(!Object.hasOwn(drawingProjections,name))return true;
 return (options.viewSelection??defaultDrawingViews).includes(name);
}
export function drawingProjectedFrame(name,bounds){
 const {horizontal,vertical,label}=drawingProjections[name];
 const range=axis=>{
  const i=axis.findIndex(v=>v!==0);
  return axis[i]>0?[bounds[0][i],bounds[1][i]]:[-bounds[1][i],-bounds[0][i]];
 };
 const [bx,x1]=range(horizontal),[by,y1]=range(vertical);
 return {bx,by,width:x1-bx,height:y1-by,label,factor:1};
}
export const drawingViewFactor=(name,options={})=>name==='front'&&options.viewPriority==='front'?1.4:name==='iso'&&options.isoMode==='small'?.5:1;
export function drawingScaleLabel(scale){return scale>=1?Number(scale.toFixed(4))+':1':'1:'+Number((1/scale).toFixed(4));}
