import {drawingDimensionVisible,drawingPaperPoint} from './drawing-break.js';

const numberLabel=d=>d.precision==null?String(Number(dimensionValue(d).toFixed(3))):dimensionValue(d).toFixed(d.precision);
export const escapeDrawingText=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export function dimensionLabel(d){
 if(d.review)return '要確認';
 const value=numberLabel(d);
 const nominal=d.repeat?d.repeat.count+'×'+(d.precision==null?Number(d.repeat.pitch.toFixed(3)):d.repeat.pitch.toFixed(d.precision))+' = '+value:
  (d.kind==='diameter'?(d.count>1?d.count+'×':'')+'Ø':d.kind==='radius'?'R':'')+value+(d.kind==='angle'?'°':'');
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
function dimensionGroup(d,index,paths,colors,x,y){
 return '<g data-dimension="'+index+'"'+(d.review?' data-dimension-review="true" stroke-dasharray="2 1"':'')+
  ' stroke="'+colors.line+'" stroke-width=".18" fill="none">'+paths+dimensionText(d,x,y,colors.text)+'</g>';
}
export function dimensionValue(d){if(d.kind==='diameter')return d.radius*2;if(d.kind==='radius')return d.radius;if(d.kind==='angle'){const a=[d.a[0]-d.vertex[0],d.a[1]-d.vertex[1]],b=[d.b[0]-d.vertex[0],d.b[1]-d.vertex[1]];return Math.acos(Math.max(-1,Math.min(1,(a[0]*b[0]+a[1]*b[1])/(Math.hypot(...a)*Math.hypot(...b)))))*180/Math.PI;}const dx=d.b[0]-d.a[0],dy=d.b[1]-d.a[1];return d.kind==='horizontal'?Math.abs(dx):d.kind==='vertical'?Math.abs(dy):Math.hypot(dx,dy);}
export function dimensionSVG(d,view,scale,index,defaults){
 if(!drawingDimensionVisible(d,view))return '';
 const colors=d.review?{line:'#a85014',text:'#a85014'}:{
  line:drawingDimensionColor('lineColor',d,defaults),text:drawingDimensionColor('textColor',d,defaults),
 };
 if(['diameter','radius','angle'].includes(d.kind))return specialDimension(d,view,scale,index,colors);
 const a=drawingPaperPoint(view,d.a),b=drawingPaperPoint(view,d.b),at=drawingPaperPoint(view,d.at);let u;
 if(d.kind==='horizontal')u=[Math.sign(b[0]-a[0])||1,0];else if(d.kind==='vertical')u=[0,Math.sign(b[1]-a[1])||1];else{const len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len<1e-8)return '';u=[(b[0]-a[0])/len,(b[1]-a[1])/len];}
 const n=[-u[1],u[0]],offset=(at[0]-a[0])*n[0]+(at[1]-a[1])*n[1],q=[a[0]+n[0]*offset,a[1]+n[1]*offset],span=(b[0]-a[0])*u[0]+(b[1]-a[1])*u[1],r=[q[0]+u[0]*span,q[1]+u[1]*span];
 const line=(p,t)=>'<path d="M '+p.join(' ')+' L '+t.join(' ')+'"/>',arrow=(p,dir)=>'<path d="M '+p.join(' ')+' L '+[p[0]+dir*u[0]*2+n[0]*.7,p[1]+dir*u[1]*2+n[1]*.7].join(' ')+' L '+[p[0]+dir*u[0]*2-n[0]*.7,p[1]+dir*u[1]*2-n[1]*.7].join(' ')+' Z" fill="'+colors.line+'"/>';
 const paths=line(a,[q[0]+n[0]*Math.sign(offset)*1.5,q[1]+n[1]*Math.sign(offset)*1.5])+line(b,[r[0]+n[0]*Math.sign(offset)*1.5,r[1]+n[1]*Math.sign(offset)*1.5])+line(q,r)+arrow(q,1)+arrow(r,-1);
 return dimensionGroup(d,index,paths,colors,(q[0]+r[0])/2,(q[1]+r[1])/2);
}
// Endpoints of SVG line, arc and Bezier segments; these are model-space coordinates.
export function pathEndpoints(paths){const points=[];for(const path of paths){const tokens=path.match(/[a-zA-Z]|[-+]?(?:\d*\.)?\d+(?:[eE][-+]?\d+)?/g)||[];let i=0,command='';while(i<tokens.length){if(/^[a-zA-Z]$/.test(tokens[i]))command=tokens[i++];const count={M:2,L:2,A:7,C:6,Q:4}[command];if(!count){if(command==='Z'||command==='z'){command='';continue;}break;}if(i+count>tokens.length)break;const values=tokens.slice(i,i+count).map(Number);if(values.some(v=>!Number.isFinite(v)))break;points.push(values.slice(-2));i+=count;}}return [...new Map(points.map(p=>[p.join(','),p])).values()];}

function specialDimension(d,v,s,index,colors){const map=p=>drawingPaperPoint(v,p),at=map(d.at),line=(a,b)=>'<path d="M '+a.join(' ')+' L '+b.join(' ')+'"/>',arrow=(p,u)=>'<path d="M '+p.join(' ')+' l '+(u[0]*2-u[1]*.7)+' '+(u[1]*2+u[0]*.7)+' l '+(u[1]*1.4)+' '+(-u[0]*1.4)+' Z" fill="'+colors.line+'"/>';let paths='';
 if(d.kind==='angle'){const c=map(d.vertex),a=map(d.a),b=map(d.b),ta=Math.atan2(a[1]-c[1],a[0]-c[0]);let delta=Math.atan2(b[1]-c[1],b[0]-c[0])-ta;while(delta>Math.PI)delta-=2*Math.PI;while(delta<-Math.PI)delta+=2*Math.PI;const r=Math.max(4,Math.hypot(at[0]-c[0],at[1]-c[1])),pt=t=>[c[0]+r*Math.cos(t),c[1]+r*Math.sin(t)],q=pt(ta),z=pt(ta+delta),mid=pt(ta+delta/2);paths=line(c,q)+line(c,z)+'<path d="M '+q.join(' ')+' A '+r+' '+r+' 0 0 '+(delta>0?1:0)+' '+z.join(' ')+'"/>'+arrow(q,[-Math.sin(ta)*Math.sign(delta),Math.cos(ta)*Math.sign(delta)])+arrow(z,[Math.sin(ta+delta)*Math.sign(delta),-Math.cos(ta+delta)*Math.sign(delta)]);at[0]=mid[0];at[1]=mid[1];}
 else{const c=map(d.center),len=Math.hypot(at[0]-c[0],at[1]-c[1])||1,u=[(at[0]-c[0])/len,(at[1]-c[1])/len],tip=d.arcPoint?map(d.arcPoint):[c[0]+u[0]*d.radius*s,c[1]+u[1]*d.radius*s];const radial=d.arcPoint?tip.map((x,i)=>(x-c[i])/(d.radius*s)):u;paths=line(tip,at)+arrow(tip,radial);if(d.kind==='diameter'){const far=[c[0]-u[0]*d.radius*s,c[1]-u[1]*d.radius*s];paths+=line(far,tip)+arrow(far,u);}else paths+=line(c,tip);}
 return dimensionGroup(d,index,paths,colors,...at);
}
