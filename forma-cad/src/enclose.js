import * as R from 'replicad';
import {selectedCadFaces} from './face-pull.js';
function valid(shape){const check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);try{return check.IsValid();}finally{check.delete();}}
function booleanShape(a,b,common=false){const oc=R.getOC(),builder=common?new oc.BRepAlgoAPI_Common(a.wrapped,b.wrapped):new oc.BRepAlgoAPI_Cut(a.wrapped,b.wrapped);try{builder.SetNonDestructive(true);builder.SetFuzzyValue(1e-6);builder.Build();if(!builder.IsDone())throw Error('差し引きに失敗しました');const raw=builder.Shape();try{return raw.IsNull()?null:R.cast(raw).asShape3D();}finally{raw.delete();}}finally{builder.delete();}}
const volumeOf=shape=>shape?R.measureVolume(shape):0;
// Work on a deep copy: native offsets/booleans may update shared TShape flags.
function offsetSolid(source,distance){
 const oc=R.getOC(),builder=new oc.BRepOffsetAPI_MakeOffsetShape();let shape;
 try{
  builder.PerformByJoin(source.wrapped,distance,1e-6,oc.BRepOffset_Mode.BRepOffset_Skin,false,false,oc.GeomAbs_JoinType.GeomAbs_Arc,false);
  if(!builder.IsDone())throw Error('offset failed');
  shape=R.cast(builder.Shape()).asShape3D();
  if(shape instanceof R.Shell){const solid=R.makeSolid([shape]);shape.delete();shape=solid;}
  if(!valid(shape))throw Error('invalid offset');
  const output=shape;shape=null;return output;
 }finally{shape?.delete();builder.delete();}
}
function boxOpeningSide(selection){
 const normal=selection?.normal;if(!Array.isArray(normal)||normal.length!==3||normal.some(v=>!Number.isFinite(v)))throw Error('BOXの開口面を選び直してください');
 const axis=normal.reduce((best,value,i)=>Math.abs(value)>Math.abs(normal[best])?i:best,0);
 if(Math.abs(normal[axis])<.3)throw Error('BOXの開口面を選び直してください');
 return (normal[axis]>=0?'+':'-')+'XYZ'[axis];
}
export function encloseBody(base,thickness,{clearance=0,boxExtra=0,faces=[],boxMode=false,enclosureSplit='分割しない',hingeEdge,chestStyle=false}={}){
 if(!Number.isFinite(thickness)||thickness<.1||thickness>1000)throw Error('囲みの厚みは0.1〜1000 mmで指定してください');
 if(!Number.isFinite(clearance)||clearance<0||clearance>1000)throw Error('すき間は0〜1000 mmで指定してください');
 if(!base)throw Error('囲む対象のソリッドを選択してください');
 if(!Number.isFinite(boxExtra)||boxExtra<0||clearance+boxExtra>1000)throw Error('BOXの追加すき間が不正です');
 if(chestStyle&&!boxMode)throw Error('宝箱風はBOXを作る場合に使用できます');
 if(chestStyle&&!Object.hasOwn(AXES,enclosureSplit))throw Error('宝箱風には分割平面を選択してください');
 if(boxMode){
  const [lo,hi]=base.boundingBox.bounds,gap=clearance+boxExtra,insideLo=lo.map(v=>v-gap),insideHi=hi.map(v=>v+gap),outsideLo=insideLo.map(v=>v-thickness),outsideHi=insideHi.map(v=>v+thickness);
  let selected=[];try{if(faces.length)selected=selectedCadFaces(base,faces);for(const selection of faces){const side=boxOpeningSide(selection),axis='XYZ'.indexOf(side[1]);if(side[0]==='+')insideHi[axis]=outsideHi[axis]+thickness;else insideLo[axis]=outsideLo[axis]-thickness;}}finally{selected.forEach(face=>face.delete());}
  const outer=R.makeBox(outsideLo,outsideHi),innerBox=R.makeBox(insideLo,insideHi);let result;
  try{
   result=outer.cut(innerBox);
   if(chestStyle){const decorated=addChestRoof(result,outsideLo,outsideHi,{thickness,enclosureSplit,hingeEdge,faces});result.delete();result=decorated;}
   if(!valid(result)||R.measureVolume(result)<=1e-6)throw Error('BOXを作成できません。開口面を減らすか寸法を調整してください');
   const output=result;result=null;return output;
  }
  finally{result?.delete();outer.delete();innerBox.delete();}
 }
 let expanded,result,missing,overlap,source,inner;let openingFaces=[];
 const fail='この形状・厚み・すき間では囲みを作成できません。値を小さくするか、開口面を変更してください。細い溝や複雑なねじ面では作成できない場合があります';
 try{
  source=R.deserializeShape(base.serialize()).asShape3D();
  inner=clearance>0?offsetSolid(source,clearance):R.deserializeShape(source.serialize()).asShape3D();
  if(faces.length){
   openingFaces=selectedCadFaces(source,faces);
   // Native thick solid removes only the selected faces, including curved faces.
   // Its rim ends at the original opening; clearance removes the inner material.
   expanded=source.shell(-(clearance+thickness),f=>f.inList(openingFaces),1e-6);
  }else expanded=offsetSolid(source,clearance+thickness);
  if(!valid(expanded))throw Error(fail);
  const expandedVolume=R.measureVolume(expanded),tolerance=Math.max(1e-6,Math.abs(expandedVolume)*1e-8);
  if(!Number.isFinite(expandedVolume)||expandedVolume<=tolerance)throw Error(fail);
  if(!faces.length){missing=booleanShape(inner,expanded);if(Math.abs(volumeOf(missing))>tolerance)throw Error(fail);}
  result=booleanShape(expanded,inner);if(!result||!valid(result))throw Error(fail);
  const volume=R.measureVolume(result);
  if(!Number.isFinite(volume)||volume<=tolerance)throw Error(fail);
  if(!faces.length&&Math.abs(volume-(expandedVolume-R.measureVolume(inner)))>tolerance)throw Error(fail);
  overlap=booleanShape(result,inner,true);if(Math.abs(volumeOf(overlap))>tolerance)throw Error(fail);
  const output=result;result=null;return output;
 }catch(e){throw Error(fail);}finally{openingFaces.forEach(f=>f.delete());result?.delete();overlap?.delete();missing?.delete();expanded?.delete();inner?.delete();source?.delete();}
}
const AXES={XY:2,XZ:1,YZ:0};
function addChestRoof(shell,low,high,{thickness,enclosureSplit,hingeEdge,faces}){
 // The split plane's positive normal points into the lid.
 const n=AXES[enclosureSplit];
 if(faces.some(face=>boxOpeningSide(face)==='+'+'XYZ'[n]))throw Error('宝箱風の屋根側は開口できません。開口面を変更してください');
 const tangents=[0,1,2].filter(axis=>axis!==n),hingeAxis='XYZ'.indexOf(hingeEdge?.slice(1));
 const v=tangents.includes(hingeAxis)?hingeAxis:tangents.reduce((shorter,axis)=>high[axis]-low[axis]<high[shorter]-low[shorter]?axis:shorter);
 const u=tangents.find(axis=>axis!==v),span=high[v]-low[v],length=high[u]-low[u];
 if(span<Math.max(3,thickness*2)||length<Math.max(3,thickness*2))throw Error('宝箱風の屋根を作るにはBOXの幅が足りません');
 const rise=Math.min(span*.22,Math.max(2,thickness*1.8,span*.12));
 const bandHeight=Math.min(Math.max(.45,thickness*.32),rise*.35);
 const bandWidth=Math.min(Math.max(1.2,length*.055),thickness*1.2+1.2,length*.14);
 const rootDepth=Math.min(thickness*.4,.7);
 const xAxis=[0,0,0],normal=[0,0,0];xAxis[v]=1;
 // A sketch plane's normal is xAxis cross the positive lid direction.
 normal[u]=(v===0&&n===1||v===1&&n===2||v===2&&n===0)?1:-1;
 const roof=(from,to,lift)=>{
  const origin=[0,0,0];origin[v]=low[v];origin[n]=high[n]-rootDepth;origin[u]=normal[u]>0?from:to;
  const profile=R.draw([0,0]).lineTo([span,0]).lineTo([span,rootDepth+lift])
   .threePointsArcTo([0,rootDepth+lift],[span/2,rootDepth+rise+lift]).close();
  return profile.sketchOnPlane(new R.Plane(origin,xAxis,normal)).extrude(to-from);
 };
 let result=shell.clone();
 try{
  result=join(result,roof(low[u],high[u],0));
  const count=length>=75?3:2;
  for(let i=0;i<count;i++){
   const center=low[u]+length*(i+1)/(count+1);
   result=join(result,roof(center-bandWidth/2,center+bandWidth/2,bandHeight));
  }
  const output=result;result=null;return output;
 }finally{result?.delete();}
}
function boxBetween(lo,hi){return R.makeBox(lo.map((v,i)=>Math.min(v,hi[i])),lo.map((v,i)=>Math.max(v,hi[i])));}
function join(a,b){const result=a.fuse(b);a.delete();b.delete();return result;}
function subtract(a,b){const result=a.cut(b);a.delete();b.delete();return result;}
function overlapVolume(a,b){const common=a.intersect(b);try{return Math.abs(R.measureVolume(common));}finally{common.delete();}}
function hardwareScale(p){
 const scale=p.hardwareScale??1;
 if(!Number.isFinite(scale)||scale<1||scale>2)throw Error('ヒンジと爪の大きさは1〜2倍で指定してください');
 return scale;
}
function hingeRadii(p){
 const scale=hardwareScale(p),pinRadius=Math.max(1,p.thickness*.55)*scale;
 return {pinRadius,radius:pinRadius+p.hingeRadialGap+Math.max(.9,p.thickness*.65)*scale};
}
function outsetProfile(points,gap){
 // Offset each straight edge by the requested perpendicular clearance.
 // Intersecting adjacent offsets keeps sloped and horizontal locking faces aligned.
 const lines=points.map((a,i)=>{
  const b=points[(i+1)%points.length],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
  return {point:[a[0]-dy/length*gap,a[1]+dx/length*gap],direction:[dx,dy]};
 });
 return lines.map((current,i)=>{
  const previous=lines[(i+lines.length-1)%lines.length],a=previous.point,b=current.point,u=previous.direction,v=current.direction;
  const delta=[b[0]-a[0],b[1]-a[1]],cross=u[0]*v[1]-u[1]*v[0],distance=(delta[0]*v[1]-delta[1]*v[0])/cross;
  return [a[0]+distance*u[0],a[1]+distance*u[1]];
 });
}
function snapLatchAssembly(base,lid,outerBounds,p,n,v,u,hingeSide){
 const scale=hardwareScale(p),gap=p.latchGap,beadRadius=1.25*scale,engagement=p.latchEngagement??(1.25-gap-.1),triangle=(p.latchProfile??'round')==='triangle';
 if(!['round','triangle'].includes(p.latchProfile??'round'))throw Error('爪の形状を選び直してください');
 if(!Number.isFinite(gap)||gap<.2||gap>.8)throw Error('爪と溝のすき間は0.2〜0.8 mmで指定してください');
 if(!Number.isFinite(engagement)||engagement<.1||engagement>1.5)throw Error('爪の掛かり量は0.1〜1.5 mmで指定してください');
 const opposite=(hingeSide===1?'-':'+')+'XYZ'[v];
 if(p.faces?.some(face=>boxOpeningSide(face)===opposite))throw Error('爪を付ける側のBOX面は開口できません。開口面かヒンジ辺を変更してください');
 const [low,high]=outerBounds,wall=hingeSide===1?low[v]:high[v],outward=-hingeSide,t=p.thickness,split=p.splitOffset,radial=p.hingeRadialGap;
 const baseDepth=split-radial/2-low[n],depth=Math.min(8*scale,baseDepth-1);
 if(depth<5*scale)throw Error('爪を付けるには本体側の高さが足りません。分割位置を上げてください');
 const width=Math.min(9*scale,(high[u]-low[u])*.6);
 if(width<4*scale)throw Error('爪を付ける辺が短すぎます');
 // Keep the angular receiver compact so its lid spring needs less empty space behind it.
 const tongueWidth=width-2*gap,mid=(low[u]+high[u])/2,bossReach=triangle?Math.max(1.1*scale,engagement+.1*scale):3*scale,beamThickness=(Math.max(.9,Math.min(1.3,t*.55))+(triangle?.12:0))*scale;
 const beadN=split-depth+1.5*scale,beadQ=bossReach+beadRadius-engagement,rootHeight=Math.max(t,2.4)*scale;
 // Keep the thicker flexible arm close to the receiver while preserving its printable gap.
 // A small overlap with the tooth base keeps the printed latch one solid.
 const beamQ=triangle?bossReach+gap:beadQ;
 const localBox=(u0,u1,q0,q1,n0,n1)=>{const a=[0,0,0],b=[0,0,0];a[u]=u0;b[u]=u1;a[v]=wall+outward*q0;b[v]=wall+outward*q1;a[n]=n0;b[n]=n1;return boxBetween(a,b);};
 const direction=[0,0,0];direction[u]=1;
 const qAxis=[0,0,0],nAxis=[0,0,0];qAxis[v]=outward;nAxis[n]=1;
 const prismAxis=[qAxis[1]*nAxis[2]-qAxis[2]*nAxis[1],qAxis[2]*nAxis[0]-qAxis[0]*nAxis[2],qAxis[0]*nAxis[1]-qAxis[1]*nAxis[0]];
 const localPrism=(points,from,to)=>{
  const origin=[0,0,0];origin[u]=prismAxis[u]>0?from:to;origin[v]=wall;
  let profile=R.draw(points[0]);for(const point of points.slice(1))profile=profile.lineTo(point);
  return profile.close().sketchOnPlane(new R.Plane(origin,qAxis,prismAxis)).extrude(to-from);
 };
 let body=base,cover=lid;
 try{
  body=join(body,localBox(mid-width/2,mid+width/2,-t*.7,bossReach,split-depth-scale,split-radial/2));
  // Ease the bead past the receiver's upper outside edge. The lower straight
  // wall and the groove remain intact so the claw still retains the lid.
  const lipTop=split-radial/2,grooveLipN=triangle?beadN+beadRadius+gap:beadN+Math.sqrt((beadRadius+gap)**2-(beadQ-bossReach)**2),leadDepth=Math.max(1.1*scale,lipTop-grooveLipN+.15*scale),leadInset=Math.min(.55*scale,Math.max(.25*scale,engagement*.75)),lipRelief=Math.min(.05*scale,Math.max(.02*scale,engagement*.08));
  const leadOrigin=[0,0,0];leadOrigin[v]=wall;leadOrigin[u]=prismAxis[u]>0?mid-width/2-.1:mid+width/2+.1;
  const leadProfile=R.draw([bossReach-leadInset,lipTop+.5]).lineTo([bossReach+1,lipTop+.5]).lineTo([bossReach+1,lipTop-leadDepth]).lineTo([bossReach-lipRelief,lipTop-leadDepth]).close();
  body=subtract(body,leadProfile.sketchOnPlane(new R.Plane(leadOrigin,qAxis,prismAxis)).extrude(width+.2));
  const grooveOrigin=[0,0,0];grooveOrigin[u]=mid-tongueWidth/2-gap;grooveOrigin[v]=wall+outward*beadQ;grooveOrigin[n]=beadN;
  // The broad tab has a short lead chamfer and a horizontal retaining shelf.
  const toothBaseQ=beamQ+beamThickness;
  const toothTipExtension=triangle?1:0,toothTipQ=bossReach-engagement-toothTipExtension,toothShelfN=beadN+.6*scale;
  const toothSection=triangle?[[toothBaseQ,beadN-beadRadius],[toothTipQ+.2*scale,beadN-beadRadius],[toothTipQ,beadN-beadRadius+.2*scale],[toothTipQ,toothShelfN],[toothBaseQ,toothShelfN]]:null;
  if(triangle){
   const grooveSection=outsetProfile(toothSection,gap);
   // Deepen only the pocket behind the tip; keep at least 0.8 mm, or 40% of walls up to 3 mm thick.
   const remainingWall=Math.min(1.2,Math.max(.8,t*.4)),wallLimit=-t+remainingWall,grooveTipQ=Math.min(...grooveSection.map(point=>point[0]));
    if(grooveTipQ<wallLimit-1e-6)throw Error('爪の受け溝がBOXの壁を貫通します。壁厚を増やすか、爪と溝のすき間を小さくしてください');
   const extraPocket=Math.max(0,Math.min(.6*scale,grooveTipQ-wallLimit));
   grooveSection[2][0]-=extraPocket;grooveSection[3][0]-=extraPocket;
   body=subtract(body,localPrism(grooveSection,mid-tongueWidth/2-gap,mid+tongueWidth/2+gap));
  }
  else body=subtract(body,R.makeCylinder(beadRadius+gap,tongueWidth+2*gap,grooveOrigin,direction));
  cover=join(cover,localBox(mid-tongueWidth/2,mid+tongueWidth/2,-t*.5,beamQ+beamThickness,split+radial/2,split+rootHeight));
  cover=join(cover,localBox(mid-tongueWidth/2,mid+tongueWidth/2,beamQ,beamQ+beamThickness,beadN,split+rootHeight));
  if(triangle){
   // Extend the spring arm past the tooth, ending in a round finger hook.
   const gripRadius=beamThickness/2,gripEndN=Math.max(beadN-2.3*scale,low[n]+gripRadius);
   cover=join(cover,localBox(mid-tongueWidth/2,mid+tongueWidth/2,beamQ,beamQ+beamThickness,gripEndN,beadN+.1*scale));
   const gripOrigin=[0,0,0];gripOrigin[u]=mid-tongueWidth/2;gripOrigin[v]=wall+outward*(beamQ+gripRadius);gripOrigin[n]=gripEndN;
   cover=join(cover,R.makeCylinder(gripRadius,tongueWidth,gripOrigin,direction));
  }
  const beadOrigin=[...grooveOrigin];beadOrigin[u]=mid-tongueWidth/2;
  if(triangle)cover=join(cover,localPrism(toothSection,mid-tongueWidth/2,mid+tongueWidth/2));
  else cover=join(cover,R.makeCylinder(beadRadius,tongueWidth,beadOrigin,direction));
  const output=[body,cover];body=null;cover=null;return output;
 }finally{body?.delete();cover?.delete();}
}
function hingeAssembly(base,lid,outerBounds,p){
 const n=AXES[p.enclosureSplit],v='XYZ'.indexOf(p.hingeEdge?.slice(1)),side=p.hingeEdge?.[0]==='+'?1:-1;
 if(n===undefined||v<0||v===n||!['+','-'].includes(p.hingeEdge?.[0]))throw Error('ヒンジを付ける辺を選択してください');
 const u=[0,1,2].find(i=>i!==n&&i!==v),radial=p.hingeRadialGap,axial=p.hingeAxialGap,angle=p.hingeAngle;
 if(!Number.isFinite(radial)||radial<.2||radial>3||!Number.isFinite(axial)||axial<.2||axial>3)throw Error('ヒンジのすき間は0.2〜3 mmで指定してください');
 if(!Number.isFinite(angle)||angle<0||angle>180)throw Error('蓋の角度は0〜180°で指定してください');
 const t=p.thickness,{pinRadius,radius}=hingeRadii(p),[low,high]=outerBounds;
 const first=low[u]+Math.min(1,Math.max(.2,(high[u]-low[u])*.05)),last=high[u]-Math.min(1,Math.max(.2,(high[u]-low[u])*.05)),length=last-first;
 if(length<Math.max(9,axial*8+pinRadius*4))throw Error('この辺はヒンジに短すぎます。別の辺か大きいBOXを選択してください');
 const end=length*.25,middleStart=first+end+axial,middleEnd=last-end-axial;
 if(middleEnd-middleStart<Math.max(2,pinRadius*2))throw Error('軸方向のすき間が大きすぎます');
 const hingeV=(side===1?high[v]:low[v])+side*(radius+t*.4),origin=[0,0,0],direction=[0,0,0];origin[v]=hingeV;origin[n]=p.splitOffset;direction[u]=1;
 const cyl=(r,from,to)=>{const o=[...origin];o[u]=from;return R.makeCylinder(r,to-from,o,direction);};
 const web=(from,to,lidSide)=>{const lo=[...low],hi=[...high];lo[u]=from;hi[u]=to;lo[v]=hingeV;hi[v]=side===1?high[v]-t*.7*hardwareScale(p):low[v]+t*.7*hardwareScale(p);lo[n]=p.splitOffset+(lidSide?radial/2: -Math.max(t,radius*.75));hi[n]=p.splitOffset+(lidSide?Math.max(t,radius*.75):-radial/2);return boxBetween(lo,hi);};
 let body=base,cover=lid;
 try{
  for(const [from,to] of [[first,first+end],[last-end,last]]){body=join(body,join(cyl(radius,from,to),web(from,to,false)));}
  body=join(body,cyl(pinRadius,first,last));
  cover=join(cover,join(cyl(radius,middleStart,middleEnd),web(middleStart,middleEnd,true)));
  cover=subtract(cover,cyl(pinRadius+radial,middleStart,middleEnd));
  if(p.snapLatch){const latched=snapLatchAssembly(body,cover,outerBounds,p,n,v,u,side);body=latched[0];cover=latched[1];}
  // The hinge axis stays fixed while the positive half (the lid) turns outwards.
  const axis=[0,0,0];axis[u]=1;
  const uv=[0,0,0];uv[v]=side;
  const cross=[axis[1]*uv[2]-axis[2]*uv[1],axis[2]*uv[0]-axis[0]*uv[2],axis[0]*uv[1]-axis[1]*uv[0]],handed=cross[n];
  if(angle)cover=cover.rotate(-angle*handed,origin,direction);
  if(!valid(body)||!valid(cover)||overlapVolume(body,cover)>1e-5)throw Error('ヒンジが本体と蓋に干渉します。辺・分割位置・すき間を調整してください');
  const output=[body,cover];
  const axisPoint=[...origin];axisPoint[u]=(first+last)/2;
  const axisStart=[...origin],axisEnd=[...origin];axisStart[u]=first;axisEnd[u]=last;
  output.hingeFrame={point:axisPoint,a:axisStart,b:axisEnd,rimPositions:[first,first+end,middleStart,middleEnd,last-end,last],axisIndex:u,sideAxis:v,normal:n,side};
  body=null;cover=null;return output;
 }finally{body?.delete();cover?.delete();}
}
function buildEncloseParts(base,p){
 if(p.hinge&&!p.boxMode)throw Error('ヒンジはBOXを作る場合に使用できます');
 if(p.snapLatch&&!p.hinge)throw Error('爪と溝にはヒンジを付けてください');
 if(p.hinge&&(!p.enclosureSplit||p.enclosureSplit==='分割しない'))throw Error('ヒンジには分割平面を選択してください');
 if(p.hinge&&p.faces?.some(face=>boxOpeningSide(face)===p.hingeEdge))throw Error('ヒンジを付ける側のBOX面は開口できません。別の開口面かヒンジ辺を選んでください');
 const shape=encloseBody(base,p.thickness,p);
 if(!p.enclosureSplit||p.enclosureSplit==='分割しない')return [shape];
 let parts,negative,positive;
 try{
  if(!['XY','XZ','YZ'].includes(p.enclosureSplit)||!Number.isFinite(p.splitOffset))throw Error('分割平面と位置を確認してください');
  const normal={XY:[0,0,1],XZ:[0,1,0],YZ:[1,0,0]}[p.enclosureSplit];
  const plane=new R.Plane(normal.map(v=>v*p.splitOffset),p.enclosureSplit==='YZ'?[0,1,0]:[1,0,0],normal);
  parts=shape.split(plane,0,1e-6);
  if(!parts.negative||!parts.positive||![parts.negative,parts.positive].every(s=>valid(s)&&R.measureVolume(s)>1e-6))throw Error('分割平面が囲みを横切っていません。分割位置を調整してください');
  const expected=R.measureVolume(shape),actual=R.measureVolume(parts.negative)+R.measureVolume(parts.positive);
  if(Math.abs(expected-actual)>Math.max(1e-5,expected*1e-7))throw Error('囲みを正常に分割できません。分割位置を調整してください');
  negative=parts.negative;positive=parts.positive;parts=null;
  if(p.hinge){
   const n=AXES[p.enclosureSplit],bounds=shape.boundingBox.bounds,lo=[...bounds[0]],hi=[...bounds[1]],gap=p.seamGap??p.hingeRadialGap;
   if(!Number.isFinite(gap)||gap<.1||gap>3)throw Error('蓋と本体のすき間は0.1〜3 mmで指定してください');
   lo[n]=p.splitOffset-gap/2;hi[n]=p.splitOffset+gap/2;
   const slab=boxBetween(lo,hi);try{negative=subtract(negative,slab.clone());positive=subtract(positive,slab.clone());}finally{slab.delete();}
   const output=hingeAssembly(negative,positive,bounds,p);negative=null;positive=null;return output;
  }
  const output=[negative,positive];negative=null;positive=null;return output;
 }finally{parts?.negative?.delete();parts?.positive?.delete();negative?.delete();positive?.delete();shape.delete();}
}

