import {drawingDimensionVisible,drawingPaperPoint} from './drawing-break.js';

export const canOverrideDrawingDimensionValue=d=>!!d&&!d.repeat&&['horizontal','vertical','aligned'].includes(d.kind);
export const validDrawingDimensionDisplayValue=value=>Number.isFinite(value)&&value>0;
function numberLabel(d){
 const value=d.displayValue??dimensionValue(d);
 if(d.precision!=null)return value.toFixed(d.precision);
 return d.displayValue===undefined?String(Number(value.toFixed(3))):String(value);
}
export const escapeDrawingText=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export function dimensionLabel(d){
 if(d.review)return '要確認';
 const value=numberLabel(d);
 const nominal=d.repeat?d.repeat.count+'×'+(d.precision==null?Number(d.repeat.pitch.toFixed(3)):d.repeat.pitch.toFixed(d.precision))+' = '+value:
  (['diameter','radius'].includes(d.kind)?(d.count>1?d.count+'×':'')+(d.kind==='diameter'?'Ø':'R'):'')+value+(d.kind==='angle'?'°':'');
 const tolerance=d.tolerance===undefined?'':' ±'+d.tolerance+(d.kind==='angle'?'°':'');
 return nominal+tolerance+(d.note?' '+d.note:'');
}
export function dimensionLabelWidth(label,font){
 return [...label].reduce((width,char)=>width+(char.codePointAt(0)>0xff?1:.6)*font,2);
}
export const defaultDrawingDimensionColor='#24455b';
export const validDimensionColor=value=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value);
export function drawingDimensionColor(key,d,defaults){
 return [d?.[key],defaults?.[key]].find(validDimensionColor)??defaultDrawingDimensionColor;
}
function dimensionText(d,x,y,color){
 const font=d.fontSize??3.2,label=dimensionLabel(d),width=dimensionLabelWidth(label,font);
 return '<rect x="'+(x-width/2)+'" y="'+(y-font*.75)+'" width="'+width+'" height="'+(font*1.45)+'" fill="white" stroke="none"/>'+
  '<text x="'+x+'" y="'+(y+font*.31)+'" text-anchor="middle" font-size="'+font+'" fill="'+color+'" stroke="none">'+escapeDrawingText(label)+'</text>';
}
function dimensionGroup(d,index,paths,colors,geometry,inherited){
 const [x,y]=geometry.at;
 const target=inherited?'data-detail-dimension="'+escapeDrawingText(d.view)+'" data-detail-dimension-index="'+index+'" pointer-events="none"':'data-dimension="'+index+'"';
 return '<g '+target+(geometry.outside?' data-dimension-outside="true"':'')+(d.review?' data-dimension-review="true" stroke-dasharray="2 1"':'')+
  ' stroke="'+colors.line+'" stroke-width=".18" fill="none">'+paths+dimensionText(d,x,y,colors.text)+'</g>';
}
export function dimensionValue(d){
 if(d.view==='iso'&&d.modelA&&d.modelB)return Math.hypot(...d.modelB.map((value,axis)=>value-d.modelA[axis]));
 if(d.kind==='diameter')return d.radius*2;
 if(d.kind==='radius')return d.radius;
 if(d.kind==='angle'){
  const a=[d.a[0]-d.vertex[0],d.a[1]-d.vertex[1]],b=[d.b[0]-d.vertex[0],d.b[1]-d.vertex[1]];
  return Math.acos(Math.max(-1,Math.min(1,(a[0]*b[0]+a[1]*b[1])/(Math.hypot(...a)*Math.hypot(...b)))))*180/Math.PI;
 }
 const dx=d.b[0]-d.a[0],dy=d.b[1]-d.a[1];
 return d.kind==='horizontal'?Math.abs(dx):d.kind==='vertical'?Math.abs(dy):Math.hypot(dx,dy);
}
const add=(p,u,k)=>[p[0]+u[0]*k,p[1]+u[1]*k];
const arrowLength=2;
function arrowPoints(tip,direction){
 const base=add(tip,direction,arrowLength),normal=[-direction[1],direction[0]];
 return [tip,add(base,normal,.7),add(base,normal,-.7)];
}
export function drawingDimensionGeometry(d,view,scale=view.scale){
 if(!drawingDimensionVisible(d,view))return null;
 const map=p=>drawingPaperPoint(view,p),at=map(d.at);
 if(d.kind==='angle'){
  const center=map(d.vertex),a=map(d.a),b=map(d.b),start=Math.atan2(a[1]-center[1],a[0]-center[0]);
  let sweep=Math.atan2(b[1]-center[1],b[0]-center[0])-start;
  while(sweep>Math.PI)sweep-=2*Math.PI;
  while(sweep<-Math.PI)sweep+=2*Math.PI;
  const end=start+sweep,radius=Math.max(4,Math.hypot(at[0]-center[0],at[1]-center[1]));
  const point=t=>add(center,[Math.cos(t),Math.sin(t)],radius);
  const first=point(start),last=point(end),direction=Math.sign(sweep);
  return {at:point(start+sweep/2),main:[],extensions:[[center,first],[center,last]],
   arrows:[arrowPoints(first,[-Math.sin(start)*direction,Math.cos(start)*direction]),
    arrowPoints(last,[Math.sin(end)*direction,-Math.cos(end)*direction])],
   arc:{first,last,center,start,sweep,radius}};
 }
 if(d.kind==='radius'||d.kind==='diameter'){
  const center=map(d.center),length=Math.hypot(at[0]-center[0],at[1]-center[1])||1;
  const u=[(at[0]-center[0])/length,(at[1]-center[1])/length],radius=d.radius*scale;
  const tip=d.arcPoint?map(d.arcPoint):add(center,u,radius);
  const radial=d.arcPoint?tip.map((n,i)=>(n-center[i])/radius):u;
  const far=add(center,u,-radius),diameter=d.kind==='diameter';
  return {at,main:[],extensions:[[tip,at],[diameter?far:center,tip]],
   arrows:diameter?[arrowPoints(tip,radial),arrowPoints(far,u)]:[arrowPoints(tip,radial)]};
 }
 const a=map(d.a),b=map(d.b);
 let u;
 if(d.kind==='horizontal')u=[Math.sign(b[0]-a[0])||1,0];
 else if(d.kind==='vertical')u=[0,Math.sign(b[1]-a[1])||1];
 else {
  const length=Math.hypot(b[0]-a[0],b[1]-a[1]);
  if(length<1e-8)return null;
  u=[(b[0]-a[0])/length,(b[1]-a[1])/length];
 }
 const n=[-u[1],u[0]],offset=(at[0]-a[0])*n[0]+(at[1]-a[1])*n[1];
 const along=(d.alongOffset??0)*scale;
 const span=(b[0]-a[0])*u[0]+(b[1]-a[1])*u[1];
 const q=add(add(a,n,offset),u,along),r=add(q,u,span);
 const overrun=Math.sign(offset)*1.5;
 const extensionEnd=(origin,tip)=>{
  if(!along)return add(tip,n,overrun);
  const dx=tip[0]-origin[0],dy=tip[1]-origin[1],length=Math.hypot(dx,dy)||1;
  return add(tip,[dx/length,dy/length],1.5);
 };
 const labelCenter=[(q[0]+r[0])/2,(q[1]+r[1])/2],reverse=[-u[0],-u[1]];
 const extensions=[[a,extensionEnd(a,q)],[b,extensionEnd(b,r)]];
 const font=d.fontSize??3.2,half=dimensionLabelWidth(dimensionLabel(d),font)/2;
 const labelAlong=Math.abs(u[0])*half+Math.abs(u[1])*font*.75;
 if(span>1e-8&&span<2*(arrowLength+labelAlong+.6)){
  const center=[view.x+(view.width??0)/2,view.y+(view.height??0)/2];
  const towardCenter=center.map((value,i)=>value-(a[i]+b[i])/2);
  // Prefer the extension towards the rest of the view, leaving more room at the sheet edge.
  const side=towardCenter[0]*u[0]+towardCenter[1]*u[1]<0?-1:1,tail=arrowLength+1;
  return {outside:true,at:add(side>0?r:q,u,side*(tail+labelAlong+.6)),direction:u,
   main:[[add(q,u,-tail),add(r,u,tail)]],extensions,arrows:[arrowPoints(q,reverse),arrowPoints(r,u)]};
 }
 return {at:labelCenter,direction:u,main:[[q,r]],extensions,arrows:[arrowPoints(q,u),arrowPoints(r,reverse)]};
}
export function dimensionSVG(d,view,scale,index,defaults,{inherited=false}={}){
 const geometry=drawingDimensionGeometry(d,view,scale);
 if(!geometry)return '';
 const colors=d.review?{line:'#a85014',text:'#a85014'}:{
  line:drawingDimensionColor('lineColor',d,defaults),text:drawingDimensionColor('textColor',d,defaults),
 };
 const path=points=>'M '+points.map(p=>p.join(' ')).join(' L ');
 let paths=[...geometry.extensions,...geometry.main].map(points=>'<path d="'+path(points)+'"/>').join('');
 if(geometry.arc){
  const {first,last,radius,sweep}=geometry.arc;
  paths+='<path d="M '+first.join(' ')+' A '+radius+' '+radius+' 0 0 '+(sweep>0?1:0)+' '+last.join(' ')+'"/>';
 }
 paths+=geometry.arrows.map(points=>'<path d="'+path(points)+' Z" fill="'+colors.line+'"/>').join('');
 return dimensionGroup(d,index,paths,colors,geometry,inherited);
}
// Endpoints of SVG line, arc and Bezier segments; these are model-space coordinates.
export function pathEndpoints(paths){const points=[];for(const path of paths){const tokens=path.match(/[a-zA-Z]|[-+]?(?:\d*\.)?\d+(?:[eE][-+]?\d+)?/g)||[];let i=0,command='';while(i<tokens.length){if(/^[a-zA-Z]$/.test(tokens[i]))command=tokens[i++];const count={M:2,L:2,A:7,C:6,Q:4}[command];if(!count){if(command==='Z'||command==='z'){command='';continue;}break;}if(i+count>tokens.length)break;const values=tokens.slice(i,i+count).map(Number);if(values.some(v=>!Number.isFinite(v)))break;points.push(values.slice(-2));i+=count;}}return [...new Map(points.map(p=>[p.join(','),p])).values()];}
