import {drawingProjectionNames,drawingViewFactor,drawingProjections,drawingScaleLabel} from './drawing-view-preferences.js';
import {withDetails,hatchPaths,annotationSVG} from './drawing-annotations.js';
import {drawingViewFrames} from './drawing-auto-layout.js';
import {commentLines} from './drawing-comments.js';
import {dimensionSVG,escapeDrawingText as esc} from './drawing-dimensions.js';
export function drawingSheet(data,scale=1,hidden=true,dimensions=[],comment='',options={}){
 options={paper:'A4',orientation:'landscape',...options};data=withDetails(data,options.details);
 if(!Number.isFinite(scale)||scale<=0)throw Error('縮尺を選択してください');
 const frames=drawingViewFrames(data,{...options,details:[]}),positions=options.positions||{};
 const sizeOf=(key,axis)=>frames[key]?frames[key][axis]*frames[key].factor*scale:0;
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
  if(f)layout[key]={x,y,bx:f.bx,by:f.by,width:sizeOf(key,'width'),height:sizeOf(key,'height'),scale:scale*f.factor};
 }
 const rightEdge=Math.max(left,...Object.values(layout).map(v=>v.x+v.width));
 const bottomEdge=Math.max(top,...Object.values(layout).map(v=>v.y+v.height));
 const paperSize=options.paper==='A4'?[297,210]:options.paper==='A3'?[420,297]:null,paperWidth=paperSize?(options.orientation==='portrait'?paperSize[1]:paperSize[0]):null;
 const commentSize=options.commentSize??3.5,lineHeight=commentSize*10/7;
 const baseWidth=Math.max(297,rightEdge+10),commentX=Math.max((paperWidth||baseWidth)-75,rightEdge+18),lines=comment.trim()?commentLines(comment,60,commentSize):[],note=lines.length?{x:positions.comment?.[0]??commentX,y:positions.comment?.[1]??23.5,width:60,height:commentSize*3.5+lines.length*lineHeight,lines}:null;
 let width=note?Math.max(baseWidth,note.x+75):baseWidth,height=Math.max(210,bottomEdge+36,note?note.y+note.height+20:0)+(options.frame?24:0);
 if(options.paper==='A4'||options.paper==='A3'){const size=options.paper==='A3'?[420,297]:[297,210];[width,height]=options.orientation==='portrait'?[size[1],size[0]]:size;}
 if(Math.max(width,height)>5000)throw Error('図面が大きすぎます。縮尺を小さくしてください');
 let extraX=20,extraY=bottomEdge+30,rowHeight=0;const extraNames=Object.keys(data.views).filter(k=>k!=='iso'&&!drawingProjectionNames.includes(k));
 for(const key of extraNames){const view=data.views[key],b=view.viewBox,s=scale*(view.factor||1),vw=b[2]*s,vh=b[3]*s;if(extraX>20&&extraX+vw>width-15){extraX=20;extraY+=rowHeight+25;rowHeight=0;}layout[key]={x:extraX,y:extraY,bx:b[0],by:b[1],width:vw,height:vh,scale:s};extraX+=vw+25;rowHeight=Math.max(rowHeight,vh);}
 if(options.paper==='auto'||!options.paper){height=Math.max(height,extraNames.length?extraY+rowHeight+(options.frame?42:20):0);width=Math.max(width,...extraNames.map(k=>layout[k].x+layout[k].width+20));}
 for(const [key,p] of Object.entries(positions))if(layout[key]){layout[key].x=p[0];layout[key].y=p[1];}
 if(Math.max(width,height)>5000)throw Error('図面が大きすぎます。縮尺を小さくしてください');
 const showsHidden=name=>options.hiddenViews?.[name]??hidden;
 const view=(name,label)=>{const {x,y,bx,by,scale:s}=layout[name],v=data.views[name],clip=v.clip,clipId='clip-'+name,paths=kind=>data.views[name][kind].map((p,i)=>'<path data-curve="'+i+'" d="'+esc(p)+'"/>').join('');return '<g data-view="'+name+'"><text x="'+x+'" y="'+(y-4)+'" font-size="3.5">'+label+(Math.abs(s-scale)>1e-10&&!name.startsWith('detail-')?' / SCALE '+drawingScaleLabel(s):'')+'</text><g transform="translate('+x+' '+y+') scale('+s+') translate('+(-bx)+' '+(-by)+')" fill="none" stroke-linejoin="round" stroke-linecap="round">'+(clip?'<defs><clipPath id="'+clipId+'"><circle cx="'+clip.center[0]+'" cy="'+clip.center[1]+'" r="'+clip.radius+'"/></clipPath></defs>':'')+'<g'+(clip?' clip-path="url(#'+clipId+')"':'')+'>'+ (v.triangles?'<path data-hatch="true" d="'+hatchPaths(v.triangles,s)+'" stroke="#777" stroke-width="'+(.15/s)+'"/>':'')+(showsHidden(name)?'<g data-hidden="true" stroke="#666666" stroke-width="'+(.18/s)+'" stroke-dasharray="'+(2/s)+' '+(1/s)+'">'+paths('hidden')+'</g>':'')+'<g stroke="#111111" stroke-width="'+(.3/s)+'">'+paths('visible')+'</g></g>'+(clip?'<circle cx="'+clip.center[0]+'" cy="'+clip.center[1]+'" r="'+clip.radius+'" stroke="#777" stroke-width="'+(.15/s)+'"/>':'')+'</g></g>';};
 const ratio=scale>=1?Number(scale.toFixed(4))+':1':'1:'+Number((1/scale).toFixed(4)),text=(x,y,t,size=3.5,attrs='')=>'<text x="'+x+'" y="'+y+'" font-size="'+size+'" '+attrs+'>'+esc(t)+'</text>';
 const commentSVG=note?'<g data-comment="true" font-family="sans-serif">'+text(note.x,note.y+commentSize,'コメント',commentSize,'font-weight="bold"')+note.lines.map((line,i)=>text(note.x,note.y+commentSize*18/7+i*lineHeight,line,commentSize,'xml:space="preserve"')).join('')+'</g>':'';
 let frame='';if(options.frame){const fx=Math.max(10,width-165),fy=height-32;frame='<g data-titleblock="true" font-family="sans-serif"><rect x="5" y="5" width="'+(width-10)+'" height="'+(height-10)+'" fill="none" stroke="#111" stroke-width=".3"/><rect x="'+fx+'" y="'+fy+'" width="160" height="27" fill="white" stroke="#111" stroke-width=".25"/>';for(const [i,key,label] of [[0,'name','部品名'],[1,'material','材質'],[2,'date','作成日']]){const y=fy+i*9;frame+='<path d="M '+fx+' '+y+' H '+(fx+160)+' M '+(fx+25)+' '+y+' V '+(y+9)+'" fill="none" stroke="#111" stroke-width=".18"/>'+text(fx+3,y+5.5,label,3);const rows=commentLines(options[key]||'',128,2.8).slice(0,2);rows.forEach((r,j)=>frame+=text(fx+28,y+3.5+j*3.5,r,2.8));}frame+='</g>';}
 const baseViews=[...drawingProjectionNames,'iso'].filter(key=>layout[key]).map(key=>view(key,drawingProjections[key]?.label??'ISOMETRIC')).join('');
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'mm" height="'+height+'mm" viewBox="0 0 '+width+' '+height+'" data-layout="'+(options.layout==='compact'?'compact':'projection')+'"><rect width="100%" height="100%" fill="white"/><g font-family="Helvetica,Arial,sans-serif" fill="#111111">'+text(15,12,options.layout==='compact'?'FORMA CAD / AUTO LAYOUT':layout.front&&drawingViewFactor('front',options)!==1?'FORMA CAD / VIEW LAYOUT':'FORMA CAD / THIRD ANGLE',4.5)+text(width-15,12,'SCALE '+ratio+' / mm',3.5,'text-anchor="end"')+baseViews+extraNames.map(key=>{const si=(options.sections||[]).findIndex(s=>s.id===key),di=(options.details||[]).findIndex(d=>d.id===key),s=layout[key].scale,ratio=s>=1?s+':1':'1:'+Number((1/s).toFixed(3));return view(key,si>=0?'断面 '+String.fromCharCode(65+si)+'–'+String.fromCharCode(65+si):'詳細 D'+(di+1)+' / '+ratio);}).join('')+annotationSVG(options,layout)+commentSVG+dimensions.map((d,i)=>layout[d.view]?dimensionSVG(d,layout[d.view],layout[d.view].scale,i,options.dimensionColors):'').join('')+(options.frame?'':text(15,height-8,data.bodyCount+' BODY / '+(Object.keys(layout).some(showsHidden)?'DASHED: HIDDEN EDGES':'VISIBLE EDGES ONLY'),3))+frame+'</g></svg>';
 return {svg,width,height,layout,note,contentBottom:height-(options.frame?35:12)};
}
