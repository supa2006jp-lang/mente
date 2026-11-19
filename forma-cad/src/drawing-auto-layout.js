import {drawingViewVisible,drawingViewScale,drawingProjectedFrame,defaultDrawingViewOrder,drawingProjections,drawingScaleSummary} from './drawing-view-preferences.js';
import {withDetails} from './drawing-annotations.js';
import {drawingCommentEntries,drawingCommentMargin} from './drawing-comments.js';
import {dimensionPlacement} from './drawing-dimension-layout.js';
import {displayedDrawingSpan,drawingBreakAxis,drawingPaperPoint,drawingPointOmitted,drawingViewBreak} from './drawing-break.js';
import {drawingHoleMarkers,drawingHoleTableSize,resolveDrawingHoleTable} from './drawing-hole-table.js';
import {drawingLeaderLayout} from './drawing-leaders.js';
import {drawingViewTitle} from './drawing-view-title.js';
const GAP=3,MIN_SCALE=.0001,MAX_SCALE=1000;
const overlap=(a,b)=>a.x<b.x+b.width-1e-8&&a.x+a.width>b.x+1e-8&&a.y<b.y+b.height-1e-8&&a.y+a.height>b.y+1e-8;
export function drawingViewFrames(input,options={},scale=1){
 const data=withDetails(input,options.details),frames={};
 const axis=drawingBreakAxis(data.bounds,options.breakAxis);
 for(const key of defaultDrawingViewOrder)if(data.views[key]&&drawingViewVisible(key,options)){
  const frame=drawingProjectedFrame(key,data.bounds),cut=drawingViewBreak(key,frame,axis,options.breakPercent,options.breakRange);
  frames[key]=cut?{...frame,break:cut,label:frame.label+' / 省略表示'}:frame;
 }
 if(data.views.iso)frames.iso={bx:data.views.iso.viewBox[0],by:data.views.iso.viewBox[1],width:data.views.iso.viewBox[2],height:data.views.iso.viewBox[3],factor:1,label:'ISOMETRIC'};
 for(const [key,view]of Object.entries(data.views))if(key!=='iso'&&!Object.hasOwn(drawingProjections,key))frames[key]={bx:view.viewBox[0],by:view.viewBox[1],width:view.viewBox[2],height:view.viewBox[3],factor:view.factor||1,label:key.startsWith('section-')?'断面 A–A':'詳細 D1 / 1000:1'};
 for(const key of Object.keys(frames)){if(!drawingViewVisible(key,options))delete frames[key];else frames[key].factor=drawingViewScale(key,scale,options,frames[key].factor)/scale;}
 for(const frame of Object.values(frames))if(![frame.bx,frame.by,frame.width,frame.height,frame.factor].every(Number.isFinite)||frame.width<0||frame.height<0||frame.factor<=0)throw Error('図の大きさを取得できません');return frames;
}
// Keep annotation offsets in paper mm when the common model scale changes.
// The measured points, radii, pitches and numeric dimension values stay intact.
export function rescaleDrawingAnnotations(dimensions,frames,fromScale,toScale,previousFrames=frames){return dimensions.map(d=>{const f=frames[d.view];if(!f||d.pinned)return structuredClone(d);const at=[...d.at],old=fromScale*(previousFrames[d.view]?.factor??f.factor),next=toScale*f.factor;
 if(d.kind==='horizontal'){const boundary=at[1]<f.by?f.by:f.by+f.height,gap=(at[1]-boundary)*old;at[1]=boundary+gap/next;}
 else if(d.kind==='vertical'){const boundary=at[0]<f.bx?f.bx:f.bx+f.width,gap=(at[0]-boundary)*old;at[0]=boundary+gap/next;}
 else if(['radius','diameter'].includes(d.kind)){const delta=at.map((v,i)=>v-d.center[i]),length=Math.hypot(...delta)||1,gap=Math.max(5,length*old-d.radius*old),distance=d.radius+gap/next;for(let i=0;i<2;i++)at[i]=d.center[i]+delta[i]/length*distance;}
 else if(d.kind==='angle'){for(let i=0;i<2;i++)at[i]=d.vertex[i]+(at[i]-d.vertex[i])*old/next;}
 else{const u=d.b.map((v,i)=>v-d.a[i]),length=Math.hypot(...u)||1,n=[-u[1]/length,u[0]/length],offset=(at[0]-d.a[0])*n[0]+(at[1]-d.a[1])*n[1];for(let i=0;i<2;i++)at[i]+=n[i]*offset*(old/next-1);}
 return {...structuredClone(d),at,...(d.alongOffset===undefined?{}:{alongOffset:d.alongOffset*old/next})};});}
