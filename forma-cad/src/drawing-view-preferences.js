// Orthogonal dimensions always retain their measured values.
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
export const drawingIsometricProjection={normal:[1,-1,1],horizontal:[1,1,0]};
export const projectDrawingIsometric=([x,y,z])=>[(x+y)/Math.SQRT2,(x-y-2*z)/Math.sqrt(6)];
export function drawingIsometricOutline([min,max]){
 const points=[];
 for(const x of [min[0],max[0]])for(const y of [min[1],max[1]])for(const z of [min[2],max[2]]){
  points.push(projectDrawingIsometric([x,y,z]));
 }
 return points;
}
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
export const minDrawingScale=.0001,maxDrawingScale=1000;
export const drawingScaleStep=.1;
const scaleTicks=1/drawingScaleStep,scaleTickTolerance=1e-9;
export const validDrawingScale=value=>Number.isFinite(value)&&value>=minDrawingScale&&value<=maxDrawingScale;
export const validDrawingDetailFactor=value=>value>=1&&validDrawingScale(value);
export function stepDrawingScale(value,direction){
 if(value<drawingScaleStep||(value===drawingScaleStep&&direction<0)){
  // At high reductions keep changing the denominator in tenths.
  const inverse=scaleTicks/value;
  const next=direction>0?Math.ceil(inverse-scaleTickTolerance)-1:Math.floor(inverse+scaleTickTolerance)+1;
  return scaleTicks/Math.max(scaleTicks/drawingScaleStep,Math.min(scaleTicks/minDrawingScale,next));
 }
 const ticks=value*scaleTicks;
 const next=direction>0?Math.floor(ticks+scaleTickTolerance)+1:Math.ceil(ticks-scaleTickTolerance)-1;
 return next<1?Math.min(value,drawingScaleStep):Math.min(maxDrawingScale,next/scaleTicks);
}
export function snapDrawingResizeScale(start,requested,minimum,maximum){
 const target=Math.max(minimum,Math.min(maximum,requested));
 if(Math.abs(target/start-1)<1e-6)return start;
 // Below 0.1×, use tenths in the denominator of the reduction ratio.
 const small=start<drawingScaleStep&&target<drawingScaleStep;
 const first=Math.max(1,Math.ceil((small?scaleTicks/maximum:minimum*scaleTicks)-scaleTickTolerance));
 const last=Math.floor((small?scaleTicks/minimum:maximum*scaleTicks)+scaleTickTolerance);
 if(first>last)return start;
 const tick=Math.max(first,Math.min(last,Math.round(small?scaleTicks/target:target*scaleTicks)));
 const snapped=small?scaleTicks/tick:tick/scaleTicks;
 // Close to a saved scale between ticks, a drag should never move the other way.
 return target>start?Math.max(start,snapped):Math.min(start,snapped);
}
export function parseDrawingScale(text){
 const parts=text.normalize('NFKC').trim().split(/\s*[:/]\s*/);
 if(parts.length>2||parts.some(part=>!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(part)))return null;
 const value=Number(parts[0])/Number(parts[1]??1);
 return validDrawingScale(value)?value:null;
}
export function drawingScaleLabel(scale){
 const multiplier=Number(scale.toFixed(4));
 if(scale>=1)return multiplier+':1';
 const inverse=Number((1/scale).toFixed(4));
 const isTenth=value=>Math.abs(value*scaleTicks-Math.round(value*scaleTicks))<=scaleTickTolerance;
 // Both forms describe the same physical scale. Use the multiplier if the
 // reciprocal would turn an exact tenth (e.g. 0.9) into a long decimal.
 if(isTenth(multiplier)&&!isTenth(inverse))return multiplier+':1';
 return '1:'+inverse;
}
export function drawingScaleSummary(scales){
 const scale=scales[0];
 const mixed=scales.some(value=>Math.abs(value-scale)>1e-10*Math.max(value,scale));
 return {mixed,header:mixed?'縮尺は各図に記載 / mm':scale===undefined?'mm':'SCALE '+drawingScaleLabel(scale)+' / mm'};
}
