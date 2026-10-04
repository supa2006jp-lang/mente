import {snapLidOpeningSettings,cutSnapLidOpenings} from './snap-lid-opening.js';
import {snapLidFilletSettings,roundSnapProfile,filletSnapEnd,filletSnapOutside} from './snap-lid-fillet.js';
import * as R from 'replicad';
const fail='上下が同じ輪郭で、XY平面で接する2つのボディを選択してください';
const tuple=v=>{try{return v.toTuple();}finally{v.delete();}};
function bounds(shape){const box=shape.boundingBox;try{return box.bounds;}finally{box.delete();}}
function cap(shape,z){const faces=shape.faces;try{const found=faces.filter(f=>f.geomType==='PLANE'&&Math.abs(tuple(f.center)[2]-z)<1e-5&&Math.abs(tuple(f.normalAt())[2])>.999999).sort((a,b)=>R.measureArea(b)-R.measureArea(a))[0];if(!found)throw Error(fail);return R.makeFace(found.clone().outerWire());}finally{faces.forEach(f=>f.delete());}}
function extrude(face,height){const v=new R.Vector([0,0,height]);try{return R.basicFaceExtrusion(face,v);}finally{v.delete();}}
function valid(shape,label){const check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false),solids=shape.solids;try{if(!check.IsValid()||solids.length!==1||!(R.measureVolume(shape)>1e-7))throw Error(label+'を有効なソリッドにできません。壁厚や差し込み寸法を変更してください');}finally{check.delete();solids.forEach(s=>s.delete());}}
export function snapLidInfo(lower,upper){if(!lower||!upper||lower===upper)throw Error(fail);const a=bounds(lower),b=bounds(upper),seam=a[1][2];if(Math.abs(seam-b[0][2])>1e-5||a[1][2]<=a[0][2]||b[1][2]<=b[0][2])throw Error(fail);let bottom,top,tool,other,common;try{bottom=cap(lower,seam);top=cap(upper,seam);tool=extrude(bottom,.1);other=extrude(top,.1);common=tool.intersect(other);const volume=R.measureVolume(common);if(Math.abs(volume-R.measureVolume(tool))>1e-5||Math.abs(volume-R.measureVolume(other))>1e-5)throw Error(fail);return {seam,lowerMin:a[0][2],upperMax:b[1][2],bodyHeight:seam-a[0][2],lidHeight:b[1][2]-seam,bounds:a};}finally{bottom?.delete();top?.delete();tool?.delete();other?.delete();common?.delete();}}
export function makeSnapLid(lower,upper,p){
 if(!['print','assembled'].includes(p.pose))throw Error('配置を選択してください');
 const info=snapLidInfo(lower,upper),{seam,bodyHeight,lidHeight}=info,objects=[],hold=o=>(objects.push(o),o);
 try{
  for(const key of ['bodyWall','lidWall','floor','insertion','clearance','ridge'])if(!Number.isFinite(p[key])||p[key]<=0)throw Error('壁厚・差し込み・すき間・山高さは0より大きい数値で指定してください');
  if(p.bodyWall<1.2||p.lidWall<1.2||p.floor<1.2||p.insertion<2||p.clearance>1||p.ridge>1)throw Error('0.6 mmノズル用に壁厚と底厚は1.2 mm以上、差し込みは2 mm以上、すき間と山高さは1 mm以下にしてください');
  if(p.ridge<=p.clearance)throw Error('固定する山の高さはすき間より大きくしてください');
  if(p.ridge+.15+p.clearance>=p.insertion/2-.1)throw Error('山と溝を収めるため差し込み高さを増やしてください');
  const neckOffset=p.lidWall+p.clearance,neckWall=p.bodyWall-neckOffset;
  if(neckWall<1.2-1e-6)throw Error('差し込み部分の肉厚が不足します。本体壁厚を「蓋壁厚＋すき間＋1.2 mm」以上にしてください');
  if(p.lidWall-p.ridge<1.2)throw Error('溝の外側に1.2 mm以上の肉厚が必要です。山高さを小さくするか蓋壁厚を増やしてください');
  if(bodyHeight<=p.floor+1||lidHeight<=p.floor+p.insertion+p.clearance)throw Error('本体や蓋の高さが足りません。底厚・差し込み高さを小さくしてください');
  const face=hold(cap(lower,seam)),area=R.measureArea(face),fillet=snapLidFilletSettings(p,info,face);
  const opening=snapLidOpeningSettings(face,p,fillet,info);
  const roundedLower=filletSnapOutside(lower,info.lowerMin,fillet.outerRadius),roundedUpper=filletSnapOutside(upper,info.upperMax,fillet.outerRadius);hold(roundedLower.shape);hold(roundedUpper.shape);fillet.outerEdges=roundedLower.edges+roundedUpper.edges;
  function sharpInset(distance){if(Math.abs(distance)<1e-9)return face.clone();for(const sign of [-1,1]){let w,f;try{w=face.clone().outerWire().offset2D(sign*distance,'intersection');f=R.makeFace(w);const a=R.measureArea(f);if(a>1e-6&&a<area){w.delete();return f;}}catch{}w?.delete();f?.delete();}throw Error('この輪郭では内側の空間を作れません。壁厚を小さくしてください');}
  const inset=sharpInset;
  function prism(offset,z,height,endZ=null,bodyInner=false){let f=hold(inset(offset));if(bodyInner&&fillet.innerRadius)f=hold(roundSnapProfile(f,fillet.innerRadius));const s=hold(extrude(f,height));const positioned=hold(s.translate([0,0,z-seam]));if(!bodyInner||endZ===null||!fillet.innerEndRadius)return positioned;const rounded=filletSnapEnd(positioned,endZ,fillet.innerEndRadius);fillet.innerEdges+=rounded.edges;return hold(rounded.shape);}
  function taper(sections){const wires=sections.map(([z,offset])=>hold(hold(hold(inset(offset)).translate([0,0,z-seam])).outerWire()));return hold(R.loft(wires,{ruled:true}));}
  const cavity=prism(p.bodyWall,info.lowerMin+p.floor,bodyHeight-p.floor+p.insertion+1,info.lowerMin+p.floor,true),bodyHollow=hold(roundedLower.shape.cut(cavity));
  const neckOuter=prism(neckOffset,seam-.02,p.insertion+.02),neckInner=prism(p.bodyWall,seam-.1,p.insertion+.2),neck=hold(neckOuter.cut(neckInner));
  const peak=seam+p.insertion*.5,half=p.ridge+.15,ridgeOuter=taper([[peak-half,neckOffset],[peak,neckOffset-p.ridge],[peak+half,neckOffset]]),ridgeInner=prism(p.bodyWall,peak-half-.1,half*2+.2),ridge=hold(ridgeOuter.cut(ridgeInner));
  const neckRidge=hold(neck.fuse(ridge)),body=hold(bodyHollow.fuse(neckRidge));
  const lidCavity=prism(p.lidWall,seam-.1,lidHeight-p.floor+.1),lidHollow=hold(roundedUpper.shape.cut(lidCavity));
  const grooveOuter=taper([[peak-half-p.clearance,p.lidWall],[peak,p.lidWall-p.ridge],[peak+half+p.clearance,p.lidWall]]),lidRetained=hold(lidHollow.cut(grooveOuter)),lid=hold(cutSnapLidOpenings(lidRetained,seam,opening));
  valid(body,'本体');valid(lid,'蓋');const common=hold(body.intersect(lid)),overlap=R.measureVolume(common);if(overlap>1e-5)throw Error('本体と蓋が干渉します。すき間を増やしてください');
  let bodyOut=body.clone(),lidOut=lid.clone();
  if(p.pose==='print'){bodyOut=bodyOut.translate([0,0,-info.lowerMin]);lidOut=lidOut.rotate(180,[0,0,info.upperMax],[1,0,0]);const lb=bounds(lidOut),bb=bounds(bodyOut);lidOut=lidOut.translate([bb[1][0]-lb[0][0]+10,0,-lb[0][2]]);}
  return {body:bodyOut,lid:lidOut,analysis:{...info,neckWall,overlap,fillet,opening,retention:Math.max(0,p.ridge-p.clearance)}};
 }finally{for(const object of objects.reverse())object.delete();}
}
