import {normalizeContactSettings} from './print-support-contact-settings.js';
import * as R from 'replicad';
import {validateSupportFaces,resolveSupportFaces,supportSelectedFaceMeshes} from './print-support-faces.js';
import {fuseSolids} from './solid-fuse.js';
import {supportBaseSurfaces} from './print-support-base.js';
import {makeWallSupports} from './print-support-walls.js';
import {supportMaterialEstimate} from './print-support-material.js';
export const printSupportDefaults={style:'posts',contactLines:false,topContactLines:true,bottomContactLines:true,interfaceLineWidth:.6,interfaceSpacing:.5,edgeMargin:.5,bottomSeams:false,bottomSectionLength:25,bottomSeamWidth:.6,wallBottomSkin:false,bottomSkinLayers:2,edgeRibs:false,autoReinforce:false,filamentDiameter:1.75,materialDensity:1.24,lineWidth:.4,fitLineWidth:false,wallLines:2,wallDirection:'auto',excludedRibs:[],wallRoof:false,roofLayers:2,roofTabs:false,roofTabPlacements:[],roofTabLength:6,roofSeams:false,roofSectionLength:25,roofSeamWidth:.6,wallWindows:false,wallTies:true,tieInterval:20,wallPitch:4,wallThickness:.8,layerHeight:.3,mode:'auto',baseMode:'bedOrModel',spacing:25,footDiameter:20,footThickness:.8,postDiameter:4,tipDiameter:1.2,topGap:.2,bottomGap:.2,bedZ:0,maxSupports:16,connectFeet:true,braces:true,braceDiameter:2,lockToModel:true};
const vector=v=>{try{return v.toTuple();}finally{v.delete();}};
const box=shape=>{const b=shape.boundingBox;try{return b.bounds;}finally{b.delete();}};
export function validatePrintSupport(input){
 // Existing saved supports keep their original bed-only placement on replay.
 const p={...printSupportDefaults,...input,baseMode:input.baseMode??'bed',wallTies:input.wallTies??false,wallWindows:input.wallWindows??false,wallRoof:input.wallRoof??false,roofTabs:input.roofTabs??false,roofSeams:input.roofSeams??false};
 normalizeContactSettings(input,p);
 p.edgeMargin=input.edgeMargin??.5;if(!Number.isFinite(p.edgeMargin)||p.edgeMargin<.1||p.edgeMargin>2)throw Error('外周からの余白は0.1〜2 mmで指定してください');
 p.bottomSeams=input.bottomSeams??false;if(typeof p.bottomSeams!=='boolean')throw Error('底面薄皮の分割線の設定が不正です');for(const [key,min,max]of [['bottomSectionLength',10,60],['bottomSeamWidth',.4,1.2]])if(!Number.isFinite(p[key])||p[key]<min||p[key]>max)throw Error('底面薄皮の分割間隔は10〜60 mm、幅は0.4〜1.2 mmで指定してください');
 p.wallBottomSkin=input.wallBottomSkin??false;p.bottomSkinLayers=input.bottomSkinLayers??2;if(typeof p.wallBottomSkin!=='boolean'||!Number.isInteger(p.bottomSkinLayers)||p.bottomSkinLayers<1||p.bottomSkinLayers>6)throw Error('底面の薄皮の層数は1〜6層で指定してください');p.edgeRibs=input.edgeRibs??false;if(typeof p.edgeRibs!=='boolean')throw Error('端のリブ配置の設定が不正です');p.autoReinforce=input.autoReinforce??false;p.filamentDiameter=input.filamentDiameter??1.75;p.materialDensity=input.materialDensity??1.24;
 if(typeof p.autoReinforce!=='boolean')throw Error('自動補強の設定が不正です');
 supportMaterialEstimate(0,p);
 if(!Number.isFinite(p.lineWidth)||p.lineWidth<.2||p.lineWidth>1||typeof p.fitLineWidth!=='boolean'||!Number.isInteger(p.wallLines)||p.wallLines<1||p.wallLines>8)throw Error('線幅は0.2〜1 mm、薄壁の線数は1〜8本で指定してください');
 if(!['auto','x','y'].includes(p.wallDirection))throw Error('薄壁の向きを選択してください');
 if(!Array.isArray(p.excludedRibs)||p.excludedRibs.length>96||new Set(p.excludedRibs).size!==p.excludedRibs.length||p.excludedRibs.some(v=>typeof v!=='string'||!v||v.length>500))throw Error('除外するリブの指定が不正です');
 if(p.fitLineWidth&&p.style==='walls')p.wallThickness=Number((p.lineWidth*p.wallLines).toFixed(6));
 if(typeof p.wallRoof!=='boolean'||!Number.isInteger(p.roofLayers)||p.roofLayers<1||p.roofLayers>6)throw Error('薄皮の層数は1〜6層で指定してください');
 if(typeof p.roofTabs!=='boolean'||typeof p.roofSeams!=='boolean')throw Error('薄皮のタブ・分割線の設定が不正です');
 for(const [key,min,max,label]of [['roofTabLength',3,8,'タブの張り出し'],['roofSectionLength',10,60,'薄皮の分割間隔'],['roofSeamWidth',.4,1.2,'分割線の幅']])if(!Number.isFinite(p[key])||p[key]<min||p[key]>max)throw Error(label+'は'+min+'〜'+max+' mmで指定してください');
 if(!Array.isArray(p.roofTabPlacements)||p.roofTabPlacements.length>64||new Set(p.roofTabPlacements.map(v=>v?.sectionId)).size!==p.roofTabPlacements.length||p.roofTabPlacements.some(v=>!v||typeof v.sectionId!=='string'||v.sectionId.length>500||![1,-1].includes(v.side)||!Number.isFinite(v.position)||v.position<0||v.position>1))throw Error('タブの指定位置が不正です。位置を選び直してください');
 if(typeof p.wallWindows!=='boolean')throw Error('窓抜きの設定が不正です');
 if(typeof p.wallTies!=='boolean'||!Number.isFinite(p.tieInterval)||p.tieInterval<8||p.tieInterval>60)throw Error('横つなぎの高さ間隔は8〜60 mmで指定してください');
 if(!['posts','walls'].includes(p.style))throw Error('サポートの形を選択してください');
 if(!Number.isFinite(p.wallPitch)||p.wallPitch<2||p.wallPitch>15||!Number.isFinite(p.wallThickness)||p.wallThickness<.4||p.wallThickness>2||p.wallThickness>=p.wallPitch)throw Error('薄壁の間隔は2〜15 mm、厚みは0.4〜2 mmで、厚みを間隔より小さくしてください');
 if(!Number.isFinite(p.layerHeight)||p.layerHeight<.06||p.layerHeight>.4)throw Error('積層ピッチは0.06〜0.4 mmで指定してください');
 if(p.style==='walls'&&(p.topGap<p.layerHeight-1e-6||Math.abs(p.topGap/p.layerHeight-Math.round(p.topGap/p.layerHeight))>1e-5))throw Error('薄壁の上側のすき間は、積層ピッチの1倍以上の整数倍にしてください');
 if(!['bed','bedOrModel'].includes(p.baseMode))throw Error('サポートを支え始める場所を選択してください');
 if(!Number.isFinite(p.bottomGap)||p.bottomGap<.05||p.bottomGap>1.5)throw Error('モデル上の接点の縦すき間は0.05〜1.5 mmで指定してください');
 for(const [key,min,max]of [['spacing',8,100],['footDiameter',6,50],['footThickness',.4,3],['postDiameter',2,12],['tipDiameter',.6,6],['topGap',.05,1.5],['bedZ',-10000,10000],['maxSupports',1,36],['braceDiameter',1,5]])if(!Number.isFinite(p[key])||p[key]<min||p[key]>max)throw Error(({spacing:'支柱の間隔',footDiameter:'足の直径',footThickness:'足の厚み',postDiameter:'支柱の直径',tipDiameter:'先端の直径',topGap:'上面との縦すき間',bedZ:'ベッド高さ',maxSupports:'本数の上限',braceDiameter:'斜め補強の直径'})[key]+'は'+min+'〜'+max+(key==='maxSupports'?'本':' mm')+'で指定してください');
 if(!Number.isInteger(p.maxSupports)||p.tipDiameter>p.postDiameter||p.footDiameter<p.postDiameter+2||(p.braces&&p.braceDiameter>p.postDiameter))throw Error('足・支柱・先端・補強の太さの関係を確認してください');
 if(!['auto','face'].includes(p.mode))throw Error('サポートの配置方法を選択してください');
 if(p.mode==='face')p.faces=validateSupportFaces(p.faces,p.target);
 for(const key of ['connectFeet','braces','lockToModel'])if(typeof p[key]!=='boolean')throw Error('サポートの設定が不正です');
 return p;
}
function cone(r1,r2,z,height){return R.drawCircle(r1).sketchOnPlane('XY',z).loftWith([R.drawCircle(r2).sketchOnPlane('XY',z+height)]);}
function postAt(point,normal,p,base){
 const [x,y,surfaceZ]=point,h=surfaceZ-p.topGap,tipR=p.tipDiameter/2,postR=p.postDiameter/2,slope=Math.hypot(normal[0],normal[1])/-normal[2],tipBase=h-tipR*slope-.3,modelBase=base.kind==='model',baseZ=base.point[2]+(modelBase?p.bottomGap:0),baseSlope=modelBase?Math.hypot(base.normal[0],base.normal[1])/base.normal[2]:0,rootZ=modelBase?baseZ+tipR*baseSlope+.3:p.bedZ+p.footThickness,available=tipBase-rootZ;
 if(available<3)return null;
 const rootHeight=Math.min(4,available*.25),tipHeight=Math.min(4,available*.35),stemTop=tipBase-tipHeight,parts=[];
 let local,shifted,split,plane,lowerPlane,lowerSplit;
 try{
  if(modelBase)parts.push(R.makeCylinder(tipR,tipR*baseSlope*2+.4,[0,0,baseZ-tipR*baseSlope-.05]));
  else parts.push(R.makeCylinder(p.footDiameter/2,p.footThickness,[0,0,p.bedZ]));
  parts.push(cone(modelBase?tipR:Math.min(p.footDiameter/2-.5,postR*2),postR,rootZ-.05,rootHeight+.1));
  parts.push(R.makeCylinder(postR,stemTop-(rootZ+rootHeight)+.15,[0,0,rootZ+rootHeight-.05]));
  parts.push(cone(postR,tipR,stemTop-.05,tipHeight+.1));
  parts.push(R.makeCylinder(tipR,tipR*slope*2+.45,[0,0,tipBase-.05]));
  local=fuseSolids(parts);shifted=local.translate([x,y,0]);plane=new R.Plane([x,y,h],[1,0,-normal[0]/normal[2]],normal);split=shifted.split(plane);
  if(!split.positive)throw Error('先端の切断に失敗しました');
  let shape=split.positive;
  if(modelBase){lowerPlane=new R.Plane([x,y,baseZ],[1,0,-base.normal[0]/base.normal[2]],base.normal);lowerSplit=shape.split(lowerPlane);if(!lowerSplit.positive)throw Error('下側の接点を作成できませんでした');shape=lowerSplit.positive;lowerSplit.positive=null;}else split.positive=null;
  return {shape,point,tip:[x,y,h],base:{...base,tip:[x,y,baseZ]},stemTop,rootTop:rootZ+rootHeight};
 }finally{parts.forEach(s=>s.delete());local?.delete();if(shifted&&shifted!==local)shifted.delete();split?.positive?.delete();split?.negative?.delete();plane?.delete();lowerSplit?.positive?.delete();lowerSplit?.negative?.delete();lowerPlane?.delete();}
}
function clearOfModels(shape,bodies,bounds){
 const a=box(shape);
 for(const [id,model]of bodies){const b=bounds.get(id);if([0,1,2].some(i=>a[1][i]<b[0][i]-.02||a[0][i]>b[1][i]+.02))continue;const query=new R.DistanceTool();try{if(query.distanceBetween(shape,model)<.02)return false;}finally{query.delete();}}
 return true;
}
function links(points){
 if(points.length<2)return [];const connected=new Set([0]),edges=[];
 while(connected.size<points.length){let best=null;for(const i of connected)for(let j=0;j<points.length;j++)if(!connected.has(j)){const distance=Math.hypot(points[i].point[0]-points[j].point[0],points[i].point[1]-points[j].point[1]);if(!best||distance<best.distance)best={i,j,distance};}edges.push(best);connected.add(best.j);}
 return edges;
}
function rail(a,b,width,height,z){const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);let shape=R.makeBox([0,-width/2,z],[length,width/2,z+height]);try{const rotated=shape.rotate(Math.atan2(dy,dx)*180/Math.PI,[0,0,0],[0,0,1]);if(rotated!==shape)shape.delete();shape=rotated;return shape.translate([a[0],a[1],0]);}finally{shape.delete();}}
function diagonal(a,b,z,radius){const d=[b[0]-a[0],b[1]-a[1],Math.hypot(b[0]-a[0],b[1]-a[1])],length=Math.hypot(...d);return R.makeCylinder(radius,length,[a[0],a[1],z],d.map(v=>v/length));}
export function makePrintSupport(bodies,input,onProgress){
 const p=validatePrintSupport(input),model=bodies.get(p.target);if(!model)throw Error('サポートを付けるボディを選択してください');
 if(p.style==='walls')return makeWallSupports(bodies,p,onProgress);
 const selection=p.mode==='face'?resolveSupportFaces(model,p):null,faces=selection?.faces||model.faces,bounds=new Map([...bodies].map(([id,shape])=>[id,box(shape)])),candidates=[],seen=new Set(),posts=[],extras=[];
 let bases,selectedFacePreview=null;
 let skipped=0,omittedReinforcement=0,shape=null;
 try{
  selectedFacePreview=p.preview&&selection?supportSelectedFaceMeshes(selection):null;if(p.baseMode==='bedOrModel')bases=supportBaseSurfaces(bodies);
  for(const face of faces){
   if(face.geomType!=='PLANE')continue;const normal=vector(face.normalAt()),center=vector(face.center);if(normal[2]>-.5){if(p.mode==='face')throw Error('下向きの平面を選択してください（水平から60°以内）。');continue;}
   const bounds=box(face),xs=[],ys=[];if((bounds[1][0]-bounds[0][0])*(bounds[1][1]-bounds[0][1])/(p.spacing*p.spacing)>512)throw Error('配置候補が多すぎます。間隔を広げるか、対象の面を絞ってください。');for(let x=bounds[0][0]+1;x<=bounds[1][0]-1+.00001;x+=p.spacing)xs.push(x);for(let y=bounds[0][1]+1;y<=bounds[1][1]-1+.00001;y+=p.spacing)ys.push(y);
   const samples=[[center[0],center[1]],...xs.flatMap(x=>ys.map(y=>[x,y]))];
   // Face centroids may lie in a hole or outside a concave contour. Add a
   // bounded set of interior triangle seeds, then validate them against CAD.
   const mesh=face.mesh({tolerance:.3,angularTolerance:.4}),triangles=mesh.triangles;
   for(let t=0;t<triangles.length;t+=3*Math.max(1,Math.ceil(triangles.length/96))){const ids=triangles.slice(t,t+3);if(ids.length===3)samples.push([ids.reduce((s,i)=>s+mesh.vertices[i*3]/3,0),ids.reduce((s,i)=>s+mesh.vertices[i*3+1]/3,0)]);}
   for(const [x,y]of samples){if(candidates.length>=512)break;const z=center[2]-(normal[0]*(x-center[0])+normal[1]*(y-center[1]))/normal[2];if(z<=p.bedZ+p.footThickness+p.topGap+3)continue;const key=[x,y,z].map(v=>Math.round(v*1e5)).join(',');if(seen.has(key))continue;seen.add(key);
    const vertex=R.makeVertex([x,y,z]),query=new R.DistanceTool();let inside;try{inside=query.distanceBetween(vertex,face)<1e-5;}finally{vertex.delete();query.delete();}if(inside)candidates.push({point:[x,y,z],normal});
   }
  }
  const totalCandidates=candidates.length;
  while(candidates.length&&posts.length<p.maxSupports){
   if(posts.length)candidates.sort((a,b)=>Math.min(...posts.map(s=>Math.hypot(b.point[0]-s.point[0],b.point[1]-s.point[1])))-Math.min(...posts.map(s=>Math.hypot(a.point[0]-s.point[0],a.point[1]-s.point[1]))));
   const candidate=candidates.shift(),base=bases?.find(candidate.point,p.bedZ)||{kind:'bed',point:[candidate.point[0],candidate.point[1],p.bedZ],normal:[0,0,1]};if(posts.some(s=>Math.hypot(s.point[0]-candidate.point[0],s.point[1]-candidate.point[1])<Math.max(p.postDiameter*2,p.spacing*.6)&&base.point[2]<s.tip[2]&&s.base.point[2]<candidate.point[2]-p.topGap)){skipped++;continue;}
   onProgress?.({stage:'連結リブサポートを配置しています（'+(posts.length+1)+'本目）'});let post=postAt(candidate.point,candidate.normal,p,base);
   if(!post){skipped++;continue;}if(!clearOfModels(post.shape,bodies,bounds)){post.shape.delete();skipped++;continue;}posts.push(post);
  }
  if(!posts.length)throw Error(p.baseMode==='bed'?'ベッドから支えられる平面の下面が見つかりません。「ベッドとモデルの上面」を選ぶと板の間も支えられます。':'支えられる平面の下面が見つかりません。下面と土台の向き・支柱が入る高さ・側面との干渉を確認してください。');
  const edges=links(posts);
  for(const {i,j,distance}of edges){const a=posts[i],b=posts[j];
   if(p.connectFeet&&a.base.kind==='bed'&&b.base.kind==='bed'){const strip=rail(a.point,b.point,Math.min(p.postDiameter*1.5,p.footDiameter*.5),p.footThickness,p.bedZ);if(clearOfModels(strip,bodies,bounds))extras.push(strip);else{strip.delete();omittedReinforcement++;}}
   if(p.braces&&distance>p.postDiameter&&distance<=p.spacing*3){const start=Math.max(a.rootTop,b.rootTop)+1,limit=Math.min(a.stemTop,b.stemTop)-2;for(let z=start;z+distance<limit&&extras.length<120;z+=Math.max(20,distance+3))for(const [one,two]of [[a,b],[b,a]]){const brace=diagonal(one.point,two.point,z,p.braceDiameter/2);if(clearOfModels(brace,bodies,bounds))extras.push(brace);else{brace.delete();omittedReinforcement++;}}}
  }
  onProgress?.({stage:'足・支柱・補強をまとめています'});shape=fuseSolids([...posts.map(s=>s.shape),...extras],{onProgress});
  const check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);try{if(!check.IsValid())throw Error('正常な連結リブサポートを作成できませんでした');}finally{check.delete();}
  if(!clearOfModels(shape,bodies,bounds))throw Error('サポートが本体または別のボディに接触します。寸法・間隔を変更してください。');
  const solids=shape.solids;let components;try{components=solids.length;}finally{solids.forEach(s=>s.delete());}
  const modelBasedCount=posts.filter(s=>s.base.kind==='model').length,baseBodyIds=[...new Set(posts.flatMap(s=>s.base.bodyId?[s.base.bodyId]:[]))];
  const analysis={count:posts.length,contacts:posts.map(({point,tip,base})=>({point,tip,base})),topGap:p.topGap,bottomGap:p.bottomGap,baseMode:p.baseMode,modelBasedCount,bedBasedCount:posts.length-modelBasedCount,baseBodyIds,footDiameter:p.footDiameter,postDiameter:p.postDiameter,reinforcements:extras.length,omittedReinforcement,skipped,candidates:totalCandidates,limited:candidates.length>0,components,bedZ:p.bedZ};
  analysis.material=supportMaterialEstimate(R.measureVolume(shape),p);const selectedFaces=selectedFacePreview;const output=shape;shape=null;return {shape:output,analysis:{...analysis,selection:{mode:p.mode,count:selection?.faces.length||0}},...(selectedFaces?{selectedFaces}:{})};
 }finally{bases?.delete();faces.forEach(f=>f.delete());posts.forEach(s=>s.shape.delete());extras.forEach(s=>s.delete());shape?.delete();}
}
