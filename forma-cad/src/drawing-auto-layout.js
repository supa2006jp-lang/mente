import {alignLinkedDrawingViews,linkedDrawingViews,drawingViewVisible,drawingViewScale,drawingViewScaleOverride,drawingProjectedFrame,defaultDrawingViewOrder,drawingProjections,drawingScaleSummary,drawingScaleStep,minDrawingScale,maxDrawingScale} from './drawing-view-preferences.js';
import {withDetails} from './drawing-annotations.js';
import {drawingCommentEntries,drawingCommentMargin} from './drawing-comments.js';
import {dimensionPlacement} from './drawing-dimension-layout.js';
import {drawingDetailDimensions} from './drawing-detail-dimensions.js';
import {displayedDrawingSpan,drawingBreakAxis,drawingPaperPoint,drawingPointOmitted,drawingViewBreak} from './drawing-break.js';
import {drawingHoleMarkers,drawingHoleTableSize,resolveDrawingHoleTable} from './drawing-hole-table.js';
import {drawingLeaderLayout} from './drawing-leaders.js';
import {drawingViewTitle} from './drawing-view-title.js';
const minimumGap=3;
const minimumGaps=[minimumGap,minimumGap];
const preferredGap=12;
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
 const inherited=drawingDetailDimensions(layout,options.details,options.detailDimensionSources??dimensions,!!options.pageViews);
 for(const d of [...dimensions,...inherited]){const v=layout[d.view],p=dimensionPlacement(d,{layout});if(!v||!p)continue;include(d.view,p.box,.7);for(const b of [...p.main,...p.extensions])include(d.view,b,2);if(d.kind==='angle'){const c=point(v,d.vertex),at=point(v,d.at),r=Math.max(4,Math.hypot(at[0]-c[0],at[1]-c[1]));include(d.view,{x:c[0]-r,y:c[1]-r,width:r*2,height:r*2},1);}else if(['radius','diameter'].includes(d.kind)){const c=point(v,d.center),at=point(v,d.at),length=Math.hypot(at[0]-c[0],at[1]-c[1])||1,r=d.radius*v.scale,u=[(at[0]-c[0])/length,(at[1]-c[1])/length];points(d.view,[c,at,[c[0]+u[0]*r,c[1]+u[1]*r],[c[0]-u[0]*r,c[1]-u[1]*r]],2);}}
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
function slicingPack(items,width,height,[gapX,gapY],order){
 const limitW=width+gapX,limitH=height+gapY,memo=new Map();
 const maskFor=key=>{
  const index=items.findIndex(item=>item.key===key);
  return index<0?0:1<<index;
 };
 const front=order.length?maskFor('front'):0;
 const top=order.includes('top')?maskFor('top'):0,right=order.includes('right')?maskFor('right'):0;
 function variants(mask){
  if(memo.has(mask))return memo.get(mask);
  if(!(mask&(mask-1))){
   const item=items[Math.log2(mask)],v={w:item.width+gapX,h:item.height+gapY,at:{[item.key]:[0,0]}};
   const result=v.w<=limitW+1e-8&&v.h<=limitH+1e-8?[v]:[];
   memo.set(mask,result);return result;
  }
  const result=[],first=mask&-mask;
  for(let left=(mask-1)&mask;left;left=(left-1)&mask){
   if(!(left&first))continue;
   const other=mask^left;
   if(!other)continue;
   const opposite=left&front?other:other&front?left:0;
   const topAbove=!!(opposite&top),rightBeside=!!(opposite&right);
   if(topAbove&&rightBeside)continue;
   const swap=topAbove?!!(left&front):rightBeside&&!(left&front);
   const directions=topAbove?[false]:rightBeside?[true]:[true,false];
   for(const a of variants(swap?other:left))for(const b of variants(swap?left:other))for(const horizontal of directions){
    const w=horizontal?a.w+b.w:Math.max(a.w,b.w),h=horizontal?Math.max(a.h,b.h):a.h+b.h;
    if(w>limitW+1e-8||h>limitH+1e-8||result.some(v=>v.w<=w+1e-8&&v.h<=h+1e-8))continue;
    for(let i=result.length-1;i>=0;i--)if(w<=result[i].w+1e-8&&h<=result[i].h+1e-8)result.splice(i,1);
    const at={...a.at};
    for(const [key,p]of Object.entries(b.at))at[key]=[p[0]+(horizontal?a.w:0),p[1]+(horizontal?0:a.h)];
    result.push({w,h,at});
   }
  }
  result.sort((a,b)=>a.w*a.h-b.w*b.h);
  if(result.length>96)result.length=96;
  memo.set(mask,result);return result;
 }
 return variants((1<<items.length)-1)[0]??null;
}
function freeRectPack(items,width,height,[gapX,gapY]){let best=null;const sorts=[(a,b)=>b.height-a.height,(a,b)=>b.width-a.width,(a,b)=>b.width*b.height-a.width*a.height,(a,b)=>Math.max(b.width,b.height)-Math.max(a.width,a.height),(a,b)=>b.width/b.height-a.width/a.height,(a,b)=>a.width/a.height-b.width/b.height];for(const sort of sorts){let free=[{x:0,y:0,width:width+gapX,height:height+gapY}],at={},w=0,h=0,failed=false;for(const item of [...items].sort(sort)){const iw=item.width+gapX,ih=item.height+gapY,candidates=free.filter(r=>r.width>=iw-1e-8&&r.height>=ih-1e-8).sort((a,b)=>Math.min(a.width-iw,a.height-ih)-Math.min(b.width-iw,b.height-ih)||a.y-b.y||a.x-b.x);if(!candidates.length){failed=true;break;}const rect={x:candidates[0].x,y:candidates[0].y,width:iw,height:ih};at[item.key]=[rect.x,rect.y];w=Math.max(w,rect.x+iw);h=Math.max(h,rect.y+ih);const split=[];for(const f of free){if(!overlap(f,rect)){split.push(f);continue;}if(rect.x>f.x)split.push({...f,width:rect.x-f.x});if(rect.x+iw<f.x+f.width)split.push({...f,x:rect.x+iw,width:f.x+f.width-rect.x-iw});if(rect.y>f.y)split.push({...f,height:rect.y-f.y});if(rect.y+ih<f.y+f.height)split.push({...f,y:rect.y+ih,height:f.y+f.height-rect.y-ih});}free=split.filter((r,i)=>r.width>1e-8&&r.height>1e-8&&!split.some((q,j)=>j!==i&&(q.width*q.height>r.width*r.height+1e-8||j<i)&&r.x>=q.x-1e-8&&r.y>=q.y-1e-8&&r.x+r.width<=q.x+q.width+1e-8&&r.y+r.height<=q.y+q.height+1e-8));}if(!failed&&(!best||w*h<best.w*best.h))best={w,h,at};}return best;}
function groupProjectionViews(views,frames,scale,[gapX,gapY],names){
 const members=views.filter(({key})=>names.includes(key));
 if(members.length<2||!frames.front)return views;
 const layout=Object.fromEntries(members.map(({key})=>{
  const frame=frames[key],s=scale*frame.factor;
  return [key,{x:0,y:0,width:displayedDrawingSpan(frame,0)*s,height:displayedDrawingSpan(frame,1)*s}];
 }));
 alignLinkedDrawingViews(layout);
 const front=members.find(({key})=>key==='front');
 const top=members.find(({key})=>key==='top');
 const right=members.find(({key})=>key==='right');
 if(top)layout.top.y=Math.min(layout.top.y,front.box.y-top.box.y-top.height-gapY);
 if(right){
  const edge=Math.max(front.box.x+front.width,top?layout.top.x+top.box.x+top.width:-Infinity);
  layout.right.x=Math.max(layout.right.x,edge-right.box.x+gapX);
 }
 const children=members.map(member=>({...member,offset:[
  layout[member.key].x+member.box.x,layout[member.key].y+member.box.y,
 ]}));
 const left=Math.min(...children.map(({offset})=>offset[0]));
 const upper=Math.min(...children.map(({offset})=>offset[1]));
 const width=Math.max(...children.map(child=>child.offset[0]+child.width))-left;
 const height=Math.max(...children.map(child=>child.offset[1]+child.height))-upper;
 for(const child of children)child.offset=[child.offset[0]-left,child.offset[1]-upper];
 return [{key:'front',width,height,children},...views.filter(({key})=>!names.includes(key))];
}

