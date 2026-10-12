import {findRegions} from './regions.js';

const groupKey=f=>f.groupId||f.groupNumber||f.id;

// Derive progress from persisted history, so undo, reload and geometry edits
// use the same region identities as the automatic visibility rule.
export function sketchExtrusionProgress(features,extrusions=[]){
 const sketches=features.filter(f=>f.kind==='sketch'),byId=new Map(sketches.map(f=>[f.id,f]));
 const groups=new Map();
 for(const f of sketches){const id=groupKey(f);if(!groups.has(id))groups.set(id,[]);groups.get(id).push(f);}
 const completed=new Map();
 for(const f of [...features,...extrusions]){
  if(f.kind!=='extrusion'||!f.region?.id)continue;
  for(const sourceId of f.region.sourceIds||[]){
   const source=byId.get(sourceId);if(!source)continue;
   const id=groupKey(source);if(!completed.has(id))completed.set(id,new Set());
   completed.get(id).add(f.region.id);
  }
 }
 return new Map([...groups].map(([id,members])=>{
  const regions=findRegions(members),remaining=regions.filter(r=>!completed.get(id)?.has(r.id));
  return [id,{members,regions,remaining,total:regions.length,done:regions.length-remaining.length}];
 }));
}

// Keep unfinished regions available; hide the group once every closed region
// has a corresponding extrusion in the current project history.
export function hideExtrudedSketches(features,extrusions){
 if(!extrusions.some(f=>f.kind==='extrusion'))return features;
 const byId=new Map(features.filter(f=>f.kind==='sketch').map(f=>[f.id,f])),candidates=new Set();
 for(const f of extrusions){
  if(f.kind!=='extrusion')continue;
  for(const id of [...(f.region?.sourceIds||[]),...(f.sourceSketchIds||[])]){const source=byId.get(id);if(source)candidates.add(groupKey(source));}
 }
 const progress=sketchExtrusionProgress(features,extrusions);
 const hidden=new Set([...candidates].filter(id=>{
  const group=progress.get(id);
  return group.total<=1||!group.remaining.length;
 }));
 return hidden.size?features.map(f=>f.kind==='sketch'&&hidden.has(groupKey(f))&&!f.groupHidden?{...f,groupHidden:true}:f):features;
}
