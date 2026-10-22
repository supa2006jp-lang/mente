import {pipeSketchPaths,pipeWorldPoints} from './pipe-path.js';
import {basisFor} from './frames.js';
import {offsetSketch} from './sketch-offset.js';

// Join only selected, coplanar endpoints before offsetting. This gives each
// connected chain one pair of straight caps and keeps separate paths separate.
export function offsetConnectedSketches(sources,distance,options={}){
 if(!options.closeEnds)return sources.flatMap(f=>offsetSketch(f,distance,options));
 const owners=new Map(sources.map(f=>[f.id,f])),paths=pipeSketchPaths(sources.map(f=>({...f,groupId:'offset-selected-paths'})));
 return paths.flatMap(path=>{
  if(path.pathError)throw Error('選択した線が分岐しています。閉じる線を分岐のない経路に絞ってください');
  const source=owners.get(path.id);if(!path.pathSegments)return offsetSketch(source,distance,options);
  const b=basisFor(source),points=[];
  for(const segment of path.pathSegments){const world=pipeWorldPoints(segment.feature);if(segment.reverse)world.reverse();for(const p of world.slice(points.length?1:0))points.push([p[0]*b.u.x+p[1]*b.u.y+p[2]*b.u.z,p[0]*b.v.x+p[1]*b.v.y+p[2]*b.v.z]);}
  const joined={...structuredClone(source),profile:'polyline',points,closed:path.closed};delete joined.arc;delete joined.tangents;delete joined.tangentLengths;
  return offsetSketch(joined,distance,options);
 });
}
