import {SVGLoader} from 'three/addons/loaders/SVGLoader.js';
import {defaults} from './geometry.js';
export function svgSketches(text,plane,name){
 const doc=new DOMParser().parseFromString(text,'image/svg+xml'),root=doc.documentElement;
 if(doc.querySelector('parsererror')||root.localName!=='svg')throw Error('SVGを読み込めません');
 if(doc.querySelector('script,foreignObject,iframe,object,embed,image,text'))throw Error('文字・画像はパスに変換したSVGを使用してください');
 if([...doc.querySelectorAll('*')].some(el=>[...el.attributes].some(a=>/^on/i.test(a.name)||(/href$/i.test(a.name)&&a.value&&!a.value.startsWith('#')))))throw Error('外部参照を含まないSVGを使用してください');
 const mm=value=>{const match=/^\s*([\d.+-]+)\s*(mm|cm|in|pt|pc|px)?\s*$/.exec(value||'');if(!match)return null;return Number(match[1])*({mm:1,cm:10,in:25.4,pt:25.4/72,pc:25.4/6,px:25.4/96}[match[2]||'px']);};
 const vb=root.getAttribute('viewBox')?.trim().split(/[ ,]+/).map(Number);let sx=25.4/96,sy=sx;if(vb?.length===4&&vb[2]>0&&vb[3]>0){const w=mm(root.getAttribute('width')),h=mm(root.getAttribute('height'));sx=w?w/vb[2]:h?h/vb[3]:sx;sy=h?h/vb[3]:sx;if(root.getAttribute('preserveAspectRatio')!=='none')sx=sy=Math.min(sx,sy);}
 const parsed=new SVGLoader().parse(new XMLSerializer().serializeToString(root)),rings=[];let total=0;
 for(const path of parsed.paths){let hidden=false;for(let el=path.userData?.node;el;el=el.parentElement)if(el.getAttribute('display')==='none'||el.getAttribute('visibility')==='hidden'||/display\s*:\s*none/.test(el.getAttribute('style')||''))hidden=true;if(hidden)continue;
  for(const sub of path.subPaths){const points=sub.getPoints(64).map(p=>[p.x*sx,-p.y*sy]).filter((p,i,a)=>!i||Math.hypot(p[0]-a[i-1][0],p[1]-a[i-1][1])>1e-7);if(points.length<2)continue;const closed=sub.autoClose||Math.hypot(points[0][0]-points.at(-1)[0],points[0][1]-points.at(-1)[1])<1e-6;if(closed&&Math.hypot(points[0][0]-points.at(-1)[0],points[0][1]-points.at(-1)[1])<1e-6)points.pop();total+=points.length;if(total>15000||rings.length>=100)throw Error('SVGが複雑すぎます。輪郭を減らしてください');rings.push({points,closed});}
 }
 if(!rings.length)throw Error('取り込める線や輪郭がありません');const all=rings.flatMap(r=>r.points),xs=all.map(p=>p[0]),ys=all.map(p=>p[1]),cx=(Math.min(...xs)+Math.max(...xs))/2,cy=(Math.min(...ys)+Math.max(...ys))/2,groupId=crypto.randomUUID();if(all.some(p=>p.some(v=>!Number.isFinite(v)||Math.abs(v)>25000)))throw Error('SVGの寸法が大きすぎます');
 return rings.map((r,i)=>({...defaults,...plane,id:crypto.randomUUID(),kind:'sketch',groupId,name:name.replace(/\.svg$/i,'').slice(0,85)+' '+(i+1),profile:'polyline',closed:r.closed,points:r.points.map(p=>[p[0]-cx,p[1]-cy]),x:plane.frame.n[0]*plane.offset,y:plane.frame.n[1]*plane.offset,z:plane.frame.n[2]*plane.offset}));
}
