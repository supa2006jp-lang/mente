import {sketchConnections,SKETCH_CONNECTION_TOLERANCE as EPS} from './sketch-connections.js';
import {sketchPoints,planeCoordinates} from './regions.js';
import {basisFor,worldPoint} from './frames.js';
import {moveConstraintVertex,solveSketchConstraints} from './sketch-constraints.js';
import {validateFeature} from './geometry.js';
import {tangentArc} from './tangent-arc.js';

const group=f=>f.groupId??('legacy:'+(f.groupNumber??''));
const refKey=r=>JSON.stringify([r.featureId,r.index]);
const pairKey=(a,b)=>[refKey(a),refKey(b)].sort().join('|');
const plane=f=>({...f,offset:planeCoordinates(f).offset});
const point=(f,r)=>worldPoint(plane(f),(f.profile==='line'?sketchPoints(f):f.points)[r.index]);
function samePlane(a,b){const n=basisFor(a).n,m=basisFor(b).n;return Math.abs(n.dot(m))>1-1e-8&&Math.abs(planeCoordinates(a).offset-planeCoordinates(b).offset*n.dot(m))<=EPS;}
export function sketchGapCandidates(features,{limit=.1,nodes=sketchConnections(features)}={}){
 if(!Number.isFinite(limit)||limit<=EPS||limit>1)throw Error('検出する隙間は0.000001 mmより大きく、1 mm以下にしてください');
 const byId=new Map(features.map(f=>[f.id,f])),open=nodes.filter(n=>!n.connected&&n.refs?.length===1),buckets=new Map(),pairs=[],cell=p=>p.toArray().map(v=>Math.floor(v/limit));
 for(const node of open){const ref=node.refs[0],feature=byId.get(ref.featureId);if(!feature)continue;const [x,y,z]=cell(node.point);
  for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)for(let k=-1;k<=1;k++)for(const other of buckets.get([x+i,y+j,z+k].join(','))||[]){const first=other.refs[0],base=byId.get(first.featureId);if(group(base)!==group(feature)||!samePlane(base,feature))continue;if(base===feature&&(feature.profile==='line'||feature.points?.length<3))continue;const distance=node.point.distanceTo(other.point);if(distance<=EPS||distance>limit)continue;pairs.push({key:pairKey(first,ref),first:{...first},second:{...ref},a:other.point.toArray(),b:node.point.toArray(),distance});}
  const key=[x,y,z].join(',');if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(node);
 }
 return pairs.sort((a,b)=>a.distance-b.distance||a.key.localeCompare(b.key));
}
function circle(points){const a=points[0],b=points[Math.floor(points.length/2)],c=points.at(-1),u=[b[0]-a[0],b[1]-a[1]],v=[c[0]-a[0],c[1]-a[1]],den=2*(u[0]*v[1]-u[1]*v[0]);if(Math.abs(den)<1e-10)throw Error('円弧の曲率を保って修正できません。別の端点を移動側にしてください');const uu=u[0]**2+u[1]**2,vv=v[0]**2+v[1]**2,center=[a[0]+(uu*v[1]-vv*u[1])/den,a[1]+(u[0]*vv-v[0]*uu)/den],radius=Math.hypot(a[0]-center[0],a[1]-center[1]),start=Math.atan2(a[1]-center[1],a[0]-center[0]);let previous=start,sweep=0;for(const p of points.slice(1)){const angle=Math.atan2(p[1]-center[1],p[0]-center[0]);sweep+=Math.atan2(Math.sin(angle-previous),Math.cos(angle-previous));previous=angle;}return {center,radius,start,sweep};}
function moveArcEndpoint(f,index,uv){
 const reverse=index===0,original=reverse?[...f.points].reverse():f.points,info=circle(original),sign=Math.sign(info.sweep),tangent=[-Math.sin(info.start)*sign,Math.cos(info.start)*sign],arc=tangentArc(original[0],uv,tangent);if(!arc)throw Error('円弧を保って端点を合わせられません。移動する側を入れ替えてください');
 const fitted=circle(arc.points),count=original.length-1,points=Array.from({length:count+1},(_,i)=>[fitted.center[0]+fitted.radius*Math.cos(fitted.start+fitted.sweep*i/count),fitted.center[1]+fitted.radius*Math.sin(fitted.start+fitted.sweep*i/count)]);points[0]=[...original[0]];points[count]=[...uv];if(reverse)points.reverse();return {...f,points,arc:{...f.arc,endTangent:reverse?f.arc.endTangent:arc.endTangent}};
}
export function prepareSketchGapRepair(features,candidate,{limit=.1,reverse=false}={}){
 const fresh=sketchGapCandidates(features,{limit}).find(p=>p.key===candidate?.key);if(!fresh)throw Error('隙間や接続状態が変わりました。もう一度調べてください');
 const anchor=reverse?fresh.second:fresh.first,moving=reverse?fresh.first:fresh.second,base=features.find(f=>f.id===anchor.featureId),source=features.find(f=>f.id===moving.featureId),target=point(base,anchor),basis=basisFor(source),uv=[target.dot(basis.u),target.dot(basis.v)];
 if(source.sketchMirrorLink?.enabled||source.offsetLink)throw Error('追従中の線は直接修正できません。追従を解除するか、移動する側を入れ替えてください');
 let next;
 if(source.profile==='spline'||source.arc){const replacement=source.arc?moveArcEndpoint(source,moving.index,uv):{...source,points:source.points.map((p,i)=>i===moving.index?[...uv]:[...p])};next=solveSketchConstraints(features.map(f=>f===source?replacement:f),{before:features});}
 else next=moveConstraintVertex(features,moving,uv);
 const changed=next.find(f=>f.id===source.id),fixed=next.find(f=>f.id===base.id);
 if(point(changed,moving).distanceTo(target)>EPS||point(fixed,anchor).distanceTo(target)>EPS)throw Error('拘束により、この端点へ合わせられません。移動する側を入れ替えるか、拘束を確認してください');
 for(let i=0;i<features.length;i++)if(features[i].id!==source.id&&JSON.stringify(features[i])!==JSON.stringify(next[i]))throw Error('他の線も動くため修正を中止しました。拘束を確認するか、移動する側を入れ替えてください');
 const oldPoints=source.profile==='line'?sketchPoints(source):source.points,newPoints=changed.profile==='line'?sketchPoints(changed):changed.points;
 if(oldPoints.length!==newPoints.length)throw Error('頂点の構成が変わるため修正できません');
 for(let i=0;i<oldPoints.length;i++)if(i!==moving.index){const before=worldPoint(plane(source),oldPoints[i]),after=worldPoint(plane(changed),newPoints[i]);if(before.distanceTo(after)>(source.arc&&i!==0&&i!==oldPoints.length-1?fresh.distance*3:EPS))throw Error('別の端点も動くため修正を中止しました。拘束を確認するか、移動する側を入れ替えてください');}
 for(let i=1;i<newPoints.length;i++)if(Math.hypot(newPoints[i][0]-newPoints[i-1][0],newPoints[i][1]-newPoints[i-1][1])<1e-4)throw Error('線がつぶれるため、この端点には接続できません');
 validateFeature(changed);return {features:next,changedIds:[source.id],anchor,moving,target:target.toArray(),from:point(source,moving).toArray(),distance:fresh.distance};
}
