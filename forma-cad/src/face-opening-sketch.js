import {worldPoint} from './frames.js';
import {defaults,validateFeature} from './geometry.js';
import {planarFaceMeasurement} from './planar-face-measurement.js';

export function createFaceOpeningSketch(face,index,groupNumber){
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
 return validateFeature({...defaults,...shape,id:crypto.randomUUID(),kind:'sketch',
  name:'開口 '+(index+1)+' の輪郭',groupId:crypto.randomUUID(),groupNumber,
  plane:face.plane,frame:structuredClone(face.frame),x,y,z});
}
