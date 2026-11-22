import * as R from 'replicad';
import {Vector3} from 'three';
import {hexPrism} from './free-screw.js';
import {roundOpenings} from './print-support-bores.js';
import {validateNutPocket} from './nut-pocket-settings.js';

const rimTolerance=1e-4;
const aligned=(a,b)=>a.reduce((dot,value,i)=>dot+value*b[i],0)>1-1e-7;
const sameCenter=(a,b)=>Math.hypot(...a.map((value,i)=>value-b[i]))<=rimTolerance;

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

export function nutPocketOpenings(shape){
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
    if(!openings.some(item=>sameCenter(item.center,rim.center)&&aligned(item.normal,normal)))openings.push({...rim,normal});
   }
  }
 }finally{faces.forEach(face=>face.delete());}
 // Raised cylindrical bosses also bound circular inner wires on flat faces.
 // Their centres are solid, whereas a bore opens into empty space.
 const available=emptyPoints(shape,openings.map(opening=>opening.center));
 return openings.filter((_,index)=>available[index]);
}

export function findNutPocketOpening(openings,reference,checkRadius=true){
 const matches=openings.filter(item=>sameCenter(item.center,reference.center)&&aligned(item.normal,reference.normal)&&
  (!checkRadius||Math.abs(item.radius-reference.radius)<=rimTolerance));
 return matches.length===1?matches[0]:null;
}

export function makeNutPocket(base,spec,nut){
 validateNutPocket(spec);
 if(!nut)throw Error('ねじ作成で作った六角ナットを選択してください');
 if(spec.target===nut.screwId)throw Error('ねじとナットとは別の加工先ボディを選択してください');
 const opening=findNutPocketOpening(nutPocketOpenings(base),spec.opening);
 if(!opening)throw Error('円穴の開口が見つかりません。加工する穴を選び直してください');
 const {center,normal,radius}=opening,{depth}=nut,across=nut.across+2*spec.clearance;
 const seatWidth=nut.across/2-radius;
 if(seatWidth<=rimTolerance)throw Error('穴径がナットの対辺寸法に近すぎます。ナットを支える受け面を残せる寸法にしてください');
 const insufficient='六角ポケットの側壁または底の受け面が足りません。加工する側、ナット寸法、すき間を確認してください';
 const box=base.boundingBox;let diagonal;
 try{const [lo,hi]=box.bounds;diagonal=Math.hypot(...hi.map((v,i)=>v-lo[i]));}finally{box.delete();}
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
  const floorPoint=new Vector3(...center).addScaledVector(inward,depth+2e-5).toArray();
  if(!emptyPoints(base,[floorPoint])[0])throw Error('円穴が浅く、ポケットの底にねじを通す穴を残せません');
  const cutter=hex(across,-lead,depth);
  // A thin collar enclosing the cut and its floor must remain solid. The
  // coaxial pilot bore is the intended opening through that floor.
  const envelope=hex(across+2*band,band/4,depth+band);
  const bore=hold(R.makeCylinder(radius,depth+2*band,center,direction));
  const collar=hold(hold(envelope.cut(cutter)).cut(bore));
  const contact=hold(base.intersect(collar)),expected=R.measureVolume(collar);
  if(!(expected>0)||expected-R.measureVolume(contact)>Math.max(1e-7,expected*1e-5))throw Error(insufficient);
  output=base.cut(cutter);
  const solids=output.solids,previous=base.solids,check=new (R.getOC().BRepCheck_Analyzer)(output.wrapped,true,false);
  try{
   if(!check.IsValid()||solids.length!==previous.length||R.measureVolume(base)-R.measureVolume(output)<1e-7){
    throw Error('六角ポケットを正常に加工できませんでした。穴と寸法を確認してください');
   }
  }finally{check.delete();solids.forEach(s=>s.delete());previous.forEach(s=>s.delete());}
  const result={shape:output,analysis:{opening,across,depth,clearance:spec.clearance}};
  output=null;return result;
 }finally{output?.delete();owned.reverse().forEach(shape=>shape.delete());}
}
