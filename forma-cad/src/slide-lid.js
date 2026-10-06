import {slideSurfaceGrip} from './slide-lid-surface-grip.js';
import {topSlideLayout,topSlideBlank,topSlideSweep,topSlideGrip,slideFinishingOptions,slideLeadIn} from './slide-lid-top.js';
import * as R from 'replicad';
import {slideLabelLayout,applySlideLabels} from './slide-lid-labels.js';
import {snapLidSides} from './snap-lid-opening.js';
import {slideLidOptions,slideOuterFillet,slidePocket,slideLock} from './slide-lid-options.js';
const tuple=v=>{try{return v.toTuple();}finally{v.delete();}};
const bounds=shape=>{const box=shape.boundingBox;try{return box.bounds;}finally{box.delete();}};
const fail='上面がXY平面に平行な、中身の詰まった直方体を選択してください。シェル・穴・フィレットを入れる前のボディで使用できます';
export function slideLidInfo(source,direction='long',entry='negative'){
 if(!source||!['long','short'].includes(direction)||!['negative','positive'].includes(entry))throw Error(fail);
 const faces=source.faces;let top,topWire;
 try{
  if(faces.length!==6||faces.some(f=>f.geomType!=='PLANE'))throw Error(fail);
  const horizontal=faces.filter(f=>Math.abs(tuple(f.normalAt())[2])>.999999);if(horizontal.length!==2)throw Error(fail);
  horizontal.sort((a,b)=>tuple(a.center)[2]-tuple(b.center)[2]);const bottom=tuple(horizontal[0].center),center=tuple(horizontal[1].center),height=center[2]-bottom[2];
  topWire=horizontal[1].outerWire();top=R.makeFace(topWire);const sides=snapLidSides(top),side=sides.reduce((a,b)=>(direction==='long'?b.length>a.length+1e-6:b.length<a.length-1e-6)?b:a);
  let axis=[...side.tangent];const main=Math.abs(axis[0])>=Math.abs(axis[1])?0:1;if(axis[main]<0)axis=axis.map(v=>-v);if(entry==='positive')axis=axis.map(v=>-v);
  const length=side.length,width=sides.find(s=>Math.abs(s.tangent[0]*axis[0]+s.tangent[1]*axis[1])<1e-6).length,angle=Math.atan2(axis[1],axis[0])*180/Math.PI;
  const local=source.clone().translate([-center[0],-center[1],-bottom[2]]).rotate(-angle,[0,0,0],[0,0,1]);
  try{const b=bounds(local),expected=[[-length/2,-width/2,0],[length/2,width/2,height]];if(b.some((point,i)=>point.some((v,j)=>Math.abs(v-expected[i][j])>1e-5))||Math.abs(R.measureVolume(source)-length*width*height)>Math.max(1e-5,length*width*height*1e-8))throw Error(fail);}finally{local.delete();}
  return {length,width,height,center:[center[0],center[1],bottom[2]],angle,axis:[...axis,0],exitVector:[-axis[0],-axis[1],0]};
 }catch{throw Error(fail);}finally{top?.delete();topWire?.delete();faces.forEach(f=>f.delete());}
}
function sectionPrism(points,start,end){
 let plane;try{let drawing=R.draw(points[0]);for(const point of points.slice(1))drawing=drawing.lineTo(point);plane=new R.Plane([start,0,0],[0,1,0],[1,0,0]);return drawing.close().sketchOnPlane(plane).extrude(end-start);}finally{plane?.delete();}
}
function valid(shape,label){const check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false),solids=shape.solids;try{if(!check.IsValid()||solids.length!==1||!(R.measureVolume(shape)>1e-7))throw Error(label+'を有効なソリッドにできません。寸法を調整してください');}finally{check.delete();solids.forEach(s=>s.delete());}}
export function makeSlideLid(source,p){
 if(p.lidStyle!==undefined&&!['top','inset'].includes(p.lidStyle))throw Error('蓋の形を選択してください');
 if(!['print','assembled'].includes(p.pose))throw Error('配置を選択してください');
 const info=slideLidInfo(source,p.direction,p.entry),{length:L,width:W,height:H}=info;
 for(const key of ['wall','floor','lidThickness','railDepth','cover','clearance'])if(!Number.isFinite(p[key])||p[key]<=0)throw Error('壁厚・底厚・蓋厚・溝の寸法は0より大きい数値で指定してください');
 const {wall:w,floor,railDepth:d,cover,clearance:g,lidThickness:t}=p;
 if(Math.min(w,floor,t,cover)<1.2||d<.6||g<.05||g>1)throw Error('0.6 mmノズル用に壁・底・蓋・溝上部の厚さは1.2 mm以上、溝深さは0.6 mm以上、すき間は0.05〜1 mmにしてください');
 if(w-d<1.2-1e-6||d-g<.6-1e-6)throw Error('溝の外側に1.2 mm以上の肉厚、蓋の掛かりに0.6 mm以上が必要です。壁厚・溝深さ・すき間を調整してください');
 const top=p.lidStyle==='top'?topSlideLayout(info,p):null,bodyHeight=top?.bodyHeight??H,S=W/2-w,upper=top?.upper??H-cover,lower=top?.lower??upper-t-2*g,k=g*(Math.SQRT2-1),tipHeight=top?.tipHeight??upper-lower-2*d-2*k;
 if(tipHeight<1.2-1e-6)throw Error('蓋の両端が薄くなりすぎます。蓋厚を増やすか溝深さを小さくしてください');
 if(L-2*w<6||W-2*w<6||lower-floor<3)throw Error('収納部分の大きさが足りません。壁・底・蓋を薄くするか、元の直方体を大きくしてください');
 if(p.grip!==undefined&&typeof p.grip!=='boolean')throw Error('指掛け溝の設定を確認してください');
 const finishing=slideFinishingOptions(p,info,top),options=slideLidOptions(p,info,lower),labels=slideLabelLayout(p,options,lower);const objects=[],hold=shape=>(objects.push(shape),shape);
 try{
  let hollow=hold(source.clone().translate(info.center.map(v=>-v)).rotate(-info.angle,[0,0,0],[0,0,1]));
  if(top)hollow=hold(hollow.cut(hold(R.makeBox([-L/2-1,-W/2-1,bodyHeight],[L/2+1,W/2+1,H+1]))));
  if(options.fillet?.outerRadius){const rounded=slideOuterFillet(hollow,options.fillet);hollow=hold(rounded.shape);options.fillet.outerEdges=rounded.edges;}
  for(const pocket of options.pockets){const cavity=hold(slidePocket(pocket,floor,H+1,options.fillet));hollow=hold(hollow.cut(cavity));}
  // Clear everything above the divider/fillet tops without changing the sliding rails.
  if(options.divider||options.fillet?.innerRadius){const upperPocket=hold(R.makeBox([-L/2+w,-S,lower],[L/2-w,S,H+1]));hollow=hold(hollow.cut(upperPocket));}
  const channelPoints=[[-S,lower],[S,lower],[S+d,lower+d],[S+d,upper-d],[S,upper],[-S,upper],[-S-d,upper-d],[-S-d,lower+d]];
  const channel=hold(sectionPrism(channelPoints,-L/2-.02,L/2-w)),grooved=hold(hollow.cut(channel));
  // Remove the entrance roof entirely so no bridge spans the open end when printed.
  const entrance=hold(R.makeBox([-L/2-.02,-S-d,lower],[ -L/2+w+.02,S+d,H+.02]));let body=hold(grooved.cut(entrance));
  // Inset every channel surface by the same normal clearance, including 45 degree edges.
  const root=S-k,tip=S+d-g,low=lower+g,high=upper-g;
  const lidPoints=[[-root,low],[root,low],[tip,lower+d+k],[tip,upper-d-k],[root,high],[-root,high],[-tip,upper-d-k],[-tip,lower+d+k]];
  const front=-L/2+g,back=L/2-w-g,lidBlank=top?topSlideBlank(top,info,sectionPrism,hold,finishing.lidCorners):hold(sectionPrism(lidPoints,front,back));let lid=lidBlank,grip=null;
  if(p.grip&&top){const out=topSlideGrip(lid,top,info,p,hold);lid=out.lid;grip=out.grip;}
  if(p.grip&&!top){const width=Math.min(18,2*root-3),depth=Math.min(.8,t-1.2),gripLength=Math.min(6,back-front-4);if(width<3||gripLength<2)throw Error('指掛け溝を入れる余裕がありません');const tool=hold(R.drawRoundedRectangle(gripLength,width,.8).sketchOnPlane('XY',high-depth).extrude(depth+.02).translate([front+2+gripLength/2,0,0]));lid=hold(lidBlank.cut(tool));grip={width,length:gripLength,depth};}
  const textured=slideSurfaceGrip(lid,p,info,top,upper,hold);lid=textured.lid;const surfaceGrip=textured.surfaceGrip;
  ({body,lid}=slideLeadIn(body,lid,p,info,top,lower,hold,finishing.leadIn));
  if(labels.length)body=hold(applySlideLabels(body,p,labels));
  const clearPathBody=body;let lock=null;
  if(p.lock){const locked=slideLock(body,lid,p,top?{...info,lockCenters:[-(S-g-top.stemWidth/2),S-g-top.stemWidth/2],lockWidth:top.stemWidth,lockThickness:top.railCore}:info,lower);body=hold(locked.body);lid=hold(locked.lid);lock=locked.analysis;}
  valid(body,'本体');valid(lid,'蓋');
  const overlap=R.measureVolume(hold(body.intersect(lid))),travel=top?L+2*g:L-w,swept=top?topSlideSweep(top,info,travel,sectionPrism,hold):hold(sectionPrism(lidPoints,front-travel,back)),slidingOverlap=R.measureVolume(hold(clearPathBody.intersect(swept)));
  if(lock)lock.slidingContact=R.measureVolume(hold(body.intersect(swept)));
  if(overlap>1e-5||slidingOverlap>1e-5)throw Error('蓋の開閉経路が本体と干渉します。寸法を調整してください');
  const toWorld=shape=>shape.clone().rotate(info.angle,[0,0,0],[0,0,1]).translate(info.center);
  let bodyOut=toWorld(body),lidOut=toWorld(lid);let printTranslation=null;
  try{if(p.pose==='print'){if(top){lidOut.delete();const flipped=lid.clone().rotate(180,[0,0,0],[1,0,0]);try{lidOut=toWorld(flipped);}finally{flipped.delete();}}bodyOut=bodyOut.translate([0,0,-info.center[2]]);const bb=bounds(bodyOut),lb=bounds(lidOut);printTranslation=[bb[1][0]-lb[0][0]+10,0,-lb[0][2]];lidOut=lidOut.translate(printTranslation);}
   return {body:bodyOut,lid:lidOut,analysis:{...info,lidStyle:top?'top':'inset',...finishing,bodyHeight,capLower:top?.capLower??null,capUpper:top?.capUpper??null,railStemWidth:top?.stemWidth??null,printFlipped:!!top,wall:w,floor,lidThickness:t,railDepth:d,cover,clearance:g,tipHeight,remainingWall:w-d,engagement:d-g,cavityLength:L-2*w,cavityWidth:2*S,cavityHeight:low-floor,grooveLower:lower,grooveUpper:upper,lidFront:front,lidBack:back,grip,surfaceGrip,lock,labels:labels.map(({pattern,...entry})=>entry),fillet:options.fillet,divider:options.divider,overlap,slidingOverlap,openTravel:travel,printTranslation}};
  }catch(error){bodyOut.delete();lidOut.delete();throw error;}
 }finally{objects.reverse().forEach(shape=>shape.delete());}
}
