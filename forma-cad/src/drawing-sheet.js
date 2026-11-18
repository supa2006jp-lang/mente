import {drawingProjectionNames,drawingViewFactor,drawingViewVisible} from './drawing-view-preferences.js';
import {withDetails,hatchPaths,annotationSVG} from './drawing-annotations.js';
import {drawingViewFrames} from './drawing-auto-layout.js';
import {commentLines,defaultDrawingCommentColor,drawingCommentFamily,drawingCommentEntries} from './drawing-comments.js';
import {dimensionSVG,escapeDrawingText as esc,validDimensionColor} from './drawing-dimensions.js';
import {dimensionPlacement} from './drawing-dimension-layout.js';
import {drawingViewTitle,drawingViewTitleSVG} from './drawing-view-title.js';
import {displayedDrawingSpan,drawingPaperPoint,fullDrawingSpan} from './drawing-break.js';
import {drawingHoleMarkersSVG,drawingHoleTableSize,drawingHoleTableSVG,resolveDrawingHoleTable} from './drawing-hole-table.js';
import {drawingLeaderLayout,drawingLeadersSVG} from './drawing-leaders.js';

const backgroundColor=value=>validDimensionColor(value)&&value.toLowerCase()!=='#ffffff'?value.toLowerCase():null;
export const drawingBackgroundColor=options=>backgroundColor(options.viewBackground)??backgroundColor(options.paperBackground);

export function drawingFileStem(name='',revision=''){
 const clean=value=>value.trim().replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g,'_').replace(/[. ]+$/,'');
 const part=clean(name)||'three-views',rev=clean(revision.trim().replace(/^rev(?:ision)?[\s._-]*/i,'').trim());
 const suffix=rev?'_Rev'+rev:'',encoder=new TextEncoder();
 // Leave room for the extension and keep the revision when a UTF-8 filename is long.
 let stem='',remaining=250-encoder.encode(suffix).length;
 for(const char of part){
  remaining-=encoder.encode(char).length;
  if(remaining<0)break;
  stem+=char;
 }
 stem=stem.replace(/[. ]+$/,'')+suffix;
 return /^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(stem)?'_'+stem:stem;
}

function viewBackgroundSVG(name,boxes,fill){
 const margin=2,x=Math.min(...boxes.map(b=>b.x))-margin,y=Math.min(...boxes.map(b=>b.y))-margin;
 const width=Math.max(...boxes.map(b=>b.x+b.width))+margin-x,height=Math.max(...boxes.map(b=>b.y+b.height))+margin-y;
 return '<rect data-view-background="'+name+'" x="'+x+'" y="'+y+'" width="'+width+'" height="'+height+'" fill="'+fill+'" pointer-events="none"/>';
}

