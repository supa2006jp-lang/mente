import {worldPoint} from './frames.js';
import {defaults,validateFeature} from './geometry.js';
import {planarFaceMeasurement} from './planar-face-measurement.js';
import {offsetSketch} from './sketch-offset.js';
import {planeCoordinates,sketchPoints} from './regions.js';
import Clipper from 'clipper-lib';

const pathScale=100000;
const clipperPath=points=>{
 const path=points.map(([x,y])=>({X:Math.round(x*pathScale),Y:Math.round(y*pathScale)}));
 if(!Clipper.Clipper.Orientation(path))path.reverse();
 return path;
};
function lostThinAreas(original,recovered,clearance){
 const clip=new Clipper.Clipper(),lost=[];
 clip.AddPath(clipperPath(original),Clipper.PolyType.ptSubject,true);
 clip.AddPaths(recovered.map(feature=>clipperPath(feature.points)),Clipper.PolyType.ptClip,true);
 clip.Execute(Clipper.ClipType.ctDifference,lost,Clipper.PolyFillType.pftNonZero,Clipper.PolyFillType.pftNonZero);
 return lost.filter(path=>Math.abs(Clipper.Clipper.Area(path))/pathScale**2>Math.max(.0001,clearance**2*.05))
  .map(path=>path.map(({X,Y})=>[X/pathScale,Y/pathScale]));
}

export function planFaceOpeningSketch(face,index,groupNumber,{id=crypto.randomUUID(),groupId=crypto.randomUUID(),clearance=0,contour=face.holes?.[index],inspect=true}={}){
 if(!contour||contour.length<3)throw Error('開口の輪郭を取得できません');
 const measurement=planarFaceMeasurement({outer:contour});
 let center=[0,0],shape;
 if(measurement.diameter>=.1){
  center=measurement.center;
  shape={profile:'circle',diameter:measurement.diameter};
 }else if(!measurement.outline&&measurement.sides?.[0]>=.1){
  const [[x0,y0],[x1,y1],[x2,y2]]=contour;
  center=[(x0+x2)/2,(y0+y2)/2];
  shape={profile:'rect',width:Math.hypot(x1-x0,y1-y0),height:Math.hypot(x2-x1,y2-y1),
   angle:Math.atan2(y1-y0,x1-x0)*180/Math.PI};
 }else{
  shape={profile:'polyline',points:contour.map(point=>[...point]),closed:true};
 }
 const {x,y,z}=worldPoint(face,center);
 const sketch={...defaults,...shape,id,kind:'sketch',
  name:'開口 '+(index+1)+' の輪郭',groupId,groupNumber,
  plane:face.plane,frame:structuredClone(face.frame),x,y,z};
 let lost=[];
 if(clearance!==0){
  if(!Number.isFinite(clearance)||clearance<.001||clearance>10000)throw Error('すき間は0、または0.001〜10000 mmで指定してください');
  const shrink=2*clearance;
  if(shape.profile==='circle'){
   sketch.diameter-=shrink;
   if(sketch.diameter<.1)throw Error('すき間が大きすぎて円が作れません');
  }else if(shape.profile==='rect'){
   sketch.width-=shrink;
   sketch.height-=shrink;
   if(Math.min(sketch.width,sketch.height)<.1)throw Error('すき間が大きすぎて長方形が作れません');
  }else{
   const contours=offsetSketch(sketch,-clearance);
   if(contours.length!==1){
    const removed=inspect?lostThinAreas(contour,contours.flatMap(c=>offsetSketch(c,clearance)),clearance):[];
    throw Object.assign(Error('すき間を小さくしてください。輪郭が分かれます'),{openingContours:removed.length?removed:contours.map(c=>c.points)});
   }
   sketch.points=contours[0].points;
   if(inspect)lost=lostThinAreas(contour,offsetSketch(sketch,clearance),clearance);
  }
 }
 sketch.openingSketch={sketchId:id,index,clearance,outline:structuredClone(contour)};
 return {sketch:validateFeature(sketch),original:measurement,result:planarFaceMeasurement({outer:sketchPoints(sketch).slice(0,-1)}),lost};
}

export function createFaceOpeningSketch(face,index,groupNumber,options){
 return planFaceOpeningSketch(face,index,groupNumber,{...options,inspect:false}).sketch;
}

export function createFaceOpeningSketches(face,indices,groupNumber,clearance){
 const groupId=crypto.randomUUID();
 return indices.map(index=>{
  try{return createFaceOpeningSketch(face,index,groupNumber,{groupId,clearance});}
  catch(error){throw Error('開口 '+(index+1)+' ／ '+error.message);}
 });
}

export function hasOpeningSketchSource(feature){return !!feature.openingSketch&&feature.openingSketch.sketchId===feature.id;}

export function openingSketchSource(feature){
 const {index,clearance,outline}=feature.openingSketch;
 const face={plane:feature.plane,frame:feature.frame,offset:planeCoordinates(feature).offset};
 const original=createFaceOpeningSketch(face,index,feature.groupNumber,{groupId:feature.groupId,clearance,contour:outline});
 const before=sketchPoints(original),current=sketchPoints(feature);
 if(feature.construction||before.length!==current.length||before.some(([x,y],i)=>Math.hypot(x-current[i][0],y-current[i][1])>1e-6))
  throw Error('この輪郭はスケッチで編集済みです。元の開口から作り直してください');
 return {face,index,clearance,outline};
}

export function planOpeningSketchEdit(features,edits){
 const replacements=new Map(edits.map(({id,plan})=>[id,plan.sketch]));
 let start=features.length;
 const next=features.map((feature,i)=>{
  const sketch=replacements.get(feature.id);
  if(!sketch||feature.openingSketch.clearance===sketch.openingSketch.clearance)return feature;
  start=Math.min(i,start);
  const {diameter,width,height,points,openingSketch}=sketch;
  return {...feature,diameter,width,height,...(points?{points}:{}),openingSketch:{...openingSketch,sketchId:feature.id}};
 });
 return {features:next,start};
}

export function openingDimensionLabel({diameter,sides,outline}){
 const mm=n=>n.toLocaleString('ja-JP',{maximumFractionDigits:4})+' mm';
 return diameter?'φ'+mm(diameter):(outline?'外形 ':'')+sides.map(mm).join(' × ');
}
