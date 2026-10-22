import Clipper from 'clipper-lib';
import {sketchPoints,planeCoordinates} from './regions.js';
import {basisFor} from './frames.js';
export function offsetSketch(f,distance,options={}){if(options.allAround)return offsetSketchAllAround([f],distance);if(!Number.isFinite(distance)||Math.abs(distance)<.001)throw Error('オフセット距離を指定してください');const result={...structuredClone(f),id:crypto.randomUUID(),name:'オフセット '+f.name};if(f.profile==='circle'){result.diameter+=distance*2;if(result.diameter<.1)throw Error('円が消える距離です');return [result];}const points=sketchPoints(f),closed=f.profile==='rect'||f.closed||Math.hypot(points[0][0]-points.at(-1)[0],points[0][1]-points.at(-1)[1])<1e-6;let paths=[];
 if(closed){const path=points.map(([x,y])=>({X:Math.round(x*100000),Y:Math.round(y*100000)}));if(!Clipper.Clipper.Orientation(path))path.reverse();const offset=new Clipper.ClipperOffset(4);offset.AddPath(path,Clipper.JoinType.jtMiter,Clipper.EndType.etClosedPolygon);const output=[];offset.Execute(output,distance*100000);paths=output.map(p=>p.map(v=>[v.X/100000,v.Y/100000]));}else {const normals=[];for(let i=1;i<points.length;i++){const dx=points[i][0]-points[i-1][0],dy=points[i][1]-points[i-1][1],length=Math.hypot(dx,dy);if(length<1e-8)throw Error('重複した点を含む線です');normals.push([-dy/length,dx/length]);}paths=[points.map((p,i)=>{let n=i===0?normals[0]:i===points.length-1?normals.at(-1):[normals[i-1][0]+normals[i][0],normals[i-1][1]+normals[i][1]];const div=i===0||i===points.length-1?1:n[0]*normals[i][0]+n[1]*normals[i][1];if(Math.abs(div)<.05)throw Error('急な折り返し部分をオフセットできません');return [p[0]+n[0]*distance/div,p[1]+n[1]*distance/div];})];}
 if(!paths.length)throw Error('輪郭が消える距離です');return paths.map(path=>{const closeEnds=options.closeEnds===true&&!closed,outline=closeEnds?[...points.map(p=>[...p]),...path.slice().reverse()]:path,copy={...result,id:crypto.randomUUID(),profile:'polyline',points:outline,closed:closed||closeEnds};delete copy.arc;delete copy.tangents;delete copy.tangentLengths;return copy;});}

// Buffer the selected paths, rather than their filled regions. Round joins and
// caps keep the outside boundary at the requested distance from the lines.
export function offsetSketchAllAround(sources,distance){
 if(!Number.isFinite(distance)||distance<.001||distance>10000)throw Error('全周囲の距離は0.001〜10000 mmで指定してください');
 const selected=sources.filter(f=>f.kind==='sketch'&&f.profile!=='point');if(!selected.length)throw Error('スケッチの線または閉じた領域を選択してください');
 const groups=new Map(),scale=100000,result=[];
 for(const f of selected){
  const b=basisFor(f),o=planeCoordinates(f),normal=b.n.toArray(),dominant=normal.reduce((j,x,i)=>Math.abs(x)>Math.abs(normal[j])?i:j,0),sign=normal[dominant]<0?-1:1,key=[...normal.map(v=>Math.round(v*sign*1e6)),Math.round(o.offset*sign*1e6)].join(',');
  if(!groups.has(key))groups.set(key,{source:f,basis:b,offset:o.offset,paths:[],features:[]});const group=groups.get(key);
  const points=sketchPoints(f).map(([u,v])=>{const p=b.u.clone().multiplyScalar(u).addScaledVector(b.v,v).addScaledVector(b.n,o.offset);return [p.dot(group.basis.u),p.dot(group.basis.v)];});
  const path=[];for(const [x,y] of points){const q={X:Math.round(x*scale),Y:Math.round(y*scale)},last=path.at(-1);if(!last||last.X!==q.X||last.Y!==q.Y)path.push(q);}
  const closed=f.profile==='circle'||f.profile==='rect'||!!f.closed||(path.length>2&&path[0].X===path.at(-1).X&&path[0].Y===path.at(-1).Y);
  if(closed&&path.length>1&&path[0].X===path.at(-1).X&&path[0].Y===path.at(-1).Y)path.pop();
  if(path.length<(closed?3:2))throw Error('長さのある線を選択してください');group.paths.push({path,closed});group.features.push(f);
 }
 for(const group of groups.values()){
  const source=structuredClone(group.source);
  if(group.features.length===1&&source.profile==='circle'){
   for(const diameter of [source.diameter+distance*2,source.diameter-distance*2])if(diameter>=.1)result.push({...source,id:crypto.randomUUID(),name:'全周囲 '+source.name,diameter});
   continue;
  }
  const offset=new Clipper.ClipperOffset(4,Math.min(.005,distance/100)*scale);
  for(const {path,closed} of group.paths)offset.AddPath(path,Clipper.JoinType.jtRound,closed?Clipper.EndType.etClosedLine:Clipper.EndType.etOpenRound);
  const paths=[];offset.Execute(paths,distance*scale);
  const origin=group.basis.n.clone().multiplyScalar(group.offset);
  for(const path of paths){const f={...source,id:crypto.randomUUID(),name:'全周囲 '+source.name,profile:'polyline',x:origin.x,y:origin.y,z:origin.z,angle:0,points:path.map(p=>[p.X/scale,p.Y/scale]),closed:true};delete f.arc;delete f.tangents;delete f.tangentLengths;result.push(f);}
 }
 if(!result.length)throw Error('全周囲の輪郭を作成できません');return result;
}
