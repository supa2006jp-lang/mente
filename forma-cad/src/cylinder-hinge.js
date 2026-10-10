import * as R from 'replicad';
import * as THREE from 'three';
import {fuseSolid} from './solid-fuse.js';

const v=a=>new THREE.Vector3(...a);
function surface(face){
 const owned=[],hold=o=>(owned.push(o),o);
 try{const s=hold(face.surface),c=hold(s.wrapped.Cylinder()),p=hold(c.Location()),a=hold(c.Axis()),d=hold(a.Direction());return {radius:c.Radius(),origin:[p.X(),p.Y(),p.Z()],axis:[d.X(),d.Y(),d.Z()],bounds:face.UVBounds};}
 finally{owned.reverse().forEach(o=>o.delete());}
}
function valid(shape){const oc=R.getOC(),check=new oc.BRepCheck_Analyzer(shape.wrapped,true,false),solids=shape.solids;try{return check.IsValid()&&solids.length===1&&R.measureVolume(shape)>1e-6;}finally{check.delete();solids.forEach(s=>s.delete());}}
export function cylinderHingeInfo(base){
 if(!base)throw Error('円柱または円筒を選択してください');
 const faces=base.faces,fail='平らな端面を持つ円柱・円筒を選択してください。段差や模様のある外周には対応していません';
 try{
  if(!valid(base)||faces.some(f=>!['PLANE','CYLINDRE'].includes(f.geomType)))throw Error(fail);
  const sides=faces.filter(f=>f.geomType==='CYLINDRE').map(surface).sort((a,b)=>b.radius-a.radius),outer=sides[0];if(!outer)throw Error(fail);
  let axis=v(outer.axis),height=outer.bounds.vMax-outer.bounds.vMin,origin=v(outer.origin).addScaledVector(axis,outer.bounds.vMin);
  const major=axis.toArray().reduce((best,x,i,a)=>Math.abs(x)>Math.abs(a[best])?i:best,0);if(axis.getComponent(major)<0){origin.addScaledVector(axis,height);axis.negate();}
  const inner=sides.filter(s=>s.radius<outer.radius-1e-5),innerRadius=inner[0]?.radius??0;
  if(sides.some(s=>{const d=v(s.origin).sub(origin);return Math.abs(Math.abs(v(s.axis).dot(axis))-1)>1e-7||d.addScaledVector(axis,-d.dot(axis)).length()>1e-5;})||inner.some(s=>Math.abs(s.radius-innerRadius)>1e-5))throw Error(fail);
  const levels=s=>[s.bounds.vMin,s.bounds.vMax].map(t=>v(s.origin).addScaledVector(v(s.axis),t).sub(origin).dot(axis));
  const lower=inner.length?Math.min(...inner.flatMap(levels)):0,upper=inner.length?Math.max(...inner.flatMap(levels)):0;
  const expected=Math.PI*(outer.radius**2*height-innerRadius**2*(upper-lower));if(height<=0||lower<-.0001||upper>height+.0001||Math.abs(R.measureVolume(base)-expected)>Math.max(.001,expected*1e-6))throw Error(fail);
  return {radius:outer.radius,height,origin:origin.toArray(),axis:axis.toArray(),hollow:inner.length>0,innerRadius,innerBottom:lower,innerTop:upper};
 }finally{faces.forEach(f=>f.delete());}
}
function orient(shape,axis,inverse=false){const z=new THREE.Vector3(0,0,1),a=v(axis),cross=z.clone().cross(a),angle=z.angleTo(a)*180/Math.PI;return angle>1e-8?shape.rotate((inverse?-1:1)*angle,[0,0,0],cross.length()>1e-8?cross.normalize().toArray():[1,0,0]):shape;}
function join(a,b){try{return fuseSolid(a,b);}finally{a.delete();b.delete();}}
function cut(a,b){try{return a.cut(b);}finally{a.delete();b.delete();}}
const overlap=(a,b)=>{const s=a.intersect(b);try{return Math.abs(R.measureVolume(s));}finally{s.delete();}};

