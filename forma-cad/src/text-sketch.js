import {parse} from 'opentype.js';
import Clipper from 'clipper-lib';
import {defaults} from './geometry.js';
import {validateFrame} from './frames.js';
import {verticalTextRings} from './text-vertical-layout.js';

export const TEXT_FONT_URL='fonts/NotoSansCJKjp-Regular.otf';
export function parseTextFont(bytes){
 if(bytes.byteLength>32*1024*1024)throw Error('フォントは32 MB以下にしてください');
 try{return parse(bytes,{lowMemory:true});}catch{throw Error('このフォントを読み込めません。TTF・OTF・WOFF形式を選んでください');}
}
const distance=(p,a,b)=>{const x=b[0]-a[0],y=b[1]-a[1],l=x*x+y*y,t=l?Math.max(0,Math.min(1,((p[0]-a[0])*x+(p[1]-a[1])*y)/l)):0;return Math.hypot(p[0]-a[0]-t*x,p[1]-a[1]-t*y);};
const mid=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];
// Subdivision uses a physical error bound, rather than a fixed number of edges per curve.
export function flattenTextPath(commands,tolerance){
 const rings=[];let ring=[],point;
 const append=p=>{if(!ring.length||Math.hypot(p[0]-ring.at(-1)[0],p[1]-ring.at(-1)[1])>1e-7)ring.push(p);if(ring.length>15000)throw Error('文字の輪郭が複雑すぎます');};
 function curve(points,depth=0){const a=points[0],b=points.at(-1);if(depth>=14||points.slice(1,-1).every(p=>distance(p,a,b)<=tolerance)){append(b);return;}const levels=[points];while(levels.at(-1).length>1)levels.push(levels.at(-1).slice(1).map((_,i)=>mid(levels.at(-1)[i],levels.at(-1)[i+1])));curve(levels.map(l=>l[0]),depth+1);curve(levels.map(l=>l.at(-1)).reverse(),depth+1);}
 function close(){if(ring.length>1&&Math.hypot(ring[0][0]-ring.at(-1)[0],ring[0][1]-ring.at(-1)[1])<1e-7)ring.pop();if(ring.length>=3)rings.push(ring);ring=[];}
 for(const c of commands){const end=[c.x,-c.y];if(c.type==='M'){close();point=end;append(end);}else if(c.type==='L'){append(end);point=end;}else if(c.type==='Q'||c.type==='C'){curve(c.type==='Q'?[point,[c.x1,-c.y1],end]:[point,[c.x1,-c.y1],[c.x2,-c.y2],end]);point=end;}else if(c.type==='Z')close();else throw Error('未対応の文字輪郭です');}close();return rings;
}
export function textSketchLayout(font,spec){
 const text=String(spec.text??'').normalize('NFC').replace(/\r\n?/g,'\n');
 if(!text.trim())throw Error('文字を入力してください');if([...text].length>80||text.split('\n').length>5)throw Error('文字は80文字・5行以内にしてください');
 const height=Number(spec.height),spacing=Number(spec.spacing??0),angle=Number(spec.angle??0),u=Number(spec.u??0),v=Number(spec.v??0);
 const writingMode=spec.writingMode??'horizontal';if(!['horizontal','vertical'].includes(writingMode))throw Error('横書き・縦書きを選んでください');
 if(!Number.isFinite(height)||height<1||height>500)throw Error('文字の高さは1〜500 mmで指定してください');
 if(!Number.isFinite(spacing)||spacing<0||spacing>100)throw Error('字間は0〜100 mmで指定してください');
 if(!Number.isFinite(angle)||Math.abs(angle)>360||![u,v].every(x=>Number.isFinite(x)&&Math.abs(x)<=10000))throw Error('位置・角度を確認してください');
 const missing=[...new Set([...text].filter(c=>!/[\s]/u.test(c)&&!font.charToGlyphIndex(c)))];if(missing.length)throw Error('このフォントにない文字：'+missing.slice(0,12).join(' ')+'。別のフォントを読み込んでください');
 const options={kerning:true,features:{liga:false,rlig:false}},lines=text.split('\n'),tolerance=Math.max(.002,Math.min(.02,height/1000));let rings=[];
 if(writingMode==='vertical')rings=verticalTextRings(font,lines,{height,spacing,align:spec.align,tolerance,flatten:flattenTextPath}).rings;
 else{
 const raw=lines.map(line=>font.getPath(line.replace(/\t/g,'    '),0,0,1000,options)),boxes=raw.map(p=>p.getBoundingBox()),inkHeight=Math.max(...boxes.map(b=>b.y2-b.y1));
 if(raw.reduce((n,p)=>n+p.commands.length,0)>60000)throw Error('文字の輪郭が複雑すぎます。文字数を減らしてください');
 if(!(inkHeight>0))throw Error('輪郭のある文字を入力してください');const size=1000*height/inkHeight;
 for(let line=0;line<lines.length;line++){
  const path=font.getPath(lines[line].replace(/\t/g,'    '),0,line*height*1.5,size,{...options,letterSpacing:spacing/size}),rs=flattenTextPath(path.commands,tolerance);if(!rs.length)continue;
  const xs=rs.flat().map(p=>p[0]),min=Math.min(...xs),max=Math.max(...xs),shift=spec.align==='center'?(min+max)/2:spec.align==='right'?max:min;
  rings.push(...rs.map(r=>r.map(p=>[p[0]-shift,p[1]])));
 }
 }
 if(!rings.length)throw Error('押し出せる文字輪郭がありません');
 if(rings.reduce((n,r)=>n+r.length,0)>20000)throw Error('文字の輪郭が複雑すぎます。文字数を減らしてください');
 const minY=Math.min(...rings.flat().map(p=>p[1]));rings=rings.map(r=>r.map(p=>[p[0],p[1]-minY]));const localPoints=rings.flat(),localBounds={min:[Math.min(...localPoints.map(p=>p[0])),0],max:[Math.max(...localPoints.map(p=>p[0])),Math.max(...localPoints.map(p=>p[1]))]};
 // Union overlapping strokes and glyphs while keeping their original nonzero winding holes.
 const scale=100000,clip=new Clipper.Clipper();clip.AddPaths(rings.map(r=>r.map(p=>({X:Math.round(p[0]*scale),Y:Math.round(p[1]*scale)}))),Clipper.PolyType.ptSubject,true);const tree=new Clipper.PolyTree();clip.Execute(Clipper.ClipType.ctUnion,tree,Clipper.PolyFillType.pftNonZero,Clipper.PolyFillType.pftNonZero);
 const a=angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a),contours=[];
 for(let n=tree.GetFirst();n;n=n.GetNext()){const points=n.Contour().map(p=>[p.X/scale,p.Y/scale]).map(([x,y])=>[u+x*c-y*s,v+x*s+y*c]);if(points.length>=3)contours.push({points,hole:n.IsHole()});}
 const count=contours.reduce((n,r)=>n+r.points.length,0);if(count>15000||contours.length>140)throw Error('文字が複雑すぎます。文字数を減らして分けて配置してください');if(contours.some(r=>r.points.some(p=>p.some(x=>Math.abs(x)>25000))))throw Error('文字が作図範囲を超えています');
 const points=contours.flatMap(r=>r.points),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);return {contours,text,height,spacing,angle,u,v,writingMode,align:spec.align||'left',localBounds,bounds:{min:[Math.min(...xs),Math.min(...ys)],max:[Math.max(...xs),Math.max(...ys)]},vertices:count};
}
export function textSketchFeatures(layout,placement,{fontName='Noto Sans CJK JP',groupId=crypto.randomUUID(),textId=crypto.randomUUID()}={}){
 validateFrame(placement.frame);const offset=Number(placement.offset);if(!Number.isFinite(offset)||Math.abs(offset)>10000)throw Error('作図平面の位置が不正です');
 return layout.contours.map((r,i)=>({...defaults,id:crypto.randomUUID(),kind:'sketch',profile:'polyline',closed:true,groupId,name:('文字「'+layout.text.replace(/\n/g,' ')+ '」 '+(i+1)).slice(0,95),plane:placement.plane||'CUSTOM',frame:structuredClone(placement.frame),x:placement.frame.n[0]*offset,y:placement.frame.n[1]*offset,z:placement.frame.n[2]*offset,points:r.points.map(p=>[...p]),textOutline:{id:textId,text:layout.text,fontName,hole:r.hole,height:layout.height,spacing:layout.spacing,angle:layout.angle,writingMode:layout.writingMode||'horizontal'}}));
}