function splitViewGeometry(name,view,content){
 const cut=view.break,axis=cut.direction,bounds=[view.bx,view.by],pad=1/view.scale;
 const regions=[[bounds[axis]-pad,cut.start],[cut.end,bounds[axis]+fullDrawingSpan(view,axis)+pad]];
 const rects=regions.map(([start,end],i)=>{
  const corner=bounds.map((n,j)=>j===axis?start:n-pad);
  const span=[0,1].map(j=>j===axis?end-start:fullDrawingSpan(view,j)+2*pad);
  return '<clipPath id="break-'+name+'-'+i+'"><rect x="'+corner[0]+'" y="'+corner[1]+'" width="'+span[0]+'" height="'+span[1]+'"/></clipPath>';
 });
 const left='<g clip-path="url(#break-'+name+'-0)">'+content+'</g>';
 const shift=axis?'0 '+(-cut.removed):(-cut.removed)+' 0';
 const right='<g transform="translate('+shift+')"><g clip-path="url(#break-'+name+'-1)">'+content+'</g></g>';
 return '<defs>'+rects.join('')+'</defs>'+left+right;
}
function viewBreakMarks(view){
 const cut=view.break,axis=cut.direction,across=axis?view.width:view.height;
 const amplitude=Math.min(1,cut.gap*view.scale*.3,across*.2);
 const paths=[cut.start,cut.end].map((value,index)=>{
  const model=[view.bx,view.by];model[axis]=value;
  const p=drawingPaperPoint(view,model);
  const points=[[0,0],[0,across*.35],[-amplitude,across*.45],[amplitude,across*.55],[0,across*.65],[0,across]];
  return '<path data-break-edge="'+index+'" d="M '+points.map(([shift,along])=>axis?[p[0]+along,p[1]+shift]:[p[0]+shift,p[1]+along]).map(pair=>pair.join(' ')).join(' L ')+'"/>';
 });
 return '<g data-break-marks="true" data-break-direction="'+axis+'" fill="none" stroke="#111" stroke-width=".35">'+paths.join('')+'</g>';
}
export function drawingSheet(data,scale=1,hidden=true,dimensions=[],comment='',options={}){
 options={paper:'A4',orientation:'landscape',...options};data=withDetails(data,options.details);
 options.holeTable=resolveDrawingHoleTable(options.holeTable,data.views);
 if(!Number.isFinite(scale)||scale<=0)throw Error('縮尺を選択してください');
 const frames=drawingViewFrames(data,{...options,details:[]},scale),positions=options.positions||{};
 const sizeOf=(key,axis)=>frames[key]?displayedDrawingSpan(frames[key],axis==='width'?0:1)*frames[key].factor*scale:0;
 const columnWidth=Math.max(...['top','front','bottom'].map(key=>sizeOf(key,'width')));
 const upperHeight=Math.max(sizeOf('top','height'),sizeOf('iso','height'));
 const middleHeight=Math.max(...['left','front','right','back'].map(key=>sizeOf(key,'height')));
 const left=20,top=27,mainX=left+(frames.left?sizeOf('left','width')+20:0);
 const rightX=mainX+columnWidth+(columnWidth?20:0),frontY=top+upperHeight+(upperHeight?24:0);
 const projectionPositions={
  top:[mainX,top],front:[mainX,frontY],right:[rightX,frontY],left:[left,frontY],
  back:[rightX+(frames.right?sizeOf('right','width')+20:0),frontY],
  bottom:[mainX,frontY+middleHeight+(middleHeight?24:0)],iso:[rightX,top],
 };
 const layout={};
 for(const [key,[x,y]] of Object.entries(projectionPositions)){
  const f=frames[key];
  if(f)layout[key]={x,y,bx:f.bx,by:f.by,width:sizeOf(key,'width'),height:sizeOf(key,'height'),scale:scale*f.factor,break:f.break};
 }
 const rightEdge=Math.max(left,...Object.values(layout).map(v=>v.x+v.width));
 const bottomEdge=Math.max(top,...Object.values(layout).map(v=>v.y+v.height));
 const paperSize=options.paper==='A4'?[297,210]:options.paper==='A3'?[420,297]:null,paperWidth=paperSize?(options.orientation==='portrait'?paperSize[1]:paperSize[0]):null;
 const baseWidth=Math.max(297,rightEdge+10),commentX=Math.max((paperWidth||baseWidth)-75,rightEdge+18);
 let commentY=23.5;
 const notes=drawingCommentEntries(comment,options).map(note=>{
  const placed={...note,x:positions[note.id]?.[0]??commentX,y:positions[note.id]?.[1]??commentY};
  commentY+=note.height+5;
  return placed;
 });
 const note=notes.find(note=>note.id==='comment')??null;
 let width=Math.max(baseWidth,...notes.map(note=>note.x+75)),height=Math.max(210,bottomEdge+36,...notes.map(note=>note.y+note.height+20))+(options.frame?24:0);
 if(options.paper==='A4'||options.paper==='A3'){const size=options.paper==='A3'?[420,297]:[297,210];[width,height]=options.orientation==='portrait'?[size[1],size[0]]:size;}
 if(Math.max(width,height)>5000)throw Error('図面が大きすぎます。縮尺を小さくしてください');
 let extraX=20,extraY=bottomEdge+30,rowHeight=0;const extraNames=Object.keys(data.views).filter(k=>k!=='iso'&&!drawingProjectionNames.includes(k)&&drawingViewVisible(k,options));
 for(const key of extraNames){const view=data.views[key],b=view.viewBox,s=scale*frames[key].factor,vw=b[2]*s,vh=b[3]*s;if(extraX>20&&extraX+vw>width-15){extraX=20;extraY+=rowHeight+25;rowHeight=0;}layout[key]={x:extraX,y:extraY,bx:b[0],by:b[1],width:vw,height:vh,scale:s};extraX+=vw+25;rowHeight=Math.max(rowHeight,vh);}
 if(options.paper==='auto'||!options.paper){height=Math.max(height,extraNames.length?extraY+rowHeight+(options.frame?42:20):0);width=Math.max(width,...extraNames.map(k=>layout[k].x+layout[k].width+20));}
 for(const [key,p] of Object.entries(positions))if(layout[key]){layout[key].x=p[0];layout[key].y=p[1];}
 const tableSize=options.pageHoleTable===false?null:drawingHoleTableSize(options.holeTable,options.pageHoleTable?{[options.holeTable?.view]:true}:layout);
 const holeBox=tableSize?{...tableSize,x:positions.holeTable?.[0]??Math.max(rightEdge+12,width-tableSize.width-12),y:positions.holeTable?.[1]??24}:null;
 if(holeBox&&options.paper==='auto'){
  width=Math.max(width,holeBox.x+holeBox.width+8);
  height=Math.max(height,holeBox.y+holeBox.height+(options.frame?40:18));
 }
 if(Math.max(width,height)>5000)throw Error('図面が大きすぎます。縮尺を小さくしてください');
 const viewColor=backgroundColor(options.viewBackground),color=drawingBackgroundColor(options),paperColor=viewColor?'white':color??'white';
 const leaders=options.leaders||[],leaderGeometry=leaders.map(note=>[note.view,drawingLeaderLayout(note,layout[note.view])]);
 const leaderLabels=leaderGeometry.map(([,geometry])=>geometry?.label).filter(Boolean);
 const viewBoxes={};
 const titles=Object.fromEntries(Object.entries(layout).map(([name,view])=>[name,drawingViewTitle(name,view,scale,options)]));
 const viewTitles=Object.fromEntries(Object.entries(titles).map(([name,title])=>[name,title.bounds]));
 if(viewColor){
  for(const [name,{x,y,width,height}] of Object.entries(layout))viewBoxes[name]=[{x,y,width,height},viewTitles[name]];
  for(const [name,geometry] of leaderGeometry)if(geometry)viewBoxes[name].push(geometry.bounds);
  for(const d of dimensions){
   const p=dimensionPlacement(d,{layout});
   if(p)viewBoxes[d.view].push(p.box,...p.main,...p.extensions,...p.arrowBoxes);
  }
 }
 const showsHidden=name=>options.hiddenViews?.[name]??hidden;
 const view=name=>{
  const layoutView=layout[name],{x,y,bx,by,scale:s}=layoutView,v=data.views[name],clip=v.clip,clipId='clip-'+name;
  const paths=kind=>v[kind].map((p,i)=>'<path data-curve="'+i+'" d="'+esc(p)+'"/>').join('');
  const silhouette=color&&v.silhouette?
   '<path data-drawing-silhouette="true" d="'+esc(v.silhouette)+'" fill="white" fill-rule="evenodd" pointer-events="none"/>':'';
  const geometry=silhouette+(v.triangles?'<path data-hatch="true" d="'+hatchPaths(v.triangles,s)+'" stroke="#777" stroke-width="'+(.15/s)+'"/>':'')+
   (showsHidden(name)?'<g data-hidden="true" stroke="#666666" stroke-width="'+(.18/s)+'" stroke-dasharray="'+(2/s)+' '+(1/s)+'">'+paths('hidden')+'</g>':'')+
   '<g stroke="#111111" stroke-width="'+(.3/s)+'">'+paths('visible')+'</g>';
  const body=layoutView.break?splitViewGeometry(name,layoutView,geometry):
   clip?'<defs><clipPath id="'+clipId+'"><circle cx="'+clip.center[0]+'" cy="'+clip.center[1]+'" r="'+clip.radius+'"/></clipPath></defs><g clip-path="url(#'+clipId+')">'+geometry+
    '</g><circle cx="'+clip.center[0]+'" cy="'+clip.center[1]+'" r="'+clip.radius+'" stroke="#777" stroke-width="'+(.15/s)+'"/>':'<g>'+geometry+'</g>';
  return '<g data-view="'+name+'">'+drawingViewTitleSVG(titles[name])+'<g transform="translate('+x+' '+y+') scale('+s+') translate('+(-bx)+' '+(-by)+')" fill="none" stroke-linejoin="round" stroke-linecap="round">'+body+'</g>'+
   (layoutView.break?viewBreakMarks(layoutView):'')+'</g>';
 };
 const ratio=scale>=1?Number(scale.toFixed(4))+':1':'1:'+Number((1/scale).toFixed(4)),text=(x,y,t,size=3.5,attrs='')=>'<text x="'+x+'" y="'+y+'" font-size="'+size+'" '+attrs+'>'+esc(t)+'</text>';
 const commentSVG=notes.map(note=>{
  const color=validDimensionColor(note.color)?note.color:defaultDrawingCommentColor;
  return '<g data-comment="'+(note.id==='comment'?'true':note.id)+'" fill="'+color+'" font-family="'+esc(drawingCommentFamily(note.font))+'">'+
   note.lines.map((line,i)=>text(note.x,note.y+note.baseline+i*note.lineHeight,line,note.fontSize,'xml:space="preserve"')).join('')+'</g>';
 }).join('');
 const titleBlock=options.frame?{x:Math.max(10,width-165),y:height-32,width:160,height:27}:null;
 let frame='';if(titleBlock){const {x:fx,y:fy,width:fw,height:fh}=titleBlock;frame='<g data-titleblock="true" font-family="sans-serif"><rect x="5" y="5" width="'+(width-10)+'" height="'+(height-10)+'" fill="none" stroke="#111" stroke-width=".3"/><rect x="'+fx+'" y="'+fy+'" width="'+fw+'" height="'+fh+'" fill="white" stroke="#111" stroke-width=".25"/>';for(const [i,key,label] of [[0,'name','部品名'],[1,'material','材質'],[2,'date','作成日']]){const y=fy+i*9;frame+='<path d="M '+fx+' '+y+' H '+(fx+fw)+' M '+(fx+25)+' '+y+' V '+(y+9)+'" fill="none" stroke="#111" stroke-width=".18"/>'+text(fx+3,y+5.5,label,3);const rows=commentLines(options[key]||'',128,2.8).slice(0,2);rows.forEach((r,j)=>frame+=text(fx+28,y+3.5+j*3.5,r,2.8));}
  if(options.revision?.trim()){
   const x=fx+77,y=fy+18;
   frame+='<path d="M '+x+' '+y+' v 9 M '+(x+22)+' '+y+' v 9" fill="none" stroke="#111" stroke-width=".18"/>'+text(x+3,y+5.5,'改訂番号',3);
   commentLines(options.revision.trim(),fw-102,2.8).slice(0,2).forEach((row,i)=>frame+=text(x+25,y+3.5+i*3.5,row,2.8));
  }
  frame+='</g>';
 }
 const baseViews=[...drawingProjectionNames,'iso'].filter(key=>layout[key]).map(view).join('');
 const extraViews=extraNames.map(view).join('');
 const backgrounds=viewColor?Object.entries(viewBoxes).map(([name,boxes])=>viewBackgroundSVG(name,boxes,viewColor)).join(''):'';
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'mm" height="'+height+'mm" viewBox="0 0 '+width+' '+height+'" data-layout="'+(options.layout==='compact'?'compact':'projection')+'"><rect data-paper-background="true" width="'+width+'" height="'+height+'" fill="'+paperColor+'"/>'+backgrounds+'<g font-family="Helvetica,Arial,sans-serif" fill="#111111">'+text(15,12,options.layout==='compact'?'FORMA CAD / AUTO LAYOUT':layout.front&&drawingViewFactor('front',options)!==1?'FORMA CAD / VIEW LAYOUT':'FORMA CAD / THIRD ANGLE',4.5)+text(width-15,12,options.pageViews?.length===0?'mm':'SCALE '+ratio+' / mm',3.5,'text-anchor="end"')+baseViews+extraViews+annotationSVG(options,layout)+drawingLeadersSVG(leaders,layout)+drawingHoleMarkersSVG(options.holeTable,layout[options.holeTable?.view])+commentSVG+drawingHoleTableSVG(options.holeTable,holeBox)+dimensions.map((d,i)=>layout[d.view]?dimensionSVG(d,layout[d.view],layout[d.view].scale,i,options.dimensionColors):'').join('')+(options.frame?'':text(15,height-8,data.bodyCount+' BODY / '+(Object.keys(layout).some(showsHidden)?'DASHED: HIDDEN EDGES':'VISIBLE EDGES ONLY'),3))+frame+(options.pageCount>1?text(options.frame?15:width-15,height-7,options.pageNumber+' / '+options.pageCount,2.8,(options.frame?'':'text-anchor="end" ')+'data-page-number="true"'):'')+'</g></svg>';
 return {svg,fileStem:drawingFileStem(options.name,options.revision),width,height,layout,viewTitles,note,notes,holeBox,leaderLabels,titleBlock,contentBottom:height-(options.frame?35:12)};
}
