import {BufferGeometry,DoubleSide,Float32BufferAttribute,Group,Mesh,MeshBasicMaterial,ShapeUtils,Vector2} from 'three';
import Clipper from 'clipper-lib';
import {clipTriangle} from './box-selection.js';
import {supportMeshTriangles} from './print-support-bridges.js';

const distanceEpsilon=1e-5,scale=1e5;
const overlap=(low,high,from,to)=>Math.min(high,to)-Math.max(low,from);
const settingKinds={
 sideGap:['gap'],
 wallRoof:['upperSkin'],roofLayers:['upperSkin'],roofSeams:['upperSkin'],roofSectionLength:['upperSkin'],roofSeamWidth:['upperSkin'],
 wallBottomSkin:['lowerSkin'],bottomSkinLayers:['lowerSkin'],bottomSeams:['lowerSkin'],bottomSectionLength:['lowerSkin'],bottomSeamWidth:['lowerSkin'],
 contactLines:['upperContact','lowerContact'],
 topContactLines:['upperContact'],interfaceLineWidth:['upperContact'],interfaceSpacing:['upperContact'],
 topContactRim:['upperContact'],topContactRimWidth:['upperContact'],
 bottomContactLines:['lowerContact'],bottomInterfaceLineWidth:['lowerContact'],bottomInterfaceSpacing:['lowerContact'],bottomContactInset:['lowerContact'],
 wallWindows:['windows'],
};

export function supportComparisonKinds(fields){
 return [...new Set(fields.flatMap(field=>settingKinds[field]||[]))];
}

function removedRibs(before,after,pitch){
 const possible=[];
 for(const [i,a] of before.entries())for(const [j,b] of after.entries()){
  if(a.ceilingId!==b.ceilingId||a.axis!==b.axis)continue;
  const other=1-a.axis,cross=Math.abs(a.center-b.center);
  if(cross>pitch/2||overlap(a.bounds[0][2],a.bounds[1][2],b.bounds[0][2],b.bounds[1][2])<=distanceEpsilon)continue;
  const length=overlap(a.bounds[0][other],a.bounds[1][other],b.bounds[0][other],b.bounds[1][other]);
  if(length>distanceEpsilon)possible.push({i,j,cross,length,same:a.id===b.id});
 }
 possible.sort((a,b)=>Number(b.same)-Number(a.same)||a.cross-b.cross||b.length-a.length);
 const pairedBefore=new Set(),pairedAfter=new Set();
 for(const {i,j} of possible){
  if(pairedBefore.has(i)||pairedAfter.has(j))continue;
  pairedBefore.add(i);pairedAfter.add(j);
 }
 return before.filter((_,i)=>!pairedBefore.has(i));
}

function meshPaths(mesh){
 if(!mesh)return [];
 return supportMeshTriangles(mesh).flatMap(points=>{
  const polygon=points.map(([x,y])=>({X:Math.round(x*scale),Y:Math.round(y*scale)}));
  const area=Clipper.Clipper.Area(polygon);
  if(Math.abs(area)<1)return [];
  return [area>0?polygon:polygon.reverse()];
 });
}

function lostSkin(before,after){
 if(!before)return null;
 const clipper=new Clipper.Clipper(),tree=new Clipper.PolyTree(),z=before.vertices[2];
 clipper.AddPaths(meshPaths(before),Clipper.PolyType.ptSubject,true);
 const remaining=meshPaths(after);
 if(remaining.length)clipper.AddPaths(remaining,Clipper.PolyType.ptClip,true);
 clipper.Execute(Clipper.ClipType.ctDifference,tree,Clipper.PolyFillType.pftNonZero,Clipper.PolyFillType.pftNonZero);
 const vertices=[],triangles=[];
 let area=0;
 function append(node){
  for(const child of node.Childs()){
   if(!child.IsHole()){
    const contour=child.Contour(),holes=child.Childs().filter(h=>h.IsHole()).map(h=>h.Contour());
    const points=path=>path.map(({X,Y})=>new Vector2(X/scale,Y/scale));
    const outer=points(contour),inner=holes.map(points),first=vertices.length/3;
    const faces=ShapeUtils.triangulateShape(outer,inner);
    for(const point of [...outer,...inner.flat()])vertices.push(point.x,point.y,z);
    for(const triangle of faces)for(const index of triangle)triangles.push(first+index);
    area+=(Math.abs(Clipper.Clipper.Area(contour))-holes.reduce((sum,h)=>sum+Math.abs(Clipper.Clipper.Area(h)),0))/scale**2;
   }
   append(child);
  }
 }
 append(tree);
 return triangles.length&&area>1e-5?{vertices,triangles,area}:null;
}

