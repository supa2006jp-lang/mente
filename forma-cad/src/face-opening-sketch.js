import {worldPoint} from './frames.js';
import {defaults,validateFeature} from './geometry.js';
import {planarFaceMeasurement} from './planar-face-measurement.js';
import {offsetSketch} from './sketch-offset.js';

export function createFaceOpeningSketch(face,index,groupNumber,{groupId=crypto.randomUUID(),clearance=0}={}){
 const contour=face.holes?.[index];
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
 const sketch={...defaults,...shape,id:crypto.randomUUID(),kind:'sketch',
  name:'開口 '+(index+1)+' の輪郭',groupId,groupNumber,
  plane:face.plane,frame:structuredClone(face.frame),x,y,z};
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
   if(contours.length!==1)throw Error('すき間を小さくしてください。輪郭が分かれます');
   sketch.points=contours[0].points;
  }
 }
 return validateFeature(sketch);
}

export function createFaceOpeningSketches(face,indices,groupNumber,clearance){
 const groupId=crypto.randomUUID();
 return indices.map(index=>{
  try{return createFaceOpeningSketch(face,index,groupNumber,{groupId,clearance});}
  catch(error){throw Error('開口 '+(index+1)+' ／ '+error.message);}
 });
}
