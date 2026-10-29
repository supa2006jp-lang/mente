import * as THREE from 'three';
import {sketchPoints,planeCoordinates} from './regions.js';
import {basisFor,worldPoint} from './frames.js';
export const constraintNames={coincident:'端点一致',horizontal:'水平',vertical:'垂直',equal:'同じ長さ',parallel:'平行',perpendicular:'直角',length:'長さ固定',fixed:'位置固定'};
const vertexConstraint=type=>type==='coincident'||type==='fixed';
const EPS=1e-7,key=r=>JSON.stringify([r.featureId,r.index]),copy=x=>structuredClone(x);
export function constraintVertices(f){
 if(f?.kind!=='sketch'||f.arc||f.textOutline||!['line','rect','polyline'].includes(f.profile))return null;
 const points=sketchPoints(f).map(p=>[...p]);if(points.length>2&&Math.hypot(points[0][0]-points.at(-1)[0],points[0][1]-points.at(-1)[1])<1e-8)points.pop();
 return points;
}
export function constraintEdges(f){const ps=constraintVertices(f);if(!ps)return [];const closed=f.profile==='rect'||f.closed||f.profile==='polyline'&&f.points.length>ps.length;return Array.from({length:ps.length-(closed?0:1)},(_,index)=>({featureId:f.id,index,vertices:[index,(index+1)%ps.length]}));}
function checkShape(f){
 if(['line','rect'].includes(f.profile)&&(f.width<.1||f.width>10000||f.profile==='rect'&&(f.height<.1||f.height>10000)))throw Error('拘束後の長さ・寸法は0.1〜10000 mmにしてください');
 const ps=constraintVertices(f),edges=constraintEdges(f);for(const e of edges)if(Math.hypot(...ps[e.vertices[1]].map((v,i)=>v-ps[e.vertices[0]][i]))<.0001)throw Error('拘束によって線がつぶれます。関係する拘束を解除してください');
 if(edges.length!==ps.length)return;const area=ps.reduce((n,p,i)=>n+p[0]*ps[(i+1)%ps.length][1]-p[1]*ps[(i+1)%ps.length][0],0);if(Math.abs(area)<1e-7)throw Error('拘束によって閉じた枠がつぶれます');
 const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]),on=(p,a,b)=>Math.abs(cross(a,b,p))<1e-9&&p[0]>=Math.min(a[0],b[0])-1e-9&&p[0]<=Math.max(a[0],b[0])+1e-9&&p[1]>=Math.min(a[1],b[1])-1e-9&&p[1]<=Math.max(a[1],b[1])+1e-9;
 for(let i=0;i<ps.length;i++)for(let j=i+2;j<ps.length;j++){if(i===0&&j===ps.length-1)continue;const a=ps[i],b=ps[(i+1)%ps.length],c=ps[j],d=ps[(j+1)%ps.length];if(cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0||on(c,a,b)||on(d,a,b)||on(a,c,d)||on(b,c,d))throw Error('拘束によって閉じた枠が交差・接触します');}
}
export function validateConstraintData(f){
 if(f?.sketchConstraintsEnabled!==undefined&&(f.kind!=='sketch'||typeof f.sketchConstraintsEnabled!=='boolean'))throw Error('拘束機能のON/OFFが不正です');if(!f||f.sketchConstraints===undefined)return;if(f.kind!=='sketch'||!Array.isArray(f.sketchConstraints)||f.sketchConstraints.length>200)throw Error('スケッチ拘束のデータが不正です');
 for(const c of f.sketchConstraints){if(!c||typeof c.id!=='string'||!c.id||c.id.length>100||!Object.hasOwn(constraintNames,c.type))throw Error('スケッチ拘束の種類が不正です');const refs=[c.first,...(['equal','coincident','parallel','perpendicular'].includes(c.type)?[c.second]:[])];if(refs.some(r=>!r||typeof r.featureId!=='string'||!r.featureId||r.featureId.length>100||!Number.isInteger(r.index)||r.index<0||r.index>255)||c.first.featureId!==f.id)throw Error('スケッチ拘束の参照が不正です');if(refs.length===1&&c.second!==undefined)throw Error('スケッチ拘束の参照が不正です');if(c.enabled!==undefined&&typeof c.enabled!=='boolean')throw Error('拘束のON/OFFは真偽値で指定してください');if(c.type==='length'&&(!Number.isFinite(c.value)||c.value<.1||c.value>10000)||c.type!=='length'&&c.value!==undefined)throw Error('固定する長さは0.1〜10000 mmで指定してください');if(c.type==='fixed'&&(!Array.isArray(c.position)||c.position.length!==3||c.position.some(v=>!Number.isFinite(v)||Math.abs(v)>100000))||c.type!=='fixed'&&c.position!==undefined)throw Error('固定位置のデータが不正です');}
}
export function sketchConstraints(features){return features.flatMap(f=>(f.sketchConstraints||[]).map(c=>({...c,owner:f.id})));}
export function sketchConstraintsEnabled(features){return features.filter(f=>f.kind==='sketch').every(f=>f.sketchConstraintsEnabled!==false);}
export function constraintIsEnabled(features,c){return c.enabled!==false&&sketchConstraintsEnabled(features);}
function references(features,{activeOnly=false}={}){
 const byId=new Map(features.map(f=>[f.id,f])),records=sketchConstraints(features),ids=new Set();if(records.length>200)throw Error('スケッチ拘束は合計200個以内にしてください');
 for(const f of features)validateConstraintData(f);for(const c of records){if(ids.has(c.id))throw Error('スケッチ拘束のIDが重複しています');ids.add(c.id);const refs=[c.first,...(c.second?[c.second]:[])],fs=refs.map(r=>byId.get(r.featureId));for(const [i,r]of refs.entries()){const points=constraintVertices(fs[i]),count=vertexConstraint(c.type)?points?.length:constraintEdges(fs[i]).length;if(!points||r.index>=count)throw Error('拘束対象の直線・端点がありません。該当する拘束を解除してください');}if(constraintIsEnabled(features,c)&&c.type==='fixed'&&Math.abs(new THREE.Vector3(...c.position).dot(basisFor(fs[0]).n)-planeCoordinates(fs[0]).offset)>EPS)throw Error('固定した頂点の作図平面を変更できません。位置固定を解除してください');
  if(fs.length===2){const a=basisFor(fs[0]),b=basisFor(fs[1]);if(fs[0].groupId!==fs[1].groupId||Math.abs(a.n.dot(b.n))<1-1e-8||Math.abs(new THREE.Vector3(fs[1].x-fs[0].x,fs[1].y-fs[0].y,fs[1].z-fs[0].z).dot(a.n))>EPS)throw Error('拘束には同じスケッチ番号・同じ平面の線を選択してください');if(key(c.first)===key(c.second))throw Error('異なる2つの線・端点を選択してください');}
 }
 const involved=new Set(records.flatMap(c=>[c.first.featureId,...(c.second?[c.second.featureId]:[])]));if([...involved].reduce((n,id)=>n+constraintVertices(byId.get(id)).length,0)>256)throw Error('拘束対象の頂点は合計256個以内にしてください');return {byId,records:activeOnly?records.filter(c=>constraintIsEnabled(features,c)):records};
}
function equations(c,byId,nodes){
 const cache=byId.constraintEdges||(byId.constraintEdges=new Map()),vertex=r=>nodes.get(key(r)),edge=r=>{if(!cache.has(r.featureId))cache.set(r.featureId,constraintEdges(byId.get(r.featureId)));return cache.get(r.featureId)[r.index].vertices.map(index=>({ref:{featureId:r.featureId,index},p:vertex({featureId:r.featureId,index})}));};
 if(c.type==='fixed'){const node=vertex(c.first);return [0,1,2].map(axis=>({value:node.p.getComponent(axis)-c.position[axis],terms:[[node,new THREE.Vector3().setComponent(axis,1)]]}));}
 if(c.type==='coincident'){const a=vertex(c.first),b=vertex(c.second);return [0,1,2].map(axis=>({value:b.p.getComponent(axis)-a.p.getComponent(axis),terms:[[a,new THREE.Vector3().setComponent(axis,-1)],[b,new THREE.Vector3().setComponent(axis,1)]]}));}
 const [a,b]=edge(c.first);if(c.type==='horizontal'||c.type==='vertical'){const axis=basisFor(byId.get(c.first.featureId))[c.type==='horizontal'?'v':'u'];return [{value:b.p.p.clone().sub(a.p.p).dot(axis),terms:[[a.p,axis.clone().negate()],[b.p,axis]]}];}
 if(c.type==='length'){const u=b.p.p.clone().sub(a.p.p),value=u.length()-c.value;u.normalize();return [{value,terms:[[a.p,u.clone().negate()],[b.p,u]]}];}
 if(c.type==='parallel'||c.type==='perpendicular'){
  const [d,e]=edge(c.second),u=b.p.p.clone().sub(a.p.p),v=e.p.p.clone().sub(d.p.p),n=basisFor(byId.get(c.first.featureId)).n,lu=u.length(),lv=v.length(),angle=Math.atan2(new THREE.Vector3().crossVectors(u,v).dot(n),u.dot(v)),target=c.type==='parallel'?0:Math.PI/2,delta=((angle-target+Math.PI/2)%Math.PI+Math.PI)%Math.PI-Math.PI/2,scale=Math.min(lu,lv),gu=new THREE.Vector3().crossVectors(n,u).multiplyScalar(-scale/(lu*lu||1)),gv=new THREE.Vector3().crossVectors(n,v).multiplyScalar(scale/(lv*lv||1));
  return [{value:delta*scale,terms:[[a.p,gu.clone().negate()],[b.p,gu],[d.p,gv.clone().negate()],[e.p,gv]]}];
 }
 const [d,e]=edge(c.second),u=b.p.p.clone().sub(a.p.p),v=e.p.p.clone().sub(d.p.p),value=u.length()-v.length();u.normalize();v.normalize();return [{value,terms:[[a.p,u.clone().negate()],[b.p,u],[d.p,v],[e.p,v.clone().negate()]]}];
}
function writeVertices(f,world){
 const b=basisFor(f),points=world.map(p=>[p.dot(b.u),p.dot(b.v)]),old=constraintVertices(f);if(points.every((p,i)=>Math.hypot(p[0]-old[i][0],p[1]-old[i][1])<1e-9))return f;
 const next=copy(f);if(f.profile==='line'){const d=world[1].clone().sub(world[0]),center=world[0].clone().add(world[1]).multiplyScalar(.5);return {...next,x:center.x,y:center.y,z:center.z,width:d.length(),angle:Math.atan2(d.dot(b.v),d.dot(b.u))*180/Math.PI};}
 if(f.profile==='rect'){const u=world[1].clone().sub(world[0]),v=world[2].clone().sub(world[1]);if(Math.abs(u.dot(v))<1e-7*u.length()*v.length()&&world[0].clone().add(u).add(v).distanceTo(world[2])<EPS&&world[0].clone().add(v).distanceTo(world[3])<EPS){const center=world.reduce((sum,p)=>sum.add(p),new THREE.Vector3()).multiplyScalar(.25);return {...next,x:center.x,y:center.y,z:center.z,width:u.length(),height:v.length(),angle:Math.atan2(u.dot(b.v),u.dot(b.u))*180/Math.PI};}next.profile='polyline';next.closed=true;}
 next.points=points;if(f.profile==='polyline'&&f.points.length>old.length)next.points.push([...points[0]]);return next;
}
export function solveSketchConstraints(features,{before=features,pins=[],freeDrivers=[]}={}){
 const {byId,records}=references(features,{activeOnly:true});if(!records.length)return features;const involved=new Set(records.flatMap(c=>[c.first.featureId,...(c.second?[c.second.featureId]:[])])),old=new Map(before.map(f=>[f.id,f])),nodes=new Map(),pinSet=new Set(pins.map(key)),free=new Set(freeDrivers.map(key));
 for(const id of involved){const f=byId.get(id),ps=constraintVertices(f),prior=old.get(id),oldPoints=constraintVertices(prior);for(const [index,p]of ps.entries()){const world=worldPoint({...f,offset:planeCoordinates(f).offset},p),previous=oldPoints?.[index]&&worldPoint({...prior,offset:planeCoordinates(prior).offset},oldPoints[index]),ref={featureId:id,index};nodes.set(key(ref),{ref,p:world,fixed:pinSet.has(key(ref))||!free.has(key(ref))&&!!previous&&world.distanceTo(previous)>1e-8});}}
 for(const c of records.filter(c=>c.type==='fixed')){const node=nodes.get(key(c.first));if(node.p.distanceTo(new THREE.Vector3(...c.position))>EPS)throw Error('位置固定された頂点は移動できません。位置固定を解除してください');node.fixed=true;}
 if(nodes.size>256)throw Error('拘束対象の頂点は合計256個以内にしてください');
 let residual=Infinity;for(let iteration=0;iteration<1200;iteration++){residual=0;for(const c of records)for(const equation of equations(c,byId,nodes)){residual=Math.max(residual,Math.abs(equation.value));const gradients=new Map();for(const [node,g]of equation.terms){if(!gradients.has(node))gradients.set(node,new THREE.Vector3());gradients.get(node).add(g);}let den=0;for(const [node,g]of gradients)if(!node.fixed)den+=g.lengthSq();if(den<=1e-20&&Math.abs(equation.value)>EPS)throw Error('拘束が矛盾するため変更できません：'+constraintNames[c.type]+'。関係する拘束を解除するか、動かす端点を変更してください');if(den>1e-20)for(const [node,g]of gradients)if(!node.fixed)node.p.addScaledVector(g,-equation.value/den);}if(residual<1e-9)break;}
 const failed=records.filter(c=>equations(c,byId,nodes).some(e=>Math.abs(e.value)>EPS));if(failed.length)throw Error('拘束が矛盾するため変更できません：'+[...new Set(failed.map(c=>constraintNames[c.type]))].join('・')+'。関係する拘束を解除するか、動かす端点を変更してください');
 // Use one shared position, rather than leaving a sub-micron gap at a solved joint.
 const parents=new Map(),root=k=>{let r=k;while(parents.has(r))r=parents.get(r);return r;};for(const c of records.filter(c=>c.type==='coincident')){const a=root(key(c.first)),b=root(key(c.second));if(a!==b)parents.set(b,a);}const joints=new Map();for(const [k,node]of nodes){const r=root(k);if(!joints.has(r))joints.set(r,[]);joints.get(r).push(node);}for(const joint of joints.values()){if(joint.length<2)continue;const target=(joint.find(n=>n.fixed)||joint[0]).p.clone();for(const node of joint)node.p.copy(target);}
 const output=features.map(f=>{if(!involved.has(f.id))return f;const ps=constraintVertices(f),world=ps.map((_,index)=>nodes.get(key({featureId:f.id,index})).p);for(const edge of constraintEdges(f))if(world[edge.vertices[0]].distanceTo(world[edge.vertices[1]])<.0001)throw Error('拘束によって線がつぶれます。関係する拘束を解除してください');return writeVertices(f,world);});
 for(const f of output)if(involved.has(f.id))checkShape(f);assertSketchConstraints(output);return output;
}
export function assertSketchConstraints(features){
 const {byId,records}=references(features,{activeOnly:true});if(!records.length)return;const nodes=new Map();for(const c of records)for(const ref of [c.first,...(c.second?[c.second]:[])]){const f=byId.get(ref.featureId);for(const [index,p]of constraintVertices(f).entries())nodes.set(key({featureId:f.id,index}),{p:worldPoint({...f,offset:planeCoordinates(f).offset},p)});}
 for(const c of records)if(equations(c,byId,nodes).some(e=>Math.abs(e.value)>EPS))throw Error('保存されたスケッチが「'+constraintNames[c.type]+'」拘束を満たしていません');
 for(const id of new Set(records.flatMap(c=>[c.first.featureId,...(c.second?[c.second.featureId]:[])])))checkShape(byId.get(id));
}
export function addSketchConstraint(features,type,first,second,options={}){
 const {byId,records}=references(features),f=byId.get(first?.featureId);if(!f||!constraintNames[type])throw Error('拘束する線・頂点を選択してください');const c={id:crypto.randomUUID(),type,first:copy(first),...(['equal','coincident','parallel','perpendicular'].includes(type)?{second:copy(second)}:{}),...(type==='length'?{value:options.value}:{}),...(type==='fixed'?{position:worldPoint({...f,offset:planeCoordinates(f).offset},constraintVertices(f)?.[first.index]||[]).toArray()}:{})};validateConstraintData({...f,sketchConstraints:[c]});
 const existing=records.find(r=>r.type===type&&(key(r.first)===key(first)&&(!c.second||key(r.second)===key(c.second))||['equal','coincident','parallel','perpendicular'].includes(type)&&key(r.second)===key(first)&&key(r.first)===key(c.second)));if(existing&&existing.enabled!==false&&type!=='length')throw Error('同じ拘束は既に設定されています');if(existing){c.id=existing.id;if(existing.enabled===false&&type==='length')c.enabled=false;}
 let next=features.map(item=>item.id===first.featureId?{...item,sketchConstraints:existing?item.sketchConstraints.map(r=>r.id===existing.id?c:r):[...(item.sketchConstraints||[]),c]}:item),edgeVertices=constraintEdges(f)[first.index]?.vertices,locked=lockedConstraintVertices(features),anchor=edgeVertices?.find(index=>locked.has(key({featureId:f.id,index})))??edgeVertices?.[0],pins=vertexConstraint(type)?[first]:['equal','parallel','perpendicular'].includes(type)?edgeVertices?.map(index=>({featureId:f.id,index})):anchor===undefined?null:[{featureId:f.id,index:anchor}];if(!pins)throw Error('拘束する線を選択してください');if(['parallel','perpendicular'].includes(type)&&constraintIsEnabled(next,c))next=alignConstraintEdges(next,c);return solveSketchConstraints(next,{pins});
}
function alignConstraintEdges(features,c){
 const {byId}=references(features),f=byId.get(c.first.featureId),g=byId.get(c.second.featureId),a=constraintEdges(f)[c.first.index].vertices,b=constraintEdges(g)[c.second.index].vertices,world=(feature,index)=>worldPoint({...feature,offset:planeCoordinates(feature).offset},constraintVertices(feature)[index]),first=a.map(i=>world(f,i)),second=b.map(i=>world(g,i)),u=first[1].clone().sub(first[0]),v=second[1].clone().sub(second[0]),n=basisFor(f).n,angle=Math.atan2(new THREE.Vector3().crossVectors(u,v).dot(n),u.dot(v)),target=c.type==='parallel'?0:Math.PI/2,delta=((angle-target+Math.PI/2)%Math.PI+Math.PI)%Math.PI-Math.PI/2,locked=lockedConstraintVertices(features),fixed=b.findIndex(i=>locked.has(key({featureId:g.id,index:i}))),shared=second.findIndex(p=>first.some(q=>q.distanceTo(p)<EPS)),pivot=fixed>=0?second[fixed]:shared>=0?second[shared]:second[0].clone().add(second[1]).multiplyScalar(.5),q=new THREE.Quaternion().setFromAxisAngle(n,-delta),points=constraintVertices(g).map((_,i)=>world(g,i));
 for(const i of b)points[i].sub(pivot).applyQuaternion(q).add(pivot);return features.map(item=>item.id===g.id?writeVertices(g,points):item);
}
export function selectedConstraintEdges(features,selection){
 const byId=new Map(features.map(f=>[f.id,f]));return [...selection].flatMap(([id,indices])=>{const f=byId.get(id);return f&&!f.groupHidden?[...indices].map(index=>constraintEdges(f)[index]).filter(Boolean):[];});
}
export function applyDirectSketchConstraint(features,type,selection){
 if(!sketchConstraintsEnabled(features))throw Error('拘束をONにしてください');const edges=selectedConstraintEdges(features,selection),pair=['parallel','perpendicular','equal'].includes(type);if(!['horizontal','vertical','parallel','perpendicular','equal'].includes(type)||edges.length!==(pair?2:1))throw Error(pair?'直線の辺を2本選択してください':'直線の辺を1本選択してください');const first={featureId:edges[0].featureId,index:edges[0].index},second=pair?{featureId:edges[1].featureId,index:edges[1].index}:undefined,existing=sketchConstraints(features).find(c=>c.enabled!==false&&c.type===type&&(key(c.first)===key(first)&&(!second||key(c.second)===key(second))||second&&key(c.first)===key(second)&&key(c.second)===key(first)));if(existing)return features;return addSketchConstraint(features,type,first,second);
}
function resumeSketchConstraints(before,next){
 const previous=new Map(sketchConstraints(before).map(c=>[c.id,c])),fixed=sketchConstraints(next).filter(c=>c.type==='fixed'&&constraintIsEnabled(next,c)&&!constraintIsEnabled(before,previous.get(c.id)||c));
 const restored=next.map(f=>{const locked=fixed.filter(c=>c.first.featureId===f.id);if(!locked.length)return f;const world=constraintVertices(f).map(p=>worldPoint({...f,offset:planeCoordinates(f).offset},p));for(const c of locked)world[c.first.index]=new THREE.Vector3(...c.position);return writeVertices(f,world);});return solveSketchConstraints(restored);
}
export function setSketchConstraintsEnabled(features,enabled){
 if(typeof enabled!=='boolean')throw Error('拘束機能のON/OFFが不正です');references(features);return resumeSketchConstraints(features,features.map(f=>f.kind==='sketch'?{...f,sketchConstraintsEnabled:enabled}:f));
}
export function inheritSketchConstraintSwitch(next,before){
 if(!before.some(f=>f.kind==='sketch'))return next;const enabled=sketchConstraintsEnabled(before),previous=new Set(before.map(f=>f.id));return next.map(f=>f.kind==='sketch'&&(!previous.has(f.id)||!enabled&&f.sketchConstraintsEnabled===undefined)?{...f,sketchConstraintsEnabled:enabled}:f);
}
export function setSketchConstraintEnabled(features,ids,enabled){
 if(typeof enabled!=='boolean'||!Array.isArray(ids)||ids.some(id=>typeof id!=='string'))throw Error('拘束のON/OFFの指定が不正です');
 const {records}=references(features),targets=new Set(ids);if(ids.some(id=>!records.some(c=>c.id===id)))throw Error('切り替える拘束がありません');
 if(!records.some(c=>targets.has(c.id)&&(c.enabled!==false)!==enabled))return features;
 return resumeSketchConstraints(features,features.map(f=>f.sketchConstraints?.some(c=>targets.has(c.id))?{...f,sketchConstraints:f.sketchConstraints.map(c=>targets.has(c.id)?{...c,enabled}:c)}:f));
}
export function removeSketchConstraint(features,id){return features.map(f=>f.sketchConstraints?.some(c=>c.id===id)?{...f,sketchConstraints:f.sketchConstraints.filter(c=>c.id!==id)}:f);}
export function moveConstraintVertex(features,ref,uv,{relax=false}={}){
 const f=features.find(f=>f.id===ref.featureId),ps=constraintVertices(f);if(!ps?.[ref.index]||!uv.every(n=>Number.isFinite(n)&&Math.abs(n)<=10000))throw Error('端点の座標は−10000〜10000 mmで入力してください');if(lockedConstraintVertices(features).has(key(ref))&&Math.hypot(...uv.map((v,i)=>v-ps[ref.index][i]))>EPS)throw Error('位置固定された頂点は移動できません。位置固定を解除してください');const point=worldPoint({...f,offset:planeCoordinates(f).offset},uv),world=ps.map(p=>worldPoint({...f,offset:planeCoordinates(f).offset},p));world[ref.index]=point;const next=features.map(item=>item===f?writeVertices(f,world):item);try{return solveSketchConstraints(next,{before:features,pins:ps.map((_,index)=>({featureId:f.id,index}))});}catch(error){try{return solveSketchConstraints(next,{before:features,pins:[ref]});}catch(strictError){if(!relax)throw strictError;const projected=solveSketchConstraints(next,{before:features,freeDrivers:[ref]}),point=constraintVertices(projected.find(item=>item.id===ref.featureId))[ref.index];for(const candidate of [[point[0],uv[1]],[uv[0],point[1]]]){try{return moveConstraintVertex(features,ref,candidate);}catch{}}return projected;}}
}
export function lockedConstraintVertices(features){const records=sketchConstraints(features).filter(c=>constraintIsEnabled(features,c)),locked=new Set(records.filter(c=>c.type==='fixed').map(c=>key(c.first)));for(let i=0;i<=records.length;i++){let changed=false;for(const c of records.filter(c=>c.type==='coincident')){const a=key(c.first),b=key(c.second);if(locked.has(a)&&!locked.has(b)){locked.add(b);changed=true;}if(locked.has(b)&&!locked.has(a)){locked.add(a);changed=true;}}if(!changed)break;}return locked;}
export function earliestSketchChange(before,next){let first=next.length;for(const [i,f]of next.entries()){if(f.kind!=='sketch')continue;const old=before.find(p=>p.id===f.id);if(!old||JSON.stringify(sketchPoints(f))!==JSON.stringify(sketchPoints(old))||JSON.stringify([f.plane,f.frame,planeCoordinates(f).offset])!==JSON.stringify([old.plane,old.frame,planeCoordinates(old).offset]))first=Math.min(first,i);}return first;}
export function reconcileSketchConstraints(next,before,{topology=false}={}){
 const previous=new Map(before.map(f=>[f.id,f])),ids=new Set(next.map(f=>f.id)),changed=new Set(before.filter(f=>constraintVertices(f)&&(!ids.has(f.id)||topology&&constraintVertices(next.find(n=>n.id===f.id))?.length!==constraintVertices(f).length)).map(f=>f.id));
 return next.map(f=>{if(!f.sketchConstraints)return f;const constraints=f.sketchConstraints.filter(c=>{if(c.first?.featureId!==f.id&&!previous.has(f.id))return false;return !changed.has(c.first?.featureId)&&(!c.second||!changed.has(c.second.featureId));});return constraints.length===f.sketchConstraints.length?f:{...f,sketchConstraints:constraints};});
}