function enlargedSpans(previous,row,lineWidth){
 const old=previous.bridges,next=row.bridges;
 if(!old||!next)return null;
 const bands=[],minimum=Math.max(.02,lineWidth/10);
 let widest,station,previousBands=[];
 for(const band of next.bands){
  const at=(band.from+band.to)/2;
  if(old.axis===next.axis&&station!==at){
   station=at;
   previousBands=old.bands.filter(other=>at>=other.from-distanceEpsilon&&at<=other.to+distanceEpsilon);
  }
  const oldWidth=old.axis===next.axis?previousBands.reduce((max,other)=>
   overlap(other.start,other.end,band.start,band.end)>distanceEpsilon?Math.max(max,other.width):max,0):
   Math.max(old.max,old.unbraced);
  const growth=band.width-oldWidth;
  if(growth<minimum)continue;
  bands.push(band);
  if(!widest||growth>widest.growth)widest={before:oldWidth,after:band.width,growth};
 }
 if(!bands.length)return null;
 const faceTriangles=supportMeshTriangles(row.face).map(t=>t.map(([x,y])=>({x,y}))),vertices=[],z=row.face.vertices[2];
 for(const {start,end,from,to} of bands){
  const rect=next.axis===0?{left:start,right:end,top:from,bottom:to}:{left:from,right:to,top:start,bottom:end};
  for(const triangle of faceTriangles){
   if(triangle.every(p=>p.x<rect.left)||triangle.every(p=>p.x>rect.right)||triangle.every(p=>p.y<rect.top)||triangle.every(p=>p.y>rect.bottom))continue;
   const polygon=clipTriangle(triangle,rect);
   for(let i=1;i<polygon.length-1;i++)for(const {x,y} of [polygon[0],polygon[i],polygon[i+1]])vertices.push(x,y,z);
  }
 }
 return vertices.length?{vertices,widest}:null;
}

export function compareSupportGap(before,after){
 const ribs=preview=>preview.ribs.filter(rib=>!rib.excluded);
 const oldRibs=ribs(before.result.supportPreview),newRibs=ribs(after.result.supportPreview);
 const nextRows=new Map(after.result.supportPreview.coverage.filter(row=>row.ceilingId).map(row=>[row.ceilingId,row]));
 const removed=removedRibs(oldRibs,newRibs,before.input.wallPitch),skins=[],spans=[];
 for(const row of before.result.supportPreview.coverage){
  if(!row.ceilingId)continue;
  const next=nextRows.get(row.ceilingId);
  const skin=lostSkin(row.skinSupport?.face,next?.skinSupport?.face);
  if(skin)skins.push(skin);
  if(next){
   const widened=enlargedSpans(row,next,before.input.lineWidth);
   if(widened)spans.push(widened);
  }
 }
 return {beforeCount:oldRibs.length,afterCount:newRibs.length,removed,skins,spans};
}

