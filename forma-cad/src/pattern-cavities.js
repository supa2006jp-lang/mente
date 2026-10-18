import * as R from 'replicad';

function valid(shape){const check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);try{return check.IsValid();}finally{check.delete();}}
// Cut the face-adjacency graph at inner boundary loops. The isolated inside
// walls, closed with caps at their openings, are the empty volumes of holes.
// This uses the final CAD surfaces, including blind holes and rounded rims.
export function patternCavities(source,onProgress){
 const base=R.deserializeShape(source.serialize()).asShape3D(),faces=base.faces,records=[],buckets=new Map(),faceEdges=[],mouths=[],blocked=new Set(),cavities=[];let completed=false;
 function record(edge){let bucket=buckets.get(edge.hashCode);if(!bucket){bucket=[];buckets.set(edge.hashCode,bucket);}let found=bucket.find(r=>r.edge.isSame(edge));if(found){edge.delete();return found;}found={index:records.length,edge,faces:new Set()};records.push(found);bucket.push(found);return found;}
 try{
  for(const [i,face]of faces.entries()){faceEdges[i]=face.edges.map(edge=>{const r=record(edge);r.faces.add(i);return r;});}
  for(const [i,face]of faces.entries())for(const wire of face.clone().innerWires()){
   const edges=wire.edges;let links;
   try{links=edges.map(edge=>buckets.get(edge.hashCode)?.find(r=>r.edge.isSame(edge))).filter(Boolean);}finally{edges.forEach(edge=>edge.delete());}
   if(!links.length){wire.delete();throw Error('穴の境界を特定できません');}
   links.forEach(r=>blocked.add(r.index));mouths.push({parent:i,wire,links});
  }
  const processed=new Set();
  for(const mouth of mouths)for(const start of new Set(mouth.links.flatMap(r=>[...r.faces].filter(i=>i!==mouth.parent)))){
   if(processed.has(start))continue;const group=new Set(),pending=[start];
   while(pending.length){const i=pending.pop();if(group.has(i))continue;group.add(i);for(const r of faceEdges[i])if(!blocked.has(r.index))for(const j of r.faces)if(!group.has(j))pending.push(j);}
   group.forEach(i=>processed.add(i));const caps=[];let cavity;
   try{
    for(const opening of mouths)if(opening.links.some(r=>[...r.faces].some(i=>group.has(i))&&[...r.faces].some(i=>!group.has(i))))caps.push(R.makeFace(opening.wire));
    onProgress?.({stage:'穴の空間を判定しています',current:cavities.length+1});cavity=R.makeSolid([...group].map(i=>faces[i]).concat(caps));
    if(!valid(cavity)||R.measureVolume(cavity)<=1e-7)throw Error('穴の空間を閉じた形状として判定できません');
    const intersection=base.intersect(cavity);try{if(Math.abs(R.measureVolume(intersection))>Math.max(1e-6,R.measureVolume(cavity)*1e-7))throw Error('穴の空間とソリッドの実体を区別できません');}finally{intersection.delete();}
    cavities.push(cavity);cavity=null;
   }finally{cavity?.delete();caps.forEach(cap=>cap.delete());}
  }
  const shells=Array.from(R.iterTopo(base.wrapped,'shell'),shell=>R.cast(shell));
  try{if(shells.length>1)for(const shell of shells){let cavity;try{cavity=R.makeSolid([shell]);if(!valid(cavity)||R.measureVolume(cavity)<=1e-7)throw Error('内部空間を判定できません');const intersection=base.intersect(cavity);try{if(Math.abs(R.measureVolume(intersection))>1e-6)continue;}finally{intersection.delete();}cavities.push(cavity);cavity=null;}finally{cavity?.delete();}}}finally{shells.forEach(shell=>shell.delete());}
  completed=true;return cavities;
 }catch(error){throw Object.assign(Error('穴を埋めずにパターン化するための判定に失敗しました。'+(error.message||'穴の形状を確認してください')),{cause:error});}
 finally{if(!completed)cavities.forEach(shape=>shape.delete());mouths.forEach(m=>m.wire.delete());records.forEach(r=>r.edge.delete());faces.forEach(face=>face.delete());base.delete();}
}
