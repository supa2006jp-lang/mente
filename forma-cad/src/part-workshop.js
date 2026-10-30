import * as R from 'replicad';
import * as THREE from 'three';
import ClipperLib from 'clipper-lib';
import {assemblyBasis} from './assembly-placement.js';
import {inspectAssemblyContact} from './assembly-contact.js';
import {fuseSolid,fuseSolids} from './solid-fuse.js';
import {templatePlacement} from './template-placement.js';
import {applySlideLabels} from './slide-lid-labels.js';

const SCALE=100000;
const xyz=v=>{try{return v.toTuple();}finally{v.delete();}};
const bounds=s=>{const b=s.boundingBox;try{return b.bounds.map(p=>[...p]);}finally{b.delete();}};
const finite=(v,min,max,label)=>{if(!Number.isFinite(v)||v<min||v>max)throw Error(label+'を確認してください');return v;};
const vec=(v,label)=>{if(!Array.isArray(v)||v.length!==3||v.some(x=>!Number.isFinite(x)||Math.abs(x)>100000))throw Error(label+'を確認してください');return new THREE.Vector3(...v);};
function solid(s,label){const parts=s.solids;let check;try{check=new (R.getOC().BRepCheck_Analyzer)(s.wrapped,true,false);if(parts.length!==1||!check.IsValid()||R.measureVolume(s)<1e-7)throw Error(label+'を一つながりの立体にできません。寸法や接合位置を変更してください');}finally{check?.delete();parts.forEach(p=>p.delete());}}
function paths(mesh,u,v){
 if(mesh.triangles.length>600000)throw Error('輪郭が複雑すぎます。対象を減らしてください');
 const p=mesh.vertices,result=[];for(let i=0;i<mesh.triangles.length;i+=3){const tri=mesh.triangles.slice(i,i+3).map(j=>{const a=new THREE.Vector3(...p.slice(j*3,j*3+3));return {X:Math.round(a.dot(u)*SCALE),Y:Math.round(a.dot(v)*SCALE)};});if(Math.abs(ClipperLib.Clipper.Area(tri))<1)continue;if(!ClipperLib.Clipper.Orientation(tri))tri.reverse();result.push(tri);}return booleanPaths(result,[],ClipperLib.ClipType.ctUnion);
}
function booleanPaths(a,b,kind){const c=new ClipperLib.Clipper(),out=[];c.AddPaths(a,ClipperLib.PolyType.ptSubject,true);if(b.length)c.AddPaths(b,ClipperLib.PolyType.ptClip,true);c.Execute(kind,out,ClipperLib.PolyFillType.pftNonZero,ClipperLib.PolyFillType.pftNonZero);return out;}
function expand(a,delta){const c=new ClipperLib.ClipperOffset(2,.02*SCALE),out=[];c.AddPaths(a,ClipperLib.JoinType.jtRound,ClipperLib.EndType.etClosedPolygon);c.Execute(out,delta*SCALE);return out;}
const ring=p=>p.map(({X,Y})=>[X/SCALE,Y/SCALE]);
const limits=p=>{const a=ring(p);return {min:[Math.min(...a.map(p=>p[0])),Math.min(...a.map(p=>p[1]))],max:[Math.max(...a.map(p=>p[0])),Math.max(...a.map(p=>p[1]))]};};
function prism(points,origin,u,n,depth){const drawing=R.draw(points[0]);for(const p of points.slice(1))drawing.lineTo(p);return drawing.close().sketchOnPlane(new R.Plane(origin,u,n)).extrude(depth);}

// Raster glyphs can contain strokes touching only at one corner. Extruding
// that contact produces a non-manifold vertical edge. A 0.02 mm outline
// expansion joins those strokes with positive material before the CAD fuse.
function printableLabel(entry){
 const toPath=(ring,hole)=>{const path=ring.map(([x,y])=>({X:Math.round((entry.center[0]+(x-.5)*entry.width)*SCALE),Y:Math.round((entry.center[1]+(y-.5)*entry.height)*SCALE)}));if(ClipperLib.Clipper.Orientation(path)===hole)path.reverse();return path;},paths=entry.pattern.regions.flatMap(r=>[toPath(r.outer,false),...r.holes.map(h=>toPath(h,true))]),grown=expand(paths,.02),c=new ClipperLib.Clipper(),tree=new ClipperLib.PolyTree(),regions=[];
 c.StrictlySimple=true;c.AddPaths(grown,ClipperLib.PolyType.ptSubject,true);c.Execute(ClipperLib.ClipType.ctUnion,tree,ClipperLib.PolyFillType.pftNonZero,ClipperLib.PolyFillType.pftNonZero);
 const normalized=path=>ClipperLib.Clipper.CleanPolygon(path,.001*SCALE).map(p=>[(p.X/SCALE-entry.center[0])/entry.width+.5,(p.Y/SCALE-entry.center[1])/entry.height+.5]);
 function visit(node){if(node.Contour().length&&!node.IsHole()){const outer=normalized(node.Contour()),holes=node.Childs().filter(n=>n.IsHole()).map(n=>normalized(n.Contour())).filter(h=>h.length>=3);if(outer.length>=3)regions.push({outer,holes});}node.Childs().forEach(visit);}visit(tree);if(!regions.length)throw Error('表示名の文字が小さすぎます');return {...entry,pattern:{...entry.pattern,regions}};
}

