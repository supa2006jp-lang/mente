import * as R from 'replicad';
import {Vector3} from 'three';
import {hexPrism} from './free-screw.js';
import {screwHeadDefaults} from './free-screw-settings.js';
import {roundOpenings} from './print-support-bores.js';
import {validateNutPocket} from './nut-pocket-settings.js';

const rimTolerance=1e-4;
const aligned=(a,b)=>a.reduce((dot,value,i)=>dot+value*b[i],0)>1-1e-7;
const sameCenter=(a,b)=>Math.hypot(...a.map((value,i)=>value-b[i]))<=rimTolerance;
const roundUpMm=value=>Math.ceil((value-1e-9)*1000)/1000;

function emptyPoints(shape,points){
 const solids=shape.solids,queries=[];
 try{
  for(const solid of solids)queries.push(new R.DistanceQuery(solid));
  return points.map(point=>{
   const vertex=R.makeVertex(point);
   try{return queries.every(query=>query.distanceTo(vertex)>1e-5);}
   finally{vertex.delete();}
  });
 }finally{queries.forEach(query=>query.delete());solids.forEach(solid=>solid.delete());}
}

export function nutPocketOpenings(shape,accept=()=>true){
 if(!shape)throw Error('加工先ボディが見つかりません');
 const faces=shape.faces,openings=[];
 try{
  for(const face of faces){
   if(face.geomType!=='PLANE')continue;
   const rims=roundOpenings(face);
   if(!rims.length)continue;
   const n=face.normalAt();let normal;
   try{normal=new Vector3(...n.toTuple()).normalize().toArray();}finally{n.delete();}
   for(const rim of rims){
    const opening={...rim,normal};
    if(accept(opening)&&!openings.some(item=>sameCenter(item.center,rim.center)&&aligned(item.normal,normal)))openings.push(opening);
   }
  }
 }finally{faces.forEach(face=>face.delete());}
 // Raised cylindrical bosses also bound circular inner wires on flat faces.
 // Their centres are solid, whereas a bore opens into empty space.
 const available=emptyPoints(shape,openings.map(opening=>opening.center));
 return openings.filter((_,index)=>available[index]);
}

function matchedBolt(shape,opening,nut){
 const entry=new Vector3(...opening.center),axis=new Vector3(...opening.normal).negate();
 const {diameter,depth,pitch,leftHand}=nut;
 const distance=rim=>new Vector3(...rim.center).sub(entry).dot(axis);
 const exits=nutPocketOpenings(shape,rim=>{
  const delta=new Vector3(...rim.center).sub(entry),span=delta.dot(axis);
  return span>depth+rimTolerance&&aligned(rim.normal,axis.toArray())&&
   delta.addScaledVector(axis,-span).length()<=rimTolerance;
 });
 if(!exits.length)return null;
 const seat=exits.reduce((far,rim)=>distance(rim)>distance(far)?rim:far),span=distance(seat),grip=span-depth;
 // Test the complete cross section of the nominal shaft between the nut and
 // the seat. An aligned rim alone can belong to an obstructed or stepped bore.
 if(seat.radius<diameter/2-rimTolerance)return null;
 const pad=1e-5,probe=R.makeCylinder(diameter/2-pad,grip-2*pad,entry.clone().addScaledVector(axis,depth+pad).toArray(),axis.toArray());
 let obstruction;
 try{
  obstruction=shape.intersect(probe);
  if(!(Math.abs(R.measureVolume(obstruction))<=1e-6))return null;
 }finally{obstruction?.delete();probe.delete();}
 const length=roundUpMm(span),headSize=Math.max(screwHeadDefaults(diameter,'hex').headSize,roundUpMm(seat.radius*2+.2));
 if(length>10000||headSize>1000)return null;
 return {diameter,pitch,leftHand,length,headSize,grip,nutHeight:depth,threadLength:Math.min(length,pitch*100,roundUpMm(depth+pitch))};
}

export function findNutPocketOpening(openings,reference,checkRadius=true){
 const matches=openings.filter(item=>sameCenter(item.center,reference.center)&&aligned(item.normal,reference.normal)&&
  (!checkRadius||Math.abs(item.radius-reference.radius)<=rimTolerance));
 return matches.length===1?matches[0]:null;
}

export function findNutPocketFace(shape,placement){
 const faces=shape.faces,point=new Vector3(...placement.point),vertex=R.makeVertex(placement.point),query=new R.DistanceTool();
 let best=null,nearest=rimTolerance;
 try{
  for(const face of faces){
   if(face.geomType!=='PLANE')continue;
   const n=face.normalAt();let normal;
   try{normal=new Vector3(...n.toTuple()).normalize();}finally{n.delete();}
   if(!aligned(normal.toArray(),placement.normal))continue;
   const distance=query.distanceBetween(vertex,face);
   if(!Number.isFinite(distance)||distance>nearest)continue;
   const anchor=face.center;
   try{
    const offset=normal.dot(new Vector3(...anchor.toTuple()).sub(point));
    best={center:point.clone().addScaledVector(normal,offset).toArray(),normal:normal.toArray()};
    nearest=distance;
   }finally{anchor.delete();}
  }
  return best;
 }finally{vertex.delete();query.delete();faces.forEach(face=>face.delete());}
}

