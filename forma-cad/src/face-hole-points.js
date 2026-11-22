import {Vector3} from 'three';
import {worldPoint} from './frames.js';
import {regionContains} from './regions.js';

export const holePointSnapPixels=10;

export function sketchPointsOnFace(features,face,{u,v,n}){
 const points=[];
 for(const feature of features){
  if(feature.kind!=='sketch'||feature.profile!=='point'||feature.groupHidden)continue;
  const point=new Vector3(feature.x,feature.y,feature.z),offset=face.offset-point.dot(n);
  if(Math.abs(offset)>1e-4||!regionContains(face,[point.dot(u),point.dot(v)]))continue;
  points.push(point.addScaledVector(n,offset));
 }
 return points;
}

export function nearestHolePoint(points,screenDistance,limit=holePointSnapPixels){
 let nearest=null,best=limit;
 for(const point of points){
  const distance=screenDistance(point);
  if(distance<best){nearest=point;best=distance;}
 }
 return nearest;
}

export function nearestFaceGridPoint(face,{u,v},point,step,screenDistance,limit=Infinity){
 const left=Math.floor(point.dot(u)/step),bottom=Math.floor(point.dot(v)/step),points=[];
 for(const i of [left,left+1])for(const j of [bottom,bottom+1]){
  const uv=[i*step,j*step];
  if(regionContains(face,uv))points.push(worldPoint(face,uv));
 }
 return nearestHolePoint(points,screenDistance,limit);
}