export function motionSettings(p,bodies){
 const targets=[...new Set(p.targets||[])];if(!targets.length||targets.length>30||targets.some(id=>!bodies.has(id)))throw Error('動かすボディを選択してください');
 if(!['rotate','slide'].includes(p.motion))throw Error('回転かスライドを選択してください');
 const axis=vec(p.axisVector,'移動軸');if(axis.length()<1e-8)throw Error('軸の向きを指定してください');axis.normalize();vec(p.pivot,'軸の位置');
 finite(p.min,-10000,10000,'開始値');finite(p.max,-10000,10000,'終了値');if(p.max<=p.min)throw Error('終了値を開始値より大きくしてください');
 finite(p.value??0,p.min,p.max,'現在位置');if(p.motion==='rotate'&&(p.min<-360||p.max>360))throw Error('回転範囲は−360〜360°です');
 return {...p,targets,value:p.value??0,axisVector:axis.toArray()};
}
function moved(shape,p,value){return p.motion==='rotate'?shape.clone().rotate(value,p.pivot,p.axisVector):shape.clone().translate(p.axisVector.map(a=>a*value));}
export function checkMotion(bodies,input,onProgress){
 const p=motionSettings(input,bodies),stationary=new Map([...bodies].filter(([id])=>!p.targets.includes(id)));
 if(!stationary.size)throw Error('干渉を確認する固定側のボディがありません');
 const values=p.type==='motionRangeCheck'?Array.from({length:13},(_,i)=>p.min+(p.max-p.min)*i/12):[p.value],rows=[];let highlights=[];
 for(const [i,value]of values.entries()){onProgress?.({stage:'動作位置を検査しています '+(i+1)+' / '+values.length});const moving=new Map();try{for(const id of p.targets)moving.set(id,moved(bodies.get(id),p,value));const result=inspectAssemblyContact(moving,stationary,{preview:values.length===1,maxMs:4000,onProgress});rows.push({value,...result.report});if(values.length===1)highlights=result.highlights;}finally{moving.forEach(s=>s.delete());}}
 return {rows,highlights};
}