export function makeNutPocket(base,spec,nut){
 validateNutPocket(spec);
 if(!nut)throw Error('ねじ作成で作った六角ナットを選択してください');
 if(spec.target===nut.screwId)throw Error('ねじとナットとは別の加工先ボディを選択してください');
 if(!base)throw Error('加工先ボディが見つかりません');
 const placement=spec.placement;
 const face=placement?findNutPocketFace(base,placement):null;
 const opening=placement?(face&&{...face,radius:spec.boreDiameter/2}):findNutPocketOpening(nutPocketOpenings(base),spec.opening);
 if(!opening)throw Error(placement?'選択した点が加工先の平面上にありません。面を選び直してください':'円穴の開口が見つかりません。加工する穴を選び直してください');
 const {center,normal,radius}=opening,{depth}=nut,across=nut.across+2*spec.clearance;
 const seatWidth=nut.across/2-radius;
 if(seatWidth<=rimTolerance)throw Error('穴径がナットの対辺寸法に近すぎます。ナットを支える受け面を残せる寸法にしてください');
 const insufficient='六角ポケットの側壁または底の受け面が足りません。加工する側、ナット寸法、すき間を確認してください';
 const box=base.boundingBox;let lo,hi;
 try{[lo,hi]=box.bounds;}finally{box.delete();}
 const diagonal=Math.hypot(...hi.map((v,i)=>v-lo[i]));
 if(across>=diagonal||depth>=diagonal)throw Error(insufficient);
 const inward=new Vector3(...normal).negate(),z=new Vector3(0,0,1),tilt=z.angleTo(inward);
 const rotationAxis=z.clone().cross(inward);
 if(rotationAxis.lengthSq()<1e-18)rotationAxis.set(1,0,0);
 const direction=inward.toArray(),rotation=rotationAxis.normalize().toArray();
 const owned=[],hold=shape=>(owned.push(shape),shape);
 const hex=(size,start,end)=>{
  let shape=hold(hexPrism(size,start,end-start));
  if(tilt>1e-9)shape=hold(shape.rotate(tilt*180/Math.PI,[0,0,0],rotation));
  return hold(shape.translate(center));
 };
 const band=Math.min(.025,depth/10,seatWidth/4),lead=.01;
 let output;
 try{
  if(!placement){
   const floorPoint=new Vector3(...center).addScaledVector(inward,depth+2e-5).toArray();
   if(!emptyPoints(base,[floorPoint])[0])throw Error('円穴が浅く、ポケットの底にねじを通す穴を残せません');
  }
  const cutter=hex(across,-lead,depth);
  // A thin collar enclosing the cut and its floor must remain solid. The
  // coaxial pilot bore is the intended opening through that floor.
  const envelope=hex(across+2*band,band/4,depth+band);
  const bore=hold(R.makeCylinder(radius,depth+2*band,center,direction));
  const collar=hold(hold(envelope.cut(cutter)).cut(bore));
  const contact=hold(base.intersect(collar)),expected=R.measureVolume(collar);
  if(!(expected>0)||expected-R.measureVolume(contact)>Math.max(1e-7,expected*1e-5))throw Error(insufficient);
  let stock=base;
  if(placement){
   // Project the far bounds onto the bore axis, as with through-all cutting.
   const extent=direction.reduce((sum,axis,i)=>sum+axis*((axis>=0?hi:lo)[i]-center[i]),0);
   const start=new Vector3(...center).addScaledVector(inward,-lead).toArray();
   const pilot=hold(R.makeCylinder(radius,extent+lead+.1,start,direction));
   stock=hold(base.cut(pilot));
  }
  output=stock.cut(cutter);
  const solids=output.solids,previous=base.solids,check=new (R.getOC().BRepCheck_Analyzer)(output.wrapped,true,false);
  try{
   if(!check.IsValid()||solids.length!==previous.length||R.measureVolume(base)-R.measureVolume(output)<1e-7){
    throw Error('六角ポケットを正常に加工できませんでした。穴と寸法を確認してください');
   }
  }finally{check.delete();solids.forEach(s=>s.delete());previous.forEach(s=>s.delete());}
 const bolt=matchedBolt(output,opening,nut);
 const result={shape:output,analysis:{opening,across,depth,clearance:spec.clearance,...(bolt?{bolt}:{})}};
  output=null;return result;
 }finally{output?.delete();owned.reverse().forEach(shape=>shape.delete());}
}