function packDrawingItems(items,width,height,isoOnRight,gaps,order){
 const [gapX,gapY]=gaps;
 const pack=(blocks,w,h)=>blocks.length<=6?slicingPack(blocks,w,h,gaps,order):freeRectPack(blocks,w,h,gaps);
 const iso=isoOnRight&&items.find(item=>item.key==='iso');
 if(!iso||items.length===1)return pack(items,width,height);
 if(iso.width+gapX>=width||iso.height>height)return null;
 const others=pack(items.filter(item=>item!==iso),width-iso.width-gapX,height);
 if(!others)return null;
 const h=iso.height+gapY;
 return {w:others.w+iso.width+gapX,h:Math.max(others.h,h),
  at:{...others.at,iso:[others.w,Math.max(0,(others.h-h)/2)]}};
}

function spreadDrawingItems(initial,area){
 const pack=initial.packWithGaps;
 function widen(layout,low,high,gapsFor){
  let best=layout;
  while(low<high){
   const gap=Math.ceil((low+high)/2),candidate=pack(gapsFor(gap));
   if(candidate){low=gap;best=candidate;}
   else high=gap-1;
  }
  return best;
 }
 const width=Math.min(preferredGap,Math.floor(area.width)),height=Math.min(preferredGap,Math.floor(area.height));
 // Prefer shared clearance, then spend any remaining space along each axis.
 const balanced=widen(initial,minimumGap,Math.min(width,height),gap=>[gap,gap]);
 const horizontal=widen(balanced,balanced.gaps[0],width,gap=>[gap,balanced.gaps[1]]);
 return widen(horizontal,horizontal.gaps[1],height,gap=>[horizontal.gaps[0],gap]);
}

