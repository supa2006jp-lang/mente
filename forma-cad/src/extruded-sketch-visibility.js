import {findRegions} from './regions.js';

// Keep unfinished regions available; hide the group once every closed region
// has a corresponding extrusion in the current project history.
export function hideExtrudedSketches(features,extrusions){
 const sketches=features.filter(f=>f.kind==='sketch'),byId=new Map(sketches.map(f=>[f.id,f]));
 const key=f=>f.groupId||f.groupNumber||f.id,groups=new Map();
 for(const f of sketches){const id=key(f);if(!groups.has(id))groups.set(id,[]);groups.get(id).push(f);}
 const candidates=new Set();
 for(const f of extrusions){
  if(f.kind!=='extrusion')continue;
  for(const id of [...(f.region?.sourceIds||[]),...(f.sourceSketchIds||[])]){const source=byId.get(id);if(source)candidates.add(key(source));}
 }
 const completed=new Map();
 for(const f of [...features,...extrusions]){
  if(f.kind!=='extrusion'||!f.region?.id)continue;
  for(const sourceId of f.region.sourceIds||[]){
   const source=byId.get(sourceId);if(!source)continue;
   const id=key(source);if(!completed.has(id))completed.set(id,new Set());
   completed.get(id).add(f.region.id);
  }
 }
 const hidden=new Set([...candidates].filter(id=>{
  const regions=findRegions(groups.get(id));
  return regions.length<=1||regions.every(r=>completed.get(id)?.has(r.id));
 }));
 return hidden.size?features.map(f=>f.kind==='sketch'&&hidden.has(key(f))&&!f.groupHidden?{...f,groupHidden:true}:f):features;
}
