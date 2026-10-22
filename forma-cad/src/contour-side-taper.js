import * as R from 'replicad';
import {basisFor,worldPoint} from './frames.js';
import {channelSides} from './contour-taper.js';

// Select the side faces by their shared start-cap edges. The draft operation
// retains exact CAD curves and fixes the opposite walls and the original cap.
export function contourSideTaper(shape,f,closedLoft){
 const profile=f.region||f,b=basisFor(profile),normal=b.n.clone().multiplyScalar(Math.sign(f.depth)),origin=f.region?worldPoint(profile,profile.outer[0]).toArray():[f.x,f.y,f.z],plane=new R.Plane(origin,b.u.toArray(),normal.toArray()),faces=shape.faces,resources=[],selected=[];let result,check;
 let caps=0,closedCaps=0;const project=p=>[p[0]*b.u.x+p[1]*b.u.y+p[2]*b.u.z,p[0]*b.v.x+p[1]*b.v.y+p[2]*b.v.z],coordinate=p=>p.reduce((s,v,i)=>s+(v-origin[i])*normal.toArray()[i],0),tuple=v=>{try{return v.toTuple();}finally{v.delete();}},distance=(a,c)=>Math.hypot(...a.map((v,i)=>v-c[i]));
 try{
  for(const face of faces){
   if(face.geomType!=='PLANE')continue;const n=face.normalAt(),center=face.center;let cap;try{cap=Math.abs(n.x*normal.x+n.y*normal.y+n.z*normal.z)/n.Length>.999999&&Math.abs(coordinate(center.toTuple()))<1e-5;}finally{n.delete();center.delete();}if(!cap)continue;
   const outer=face.clone().outerWire(),holes=face.clone().innerWires();resources.push(outer,...holes);const edges=outer.edges;resources.push(...edges);
   caps++;if(holes.length){closedCaps++;if(f.taperMode==='outer')selected.push(...edges);else for(const hole of holes){const inner=hole.edges;resources.push(...inner);selected.push(...inner);}continue;}
   if(edges.some(e=>e.geomType!=='LINE'))throw Error('開いた内側・外側のテーパーは直線で囲まれた輪郭を選択してください。穴のある輪郭は円弧にも対応します');
   const remaining=edges.map(edge=>({edge,a:tuple(edge.startPoint),z:tuple(edge.endPoint)})),ordered=[],ring=[];let end=remaining[0].a;
   while(remaining.length){const index=remaining.findIndex(e=>distance(e.a,end)<1e-6||distance(e.z,end)<1e-6);if(index<0)throw Error('輪郭がつながっていません');const entry=remaining.splice(index,1)[0];ring.push(project(end));ordered.push(entry.edge);end=distance(entry.a,end)<1e-6?entry.z:entry.a;}
   const mask=channelSides(ring)[f.taperMode];ordered.forEach((edge,i)=>{if(mask[i])selected.push(edge);});
  }
  if(!selected.length)throw Error('内側または外側の面を判定できません');
  result=closedCaps===caps?closedLoft():shape.draft(-f.taperAngle,ff=>ff.when(({element,normal:faceNormal})=>{if(element.geomType==='PLANE'&&Math.abs(faceNormal.x*normal.x+faceNormal.y*normal.y+faceNormal.z*normal.z)/faceNormal.Length>.999999)return false;const edges=element.edges;try{return edges.some(edge=>selected.some(base=>edge.isSame(base)));}finally{edges.forEach(edge=>edge.delete());}}),plane);
  check=new (R.getOC().BRepCheck_Analyzer)(result.wrapped,true,false);if(!check.IsValid()||R.measureVolume(result)<1e-7)throw Error('この角度では輪郭が潰れます。角度や距離を小さくしてください');
  const output=result;result=null;return output;
 }catch(error){throw Error('内側・外側のテーパーを作成できません。'+(error instanceof Error?error.message:'輪郭が交差しない角度や距離に調整してください'));}
 finally{check?.delete();result?.delete();resources.forEach(r=>r.delete());faces.forEach(face=>face.delete());plane.delete();shape.delete();}
}
