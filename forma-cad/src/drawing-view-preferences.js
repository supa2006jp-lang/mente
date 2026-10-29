// Orthogonal dimensions always retain their measured values. Per-view scales
// are explicitly labelled when the presentation differs from the base scale.
export const drawingViewVisible=(name,options={})=>name!=='iso'||options.isoMode!=='hidden';
export const drawingViewFactor=(name,options={})=>name==='front'&&options.viewPriority==='front'?1.4:name==='iso'&&options.isoMode==='small'?.5:1;
export function drawingScaleLabel(scale){return scale>=1?Number(scale.toFixed(4))+':1':'1:'+Number((1/scale).toFixed(4));}
