import {findRegions} from './regions.js';

// Hide only source groups with at most one closed region. Other regions in a
// group must stay available for subsequent extrusions.
export function hideExtrudedSketches(features,extrusions){
 const sketches=features.filter(f=>f.kind==='sketch'),byId=new Map(sketches.map(f=>[f.id,f]));
 const key=f=>f.groupId||f.groupNumber||f.id,groups=new Map();
 for(const f of sketches){const id=key(f);if(!groups.has(id))groups.set(id,[]);groups.get(id).push(f);}
 const candidates=new Set();
 for(const f of extrusions){
  if(f.kind!=='extrusion')continue;
  for(const id of [...(f.region?.sourceIds||[]),...(f.sourceSketchIds||[])]){const source=byId.get(id);if(source)candidates.add(key(source));}
 }
 const hidden=new Set([...candidates].filter(id=>findRegions(groups.get(id)).length<=1));
 return hidden.size?features.map(f=>f.kind==='sketch'&&hidden.has(key(f))&&!f.groupHidden?{...f,groupHidden:true}:f):features;
}
