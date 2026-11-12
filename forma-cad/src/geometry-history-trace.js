import {Box3,Line3,Matrix4,Vector3} from 'three';
import {moveMatrix} from './fillet-grid-reference.js';

function mirrorTransform(spec,plane){
 const p={...spec,...plane},direction=p.mirrorNormal??{XY:[0,0,1],XZ:[0,1,0],YZ:[1,0,0]}[p.plane];
 if(!direction||p.mirrorFace&&!plane)return null;
 const n=new Vector3(...direction).normalize(),origin=new Vector3(...(p.mirrorOrigin??[0,0,0])).addScaledVector(n,p.offset??0);
 const elements=[];
 for(let i=0;i<3;i++){
  for(let j=0;j<3;j++)elements.push(Number(i===j)-2*n.getComponent(i)*n.getComponent(j));
  elements.push(2*n.dot(origin)*n.getComponent(i));
 }
 return new Matrix4().set(...elements,0,0,0,1);
}

export function geometryHistoryLineage(features){
 const active=new Map();
 for(const [index,feature] of features.entries()){
  const result=feature.cadResult||(feature.kind==='cadop'?feature:null),spec=feature.spec;
  const outputs=result?.outputs??(feature.kind==='extrusion'?[{id:feature.operation==='new'?feature.id:feature.target}]:[]);
  const next=[];
  for(const [outputIndex,output] of outputs.entries()){
   const {id}=output;if(!id)continue;
   const sources=new Set([id]);
   const isUnion=spec?.type==='join'&&(!spec.combineMode||spec.combineMode==='結合');
   if(isUnion&&id===spec.target)for(const other of spec.others??[spec.other])sources.add(other);
   if(feature.kind==='extrusion'&&feature.operation==='join')for(const other of result?.remove??[])sources.add(other);
   if(spec?.type==='split')sources.add(spec.target);
   if(spec?.type==='move'&&(spec.copy||spec.moveMode==='複製して移動')){
    const targets=[...new Set(spec.targets??[spec.target])];sources.add(targets[outputIndex]);
   }
   const transform=spec?.type==='move'?moveMatrix({...spec,...result?.analysis?.contactMove?.transform}):null;
   let parents=[...sources].map(source=>active.get(source)).filter(Boolean).map(node=>({node,transform}));
   let uncertain=spec?.type==='revolve'&&!!spec.sourceBody||['rectangular','circular'].includes(spec?.type);
   if(spec?.type==='mirror'){
    const mirror=result.analysis?.mirrors?.find(row=>row.outputId===id),source=active.get(mirror?.bodyId??spec.target);
    const matrix=mirrorTransform(spec,result.analysis?.mirrorPlane);
    if(source&&matrix)parents=mirror?.action==='joined'?[{node:source,transform:null},{node:source,transform:matrix}]:[{node:source,transform:matrix}];
    else uncertain=true;
   }
   next.push({id,index,featureId:feature.id,output,parents,uncertain});
  }
  for(const id of result?.remove??[])active.delete(id);
  for(const node of next)active.set(node.id,node);
 }
 return active;
}

const boundsBox=bounds=>new Box3(new Vector3(...bounds[0]),new Vector3(...bounds[1]));
const boundsArray=box=>[box.min.toArray(),box.max.toArray()];
function transformFinding(finding,matrix){
 if(!matrix)return finding;
 const segments=[];
 for(let i=0;i<(finding.segments?.length??0);i+=3)segments.push(...new Vector3().fromArray(finding.segments,i).applyMatrix4(matrix).toArray());
 return {...finding,segments,...(finding.bounds?{bounds:boundsArray(boundsBox(finding.bounds).applyMatrix4(matrix))}:{})};
}
function sharedSegment(first,second,tolerance){
 const a=new Vector3(),b=new Vector3(),c=new Vector3(),d=new Vector3(),closest=new Vector3(),mid=new Vector3(),otherMid=new Vector3(),direction=new Vector3();
 const ab=new Line3(a,b),cd=new Line3(c,d);
 for(let i=0;i<first.length;i+=6){
  a.fromArray(first,i);b.fromArray(first,i+3);ab.getCenter(mid);ab.delta(direction).normalize();
  for(let j=0;j<second.length;j+=6){
   c.fromArray(second,j);d.fromArray(second,j+3);
   if(Math.abs(cd.delta(closest).normalize().dot(direction))<.97)continue;
   if(cd.closestPointToPoint(mid,true,closest).distanceTo(mid)<=tolerance)return true;
   cd.getCenter(otherMid);
   const distance=ab.closestPointToPoint(otherMid,true,closest).distanceTo(otherMid);
   if(distance<=tolerance)return true;
  }
 }
 return false;
}
function matches(a,b){
 if(a.code!==b.code||a.otherId!==b.otherId)return false;
 if(a.code==='disconnected')return a.count===b.count;
 if(Number.isFinite(a.size)&&Number.isFinite(b.size)&&Math.abs(a.size-b.size)>Math.max(.001,a.size*.15))return false;
 if(a.bounds&&b.bounds&&!boundsBox(a.bounds).expandByScalar(.03).intersectsBox(boundsBox(b.bounds)))return false;
 return !a.segments?.length||!b.segments?.length||sharedSegment(a.segments,b.segments,.01);
}

