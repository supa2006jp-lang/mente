import * as R from 'replicad';
import {selectedConnectedPlanarFace} from './cad-planar-face.js';
import {fuseSolids} from './solid-fuse.js';
export const printSupportDefaults={mode:'auto',spacing:25,footDiameter:20,footThickness:.8,postDiameter:4,tipDiameter:1.2,topGap:.2,bedZ:0,maxSupports:16,connectFeet:true,braces:true,braceDiameter:2,lockToModel:true};
const vector=v=>{try{return v.toTuple();}finally{v.delete();}};
const box=shape=>{const b=shape.boundingBox;try{return b.bounds;}finally{b.delete();}};
export function validatePrintSupport(input){
 const p={...printSupportDefaults,...input};
 for(const [key,min,max]of [['spacing',8,100],['footDiameter',6,50],['footThickness',.4,3],['postDiameter',2,12],['tipDiameter',.6,6],['topGap',.05,1.5],['bedZ',-10000,10000],['maxSupports',1,36],['braceDiameter',1,5]])if(!Number.isFinite(p[key])||p[key]<min||p[key]>max)throw Error(({spacing:'支柱の間隔',footDiameter:'足の直径',footThickness:'足の厚み',postDiameter:'支柱の直径',tipDiameter:'先端の直径',topGap:'上面との縦すき間',bedZ:'ベッド高さ',maxSupports:'本数の上限',braceDiameter:'斜め補強の直径'})[key]+'は'+min+'〜'+max+(key==='maxSupports'?'本':' mm')+'で指定してください');
 if(!Number.isInteger(p.maxSupports)||p.tipDiameter>p.postDiameter||p.footDiameter<p.postDiameter+2||(p.braces&&p.braceDiameter>p.postDiameter))throw Error('足・支柱・先端・補強の太さの関係を確認してください');
 if(!['auto','face'].includes(p.mode))throw Error('サポートの配置方法を選択してください');
 if(p.mode==='face'&&(!p.faces?.length||p.faces.length!==1||p.faces[0].bodyId!==p.target))throw Error('対象ボディの下面の平面を1つ選択してください');
 for(const key of ['connectFeet','braces','lockToModel'])if(typeof p[key]!=='boolean')throw Error('サポートの設定が不正です');
 return p;
}
function cone(r1,r2,z,height){return R.drawCircle(r1).sketchOnPlane('XY',z).loftWith([R.drawCircle(r2).sketchOnPlane('XY',z+height)]);}
function postAt(point,normal,p){
 const [x,y,surfaceZ]=point,h=surfaceZ-p.topGap,tipR=p.tipDiameter/2,postR=p.postDiameter/2,slope=Math.hypot(normal[0],normal[1])/-normal[2],tipBase=h-tipR*slope-.3,available=tipBase-p.bedZ-p.footThickness;
 if(available<3)return null;
 const rootHeight=Math.min(4,available*.25),tipHeight=Math.min(4,available*.35),rootZ=p.bedZ+p.footThickness,stemTop=tipBase-tipHeight,parts=[];
 let local,shifted,split,plane;
 try{
  parts.push(R.makeCylinder(p.footDiameter/2,p.footThickness,[0,0,p.bedZ]));
  parts.push(cone(Math.min(p.footDiameter/2-.5,postR*2),postR,rootZ-.05,rootHeight+.1));
  parts.push(R.makeCylinder(postR,stemTop-(rootZ+rootHeight)+.15,[0,0,rootZ+rootHeight-.05]));
  parts.push(cone(postR,tipR,stemTop-.05,tipHeight+.1));
  parts.push(R.makeCylinder(tipR,tipR*slope*2+.45,[0,0,tipBase-.05]));
  local=fuseSolids(parts);shifted=local.translate([x,y,0]);plane=new R.Plane([x,y,h],[1,0,-normal[0]/normal[2]],normal);split=shifted.split(plane);
  if(!split.positive)throw Error('先端の切断に失敗しました');
  const shape=split.positive;split.positive=null;return {shape,point,tip:[x,y,h],stemTop,rootTop:rootZ+rootHeight};
 }finally{parts.forEach(s=>s.delete());local?.delete();if(shifted&&shifted!==local)shifted.delete();split?.positive?.delete();split?.negative?.delete();plane?.delete();}
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
 const faces=p.mode==='face'?[selectedConnectedPlanarFace(model,p.faces[0])]:model.faces,bounds=new Map([...bodies].map(([id,shape])=>[id,box(shape)])),candidates=[],seen=new Set(),posts=[],extras=[];
 let skipped=0,omittedReinforcement=0,shape=null;
 try{
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
   const candidate=candidates.shift();if(posts.some(s=>Math.hypot(s.point[0]-candidate.point[0],s.point[1]-candidate.point[1])<Math.max(p.postDiameter*2,p.spacing*.6))){skipped++;continue;}
   onProgress?.({stage:'疑似サポートを配置しています（'+(posts.length+1)+'本目）'});let post=postAt(candidate.point,candidate.normal,p);
   if(!post){skipped++;continue;}if(!clearOfModels(post.shape,bodies,bounds)){post.shape.delete();skipped++;continue;}posts.push(post);
  }
  if(!posts.length)throw Error('ベッドから支えられる平面の下面が見つかりません。高さ・下面の向き・他の形状による遮りを確認してください。');
  const edges=links(posts);
  for(const {i,j,distance}of edges){const a=posts[i],b=posts[j];
   if(p.connectFeet){const strip=rail(a.point,b.point,Math.min(p.postDiameter*1.5,p.footDiameter*.5),p.footThickness,p.bedZ);if(clearOfModels(strip,bodies,bounds))extras.push(strip);else{strip.delete();omittedReinforcement++;}}
   if(p.braces&&distance>p.postDiameter&&distance<=p.spacing*3){const start=Math.max(a.rootTop,b.rootTop)+1,limit=Math.min(a.stemTop,b.stemTop)-2;for(let z=start;z+distance<limit&&extras.length<120;z+=Math.max(20,distance+3))for(const [one,two]of [[a,b],[b,a]]){const brace=diagonal(one.point,two.point,z,p.braceDiameter/2);if(clearOfModels(brace,bodies,bounds))extras.push(brace);else{brace.delete();omittedReinforcement++;}}}
  }
  onProgress?.({stage:'足・支柱・補強をまとめています'});shape=fuseSolids([...posts.map(s=>s.shape),...extras],{onProgress});
  const check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);try{if(!check.IsValid())throw Error('正常な疑似サポートを作成できませんでした');}finally{check.delete();}
  if(!clearOfModels(shape,bodies,bounds))throw Error('サポートが本体または別のボディに接触します。寸法・間隔を変更してください。');
  const solids=shape.solids;let components;try{components=solids.length;}finally{solids.forEach(s=>s.delete());}
  const analysis={count:posts.length,contacts:posts.map(({point,tip})=>({point,tip})),topGap:p.topGap,footDiameter:p.footDiameter,postDiameter:p.postDiameter,reinforcements:extras.length,omittedReinforcement,skipped,candidates:totalCandidates,limited:candidates.length>0,components,bedZ:p.bedZ};
  const output=shape;shape=null;return {shape:output,analysis};
 }finally{faces.forEach(f=>f.delete());posts.forEach(s=>s.shape.delete());extras.forEach(s=>s.delete());shape?.delete();}
}
