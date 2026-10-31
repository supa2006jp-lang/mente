import {Vector3} from 'three';
import {sketchPoints,planeCoordinates} from './regions.js';
import {basisFor,worldPoint} from './frames.js';

// Match the endpoint tolerance used by connected sketch movement. Screen
// proximity is deliberately not evidence that two lines are connected.
export const SKETCH_CONNECTION_TOLERANCE=1e-6;
const EPS=SKETCH_CONNECTION_TOLERANCE;
function corners(feature){
 const plane={...feature,offset:planeCoordinates(feature).offset};
 if(feature.profile==='spline'||feature.arc){
  if(feature.closed||!feature.points?.length)return [];
  return [0,feature.points.length-1].map(index=>({point:worldPoint(plane,feature.points[index]),degree:1,index}));
 }
 const points=sketchPoints(feature).map(p=>worldPoint(plane,p));if(points.length<2)return [];
 const closed=points.length>2&&points[0].distanceToSquared(points.at(-1))<=EPS*EPS;
 if(closed)points.pop();
 if(points.length<2||points.every(p=>p.distanceToSquared(points[0])<=EPS*EPS))return [];
 return points.map((point,index)=>({point,degree:closed||index>0&&index<points.length-1?2:1,index}));
}
export function sketchConnections(features){
 const entries=[],buckets=new Map(),parent=[],groups=new Map();
 const find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
 const cell=p=>p.toArray().map(v=>Math.floor(v/EPS));
 for(const feature of features){
  if(feature.kind!=='sketch'||feature.groupHidden||feature.construction||feature.textOutline||['point','circle'].includes(feature.profile))continue;
  const normal=basisFor(feature).n,group=feature.groupId??('legacy:'+(feature.groupNumber??'')),local=new Map();
  for(const corner of corners(feature)){
   const key=corner.point.toArray().join(',');if(local.has(key))local.get(key).degree+=corner.degree;else local.set(key,corner);
  }
  for(const {point,degree,index:vertexIndex}of local.values()){
   const index=entries.length,item={point,degree,featureId:feature.id,vertexIndex,normal,group};entries.push(item);parent.push(index);
   const [x,y,z]=cell(point);
   for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)for(let k=-1;k<=1;k++)for(const other of buckets.get([x+i,y+j,z+k].join(','))||[]){const candidate=entries[other];if(candidate.group!==group||Math.abs(candidate.normal.dot(normal))<1-1e-8||candidate.point.distanceToSquared(point)>EPS*EPS)continue;parent[find(index)]=find(other);}
   const key=[x,y,z].join(',');if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(index);
  }
 }
 for(let i=0;i<entries.length;i++){
  const root=find(i),item=entries[i];let node=groups.get(root);
  if(!node){node={point:new Vector3(),degree:0,featureIds:new Set(),refs:[],groupId:item.group,count:0};groups.set(root,node);}
  node.point.add(item.point);node.count++;node.degree+=item.degree;node.featureIds.add(item.featureId);node.refs.push({featureId:item.featureId,index:item.vertexIndex});
 }
 return [...groups.values()].map(node=>({point:node.point.divideScalar(node.count),degree:node.degree,featureIds:[...node.featureIds],refs:node.refs,groupId:node.groupId,connected:node.degree>=2}));
}

export function sketchConnectionGraph(nodes){
 const graph=new Map();for(const node of nodes){for(const id of node.featureIds){if(!graph.has(id))graph.set(id,new Set());if(node.connected)for(const other of node.featureIds)graph.get(id).add(other);}}return graph;
}
export function connectedSketchIds(graph,node){
 const ids=new Set(node?.featureIds||[]),pending=[...ids];while(pending.length)for(const id of graph.get(pending.pop())||[])if(!ids.has(id)){ids.add(id);pending.push(id);}return [...ids];
}
