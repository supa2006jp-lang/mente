const bounded=(value,min,max)=>Math.max(min,Math.min(max,value));
export const traceImagePoint=(view,p)=>[(p[0]-view.x)/view.zoom,(p[1]-view.y)/view.zoom];
export const traceCanvasPoint=(view,p)=>[p[0]*view.zoom+view.x,p[1]*view.zoom+view.y];
function clamp(view,width,height){return {...view,x:bounded(view.x,width*(1-view.zoom),0),y:bounded(view.y,height*(1-view.zoom),0)};}
export function zoomTraceView(view,anchor,zoom,width,height){
 if(![view.x,view.y,view.zoom,...anchor,zoom,width,height].every(Number.isFinite)||view.zoom<=0||width<=0||height<=0)throw Error('プレビューの拡大率が不正です');
 const point=traceImagePoint(view,anchor),next=bounded(zoom,1,12);return clamp({zoom:next,x:anchor[0]-point[0]*next,y:anchor[1]-point[1]*next},width,height);
}
export function panTraceView(view,dx,dy,width,height){return clamp({...view,x:view.x+dx,y:view.y+dy},width,height);}