function motionFrame(base,p,extra){
 const n=AXES[p.enclosureSplit],v='XYZ'.indexOf(p.hingeEdge.slice(1)),u=[0,1,2].find(i=>i!==n&&i!==v),side=p.hingeEdge[0]==='+'?1:-1;
 const [lo,hi]=base.boundingBox.bounds,gap=p.clearance+extra+p.thickness,{radius}=hingeRadii(p);
 const origin=[0,0,0],axis=[0,0,0];origin[v]=(side===1?hi[v]+gap:lo[v]-gap)+side*(radius+p.thickness*.4);origin[n]=p.splitOffset;axis[u]=1;
 const uv=[0,0,0];uv[v]=side;
 const cross=[axis[1]*uv[2]-axis[2]*uv[1],axis[2]*uv[0]-axis[0]*uv[2],axis[0]*uv[1]-axis[1]*uv[0]];
 return {origin,axis,handed:cross[n],u,v,n};
}
function motionClearance(base,lid,p,extra){
 const frame=motionFrame(base,p,extra),[lo,hi]=lid.boundingBox.bounds;
 const radius=Math.max(...[lo[frame.v],hi[frame.v]].flatMap(v=>[lo[frame.n],hi[frame.n]].map(n=>Math.hypot(v-frame.origin[frame.v],n-frame.origin[frame.n]))));
 const maxAngle=Math.max(90,p.hingeAngle),steps=Math.ceil(maxAngle/2),step=maxAngle/steps;
 const allowance=2*radius*Math.sin(step*Math.PI/720);
 let smallest=Infinity;
 for(let i=0;i<=steps;i++){
  let turned;
  try{
   if(i)turned=lid.clone().rotate(-i*step*frame.handed,frame.origin,frame.axis);
   const distance=R.measureDistanceBetween(turned||lid,base);
   if(!Number.isFinite(distance))throw Error('蓋の干渉判定に失敗しました');
   smallest=Math.min(smallest,distance);
   if(smallest+1e-5<p.motionGap+allowance)return {pass:false,smallest,allowance,maxAngle,step};
  }finally{turned?.delete();}
 }
 return {pass:true,smallest,allowance,maxAngle,step};
}
function latchMotionDiagnostic(source,parts,p,extra){
 const frame=parts.hingeFrame,body=parts[0],axis=[0,0,0],outward=[0,0,0],u=frame.axisIndex,v=frame.sideAxis,n=frame.normal;
 axis[u]=1;outward[v]=-frame.side;
 const sideVector=[0,0,0];sideVector[v]=frame.side;
 const cross=[axis[1]*sideVector[2]-axis[2]*sideVector[1],axis[2]*sideVector[0]-axis[0]*sideVector[2],axis[0]*sideVector[1]-axis[1]*sideVector[0]],handed=cross[n];
 const [sourceLo,sourceHi]=source.boundingBox.bounds,padding=p.clearance+extra+p.thickness;
 const low=sourceLo.map(value=>value-padding),high=sourceHi.map(value=>value+padding),wall=frame.side===1?low[v]:high[v];
 const scale=hardwareScale(p),width=Math.min(9*scale,(high[u]-low[u])*.6),mid=(low[u]+high[u])/2,depth=Math.min(8*scale,p.splitOffset-p.hingeRadialGap/2-low[n]-1);
 const beamThickness=Math.max(.9,Math.min(1.3,p.thickness*.55))*scale;
 const latchLo=[...low],latchHi=[...high],q0=wall+outward[v]*(-p.thickness*1.5),q1=wall+outward[v]*Math.max(7,4.25*scale+beamThickness+1);
 latchLo[u]=mid-width/2-.5;latchHi[u]=mid+width/2+.5;
 latchLo[v]=Math.min(q0,q1);latchHi[v]=Math.max(q0,q1);
 latchLo[n]=p.splitOffset-depth-2*scale;latchHi[n]=p.splitOffset+Math.max(p.thickness,2.4)*scale+2*scale;
 const {radius}=hingeRadii(p);
 const hingeLo=[...low],hingeHi=[...high];
 hingeLo[u]=frame.a[u]-.5;hingeHi[u]=frame.b[u]+.5;
 hingeLo[v]=frame.a[v]-radius-p.thickness-1;hingeHi[v]=frame.a[v]+radius+p.thickness+1;
 hingeLo[n]=p.splitOffset-radius-p.thickness-1;hingeHi[n]=p.splitOffset+radius+p.thickness+1;
 const maxAngle=Math.max(90,p.hingeAngle),sampleStep=2,steps=Math.ceil(maxAngle/sampleStep),actualStep=maxAngle/steps;
 const tolerance=1e-5,point=frame.point;
 let closedLid,latchMask,hingeMask,latchBody,firstContact=null,lastContact=null,maxRequiredDeflection=0,unexpectedContactAngle=null,unclearable=false;
 try{
  closedLid=p.hingeAngle?parts[1].clone().rotate(p.hingeAngle*handed,point,axis):parts[1];
  latchMask=R.makeBox(latchLo,latchHi);hingeMask=R.makeBox(hingeLo,hingeHi);
  latchBody=body.intersect(latchMask);
  for(let i=0;i<=steps;i++){
   const angle=i*actualStep;
   let turned,clash,elsewhere,ordinary,latchClash,latchLid;
   try{
    if(i)turned=closedLid.clone().rotate(-angle*handed,point,axis);
    const lid=turned||closedLid;
    clash=body.intersect(lid);
    if(R.measureVolume(clash)<=tolerance)continue;
    elsewhere=clash.cut(latchMask);
    ordinary=elsewhere.cut(hingeMask);
    if(R.measureVolume(ordinary)>tolerance&&unexpectedContactAngle===null)unexpectedContactAngle=angle;
    latchClash=clash.intersect(latchMask);
    if(R.measureVolume(latchClash)<=tolerance)continue;
    if(firstContact===null)firstContact=angle;
    lastContact=angle;
    latchLid=lid.intersect(latchMask);
    const touches=distance=>{
     const translated=latchLid.clone().translate(outward.map(value=>value*distance));
     try{return overlapVolume(latchBody,translated)>tolerance;}finally{translated.delete();}
    };
    let lower=0,upper=.1;
    while(upper<4&&touches(upper)){lower=upper;upper*=2;}
    if(touches(upper)){unclearable=true;maxRequiredDeflection=Math.max(maxRequiredDeflection,upper);continue;}
    for(let j=0;j<7;j++){const middle=(lower+upper)/2;if(touches(middle))lower=middle;else upper=middle;}
    maxRequiredDeflection=Math.max(maxRequiredDeflection,upper);
   }finally{turned?.delete();clash?.delete();elsewhere?.delete();ordinary?.delete();latchClash?.delete();latchLid?.delete();}
  }
  return {checkedAngle:maxAngle,sampleStep:actualStep,maxRequiredDeflection,contactRange:firstContact===null?null:[firstContact,lastContact],unexpectedContactAngle,status:unexpectedContactAngle!==null||unclearable?'blocked':firstContact===null?'clear':'flex-required'};
 }finally{if(p.hingeAngle)closedLid?.delete();latchMask?.delete();hingeMask?.delete();latchBody?.delete();}
}
export function encloseParts(base,p){
 if(!p.autoExpandMotion){
  const parts=buildEncloseParts(base,p);
  try{
   if(p.hinge&&p.snapLatch)parts.analysis={boxExtra:p.boxExtra||0,effectiveClearance:p.clearance+(p.boxExtra||0),latchMotion:latchMotionDiagnostic(base,parts,p,p.boxExtra||0)};
   return parts;
  }catch(error){parts.forEach(part=>part.delete());throw error;}
 }
 if(!p.boxMode||!p.hinge||!['XY','XZ','YZ'].includes(p.enclosureSplit))throw Error('開閉時の自動拡大にはBOX・分割面・ヒンジが必要です');
 if(!Number.isFinite(p.motionGap)||p.motionGap<.2||p.motionGap>3)throw Error('開閉時の必要すき間は0.2〜3 mmで指定してください');
 const evaluate=extra=>{
  const pieces=buildEncloseParts(base,{...p,boxExtra:extra,hingeAngle:0});
  try{return motionClearance(base,pieces[1],p,extra);}finally{pieces.forEach(piece=>piece.delete());}
 };
 let extra=0,reading=evaluate(0);
 if(!reading.pass){
  let low=0,high=Math.max(.5,p.motionGap),limit=1000-p.clearance;
  while(high<=limit){reading=evaluate(high);if(reading.pass)break;low=high;high*=2;}
  if(!reading.pass){
   if(high>limit&&low<limit){high=limit;reading=evaluate(high);}
   if(!reading.pass)throw Error('開閉時の干渉を解消できません。ヒンジの辺・分割位置・開口面を変更してください');
  }
  for(let i=0;i<8;i++){const middle=(low+high)/2,trial=evaluate(middle);if(trial.pass){high=middle;reading=trial;}else low=middle;}
  extra=Math.min(limit,Math.ceil((high+0.02)*10)/10);
  reading=evaluate(extra);
  if(!reading.pass)throw Error('開閉すき間を確保できません。ヒンジの設定を見直してください');
 }
 const parts=buildEncloseParts(base,{...p,boxExtra:extra});
 try{
  parts.analysis={boxExtra:extra,effectiveClearance:p.clearance+extra,minSampleGap:reading.smallest,requiredGap:p.motionGap,conservativeMargin:reading.allowance,checkedAngle:reading.maxAngle,sampleStep:reading.step};
  if(p.snapLatch)parts.analysis.latchMotion=latchMotionDiagnostic(base,parts,p,extra);
  return parts;
 }catch(error){parts.forEach(part=>part.delete());throw error;}
}
