import {fuseSolid} from './solid-fuse.js';
import * as R from 'replicad';
export function slideLabelLayout(p,options,lower){
 if(p.labels!==undefined&&typeof p.labels!=='boolean')throw Error('底面の文字の設定を確認してください');if(!p.labels)return [];
 if(!['emboss','engrave'].includes(p.labelOperation)||!Number.isFinite(p.labelSize)||p.labelSize<3||p.labelSize>50||!Number.isFinite(p.labelDepth)||p.labelDepth<.2||p.labelDepth>5)throw Error('文字の高さは3〜50 mm、凹凸は0.2〜5 mmで指定してください');
 if(p.labelOperation==='engrave'&&p.floor-p.labelDepth<1.2-1e-6)throw Error('彫り文字の下に1.2 mm以上の底厚を残してください');
 if(p.labelOperation==='emboss'&&p.floor+p.labelDepth>lower-.25)throw Error('浮き文字を蓋より低くしてください');
 if(!Array.isArray(p.labelTexts)||p.labelTexts.length!==options.pockets.length||!Array.isArray(p.labelPatterns)||p.labelPatterns.length!==options.pockets.length||p.labelTexts.some(t=>typeof t!=='string'||[...t.trim()].length>12)||!p.labelTexts.some(t=>t.trim()))throw Error('部屋ごとに12文字以内で文字を入力してください');
 const margin=1.2+(options.fillet?.innerRadius??0),layout=[];let total=0;
 for(const [i,[a,b]]of options.pockets.entries()){
  const text=p.labelTexts[i].trim(),pattern=p.labelPatterns[i];if(!text)continue;
  if(!pattern||pattern.text!==text||!Number.isFinite(pattern.aspect)||pattern.aspect<=0||pattern.aspect>30||!Array.isArray(pattern.regions)||!pattern.regions.length||pattern.regions.length>80||pattern.regions.some(r=>!Array.isArray(r.outer)||!Array.isArray(r.holes)||[r.outer,...r.holes].some(ring=>!Array.isArray(ring)||ring.length<3||ring.length>6000||ring.some(point=>!Array.isArray(point)||point.length!==2||point.some(v=>!Number.isFinite(v)||v<0||v>1)))))throw Error('底面の文字の輪郭を確認してください');
  total+=pattern.regions.reduce((n,r)=>n+[r.outer,...r.holes].reduce((s,ring)=>s+ring.length,0),0);if(total>12000)throw Error('文字の輪郭が細かすぎます。文字数を減らしてください');
  const height=Math.min(p.labelSize,(b[0]-a[0]-2*margin)/pattern.aspect,b[1]-a[1]-2*margin),width=height*pattern.aspect;if(height<3-1e-6)throw Error('部屋'+(i+1)+'の文字が小さくなりすぎます。文字数を減らすか部屋を広げてください');
  layout.push({room:i+1,text,height,width,center:[(a[0]+b[0])/2,(a[1]+b[1])/2],pattern});
 }
 return layout;
}
function labelTool(region,entry,z,depth){
 const wires=[];let face,vector;
 const wire=(points,hole=false)=>{const signed=points.reduce((s,p,i)=>s+p[0]*points[(i+1)%points.length][1]-points[(i+1)%points.length][0]*p[1],0),ring=(signed>0)!==!hole?[...points].reverse():points,vertices=ring.map(([x,y])=>[entry.center[0]+(x-.5)*entry.width,entry.center[1]+(y-.5)*entry.height,z]),edges=vertices.map((p,i)=>R.makeLine(p,vertices[(i+1)%vertices.length]));try{const w=R.assembleWire(edges);wires.push(w);return w;}finally{edges.forEach(e=>e.delete());}};
 try{face=R.makeFace(wire(region.outer),region.holes.map(r=>wire(r,true)));vector=new R.Vector([0,0,depth]);return R.basicFaceExtrusion(face,vector);}finally{vector?.delete();face?.delete();wires.forEach(w=>w.delete());}
}
export function applySlideLabels(body,p,layout){
 if(!layout.length)return body.clone();const tools=[];let compound;
 try{const z=p.labelOperation==='engrave'?p.floor-p.labelDepth:p.floor-.05,depth=p.labelDepth+.05;for(const entry of layout)for(const region of entry.pattern.regions)tools.push(labelTool(region,entry,z,depth));compound=R.makeCompound(tools);tools.length=0;return p.labelOperation==='engrave'?body.cut(compound):fuseSolid(body,compound);}finally{compound?.delete();tools.forEach(t=>t.delete());}
}
