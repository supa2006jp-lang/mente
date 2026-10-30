// Only committed, visible profiles in the current sketch session are eligible.
// Open cursor previews and closed regions from other sketches cannot launch it.
export function sketchExtrudeRegions(features,regions,session){
 if(!session)return [];
 const members=new Set(features.filter(f=>f.kind==='sketch'&&!f.groupHidden&&!f.construction&&(session.groupId?f.groupId===session.groupId:session.groupNumber!=null?f.groupNumber===session.groupNumber:f.id===session.id)).map(f=>f.id));
 return regions.filter(region=>region.outer?.length>=3&&Number.isFinite(region.area)&&region.area>1e-8&&(region.sourceIds||[]).some(id=>members.has(id)));
}
