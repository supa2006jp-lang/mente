// Only committed, visible profiles in the current sketch session are eligible.
// Open cursor previews and closed regions from other sketches cannot launch it.
export function sketchExtrudeRegion(features,regions,session){
 if(!session)return null;
 const members=features.filter(f=>f.kind==='sketch'&&!f.groupHidden&&(session.groupId?f.groupId===session.groupId:session.groupNumber!=null?f.groupNumber===session.groupNumber:f.id===session.id));
 const rank=new Map(members.map((f,i)=>[f.id,i]));let chosen=null,newest=-1;
 for(const region of regions){
  if(!region.outer||region.outer.length<3||!Number.isFinite(region.area)||region.area<=1e-8)continue;
  const index=Math.max(-1,...(region.sourceIds||[]).map(id=>rank.get(id)??-1));
  if(index>newest||index===newest&&index>=0&&region.area<chosen.area){chosen=region;newest=index;}
 }
 return chosen;
}