export function makeStorageTray(bodies,p,onProgress){
 const targets=[...new Set(p.targets||[])];if(!targets.length||targets.length>24||targets.some(id=>!bodies.has(id)))throw Error('収納するボディを1〜24個選択してください');
 const clearance=finite(p.clearance,.1,5,'すき間'),wall=finite(p.wall,1,20,'壁厚'),floor=finite(p.floor,1,20,'底厚'),depth=finite(p.depth,1,150,'ポケット深さ'),gap=finite(p.gap,wall,50,'ポケット間隔'),columns=Math.round(finite(p.columns,1,targets.length,'列数'));
 const u=new THREE.Vector3(1,0,0),v=new THREE.Vector3(0,1,0),items=[];
 for(const [i,id]of targets.entries()){onProgress?.({stage:'収納する輪郭を取得しています '+(i+1)+' / '+targets.length});let outline=paths(bodies.get(id).mesh({tolerance:.04,angularTolerance:.15}),u,v).filter(path=>ClipperLib.Clipper.Orientation(path));outline=expand(outline,clearance+.04).filter(path=>ClipperLib.Clipper.Orientation(path));if(!outline.length)throw Error('収納用の輪郭が空です');const all=outline.flat(),box=limits(all);items.push({id,outline,box,bounds:bounds(bodies.get(id))});}
 const notch=p.fingerAccess===true?finite(p.fingerRadius,2,20,'指掛け半径'):0,labelHeight=p.labels===true?8:0;
 const widths=Array.from({length:columns},(_,col)=>Math.max(...items.filter((_,i)=>i%columns===col).map(a=>a.box.max[0]-a.box.min[0]))+2*notch),rowCount=Math.ceil(items.length/columns),heights=Array.from({length:rowCount},(_,row)=>Math.max(...items.slice(row*columns,(row+1)*columns).map(a=>a.box.max[1]-a.box.min[1]))+2*notch+labelHeight);
 const width=widths.reduce((a,b)=>a+b,0)+gap*(columns-1)+wall*2,height=heights.reduce((a,b)=>a+b,0)+gap*(rowCount-1)+wall*2;
 if(width>1000||height>1000)throw Error('トレーが大きすぎます。対象数や列数を変更してください');
 const top=floor+depth,tools=[],labels=[],pockets=[];let shape;
 try{
  shape=R.makeBox([0,0,0],[width,height,top]);
  for(const [i,item]of items.entries()){
   const col=i%columns,row=Math.floor(i/columns),x=wall+widths.slice(0,col).reduce((a,b)=>a+b+gap,0),y=wall+heights.slice(0,row).reduce((a,b)=>a+b+gap,0),cx=x+widths[col]/2,cy=y+labelHeight+(heights[row]-labelHeight)/2,dx=cx-(item.box.min[0]+item.box.max[0])/2,dy=cy-(item.box.min[1]+item.box.max[1])/2;
   for(const path of item.outline)tools.push(prism(ring(path).map(([x,y])=>[x+dx,y+dy]),[0,0,floor],[1,0,0],[0,0,1],depth+.1));
   if(notch){const left=item.box.min[0]+dx,right=item.box.max[0]+dx;for(const px of [left,right])tools.push(R.drawCircle(notch).sketchOnPlane(new R.Plane([px,cy,floor],[1,0,0],[0,0,1])).extrude(depth+.1));}
   const text=p.labelTexts?.[i]||'',pattern=p.labelPatterns?.[i];
   if(p.labels&&text){if(typeof text!=='string'||[...text].length>12||!pattern||pattern.text!==text||!Number.isFinite(pattern.aspect)||pattern.aspect<=0||!Array.isArray(pattern.regions)||!pattern.regions.length||pattern.regions.length>80||JSON.stringify(pattern).length>300000||pattern.regions.some(r=>!Array.isArray(r.outer)||!Array.isArray(r.holes)||[r.outer,...r.holes].some(ring=>!Array.isArray(ring)||ring.length<3||ring.length>6000||ring.some(point=>!Array.isArray(point)||point.length!==2||point.some(v=>!Number.isFinite(v)||v<0||v>1)))))throw Error('文字の輪郭を確認してください');const h=Math.min(4,(widths[col]-2)/pattern.aspect);if(h<1.5)throw Error('表示名が細かすぎます。名前を短くしてください');labels.push({room:i+1,text,height:h,width:h*pattern.aspect,center:[cx,y+4],pattern});}
   pockets.push({id:item.id,translation:[dx,dy,floor-item.bounds[0][2]],center:[cx,cy],width:item.box.max[0]-item.box.min[0],height:item.box.max[1]-item.box.min[1]});
  }
  onProgress?.({stage:'収納ポケットを切り抜いています'});const compound=fuseSolids(tools);try{const next=shape.cut(compound);shape.delete();shape=next;}finally{compound.delete();tools.forEach(s=>s.delete());tools.length=0;}
  if(labels.length){const next=applySlideLabels(shape,{floor:top,labelDepth:.5,labelOperation:'emboss'},labels.map(printableLabel));shape.delete();shape=next;}
  solid(shape,'収納トレー');const offset=templatePlacement({min:[0,0,0],max:[width,height,top+.5]},[...bodies.values()].map(s=>{const b=bounds(s);return {min:b[0],max:b[1]};}),10),placed=shape.translate(offset);shape.delete();shape=null;
  return {shape:placed,info:{width,height,top,offset,pockets:pockets.map(a=>({...a,translation:a.translation.map((v,i)=>v+offset[i])})),labels:labels.map(({pattern,...a})=>a)}};
 }finally{shape?.delete();tools.forEach(s=>s.delete());}
}