export function makeCylinderHinge(base,p,onProgress=()=>{}){
 const info=cylinderHingeInfo(base),{radius:r,height:h}=info;
 const s={wall:2.4,floor:2.4,lidThickness:2.4,pinDiameter:3.6,hingeWall:2.4,radialGap:.4,axialGap:.4,seam:.3,hingeWidth:18,azimuth:0,angle:110,pose:'print',openBottom:false,holderLip:false,lipInset:1.2,lipHeight:2.4,fingerTab:false,tabWidth:18,tabReach:6,...p};
 for(const [key,label,min,max]of [['wall','本体壁厚',1.2,r-2],['floor','底厚',1.2,h-3],['lidThickness','蓋厚',1.2,10],['pinDiameter','軸径',2.4,10],['hingeWall','ヒンジ肉厚',1.2,8],['radialGap','軸の片側すき間',.25,1.5],['axialGap','軸方向のすき間',.25,1.5],['seam','蓋と本体のすき間',.2,2],['hingeWidth','ヒンジ幅',12,r*1.5],['azimuth','ヒンジ位置',0,360],['angle','開き角度',0,180]])if(!Number.isFinite(s[key])||s[key]<min||s[key]>max)throw Error(label+' は '+min+'〜'+max+' で指定してください');
 for(const key of ['openBottom','holderLip','fingerTab'])if(typeof s[key]!=='boolean')throw Error('底・掛かり段差・指掛けの設定が不正です');
 if(!['print','closed','open'].includes(s.pose))throw Error('配置を選び直してください');
 const innerRadius=info.hollow?info.innerRadius:r-s.wall,remainingWall=r-innerRadius;if(remainingWall<1.2-1e-5)throw Error('ヒンジを付けるには円筒の壁厚が1.2 mm以上必要です');
 if(s.holderLip)for(const [key,label,min,max]of [['lipInset','上端の段差の出幅',.6,Math.min(8,innerRadius-2)],['lipHeight','上端の段差の高さ',1.2,Math.min(12,h-1.2)]])if(!Number.isFinite(s[key])||s[key]<min||s[key]>max)throw Error(label+' は '+min+'〜'+max+' mmで指定してください');
 if(s.fingerTab)for(const [key,label,min,max]of [['tabWidth','くちばしの幅',4.8,r*1.5],['tabReach','くちばしの出幅',2,20]])if(!Number.isFinite(s[key])||s[key]<min||s[key]>max)throw Error(label+' は '+min+'〜'+max+' mmで指定してください');
 const pin=s.pinDiameter/2,barrel=pin+s.radialGap+s.hingeWall,width=s.hingeWidth,end=width*.25,first=-width/2,last=width/2,middleStart=first+end+s.axialGap,middleEnd=last-end-s.axialGap;
 if(h<barrel+1.2)throw Error('ヒンジを付けるには本体の高さが不足しています');
 if(middleEnd-middleStart<2.4)throw Error('ヒンジ幅を広げるか、軸方向のすき間を小さくしてください');
 const hy=-(r+barrel+1.2),hz=h+s.seam/2,hinge=[0,hy,hz];
 const cyl=(rad,from,to)=>R.makeCylinder(rad,to-from,[from,hy,hz],[1,0,0]);
 // Reach into the circular wall at both ends of each web without filling the bore.
 const innerEdge=-Math.sqrt(r*r-(width/2)**2)+Math.min(remainingWall*.6,1.2);
 const web=(from,to,lid)=>R.makeBox([from,hy,lid?h+s.seam:h-Math.max(s.lidThickness,barrel)],[to,innerEdge,lid?h+s.seam+s.lidThickness:h]);
 let body,lid;const parts=[];
 try{
  onProgress({stage:'円柱の開口と一体ヒンジを作成しています…'});
  body=orient(base.clone().translate(info.origin.map(x=>-x)),info.axis,true);
  if(s.azimuth)body=body.rotate(-s.azimuth,[0,0,0],[0,0,1]);
  // Existing cups/tubes retain their cavity and bottom. Only a top cap is opened.
  body=cut(body,R.makeCylinder(innerRadius,h+2,[0,0,s.openBottom?-1:info.hollow?info.innerTop:s.floor]));
  lid=R.makeCylinder(r,s.lidThickness,[0,0,h+s.seam]);
  for(const [from,to]of [[first,first+end],[last-end,last]])body=join(body,join(cyl(barrel,from,to),web(from,to,false)));
  body=join(body,cyl(pin,first,last));
  body=cut(body,R.makeCylinder(innerRadius,h+2,[0,0,s.openBottom?-1:info.hollow?info.innerBottom:s.floor]));
  if(s.holderLip){
   // A horizontal underside seats on the existing holder rim. The outside stays unchanged.
   const ring=cut(R.makeCylinder(r,s.lipHeight,[0,0,h-s.lipHeight]),R.makeCylinder(innerRadius-s.lipInset,s.lipHeight+2,[0,0,h-s.lipHeight-1]));body=join(body,ring);
  }
  if(s.fingerTab){
   // Broad, shallow triangular tab opposite the hinge. Round its pointed end in plan view.
   const half=s.tabWidth/2,root=Math.sqrt(r*r-half*half)-.6,tip=r+s.tabReach,round=Math.min(1.2,s.tabWidth*.1,s.tabReach*.25);
   const tab=R.draw([-half,root]).lineTo([half,root]).lineTo([round,tip-round]).threePointsArcTo([-round,tip-round],[0,tip]).close().sketchOnPlane('XY',h+s.seam).extrude(s.lidThickness);lid=join(lid,tab);
  }
  lid=join(lid,join(cyl(barrel,middleStart,middleEnd),web(middleStart,middleEnd,true)));
  lid=cut(lid,cyl(pin+s.radialGap,middleStart-.1,middleEnd+.1));
  if(!valid(body)||!valid(lid))throw Error('ヒンジと円筒をつなげられません。ヒンジ幅・壁厚を調整してください');
  const motion=[];
  for(const angle of [...new Set([0,30,60,90,120,150,180,s.angle])].sort((a,b)=>a-b)){const moved=lid.clone().rotate(angle,hinge,[1,0,0]);try{const volume=overlap(body,moved),distance=R.measureDistanceBetween(body,moved);if(volume>1e-5||distance<.15)throw Error('開閉中にヒンジが干渉します。すき間を増やしてください');motion.push({angle,distance,overlap:volume});}finally{moved.delete();}}
  const angle=s.pose==='print'?180:s.pose==='closed'?0:s.angle;
  if(angle)lid=lid.rotate(angle,hinge,[1,0,0]);
  if(s.pose==='print'){
   // Keep both bodies together with a vertical captive pin. Outside supports may be required.
   body=body.rotate(90,[0,0,0],[0,1,0]);lid=lid.rotate(90,[0,0,0],[0,1,0]);
   const boxes=[body.boundingBox,lid.boundingBox];let low;try{low=Math.min(...boxes.map(b=>b.bounds[0][2]));}finally{boxes.forEach(b=>b.delete());}
   body=body.translate([0,0,-low]);lid=lid.translate([0,0,-low]);
  }else{
   if(s.azimuth){body=body.rotate(s.azimuth,[0,0,0],[0,0,1]);lid=lid.rotate(s.azimuth,[0,0,0],[0,0,1]);}
   body=orient(body,info.axis).translate(info.origin);lid=orient(lid,info.axis).translate(info.origin);
  }
  parts.push(body,lid);body=lid=null;
  return {parts,analysis:{...info,wall:remainingWall,innerRadius,autoHollow:!info.hollow,openBottom:s.openBottom,holderLip:s.holderLip,lipInset:s.holderLip?s.lipInset:0,lipHeight:s.holderLip?s.lipHeight:0,mouthRadius:innerRadius-(s.holderLip?s.lipInset:0),fingerTab:s.fingerTab,tabWidth:s.fingerTab?s.tabWidth:0,tabReach:s.fingerTab?s.tabReach:0,hinge,angle,radialGap:s.radialGap,axialGap:s.axialGap,pinDiameter:s.pinDiameter,captive:true,motion,pose:s.pose,supportRequired:s.pose==='print'}};
 }catch(e){parts.forEach(s=>s.delete());throw e;}finally{body?.delete();lid?.delete();}
}