export function decoratedDrawingViews(frames,scale,dimensions,options){const boxes={},layout={};
 const {mixed}=drawingScaleSummary(Object.values(frames).map(frame=>scale*frame.factor));
 for(const [key,f] of Object.entries(frames)){
  const s=scale*f.factor,width=displayedDrawingSpan(f,0)*s,height=displayedDrawingSpan(f,1)*s;
  const view={x:0,y:0,bx:f.bx,by:f.by,width,height,scale:s,break:f.break};
  layout[key]=view;
  const title=drawingViewTitle(key,view,options,mixed).bounds;
  boxes[key]={x:-.5,y:title.y,width:Math.max(width+1,title.x+title.width+1),height:height-title.y+.5};
 }
 const include=(key,b,pad=1)=>{const a=boxes[key];if(!a)return;const x=Math.min(a.x,b.x-pad),y=Math.min(a.y,b.y-pad);a.width=Math.max(a.x+a.width,b.x+b.width+pad)-x;a.height=Math.max(a.y+a.height,b.y+b.height+pad)-y;a.x=x;a.y=y;},point=drawingPaperPoint,points=(key,ps,pad=1)=>{include(key,{x:Math.min(...ps.map(p=>p[0])),y:Math.min(...ps.map(p=>p[1])),width:Math.max(...ps.map(p=>p[0]))-Math.min(...ps.map(p=>p[0])),height:Math.max(...ps.map(p=>p[1]))-Math.min(...ps.map(p=>p[1]))},pad);};
 for(const d of dimensions){const v=layout[d.view],p=dimensionPlacement(d,{layout});if(!v||!p)continue;include(d.view,p.box,.7);for(const b of [...p.main,...p.extensions])include(d.view,b,2);if(d.kind==='angle'){const c=point(v,d.vertex),at=point(v,d.at),r=Math.max(4,Math.hypot(at[0]-c[0],at[1]-c[1]));include(d.view,{x:c[0]-r,y:c[1]-r,width:r*2,height:r*2},1);}else if(['radius','diameter'].includes(d.kind)){const c=point(v,d.center),at=point(v,d.at),length=Math.hypot(at[0]-c[0],at[1]-c[1])||1,r=d.radius*v.scale,u=[(at[0]-c[0])/length,(at[1]-c[1])/length];points(d.view,[c,at,[c[0]+u[0]*r,c[1]+u[1]*r],[c[0]-u[0]*r,c[1]-u[1]*r]],2);}}
 for(const m of options.markers||[]){const v=layout[m.view];if(!v||[m.center??m.a,m.b].filter(Boolean).some(p=>drawingPointOmitted(v,p)))continue;if(m.kind==='center'){const c=point(v,m.center),r=m.radius*v.scale+3;include(m.view,{x:c[0]-r,y:c[1]-r,width:r*2,height:r*2});}else points(m.view,[point(v,m.a),point(v,m.b)],4);}
 for(const s of options.sections||[]){const v=layout[s.view];if(!v)continue;include(s.view,{x:-3,y:-8,width:v.width+14,height:v.height+17});}
 for(const d of options.details||[]){const v=layout[d.view];if(!v)continue;const c=point(v,d.center),r=d.radius*v.scale;include(d.view,{x:c[0]-r,y:c[1]-r,width:2*r+13,height:2*r});}
 for(const note of options.leaders||[]){
  const annotation=drawingLeaderLayout(note,layout[note.view]);
  if(annotation)include(note.view,annotation.bounds);
 }
 if(options.holeTable){
  const key=options.holeTable.view;
  for(const {point:[x,y],origin} of drawingHoleMarkers(options.holeTable,layout[key]))
   include(key,{x:x-2,y:y-(origin?10:5),width:11,height:origin?12:7});
 }
 return Object.entries(boxes).map(([key,box])=>({key,box,width:box.width,height:box.height}));}