// Only genuine, coplanar opposite faces are candidates; nearby bounding boxes
// alone must never select a joint plane.
export function dovetailInterface(bodies,p){
 const a=bodies.get(p.target),b=bodies.get(p.other);if(!a||!b||p.target===p.other)throw Error('凸側と凹側に別々のボディを選択してください');
 const af=a.faces,bf=b.faces,candidates=[];
 try{for(const f of af){if(f.geomType!=='PLANE')continue;const normal=xyz(f.normalAt()),n=new THREE.Vector3(...normal).normalize(),center=new THREE.Vector3(...xyz(f.center));if(p.faceNormal&&n.dot(vec(p.faceNormal,'選択面').normalize())<.9999)continue;if(p.facePoint&&Math.abs(center.clone().sub(vec(p.facePoint,'選択面')).dot(n))>.0001)continue;const {u,v}=assemblyBasis(normal);let first;
  for(const g of bf){if(g.geomType!=='PLANE')continue;const gn=new THREE.Vector3(...xyz(g.normalAt())).normalize();if(n.dot(gn)>-.99999)continue;const gc=new THREE.Vector3(...xyz(g.center));if(Math.abs(gc.clone().sub(center).dot(n))>.0001)continue;first??=paths(f.mesh(),u,v);const common=booleanPaths(first,paths(g.mesh(),u,v),ClipperLib.ClipType.ctIntersection).filter(path=>ClipperLib.Clipper.Orientation(path));for(const polygon of common){const area=Math.abs(ClipperLib.Clipper.Area(polygon))/SCALE**2;if(area>1)candidates.push({normal:n.toArray(),u:u.toArray(),v:v.toArray(),offset:center.dot(n),polygon,area});}
  }}
  candidates.sort((a,b)=>b.area-a.area);if(!candidates.length)throw Error('接している平面の境界がありません。面同士を合わせてから実行してください');const chosen=candidates[0],box=limits(chosen.polygon);return {...chosen,box};
 }finally{af.forEach(f=>f.delete());bf.forEach(f=>f.delete());}
}
export function makeDovetail(bodies,p,onProgress){
 const info=dovetailInterface(bodies,p),width=finite(p.width,1,500,'根元の幅'),depth=finite(p.depth,.5,100,'蟻の深さ'),angle=finite(p.angle,5,45,'開き角度'),clearance=finite(p.clearance,.02,2,'片側のすき間'),offset=finite(p.offset??0,-1000,1000,'横位置'),twist=finite(p.twist??0,-180,180,'差し込み方向');
 const n=new THREE.Vector3(...info.normal),u=new THREE.Vector3(...info.u).applyAxisAngle(n,twist*Math.PI/180),v=n.clone().cross(u),world=ring(info.polygon).map(([x,y])=>new THREE.Vector3(...info.u).multiplyScalar(x).addScaledVector(new THREE.Vector3(...info.v),y).addScaledVector(n,info.offset)),us=world.map(p=>p.dot(u)),vs=world.map(p=>p.dot(v)),cx=(Math.min(...us)+Math.max(...us))/2+offset,start=Math.min(...vs),length=Math.max(...vs)-start,flare=depth*Math.tan(angle*Math.PI/180),a=bodies.get(p.target),b=bodies.get(p.other);
 if(width+2*flare+2*clearance>Math.max(...us)-Math.min(...us)-.4)throw Error('接合面に対して蟻の幅が大きすぎます');
 const base=n.clone().multiplyScalar(info.offset).addScaledVector(v,start).addScaledVector(u,cx),profile=[[-width/2,-.2],[width/2,-.2],[width/2+flare,depth],[-width/2-flare,depth]],path=profile.map(([X,Y])=>({X:Math.round(X*SCALE),Y:Math.round(Y*SCALE)}));if(!ClipperLib.Clipper.Orientation(path))path.reverse();
 let male,groove,clipped,joined,cut,shared;
 try{onProgress?.({stage:'蟻継ぎの凸と溝を加工しています'});male=prism(profile,base.toArray(),u.toArray(),v.clone().negate().toArray(),-length);const expanded=expand([path],clearance)[0];groove=prism(ring(expanded),base.clone().addScaledVector(v,-clearance).toArray(),u.toArray(),v.clone().negate().toArray(),-(length+2*clearance));
  // Limit the projection to material in the receiver, but retain a short root
  // inside the male body so the result is one solid.
  const receiver=b.clone(),root=male.intersect(a);try{const tongue=male.intersect(receiver);try{if(R.measureVolume(tongue)<width*depth*.1)throw Error('凹側に十分な厚みがありません');clipped=fuseSolids([tongue,root]);}finally{tongue.delete();}}finally{root.delete();receiver.delete();}
  if(R.measureVolume(clipped)<length*depth*(width+flare)*.98)throw Error('蟻の深さや幅が接合面の材料からはみ出します。寸法・位置を変更してください');
  joined=fuseSolid(a,clipped);cut=b.cut(groove);solid(joined,'凸側');solid(cut,'凹側');
  if(R.measureVolume(cut)>=R.measureVolume(b)-.001)throw Error('凹側に溝を作れません');shared=joined.intersect(cut);if(Math.abs(R.measureVolume(shared))>1e-6)throw Error('接合部以外でボディが重なっています。位置合わせを確認してください');
  const result={items:[{id:p.target,shape:joined},{id:p.other,shape:cut}],info:{...info,width,depth,angle,clearance,twist,insertionAxis:v.toArray(),length}};joined=cut=null;return result;
 }finally{[male,groove,clipped,joined,cut,shared].forEach(s=>s?.delete());}
}