export function historyStlFindings(report){
 const untested=new Set(['inspection-limit','remesh-failed']);
 return {
  partial:!report.complete||report.issues.some(issue=>untested.has(issue.code)),
  findings:report.issues.filter(issue=>!untested.has(issue.code)).flatMap(issue=>{
   const segments=report.issueSegments?.[issue.code]??[];
   if(!segments.length)return issue;
   const locationPartial=issue.count>segments.length/6,endpointGroups=new Map(),groups=new Set();
   for(let i=0;i<segments.length;i+=6){
    const keys=[segments.slice(i,i+3).join(','),segments.slice(i+3,i+6).join(',')];
    const [first,second]=keys.map(key=>endpointGroups.get(key));
    const group=first||second||{keys:new Set(),segments:[]};
    if(first&&second&&first!==second){
     for(const key of second.keys){group.keys.add(key);endpointGroups.set(key,group);}
     group.segments.push(...second.segments);groups.delete(second);
    }
    for(const key of keys){group.keys.add(key);endpointGroups.set(key,group);}
    group.segments.push(...segments.slice(i,i+6));groups.add(group);
   }
   return [...groups].map(({segments})=>{
    const box=new Box3();
    for(let i=0;i<segments.length;i+=3)box.expandByPoint(new Vector3().fromArray(segments,i));
    return {...issue,count:segments.length/6,segments,bounds:boundsArray(box),locationPartial};
   });
  }),
 };
}

export function traceGeometryHistory(features,{target,codes},inspect,onProgress,{maxChecks=24,maxMs=14000}={}){
 const current=geometryHistoryLineage(features).get(target);
 if(!current)return {checked:0,partial:true,origins:[],missing:true};
 const cache=new Map(),traced=new WeakMap(),start=Date.now();let partial=false;
 function check(node){
  if(cache.has(node))return cache.get(node);
  if(cache.size>=maxChecks||Date.now()-start>maxMs){partial=true;return null;}
  const name=features[node.index].name||features[node.index].spec?.type||'工程';
  onProgress?.({stage:(node.index+1)+'工程目「'+name+'」を検査中',current:cache.size+1,total:maxChecks});
  let report;
  try{report=inspect(node);}catch{report={findings:[],partial:true};}
  cache.set(node,report);partial||=!!report.partial;return report;
 }
 function trace(node,finding){
  if(traced.has(finding))return traced.get(finding);
  const origin={index:node.index,featureId:node.featureId,bodyId:node.id,beforeIds:[...new Set(node.parents.map(parent=>parent.node.id))],finding,uncertain:!!finding.locationPartial||node.uncertain};
  const older=[];
  for(const {node:parent,transform} of node.parents){
   const report=check(parent);
   const previous=report?.findings.filter(value=>matches(finding,transformFinding(value,transform)))??[];
   if(!previous.length){
    origin.uncertain||=!report||report.partial||report.findings.some(value=>value.code===finding.code&&value.locationPartial);
    continue;
   }
   const prior=trace(parent,previous[0]);
   older.push({...prior,uncertain:prior.uncertain||previous.length>1});
  }
  const earliest=older.sort((a,b)=>a.index-b.index)[0];
  const result=earliest?{...earliest,uncertain:earliest.uncertain||origin.uncertain||older.some(row=>row.finding!==earliest.finding)}:origin;
  traced.set(finding,result);return result;
 }
 const findings=(check(current)?.findings??[]).filter(finding=>!codes?.length||codes.includes(finding.code));
 if(findings.length>12)partial=true;
 const origins=findings.slice(0,12).map(finding=>trace(current,finding)).sort((a,b)=>a.index-b.index);
 return {checked:cache.size,partial:partial||origins.some(row=>row.uncertain),origins};
}