function meshSignature({vertices,triangles}){
 const positions=new Set();
 for(let i=0;i<vertices.length;i+=3)positions.add(vertices.slice(i,i+3).map(v=>Math.round(v*scale)).join(','));
 // The same surface may use a different triangle order or diagonal.
 let area=0;
 for(let i=0;i<triangles.length;i+=3){
  const a=triangles[i]*3,b=triangles[i+1]*3,c=triangles[i+2]*3;
  const [x,y,z]=[0,1,2].map(k=>vertices[b+k]-vertices[a+k]);
  const [u,v,w]=[0,1,2].map(k=>vertices[c+k]-vertices[a+k]);
  area+=Math.hypot(y*w-z*v,z*u-x*w,x*v-y*u)/2;
 }
 return JSON.stringify([Math.round(area*scale),[...positions].sort()]);
}

function finishSignatures(preview,kinds){
 const byCeiling=new Map();
 function add(kind,pieces,signature){
  if(!kinds.includes(kind))return;
  for(const piece of pieces){
   if(!piece.ceilingId)continue;
   if(!byCeiling.has(piece.ceilingId))byCeiling.set(piece.ceilingId,[]);
   byCeiling.get(piece.ceilingId).push(kind+':'+signature(piece));
  }
 }
 add('upperSkin',preview.roof?.parts||[],meshSignature);
 add('lowerSkin',(preview.skins||[]).flat().filter(piece=>piece.side==='lower'),meshSignature);
 add('upperContact',(preview.contact||[]).filter(piece=>piece.role==='upper'),meshSignature);
 add('lowerContact',(preview.contact||[]).filter(piece=>piece.role==='lower'),meshSignature);
 add('windows',preview.windowCuts||[],({axis,center,x,z0,z1,width})=>
  JSON.stringify([axis,...[center,x,z0,z1,width].map(v=>Math.round(v*scale))]));
 return byCeiling;
}

export function changedSupportCeilings(previous,next,kinds){
 const before=finishSignatures(previous,kinds),after=finishSignatures(next,kinds);
 const faces=new Map([...(previous.coverage||[]),...(next.coverage||[])]
  .filter(row=>row.ceilingId&&row.face).map(row=>[row.ceilingId,row.face]));
 return [...new Set([...before.keys(),...after.keys()])].flatMap(id=>{
  const a=before.get(id)||[],b=after.get(id)||[],face=faces.get(id);
  return face&&(a.length!==b.length||JSON.stringify(a.sort())!==JSON.stringify(b.sort()))?[{ceilingId:id,...face}]:[];
 });
}

