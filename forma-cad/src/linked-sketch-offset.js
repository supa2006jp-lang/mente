import {basisFor} from './frames.js';
import {offsetSketch,offsetSketchAllAround} from './sketch-offset.js';
import {defaults} from './geometry.js';

export function regionOffsetSketches(region,distance,allAround=false){
 const b=basisFor(region),p=b.n.multiplyScalar(region.offset),base={...defaults,id:'region-offset-source',kind:'sketch',name:'輪郭',profile:'polyline',plane:region.plane,frame:region.frame,x:p.x,y:p.y,z:p.z,angle:0,closed:true};
 const sources=[region.outer,...region.holes].map(points=>({...base,points}));
 return allAround?offsetSketchAllAround(sources,distance):offsetSketch(sources[0],distance);
}

export function linkRegionOffset(copies,region,distance,allAround=false){
 return copies.map((f,index)=>({...f,offsetLink:{region:structuredClone(region),distance,allAround,index,count:copies.length}}));
}

export function refreshLinkedOffset(feature,region){
 const link=feature.offsetLink,copies=regionOffsetSketches(region,link.distance,link.allAround);
 if(copies.length!==link.count||!copies[link.index])throw Error('オフセットの輪郭の数が変わりました。オフセットを作り直してください');
 return {...feature,...copies[link.index],id:feature.id,name:feature.name,groupId:feature.groupId,groupNumber:feature.groupNumber,groupHidden:feature.groupHidden,offsetLink:{...link,region}};
}