function slicingPack(items,width,height){const limitW=width+GAP,limitH=height+GAP,memo=new Map(),n=items.length;function variants(mask){if(memo.has(mask))return memo.get(mask);if(!(mask&(mask-1))){const i=Math.log2(mask),item=items[i],v={w:item.width+GAP,h:item.height+GAP,at:{[item.key]:[0,0]}};const result=v.w<=limitW+1e-8&&v.h<=limitH+1e-8?[v]:[];memo.set(mask,result);return result;}const result=[],first=mask&-mask;
 for(let left=(mask-1)&mask;left;left=(left-1)&mask){if(!(left&first))continue;const right=mask^left;if(!right)continue;for(const a of variants(left))for(const b of variants(right))for(const horizontal of [true,false]){const w=horizontal?a.w+b.w:Math.max(a.w,b.w),h=horizontal?Math.max(a.h,b.h):a.h+b.h;if(w>limitW+1e-8||h>limitH+1e-8||result.some(v=>v.w<=w+1e-8&&v.h<=h+1e-8))continue;for(let i=result.length-1;i>=0;i--)if(w<=result[i].w+1e-8&&h<=result[i].h+1e-8)result.splice(i,1);const at={...a.at};for(const [key,p]of Object.entries(b.at))at[key]=[p[0]+(horizontal?a.w:0),p[1]+(horizontal?0:a.h)];result.push({w,h,at});}}
 result.sort((a,b)=>a.w*a.h-b.w*b.h);if(result.length>96)result.length=96;memo.set(mask,result);return result;}
 const result=variants((1<<n)-1);return result.sort((a,b)=>a.w*a.h-b.w*b.h)[0]||null;}
