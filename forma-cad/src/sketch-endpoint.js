import {sketchPoints,planeCoordinates} from './regions.js';
import {worldPoint} from './frames.js';
import {defaults} from './geometry.js';

// Sampled curve vertices are not endpoints. Only keep true ends/corners.
export function sketchEndpoints(feature){
 if(feature.kind!=='sketch'||feature.groupHidden||['point','circle'].includes(feature.profile))return [];
 let points=sketchPoints(feature);
 if(feature.profile==='spline'||feature.arc){if(feature.closed)return [];points=[feature.points[0],feature.points.at(-1)];}
 const result=[],plane={...feature,offset:planeCoordinates(feature).offset};
 for(const point of points){const world=worldPoint(plane,point);if(!result.some(p=>p.distanceToSquared(world)<1e-12))result.push(world);}
 return result;
}

export function endpointSketchPoint(source,point,id){
 const feature={...defaults,id,name:'点',kind:'sketch',profile:'point',plane:source.plane,x:point.x,y:point.y,z:point.z};
 if(source.frame)feature.frame=structuredClone(source.frame);
 for(const key of ['groupId','groupNumber','groupHidden'])if(source[key]!==undefined)feature[key]=source[key];
 return feature;
}

export function existingEndpointPoint(features,source,point){
 return features.find(f=>f.kind==='sketch'&&f.profile==='point'&&!f.groupHidden&&f.groupId===source.groupId&&Math.hypot(f.x-point.x,f.y-point.y,f.z-point.z)<1e-6);
}
