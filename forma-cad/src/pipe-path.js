import {sketchPoints,planeCoordinates} from './regions.js';
import {basisFor,worldPoint} from './frames.js';

const EPS=1e-6,copy=value=>JSON.parse(JSON.stringify(value));
export function pipeWorldPoints(feature){
 const plane={...feature,offset:planeCoordinates(feature).offset};
 return sketchPoints(feature).map(point=>worldPoint(plane,point).toArray());
}
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const closed=feature=>feature.closed||['circle','rect','region'].includes(feature.profile);
function samePlane(a,b){
 const na=basisFor(a).n,nb=basisFor(b).n;
 return Math.abs(na.dot(nb))>1-1e-8&&Math.abs(na.x*(b.x-a.x)+na.y*(b.y-a.y)+na.z*(b.z-a.z))<EPS;
}

// A sketch group stores each confirmed line/curve separately. Join only their
// endpoints; nearby strokes, crossings and different workplanes stay separate.
export function pipeSketchPaths(features){
 const items=features.filter(f=>f.kind==='sketch'&&f.profile!=='point'),nodes=[];
 const entries=items.map(feature=>{
  const points=pipeWorldPoints(feature),ends=[points[0],points.at(-1)];
  const entry={feature,nodes:[]};
  if(!closed(feature)&&points.length>=2)for(const point of ends){
   let node=nodes.find(n=>feature.groupId&&n.feature.groupId===feature.groupId&&samePlane(feature,n.feature)&&distance(n.point,point)<=EPS);
   if(!node){node={point,feature,entries:[]};nodes.push(node);}
   node.entries.push(entry);entry.nodes.push(node);
  }
  return entry;
 });
 const visited=new Set(),paths=[];
 for(const root of entries){
  if(visited.has(root))continue;
  const component=[],pending=[root];visited.add(root);
  while(pending.length){const item=pending.pop();component.push(item);for(const node of item.nodes)for(const neighbor of node.entries)if(!visited.has(neighbor)){visited.add(neighbor);pending.push(neighbor);}}
  component.sort((a,b)=>items.indexOf(a.feature)-items.indexOf(b.feature));
  if(component.length===1){paths.push(copy(root.feature));continue;}
  const sourceIds=component.map(e=>e.feature.id),base=copy(component[0].feature),path={...base,sourceIds,pathSegments:[]};
  if(component.some(e=>e.nodes.some(n=>n.entries.length>2))){path.pathError='経路が分岐しています。分岐のない1本のスケッチ経路にしてください';paths.push(path);continue;}
  let node=component.flatMap(e=>e.nodes).find(n=>n.entries.length===1)||component[0].nodes[0];const used=new Set();
  while(used.size<component.length){
   const entry=node.entries.find(e=>!used.has(e));if(!entry)break;
   const reverse=entry.nodes[1]===node;path.pathSegments.push({feature:copy(entry.feature),reverse});used.add(entry);node=entry.nodes[reverse?0:1];
  }
  path.closed=component.every(e=>e.nodes.every(n=>n.entries.length===2));
  paths.push(path);
 }
 return paths;
}

export const pipePathIncludes=(path,id)=>path.id===id||path.sourceIds?.includes(id);
export const pipePathLabel=path=>(path.name||'スケッチ')+' / '+(path.pathSegments?(path.pathError?'分岐した経路':`連続パス（${path.sourceIds.length}要素）`):path.profile);

export function refreshPipePath(features,spec){
 const saved=spec.pathFeature;
 if(!saved?.pathSegments){const source=features.find(f=>f.kind==='sketch'&&f.id===spec.path)||saved;return source?copy(source):undefined;}
 const ids=new Set(saved.sourceIds),sources=features.filter(f=>f.kind==='sketch'&&ids.has(f.id));
 if(sources.length!==ids.size)throw Error('パイプ経路のスケッチが見つかりません。経路を選び直してください');
 const paths=pipeSketchPaths(sources);
 if(paths.length!==1)throw Error('パイプ経路の接続が切れています。スケッチの端点をつないでください');
 if(paths[0].pathError)throw Error(paths[0].pathError);
 return {...paths[0],id:saved.id};
}
