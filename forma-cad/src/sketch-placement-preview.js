import * as THREE from 'three';
import {applyDirectSketchConstraint,selectedConstraintEntities,sketchConstraints,constraintPlacementPoints,placementMidpointRefs,constraintVertices,constraintEdges} from './sketch-constraints.js';
import {basisFor,worldPoint} from './frames.js';
import {planeCoordinates} from './regions.js';
import {contactCurves} from './sketch-contact-curves.js';
import {placeConstraintLabel} from './sketch-constraints-overlay.js';

export function sketchPlacementGuides(features,selection,type='midpoint'){
 const entities=selectedConstraintEntities(features,selection);if(entities.length!==2)return null;
 const [first,second]=placementMidpointRefs(features,entities[0],entities[1],type);
 return {type,points:constraintPlacementPoints(features,{type,first,second}),labels:[first.whole?'① 図形の中心':'① 辺の中点',second.whole?'② 図形の中心':'② 線の中点']};
}
function placementGhosts(features,next){const sample=f=>contactCurves(f,{whole:true}).map(c=>Array.from({length:Math.max(1,Math.min(1024,c.steps*2))+1},(_,i)=>c.point(i/Math.max(1,Math.min(1024,c.steps*2)))));return next.filter(f=>f.kind==='sketch'&&JSON.stringify(f)!==JSON.stringify(features.find(g=>g.id===f.id))).flatMap(f=>{const paths=sample(f),old=features.find(g=>g.id===f.id);return old&&JSON.stringify(paths)===JSON.stringify(sample(old))?[]:paths;});}
export function previewSketchPlacement(features,selection,type,options={}){
 const entities=selectedConstraintEntities(features,selection);if(entities.length!==2||!['parallel','perpendicular','equal','contact','midpoint','center'].includes(type))return null;
 const next=applyDirectSketchConstraint(features,type,selection,options),ghosts=placementGhosts(features,next);
 if(['parallel','perpendicular','equal'].includes(type)){
  const edge=(list,ref)=>{const f=list.find(f=>f.id===ref.featureId),ps=constraintVertices(f);return constraintEdges(f)[ref.index].vertices.map(i=>worldPoint({...f,offset:planeCoordinates(f).offset},ps[i]));},before=entities.map(ref=>edge(features,ref)),after=entities.map(ref=>edge(next,ref)),middle=ps=>ps[0].clone().add(ps[1]).multiplyScalar(.5),source=middle(before[1]),target=middle(after[1]),old=before[1][1].clone().sub(before[1][0]),updated=after[1][1].clone().sub(after[1][0]),normal=basisFor(features.find(f=>f.id===entities[0].featureId)).n,angle=Math.atan2(new THREE.Vector3().crossVectors(old,updated).dot(normal),old.dot(updated))*180/Math.PI,number=n=>Number(n.toFixed(3)),summary=type==='equal'?'②の長さ '+number(old.length())+' → '+number(updated.length())+' mm':'②を回転 '+number(angle)+'°'+(options.attachToReference?'・①へ接続':''),movements=before[1].map((from,i)=>({from,to:after[1][i]})).filter(p=>p.from.distanceTo(p.to)>1e-7);
  return {type,mode:'edit',points:[middle(before[0]),source],labels:['① 基準の辺','② 変更する辺'],source,target,summary,distance:source.distanceTo(target),ghosts,movements,edgeBefore:before[1],edgeAfter:after[1]};
 }
 const refs=type==='contact'?entities:placementMidpointRefs(features,entities[0],entities[1],type),same=(a,b)=>a?.featureId===b?.featureId&&a?.index===b?.index&&!!a?.whole===!!b?.whole,records=sketchConstraints(next).filter(c=>c.enabled!==false&&c.type===type),record=records.find(c=>same(c.first,refs[0])&&same(c.second,refs[1]))||records.find(c=>same(c.first,refs[1])&&same(c.second,refs[0]));
 if(!record)throw Error('移動先を取得できません');
 const points=constraintPlacementPoints(features,record),after=constraintPlacementPoints(next,record),reverse=!same(record.first,refs[0]);if(reverse){points.reverse();after.reverse();}
 const source=points[1],target=after[1],labels=type==='contact'?['① 接触位置','② 接触させる位置']:sketchPlacementGuides(features,selection,type).labels;
 return {type,points,labels,source,target,distance:source.distanceTo(target),ghosts};
}

