import {SVGLoader} from 'three/addons/loaders/SVGLoader.js';
import {polygonRegions} from './svg-wrap-pattern.js';
export function svgWrapPattern(text){
 const doc=new DOMParser().parseFromString(text,'image/svg+xml'),root=doc.documentElement;
 if(doc.querySelector('parsererror')||root.localName!=='svg')throw Error('SVGを読み込めません');
 if(doc.querySelector('script,foreignObject,iframe,object,embed,image,text'))throw Error('文字・画像はパスに変換したSVGを使用してください');
 if([...doc.querySelectorAll('*')].some(el=>[...el.attributes].some(a=>/^on/i.test(a.name)||(/href$/i.test(a.name)&&a.value&&!a.value.startsWith('#')))))throw Error('外部参照を含まないSVGを使用してください');
 if(doc.querySelectorAll('*').length>2000)throw Error('図案が細かすぎます。輪郭を減らしてください');
 const parsed=new SVGLoader().parse(new XMLSerializer().serializeToString(root)),raw=[];
 for(const p of parsed.paths){const style=p.userData?.style||{};let hidden=style.opacity===0;for(let el=p.userData?.node;el;el=el.parentElement)if(el.getAttribute('display')==='none'||el.getAttribute('visibility')==='hidden'||/display\s*:\s*none/.test(el.getAttribute('style')||''))hidden=true;if(hidden)continue;
  if(style.fill!=='none'&&style.fillOpacity!==0)for(const shape of SVGLoader.createShapes(p)){const points=shape.extractPoints(24);raw.push({outer:points.shape.map(q=>[q.x,q.y]),holes:points.holes.map(h=>h.map(q=>[q.x,q.y]))});}
  if(style.stroke&&style.stroke!=='none'&&style.strokeOpacity!==0)for(const sub of p.subPaths){const geometry=SVGLoader.pointsToStroke(sub.getPoints(24),style);if(!geometry)continue;const pos=geometry.attributes.position;for(let i=0;i<pos.count;i+=3)raw.push({outer:[0,1,2].map(j=>[pos.getX(i+j),pos.getY(i+j)]),holes:[]});geometry.dispose();}
 }
 if(!raw.length)throw Error('SVGに塗りや太さのある線がありません');
 const all=raw.flatMap(r=>[r.outer,...r.holes].flat()),vb=root.getAttribute('viewBox')?.trim().split(/[ ,]+/).map(Number);let bounds;
 if(vb?.length===4&&vb.every(Number.isFinite)&&vb[2]>0&&vb[3]>0)bounds=vb;else{const xs=all.map(p=>p[0]),ys=all.map(p=>p[1]);bounds=[Math.min(...xs),Math.min(...ys),Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys)];}
 if(!(bounds[2]>0&&bounds[3]>0)||all.some(p=>p.some(v=>!Number.isFinite(v))))throw Error('SVGの寸法を確認してください');
 const transform=ring=>ring.map(([x,y])=>[(x-bounds[0])/bounds[2],1-(y-bounds[1])/bounds[3]]);
 const regions=polygonRegions(raw.map(r=>({outer:transform(r.outer),holes:r.holes.map(transform)})),[0,0,1,1]);
 if(!regions.length||regions.reduce((n,r)=>n+r.outer.length+r.holes.reduce((a,h)=>a+h.length,0),0)>2500||regions.length>80)throw Error('図案が細かすぎます。輪郭を減らしてください');
 return {regions,aspect:bounds[3]/bounds[2]};
}