function largestFittingScale(attempt){
 const ticks=1/drawingScaleStep;
 const firstTenth=attempt(drawingScaleStep),useSmallRatios=!firstTenth;
 const largestDenominator=Math.round(ticks/minDrawingScale);
 const scaleAt=index=>useSmallRatios?ticks/(largestDenominator-index):(index+1)/ticks;
 let low=0,high=useSmallRatios?largestDenominator-Math.round(ticks/drawingScaleStep):Math.round(maxDrawingScale*ticks)-1;
 let result=firstTenth??attempt(scaleAt(low));
 if(!result)return null;
 // Search the actual scale choices so the next larger step is tested for fit.
 while(low<high){
  const middle=Math.ceil((low+high)/2),candidate=attempt(scaleAt(middle));
  if(candidate){low=middle;result=candidate;}
  else high=middle-1;
 }
 return {scale:scaleAt(low),result};
}

export function optimizeDrawingLayout(data,{scale=1,dimensions=[],comment='',options={},fixedScale=false,isoOnRight=false,spreadViews=false,preferProjectionOrder=false}={}){
 if(options.holeTable)options={...options,holeTable:resolveDrawingHoleTable(options.holeTable,data.views)};
 if(!Number.isFinite(scale)||scale<=0)throw Error('縮尺を確認してください');const paper=options.paper==='A3'?'A3':'A4',size=paper==='A3'?[420,297]:[297,210],[width,height]=options.pageSize??(options.orientation==='portrait'?[size[1],size[0]]:size),area={x:6,y:18,width:width-12,height:height-(options.frame?35:12)-19},frames=drawingViewFrames(data,options);
 const maxNoteWidth=width-2*drawingCommentMargin;
 const notes=options.pageNotes??drawingCommentEntries(comment,options,maxNoteWidth),noteColumns=[notes];
 // Keep longer lines when they fit. Fixed-scale views may leave only a narrow column.
 if(!options.pageNotes)for(const limit of [maxNoteWidth/2,60]){
  if(noteColumns.at(-1).some(note=>note.wrapWidth===undefined&&note.width>limit))noteColumns.push(drawingCommentEntries(comment,options,limit));
 }
 const table=options.pageHoleTable===false?null:drawingHoleTableSize(options.holeTable,options.pageHoleTable?{[options.holeTable?.view]:true}:frames);
 if(!Object.keys(frames).length&&!table&&!notes.length)throw Error('図面に載せるビューを1つ以上選択してください');
 const previousFrames=drawingViewFrames(data,options,scale);
 const preferRight=isoOnRight&&!!frames.iso;
 const placementOptions=isoOnRight?{...options,autoIsoScale:undefined}:options;
 const adaptiveIso=preferRight&&Object.keys(frames).length>1&&drawingViewScaleOverride('iso',options)===undefined;
 const nominalIso=s=>drawingViewScale('iso',s,placementOptions);
 const minimumIso=s=>{
  const nominal=nominalIso(s);
  if(nominal<=minDrawingScale)return undefined;
  const limit=nominal/2;
  return largestFittingScale(value=>value<=limit+1e-12?true:null)?.scale??minDrawingScale;
 };
 const attempt=(s,right,autoIsoScale=placementOptions.autoIsoScale)=>{
  const nextOptions={...placementOptions,autoIsoScale};
  const nextFrames=drawingViewFrames(data,nextOptions,s);
  const resized=rescaleDrawingAnnotations(dimensions,nextFrames,scale,s,previousFrames),views=decoratedDrawingViews(nextFrames,s,resized,nextOptions);
  for(const column of noteColumns){
   const annotations=[];
   for(const [key,block] of [...column.map(note=>[note.id,note]),['holeTable',table]])if(block){
    const width=Math.max(block.width,Math.min(block.wrapWidth??0,maxNoteWidth))+2,height=block.height+2;
    annotations.push({key,box:{x:-1,y:-1,width,height},width,height});
   }
   const packWithGaps=(gaps,order=[])=>{
    const packCount=views.length+annotations.length-(right?1:0);
    const group=options.linkedProjections?linkedDrawingViews:order.length&&packCount>6?['front',...order]:null;
    const grouped=group?groupProjectionViews(views,nextFrames,s,gaps,group):views;
    const items=[...grouped,...annotations];
    if(items.length>24)throw Error('自動配置する図が多すぎます');
    const packed=packDrawingItems(items,area.width,area.height,right,gaps,group?[]:order);
    return packed?{items,packed,gaps}:null;
   };
   const layout=packWithGaps(minimumGaps);
   if(layout)return {...layout,packWithGaps,dimensions:resized,autoIsoScale};
  }
  return null;
 };
 const variable=Object.keys(frames).some(name=>drawingViewScaleOverride(name,placementOptions)===undefined&&
  (name!=='iso'||placementOptions.autoIsoScale===undefined));
 const solve=right=>{
  const fit=s=>attempt(s,right,right&&adaptiveIso?minimumIso(s):placementOptions.autoIsoScale);
  return !fixedScale&&variable?largestFittingScale(fit):{scale,result:fit(scale)};
 };
 let choice=solve(preferRight);
 // A full-width comment or hole table can leave no room for an isolated column.
 if(!choice?.result&&preferRight&&(notes.length||table))choice=solve(false);
 if(!choice?.result){
  if(fixedScale)return null;
  throw Error('文字・寸法・コメントを用紙に収められません。コメントを短くするか用紙を大きくしてください');
 }
 const {scale:nextScale}=choice;
 let {result}=choice;
 if(adaptiveIso&&result.autoIsoScale!==undefined){
  // Size the main views first, then use the rest of the right column for ISO.
  const nominal=nominalIso(nextScale);
  const full=attempt(nextScale,true);
  if(full)result=full;
  else{
   const larger=largestFittingScale(s=>s<nominal?attempt(nextScale,true,s):null);
   if(larger?.scale>result.autoIsoScale)result=larger.result;
  }
 }
 if(preferProjectionOrder&&!options.linkedProjections&&frames.front&&(frames.top||frames.right)){
  // Keep the fitted scales and test the preferred view order on the same sheet.
  const fitOrder=result.packWithGaps,order=['top','right'].filter(name=>frames[name]);
  const candidates=order.length>1?[order,['top'],['right']]:[order];
  for(const dirs of candidates){
   const packWithGaps=gaps=>fitOrder(gaps,dirs),ordered=packWithGaps(minimumGaps);
   if(ordered){result={...result,...ordered,packWithGaps};break;}
  }
 }
 const layout=spreadViews&&Object.keys(frames).length>1?spreadDrawingItems(result,area):result;
 const {gaps:[gapX,gapY],packed}=layout;
 const positions={},boxes=[],offset=[area.x+(area.width-(packed.w-gapX))/2,area.y+(area.height-(packed.h-gapY))/2];
 for(const block of layout.items){
  const [px,py]=packed.at[block.key];
  for(const item of block.children??[block]){
   const [dx,dy]=item.offset??[0,0],x=offset[0]+px+dx,y=offset[1]+py+dy;
   positions[item.key]=[x-item.box.x,y-item.box.y];
   boxes.push({key:item.key,x,y,width:item.width,height:item.height});
  }
 }
 return {scale:nextScale,positions,dimensions:result.dimensions,paper,layout:'compact',area,boxes,autoIsoScale:result.autoIsoScale};
}