// Screen-only overlay: it never enters the model, history, exports or hit testing.
export function createSketchPlacementOverlay({camera,canvas,getObstacle}){
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.id='sketch-placement-preview';svg.style.cssText='position:fixed;z-index:105;pointer-events:none;overflow:hidden';svg.setAttribute('aria-hidden','true');document.body.append(svg);let content='';
 const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
 function hide(){const markers=document.getElementById('sketch-constraint-markers');if(markers)delete markers.dataset.placementGuides;svg.style.display='none';svg.removeAttribute('data-preview-type');content='';svg.replaceChildren();}
 function draw(data){if(!data){hide();return;}const r=canvas.getBoundingClientRect();if(!r.width||!r.height){hide();return;}svg.style.display='block';svg.style.left=r.left+'px';svg.style.top=r.top+'px';svg.setAttribute('width',r.width);svg.setAttribute('height',r.height);svg.setAttribute('viewBox',`0 0 ${r.width} ${r.height}`);const markers=document.getElementById('sketch-constraint-markers');if(markers)markers.dataset.placementGuides='true';svg.dataset.previewType=data.type;svg.dataset.distance=data.distance??'';
  const project=p=>{const q=p.clone().project(camera);return {x:(q.x+1)*r.width/2,y:(1-q.y)*r.height/2,visible:q.z>=-1&&q.z<=1};},path=ps=>ps.map((p,i)=>{const q=project(p);return (i?'L':'M')+q.x.toFixed(2)+' '+q.y.toFixed(2);}).join(' '),obstacles=[],bar=getObstacle?.();if(bar&&bar.width)obstacles.push({x:bar.x-r.left-5,y:bar.y-r.top-5,width:bar.width+10,height:bar.height+10});
  let markup='<defs><marker id="sketch-placement-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8" fill="#07846b"/></marker></defs>';
  for(const ps of data.ghosts||[])markup+='<path data-placement-ghost="true" d="'+path(ps)+'" fill="none" stroke="#079b9b" stroke-opacity=".55" stroke-width="4" stroke-dasharray="6 4"/>';
  const ps=data.points.map(project);for(const p of ps)obstacles.push({x:p.x-10,y:p.y-10,width:20,height:20});
  for(const movement of data.movements||(data.target?[{from:data.source,to:data.target}]:[])){const from=project(movement.from),to=project(movement.to);if(from.visible&&to.visible){if(movement.from.distanceTo(movement.to)>1e-7)markup+='<path data-placement-movement="true" d="M'+from.x+' '+from.y+' L'+to.x+' '+to.y+'" stroke="#07846b" stroke-width="2" stroke-dasharray="5 4" marker-end="url(#sketch-placement-arrow)"/>';markup+='<circle data-placement-target="true" cx="'+to.x+'" cy="'+to.y+'" r="'+(data.mode==='edit'?5:9)+'" fill="#d6fff0" fill-opacity=".6" stroke="#07846b" stroke-width="2"/>';obstacles.push({x:to.x-12,y:to.y-12,width:24,height:24});}}
  const label=(p,text,color)=>{const width=Math.min(r.width-16,text.length*12+16),height=24,box=placeConstraintLabel(p,width,height,{x:8,y:8,width:Math.max(1,r.width-16),height:Math.max(1,r.height-16)},obstacles);obstacles.push(box);return '<path d="M'+p.x+' '+p.y+' L'+(box.x+width/2)+' '+(box.y+height/2)+'" stroke="'+color+'" stroke-dasharray="3 3"/><g><rect x="'+box.x+'" y="'+box.y+'" width="'+width+'" height="24" rx="5" fill="#fffffff2" stroke="'+color+'"/><text x="'+(box.x+8)+'" y="'+(box.y+16)+'" fill="'+color+'" font-size="12" font-family="sans-serif">'+escape(text)+'</text></g>';};
  ps.forEach((p,i)=>{if(!p.visible)return;const color=i?'#b97000':'#2161ba';markup+='<circle data-placement-point="'+(i+1)+'" cx="'+p.x+'" cy="'+p.y+'" r="5" fill="'+color+'" stroke="white" stroke-width="2"/>'+label(p,data.labels[i],color);});
  if(data.target){const p=project(data.target);if(p.visible)markup+=label(p,data.summary||'②全体を移動 '+Number(data.distance.toFixed(3))+' mm','#07846b');}
  if(markup!==content){svg.innerHTML=markup;content=markup;}
 }
 return {draw,hide,element:svg};
}
