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
export const projectionDragAxis=name=>['top','bottom'].includes(name)?1:['left','right','back'].includes(name)?0:null;

export function alignThirdAngleViews(layout,frontPosition){
 const front=layout.front??{x:frontPosition[0],y:frontPosition[1],
  width:layout.top?.width??layout.bottom?.width??0,height:layout.right?.height??layout.left?.height??0};
 for(const name of ['top','bottom']){
  const view=layout[name];if(!view)continue;
  view.x=front.x+(front.width-view.width)/2;
  view.y=name==='top'?Math.min(view.y,front.y-view.height-9):Math.max(view.y,front.y+front.height+9);
 }
 for(const name of ['left','right','back']){
  const view=layout[name];if(!view)continue;
  view.y=front.y+(front.height-view.height)/2;
  if(name==='left')view.x=Math.min(view.x,front.x-view.width-2);
  else{
   const previous=name==='back'&&layout.right?layout.right:front;
   view.x=Math.max(view.x,previous.x+previous.width+2);
  }
 }
}

export function isThirdAngleLayout(layout){
 const front=layout.front;
 if(!front)return true;
 for(const name of drawingProjectionNames){
  const view=layout[name];if(!view||name==='front')continue;
  if(Math.abs(view.scale-front.scale)>1e-6)return false;
  if(projectionDragAxis(name)===1){
   if(Math.abs(view.x-front.x)>1e-4||(name==='top'?view.y+view.height>front.y+.001:view.y<front.y+front.height-.001))return false;
  }else{
   const previous=name==='back'&&layout.right?layout.right:front;
   if(Math.abs(view.y-front.y)>1e-4||(name==='left'?view.x+view.width>front.x+.001:view.x<previous.x+previous.width-.001))return false;
  }
 }
 return true;
}
export const defaultDrawingViewOrder=['front','top','right','left','back','bottom'];
export function drawingViewVisible(name,options={}){
 if(options.pageViews&&!options.pageViews.includes(name))return false;
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
export const drawingViewScale=(name,scale,options={},factor=1)=>options.viewScales?.[name]??scale*drawingViewFactor(name,options)*factor;
export function drawingScaleLabel(scale){return scale>=1?Number(scale.toFixed(4))+':1':'1:'+Number((1/scale).toFixed(4));}