export function createSupportGapComparison({anchor,scene,onRestore}){
 const panel=document.createElement('div');
 panel.dataset.id='gap-comparison';
 panel.style.cssText='margin:10px 0;padding:9px 0;border-block:1px solid #c5dce7';
 panel.innerHTML='<strong data-comparison-title></strong><small data-gap-summary role="status"></small>'+
  '<label><input type="checkbox" data-gap-show checked><span data-comparison-toggle></span></label><button type="button" data-gap-restore></button>';
 anchor.after(panel);
 const summary=panel.querySelector('[data-gap-summary]'),toggle=panel.querySelector('[data-gap-show]'),restore=panel.querySelector('[data-gap-restore]');
 const title=panel.querySelector('[data-comparison-title]'),toggleLabel=panel.querySelector('[data-comparison-toggle]');
 const group=new Group();
 scene.add(group);
 let baseline=null,hasChanges=false,blocked=false,masked=false;
 const display=value=>Number(value.toFixed(2));
 function sync(){
  panel.hidden=!baseline;
  group.visible=!!baseline&&hasChanges&&toggle.checked&&!masked&&!blocked;
  toggle.closest('label').hidden=!hasChanges;
  toggle.disabled=blocked||masked;
  restore.disabled=blocked;
 }
 function clear(){
  for(const mesh of [...group.children]){
   mesh.removeFromParent();mesh.geometry.dispose();mesh.material.dispose();
  }
  baseline=null;hasChanges=false;delete panel.dataset.changedCeilings;summary.textContent='';sync();
 }
 function pending(previous){
  clear();baseline=previous;
  const gapOnly=previous.kinds.length===1&&previous.kinds[0]==='gap';
  title.textContent=gapOnly?'横すき間の変更前後':'リブサポートの変更前後';
  toggleLabel.textContent=gapOnly?'支えが減った箇所を強調':'変更箇所を強調';
  restore.hidden=!gapOnly;
  restore.textContent=display(baseline.value)+' mmに戻す';
  summary.textContent='変更後の精密プレビューを計算しています。';
  sync();
 }
 function add(parts,color,layer){
  for(const {vertices,triangles} of parts){
   if(!vertices?.length)continue;
   const geometry=new BufferGeometry().setAttribute('position',new Float32BufferAttribute(vertices,3));
   if(triangles)geometry.setIndex(triangles);
   const material=new MeshBasicMaterial({color,side:DoubleSide,transparent:true,opacity:.72,depthWrite:false,depthTest:false});
   const mesh=new Mesh(geometry,material);mesh.renderOrder=layer;group.add(mesh);
  }
 }
 function show(previous,entries){
  const kinds=previous.kinds.filter(kind=>kind!=='gap'),gap=previous.kinds.includes('gap');
  const pairs=previous.entries.flatMap(before=>{
   const after=entries.find(entry=>entry.input.target===before.input.target&&entry.input.style==='walls');
   return after&&(kinds.length||gap&&before.input.sideGap!==after.input.sideGap)?[[before,after]]:[];
  });
  if(!pairs.length){clear();return;}
  pending(previous);
  const changes=gap?pairs.filter(([before,after])=>before.input.sideGap!==after.input.sideGap)
   .map(([before,after])=>compareSupportGap(before,after)):[];
  const removed=changes.flatMap(change=>change.removed),skins=changes.flatMap(change=>change.skins),spans=changes.flatMap(change=>change.spans);
  const widest=spans.reduce((current,row)=>!current||row.widest.growth>current.growth?row.widest:current,null);
  const changed=kinds.length?pairs.flatMap(([before,after])=>
   changedSupportCeilings(before.result.supportPreview,after.result.supportPreview,kinds)):[];
  hasChanges=!!(removed.length||skins.length||spans.length||changed.length);
  add(removed,0xde3448,27);add(skins,0xc33caf,28);add(spans,0xf08a24,29);
  add(changed,0x147cce,26);
  panel.dataset.changedCeilings=String(changed.length);
  const values=[...new Set(pairs.map(([,after])=>display(after.input.sideGap)))].join('・');
  const total=(index,get)=>pairs.reduce((sum,pair)=>sum+get(pair[index].result.analysis.printSupport),0);
  const lines=[];
  if(changes.length)lines.push('横すき間 '+display(previous.value)+' → '+values+' mm');
  lines.push('リブ '+total(0,a=>a.count)+' → '+total(1,a=>a.count)+'枚');
  if(kinds.length){
   const grams=index=>display(total(index,a=>a.material.massG));
   lines.push('材料の概算 '+grams(0)+' → '+grams(1)+' g');
   lines.push(changed.length?'青は変更した下面 '+changed.length+'面':'変更した下面 0面');
  }
  if(removed.length)lines.push('赤は消えたリブ '+removed.length+'枚');
  if(skins.length)lines.push('紫は減った上面の薄皮 '+display(skins.reduce((area,part)=>area+part.area,0))+' mm²');
  if(widest)lines.push('橙は幅が広がった区画（最大増加の箇所 '+display(widest.before)+' → '+display(widest.after)+' mm、目安）');
  if(!hasChanges&&!kinds.length)lines.push('表示する差はありません');
  if(pairs.length<previous.entries.length)lines.push(pairs.length+'ボディを比較');
  summary.textContent=lines.join(' ／ ')+'。';
  sync();
 }
 toggle.onchange=sync;
 restore.onclick=()=>{if(baseline&&!restore.hidden&&!blocked)onRestore(baseline.value);};
 clear();
 return {clear,pending,show,fail(){if(baseline){pending(baseline);summary.textContent='変更後の精密プレビューを確認できません。';}},
  controls(state){({blocked,masked}=state);sync();}};
}