function freeRectPack(items,width,height){let best=null;const sorts=[(a,b)=>b.height-a.height,(a,b)=>b.width-a.width,(a,b)=>b.width*b.height-a.width*a.height,(a,b)=>Math.max(b.width,b.height)-Math.max(a.width,a.height),(a,b)=>b.width/b.height-a.width/a.height,(a,b)=>a.width/a.height-b.width/b.height];for(const sort of sorts){let free=[{x:0,y:0,width:width+GAP,height:height+GAP}],at={},w=0,h=0,failed=false;for(const item of [...items].sort(sort)){const iw=item.width+GAP,ih=item.height+GAP,candidates=free.filter(r=>r.width>=iw-1e-8&&r.height>=ih-1e-8).sort((a,b)=>Math.min(a.width-iw,a.height-ih)-Math.min(b.width-iw,b.height-ih)||a.y-b.y||a.x-b.x);if(!candidates.length){failed=true;break;}const rect={x:candidates[0].x,y:candidates[0].y,width:iw,height:ih};at[item.key]=[rect.x,rect.y];w=Math.max(w,rect.x+iw);h=Math.max(h,rect.y+ih);const split=[];for(const f of free){if(!overlap(f,rect)){split.push(f);continue;}if(rect.x>f.x)split.push({...f,width:rect.x-f.x});if(rect.x+iw<f.x+f.width)split.push({...f,x:rect.x+iw,width:f.x+f.width-rect.x-iw});if(rect.y>f.y)split.push({...f,height:rect.y-f.y});if(rect.y+ih<f.y+f.height)split.push({...f,y:rect.y+ih,height:f.y+f.height-rect.y-ih});}free=split.filter((r,i)=>r.width>1e-8&&r.height>1e-8&&!split.some((q,j)=>j!==i&&(q.width*q.height>r.width*r.height+1e-8||j<i)&&r.x>=q.x-1e-8&&r.y>=q.y-1e-8&&r.x+r.width<=q.x+q.width+1e-8&&r.y+r.height<=q.y+q.height+1e-8));}if(!failed&&(!best||w*h<best.w*best.h))best={w,h,at};}return best;}
export function optimizeDrawingLayout(data,{scale=1,dimensions=[],comment='',options={}}={}){
 if(options.holeTable)options={...options,holeTable:resolveDrawingHoleTable(options.holeTable,data.views)};
 if(!Number.isFinite(scale)||scale<=0)throw Error('縮尺を確認してください');const paper=options.paper==='A3'?'A3':'A4',size=paper==='A3'?[420,297]:[297,210],[width,height]=options.orientation==='portrait'?[size[1],size[0]]:size,area={x:6,y:18,width:width-12,height:height-(options.frame?35:12)-19},frames=drawingViewFrames(data,options);
 const maxNoteWidth=width-2*drawingCommentMargin;
 const notes=drawingCommentEntries(comment,options,maxNoteWidth),noteColumns=[notes];
 // Keep longer lines when they fit. Fixed-scale views may leave only a narrow column.
 for(const limit of [maxNoteWidth/2,60]){
  if(noteColumns.at(-1).some(note=>note.wrapWidth===undefined&&note.width>limit))noteColumns.push(drawingCommentEntries(comment,options,limit));
 }
 const table=options.pageHoleTable===false?null:drawingHoleTableSize(options.holeTable,options.pageHoleTable?{[options.holeTable?.view]:true}:frames);
 if(!Object.keys(frames).length&&!table&&!notes.length)throw Error('図面に載せるビューを1つ以上選択してください');
 const previousFrames=drawingViewFrames(data,options,scale);
 const attempt=s=>{
  const nextFrames=drawingViewFrames(data,options,s);
  const resized=rescaleDrawingAnnotations(dimensions,nextFrames,scale,s,previousFrames),views=decoratedDrawingViews(nextFrames,s,resized,options);
  for(const column of noteColumns){
   const items=[...views];
   for(const [key,block] of [...column.map(note=>[note.id,note]),['holeTable',table]])if(block){
    const width=Math.max(block.width,Math.min(block.wrapWidth??0,maxNoteWidth))+2,height=block.height+2;
    items.push({key,box:{x:-1,y:-1,width,height},width,height});
   }
   if(items.length>24)throw Error('自動配置する図が多すぎます');
   const packed=items.length<=6?slicingPack(items,area.width,area.height):freeRectPack(items,area.width,area.height);
   if(packed)return {items,packed,dimensions:resized};
  }
  return null;
 };
 const variable=Object.keys(frames).some(name=>options.viewScales?.[name]===undefined);
 let lo=variable?MIN_SCALE:scale,hi=MAX_SCALE;if(!attempt(lo))throw Error('文字・寸法・コメントを用紙に収められません。コメントを短くするか用紙を大きくしてください');if(variable){if(attempt(hi))lo=hi;else for(let i=0;i<36;i++){const mid=(lo+hi)/2;if(attempt(mid))lo=mid;else hi=mid;}}
 const nextScale=Math.max(MIN_SCALE,Math.floor(lo*1e6)/1e6),result=attempt(nextScale),positions={},offset=[area.x+(area.width-(result.packed.w-GAP))/2,area.y+(area.height-(result.packed.h-GAP))/2];for(const item of result.items){const p=result.packed.at[item.key];positions[item.key]=[offset[0]+p[0]-item.box.x,offset[1]+p[1]-item.box.y];}
 return {scale:nextScale,positions,dimensions:result.dimensions,paper,layout:'compact',area,boxes:result.items.map(item=>({key:item.key,x:positions[item.key][0]+item.box.x,y:positions[item.key][1]+item.box.y,width:item.width,height:item.height}))};
}
