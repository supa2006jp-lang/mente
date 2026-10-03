import {svgCylinderInfo,wrapSvgSolid} from './svg-wrap.js';
import {allExtrusionTargets,multipleExtrusionTargets,extrusionTargetEntries,batchExtrusionFeature} from './extrusion-targets.js';
import {validateTaperAngle} from './taper.js';
import {draftExtrusion} from './extrusion-taper.js';
import {cutWithClearance} from './cut-clearance.js';
import {encloseParts} from './enclose.js';
import {patternSolids} from './pattern-solids.js';
import {fuseSolid} from './solid-fuse.js';
import {orthographicProjection} from './orthographic.js';
import {trimSurface,surfaceTrimTool} from './trim-surface.js';
import {trimInterior} from './trim-interior.js';
import {makePipe} from './pipe.js';
import {copiedThreadSource} from './thread-source.js';
import {throughDepth} from './extrusion-extent.js';
import {clipExtrusionAtSolids,contactSearchDistance} from './extrude-to-solid.js';
import {bodyRevolution} from './body-revolution.js';
import {replayHistory} from './history-replay.js';
import {templatePlacement,vertexBounds} from './template-placement.js';
import {cachedBody,rememberBody} from './body-cache.js';
import {makeCoilJoint,makeCoilTestPiece,coilJointInfo} from './coil-joint.js';
import {coilOnRim} from './coil-on-rim.js';
import {fuseThread} from './thread-fuse.js';
import {nominalMaleThread} from './nominal-male-thread.js';
import {threadSource,threadPullSpec,offsetThreadProfile,allThreadPullSpec} from './thread-pull.js';
import {shellBody,shellDecoratedBody} from './shell.js';
import {decoratedShellHistory} from './shell-decoration.js';
import {coaxialCircularLoftInfo,makeCoaxialCircularLoft} from './circular-loft.js';
import {pullFaces,selectedCadFaces} from './face-pull.js';
import * as THREE from 'three';
import * as R from 'replicad';
import {sketchPoints,planeCoordinates,thinShapes,regionFaceGeometry} from './regions.js';
import {basisFor,worldPoint} from './frames.js';
function threadHelix(pitch,length,radius,leftHand){
 const parts=[],edges=[];try{for(let z=0;z<length-1e-8;z+=pitch){const part=R.makeHelix(pitch,Math.min(pitch,length-z),radius,undefined,undefined,leftHand).translate([0,0,z]);parts.push(part);edges.push(...part.edges);}return R.assembleWire(edges);}finally{for(const edge of edges)edge.delete();for(const part of parts)part.delete();}
}
function regionWire(r,points,hole=false){let ring=points.length>2&&Math.hypot(points[0][0]-points.at(-1)[0],points[0][1]-points.at(-1)[1])<1e-7?points.slice(0,-1):points;const area=ps=>ps.reduce((sum,p,i)=>sum+p[0]*ps[(i+1)%ps.length][1]-ps[(i+1)%ps.length][0]*p[1],0);if(hole&&area(r.outer)*area(ring)>0)ring=[...ring].reverse();const edges=ring.map((p,i)=>R.makeLine(worldPoint(r,p).toArray(),worldPoint(r,ring[(i+1)%ring.length]).toArray()));try{return R.assembleWire(edges);}finally{for(const edge of edges)edge.delete();}}
export function profileSketch(r){const w=regionWire(r,r.outer),s=new R.Sketch(w,{defaultDirection:basisFor(r).n.toArray()});if(r.holes.length)s.baseFace=R.makeFace(w,r.holes.map(h=>regionWire(r,h,true)));return s;}
function circularLoftInfoForBody(features,target){
 let info=null;
 for(const feature of features){
  const output=(feature.cadResult?.outputs||feature.outputs)?.some(item=>item.id===target);
  if(!output)continue;
  if(feature.spec?.type==='loft')info=coaxialCircularLoftInfo(feature.spec.sections);
  else if(feature.spec?.type!=='join'||feature.spec.target!==target)info=null;
 }
 return info;
}
function extrudeProfile(r,depth){
 const outer=regionWire(r,r.outer),holes=r.holes.map(h=>regionWire(r,h,true));let face,vector;
 try{face=R.makeFace(outer,holes);vector=new R.Vector(basisFor(r).n.multiplyScalar(depth).toArray());return R.basicFaceExtrusion(face,vector);}finally{vector?.delete();face?.delete();outer.delete();for(const hole of holes)hole.delete();}
}
function extrudeCadFaceThin(face,region,depth,wall,side,skipHoleWalls=false){
 const outward=side==='outside'?wall:side==='center'?wall/2:0;
 const inward=side==='inside'?wall:side==='center'?wall/2:0;
 const resources=[],parts=[];
 const hold=shape=>(resources.push(shape),shape);
 const normal=basisFor(region).n.toArray();
 const planePosition=wire=>{
  const point=wire.startPoint;
  try{return point.toTuple().reduce((sum,value,i)=>sum+value*normal[i],0);}
  finally{point.delete();}
 };
 const offset=(wire,distance)=>{
  if(!distance)return wire;
  const sourcePlane=planePosition(wire);
  let shifted=wire.clone().offset2D(distance,'intersection');
  // OCCT can drop a wire's Location during offset (notably after a face fuse).
  // Keep the offset on the selected CAD face's plane before making a wall band.
  const correction=sourcePlane-planePosition(shifted);
  if(Math.abs(correction)>1e-7)shifted=shifted.translate(normal.map(value=>value*correction));
  return hold(shifted);
 };
 const faceArea=wire=>{const planar=R.makeFace(wire);try{return R.measureArea(planar);}finally{planar.delete();}};
 const addBand=(outer,inner)=>{
  const expected=Math.abs(faceArea(outer)-faceArea(inner));
  let band;
  for(const reversed of [false,true]){
   const hole=reversed?inner.flipOrientation():inner.clone();
   let candidate,check,accepted=false;
   try{
    candidate=R.makeFace(outer,[hole]);
    check=new (R.getOC().BRepCheck_Analyzer)(candidate.wrapped,true,false);
    const tolerance=Math.max(1e-5,expected*1e-5);
    if(check.IsValid()&&Math.abs(R.measureArea(candidate)-expected)<=tolerance){hold(hole);band=hold(candidate);accepted=true;}
   }finally{check?.delete();if(!accepted){candidate?.delete();hole.delete();}}
   if(band)break;
  }
  if(!band)throw Error('この壁厚では有効な薄い押し出しを作れません。壁厚を小さくしてください');
  const vector=hold(new R.Vector(normal.map(value=>value*depth)));
  parts.push(R.basicFaceExtrusion(band,vector));
 };
 try{
  const outer=hold(face.clone().outerWire());
  const holes=skipHoleWalls?[]:face.clone().innerWires().map(hold);
  addBand(offset(outer,outward),offset(outer,-inward));
  for(const hole of holes)addBand(offset(hole,-inward),offset(hole,outward));
  const tool=parts.length===1?parts[0].clone():R.makeCompound(parts).asShape3D();
  const check=new (R.getOC().BRepCheck_Analyzer)(tool.wrapped,true,false);
  try{if(!check.IsValid())throw Error('この壁厚では有効な薄い押し出しを作れません。壁厚を小さくしてください');}
  catch(error){tool.delete();throw error;}
  finally{check.delete();}
  return tool;
 }finally{for(const part of parts)part.delete();for(const shape of resources)shape.delete();face.delete();}
}
export function featureSolid(f,bodies){validateTaperAngle(f.taperAngle??0);return draftExtrusion(untaperedFeatureSolid({...f,taperAngle:0},bodies),f);}
function untaperedFeatureSolid(f,bodies){
 if(f.holesOnly){if(f.mode!=='solid'||f.profile!=='region'||!f.region?.holes?.length)throw Error('穴のある平面を選択してください');const input={...f,holesOnly:false},filled=featureSolid({...input,capHoles:true},bodies),original=featureSolid({...input,capHoles:false},bodies);let plug;try{plug=filled.cut(original);const sourceId=f.region.cadFace?.bodyId||f.region.bodyId,source=bodies?.get(sourceId);return source?plug.cut(source):plug.clone();}finally{plug?.delete();filled.delete();original.delete();}}

 if(f.operation==='cut'&&f.throughAll&&(multipleExtrusionTargets(f)?bodies?.size:bodies?.has(f.target))){
  const targets=extrusionTargetEntries(f,bodies).map(([,body])=>body);
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(const body of targets){const box=body.boundingBox;try{for(let i=0;i<3;i++){min[i]=Math.min(min[i],box.bounds[0][i]);max[i]=Math.max(max[i],box.bounds[1][i]);}}finally{box.delete();}}
  f={...f,depth:throughDepth(f,[min,max])};
 }
 const cap=f.capHoles&&f.mode==='solid';

 if(f.profile==='region'&&bodies&&(f.region.cadFace||f.region.bodyId)){
  const r=f.region,ref=r.cadFace||{bodyId:r.bodyId,normal:basisFor(r).n.toArray()},source=bodies.get(ref.bodyId);
  if(source){let point=ref.point;if(!point){const g=regionFaceGeometry(r),pos=g.attributes.position,ix=g.index,v=new THREE.Vector3();for(let i=0;i<3;i++)v.add(new THREE.Vector3().fromBufferAttribute(pos,ix?ix.getX(i):i));point=v.multiplyScalar(1/3).toArray();g.dispose();}
   const face=selectedCadFaces(source,[{...ref,point}])[0];if(face.geomType!=='PLANE')throw Error('押し出す平面を選択し直してください');
   if(f.mode==='thin')return extrudeCadFaceThin(face,r,f.depth,f.wall,f.side,f.skipHoleWalls);
   if(cap){const wire=face.outerWire(),filled=R.makeFace(wire);try{return R.basicFaceExtrusion(filled,new R.Vector(basisFor(r).n.multiplyScalar(f.depth).toArray()));}finally{filled.delete();wire.delete();}}
   return R.basicFaceExtrusion(face,new R.Vector(basisFor(r).n.multiplyScalar(f.depth).toArray()));
  }
  if(r.cadFace)throw Error('押し出し元の面が見つかりません。面を選択し直してください');
 }
if(cap&&f.region)f={...f,region:{...f.region,holes:[]}};
if(f.hole&&f.operation==='cut'){const n=basisFor(f).n,margin=.001,sign=Math.sign(f.depth);f={...f,x:f.x-n.x*sign*margin,y:f.y-n.y*sign*margin,z:f.z-n.z*sign*margin,depth:f.depth+sign*margin};}if(f.profile==='region'&&!f.region.holes.length){const pts=f.region.outer;if(pts.length>=32){const center=pts.reduce((s,p)=>[s[0]+p[0]/pts.length,s[1]+p[1]/pts.length],[0,0]),radius=Math.hypot(pts[0][0]-center[0],pts[0][1]-center[1]);if(radius>.1&&pts.every(p=>Math.abs(Math.hypot(p[0]-center[0],p[1]-center[1])-radius)<1e-4)){const p=worldPoint(f.region,center);return featureSolid({...f,profile:'circle',diameter:radius*2,x:p.x,y:p.y,z:p.z,frame:f.region.frame});}}}let r=f.region||{...f,...planeCoordinates(f),outer:sketchPoints(f),holes:[]};if(r.outer?.length>1&&Math.hypot(r.outer[0][0]-r.outer.at(-1)[0],r.outer[0][1]-r.outer.at(-1)[1])<1e-7)r={...r,outer:r.outer.slice(0,-1)};
 if(f.profile==='circle'){const b=basisFor(f),plane=new R.Plane([f.x,f.y,f.z],b.u.toArray(),b.n.toArray()),out=f.mode==='thin'?(f.side==='outside'?f.wall:f.side==='center'?f.wall/2:0):0;let shape=R.drawCircle(f.diameter/2+out).sketchOnPlane(plane).extrude(f.depth);if(f.mode==='thin'){const inn=f.side==='inside'?f.wall:f.side==='center'?f.wall/2:0;shape=shape.cut(R.drawCircle(f.diameter/2-inn).sketchOnPlane(plane).extrude(f.depth));}return shape;}
 if(f.profile==='line'){const a=f.angle*Math.PI/180,n=[-Math.sin(a),Math.cos(a)],left=f.side==='inside'?f.wall:f.side==='center'?f.wall/2:0,right=f.side==='outside'?f.wall:f.side==='center'?f.wall/2:0,[p,q]=r.outer;r={...r,outer:[[p[0]-n[0]*right,p[1]-n[1]*right],[q[0]-n[0]*right,q[1]-n[1]*right],[q[0]+n[0]*left,q[1]+n[1]*left],[p[0]+n[0]*left,p[1]+n[1]*left]]};return extrudeProfile(r,f.depth);}
 if(f.mode==='thin'){const shapes=thinShapes(f.skipHoleWalls?{...r,holes:[]}:r,f.wall,f.side).map(s=>{const ps=s.extractPoints();return extrudeProfile({...r,outer:ps.shape.map(p=>[p.x,p.y]),holes:ps.holes.map(h=>h.map(p=>[p.x,p.y]))},f.depth);});return R.makeCompound(shapes).asShape3D();}return extrudeProfile(r,f.depth);
}
function extrusionTool(f,bodies,contactInfo){
 let tool=featureSolid(f,bodies);
 if(!f.untilSolid)return tool;
 const sourceId=f.region?.cadFace?.bodyId||f.region?.bodyId;
 const blockers=(f.targetBodies?extrusionTargetEntries(f,bodies):[...bodies]).filter(([id])=>id!==sourceId&&(f.operation!=='cut'||id!==f.target)).map(([,shape])=>shape);
 const direction=basisFor(f.region||f).n.multiplyScalar(Math.sign(f.depth)).toArray();
 try{
  const searchDepth=contactSearchDistance(tool,blockers,direction);
  const searchTool=featureSolid({...f,depth:Math.sign(f.depth)*searchDepth},bodies);
  tool.delete();tool=searchTool;
  return clipExtrusionAtSolids(tool,blockers,direction,searchDepth,{maxDepth:Math.abs(f.depth),contactInfo,contactOnly:f.contactOnly===true});
 }finally{tool.delete();}
}
export function kernelBodies(features){const bodies=new Map(),tokens=new Map();const put=(id,entry)=>{bodies.get(id)?.delete();bodies.set(id,entry.shape);tokens.set(id,entry.token);};try{for(let f of features){if(f.cadResult)f={kind:'cadop',...f.cadResult};if(f.kind==='sketch'||f.kind==='plane'||f.kind==='referenceImage')continue;if(f.kind==='cadop'){for(const id of f.remove){bodies.get(id)?.delete();bodies.delete(id);tokens.delete(id);}for(const o of f.outputs){if(!o.brep)throw Error('このボディにはCAD形状データがありません');put(o.id,cachedBody('brep:'+o.brep,()=>R.deserializeShape(o.brep).asShape3D()));}continue;}const base=bodies.get(f.target);if(f.operation!=='new'&&!base)throw Error('対象ボディがありません');const key=JSON.stringify([f,f.untilSolid?[...tokens]:f.operation==='new'?(f.holesOnly?tokens.get(f.region?.cadFace?.bodyId||f.region?.bodyId):null):tokens.get(f.target)]);put(f.operation==='new'?f.id:f.target,cachedBody(key,()=>{const shape=extrusionTool(f,bodies);if(f.operation==='new')return shape;try{return f.operation==='cut'?base.cut(shape):base.fuse(shape);}finally{shape.delete();}}));}return bodies;}catch(e){for(const body of bodies.values())body.delete();throw e;}}
function regeneratedThread(source,spec){let result=runOperation(source.features,spec);for(const transform of source.transforms||[])result=runOperation([{kind:'cadop',...result}],transform);return result;}
function validateEnclosurePrintPose(features,spec){
 const {bodyId,lidId,hinge,axis,turnAngle}=spec;
 if(!bodyId||!lidId||!Array.isArray(hinge)||hinge.length!==3||hinge.some(value=>!Number.isFinite(value))||!Array.isArray(axis)||axis.length!==3||axis.some(value=>!Number.isFinite(value))||Math.abs(Math.hypot(...axis)-1)>1e-6||!Number.isFinite(turnAngle))throw Error('印刷姿勢のヒンジ軸を確認してください');
 const bodies=kernelBodies(features);let copy,turned,common;
 const assertSolid=(shape,label)=>{
  const check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);
  try{if(!check.IsValid())throw Error(label+'が正常なソリッドではありません。BOXを作り直してください');}finally{check.delete();}
  const solids=shape.solids;
  try{if(solids.length!==1||!(R.measureVolume(shape)>1e-6))throw Error(label+'が一つながりのソリッドではありません。BOXの形状を確認してください');}
  finally{for(const solid of solids)solid.delete();}
 };
 try{
  const body=bodies.get(bodyId),lid=bodies.get(lidId);
  if(!body||!lid)throw Error('印刷するBOX本体と蓋のCAD形状が見つかりません。BOX工程を作り直してください');
  assertSolid(body,'BOX本体');assertSolid(lid,'蓋');
  copy=lid.clone();turned=Math.abs(turnAngle)>1e-9?copy.rotate(turnAngle,hinge,axis):copy;
  assertSolid(turned,'90°に開いた蓋');
  common=body.intersect(turned);
  const overlap=Math.abs(R.measureVolume(common));
  if(!Number.isFinite(overlap))throw Error('印刷姿勢の干渉を判定できません。BOXの形状を確認してください');
  if(overlap>1e-5)throw Error('蓋を90°に開くとBOX本体と干渉します。ヒンジの辺・分割位置・すき間を調整してください');
  const clearance=R.measureDistanceBetween(body,turned);
  if(!Number.isFinite(clearance))throw Error('印刷姿勢のすき間を測定できません。BOXの形状を確認してください');
  if(clearance<.02)throw Error('蓋を90°に開くとBOX本体に接触します。ヒンジの辺・分割位置・すき間を調整してください');
  return {clearance,overlap};
 }finally{common?.delete();if(turned&&turned!==copy)turned.delete();copy?.delete();for(const body of bodies.values())body.delete();}
}
function jointSourceAxis(features,target){
 let axis=null;for(const f of features){if(f.id===target&&f.profile&&f.kind!=='sketch')axis=basisFor(f).n.clone();if(f.kind!=='cadop'||!f.outputs?.some(o=>o.id===target)||!axis)continue;const p=f.spec;if(p?.type==='move'&&p.target===target){if(p.rotation){for(let i=0;i<3;i++)axis.applyAxisAngle(new THREE.Vector3(...[[1,0,0],[0,1,0],[0,0,1]][i]),(p.rotation[i]||0)*Math.PI/180);}else axis.applyAxisAngle(new THREE.Vector3(...({X:[1,0,0],Y:[0,1,0],Z:[0,0,1]}[p.axis]||[0,0,1])),(p.angle||0)*Math.PI/180);}else axis=null;}return axis?.toArray();
}
export function runOperation(features,spec,onProgress,context={}){
 if(spec.type==='coilJointInfo'){const bodies=kernelBodies(features);try{return coilJointInfo(bodies.get(spec.target),spec,jointSourceAxis(features,spec.target));}finally{for(const body of bodies.values())body.delete();}}
 if(spec.type==='coilTestPiece'){const bodies=kernelBodies(features);let result;try{result=makeCoilTestPiece(bodies.get(spec.target),spec,onProgress,{preferredAxis:jointSourceAxis(features,spec.target)});return {outputs:result.parts.map((shape,i)=>({id:i?'coil-test-lid':'coil-test-body',...shape.mesh({tolerance:.08,angularTolerance:.15})})),analysis:result.analysis};}finally{result?.parts.forEach(shape=>shape.delete());for(const body of bodies.values())body.delete();}}
 if(spec.type==='enclosePrintValidate')return validateEnclosurePrintPose(features,spec);
 if(spec.type==='orthographic'){const bodies=kernelBodies(features);try{return orthographicProjection(bodies,spec.targets,spec.sections);}finally{for(const body of bodies.values())body.delete();}}
 if(spec.type==='svgWrapInfo'){const bodies=kernelBodies(features);try{return svgCylinderInfo(bodies.get(spec.target),spec.surfacePoint);}finally{for(const body of bodies.values())body.delete();}}
 if(spec.type==='extrusionToolPreview'){
  const bodies=kernelBodies(features),contactInfo={};let tool;
  try{tool=extrusionTool(spec.feature,bodies,contactInfo);const {previewParts,...extent}=contactInfo;return {...extent,outputs:previewParts?previewParts.map(part=>({id:spec.feature.id,...part})):[{id:spec.feature.id,...tool.mesh({tolerance:.08,angularTolerance:.15})}]};}
  finally{tool?.delete();for(const body of bodies.values())body.delete();}
 }
 if(spec.type==='preview'){
  const operation=spec.operation,result=runOperation(features,operation,onProgress,{coilPreview:operation.type==='coilJoint'});if(['coilJoint','coilTestPiece'].includes(operation.type))return {...result,removed:[]};const before=kernelBodies(features),removed=[];
  try{for(const o of result.outputs){const base=before.get(o.id);if(!base)continue;let tool,cut,after;
   try{
    if(operation.type==='extrusion'&&operation.feature.operation==='cut')tool=extrusionTool(operation.feature,before);
    else if(operation.type==='trimSurface')tool=surfaceTrimTool(base,before.get(operation.faces?.[0]?.bodyId),operation.faces?.[0],operation.trimSide);
    else if(operation.type==='pipe'&&operation.operation==='切り取り')tool=makePipe(operation.pathFeature||features.find(f=>f.id===operation.path),operation.diameter,operation.hollow==='中空'?operation.wall:0);
    if(tool)cut=base.intersect(tool);
    else{after=R.deserializeShape(o.brep).asShape3D();const delta=R.measureVolume(base)-R.measureVolume(after);if(delta<=Math.max(1e-7,R.measureVolume(base)*1e-9))continue;cut=base.cut(after);if(Math.abs(R.measureVolume(cut)-delta)>Math.max(.01,delta*.001))throw Error('削除部分のプレビューを作成できませんでした');}
    if(R.measureVolume(cut)>1e-7)removed.push({id:o.id,...cut.mesh({tolerance:.08,angularTolerance:.15})});
   }finally{after?.delete();cut?.delete();tool?.delete();}
  }for(const id of result.remove){const body=before.get(id);if(body)removed.push({id,...body.mesh({tolerance:.08,angularTolerance:.15})});}return {...result,removed};}finally{for(const b of before.values())b.delete();}
 }
 if(spec.type==='deleteBodies'){const bodies=kernelBodies(features);try{const ids=[...new Set(spec.targets||[])];if(!ids.length||ids.some(id=>!bodies.has(id)))throw Error('削除するボディを選択してください');return {outputs:[],remove:ids};}finally{for(const b of bodies.values())b.delete();}}
if(spec.type==='extrusionBatch'){const added=[];for(const original of spec.features){const f=batchExtrusionFeature(original,added),history=[...features,...added],input=multipleExtrusionTargets(f)||f.untilSolid?history:extrusionTargetHistory(history,f.target,f.region?.cadFace?.bodyId||f.region?.bodyId);const cadResult=runOperation(input,{type:'extrusion',target:f.target,feature:f});added.push({...f,cadResult});}return {features:added};}if(spec.type==='replay')return {features:replayHistory(spec.before,features,spec.start,(history,operation)=>runOperation(history,operation,onProgress),remapHistoryReferences)};const bodies=kernelBodies(features),outputs=[],remove=[];let analysis;const base=bodies.get(spec.target);const axis={X:[1,0,0],Y:[0,1,0],Z:[0,0,1]}[spec.axis]||[0,0,1];const emit=(id,shape)=>{if(!shape)throw Error('形状を作成できません');const mesh=shape.mesh({tolerance:.08,angularTolerance:.15});if(!mesh.triangles.length)throw Error('立体が空です');const brep=shape.serialize();rememberBody(brep,shape);outputs.push({id,...mesh,planarFaces:shape.faces.filter(f=>f.geomType==='PLANE').map(f=>f.hashCode),brep});};const p=spec;try{
 if(['coilJoint','enclose','shell','fillet','move','join','split','mirror','circular','rectangular'].includes(p.type)&&!base)throw Error('対象ボディを選択してください');
 if(p.type==='deleteFragment'){
  if(!base)throw Error('削除するソリッドを選択してください');
  const solids=base.solids,vertex=R.makeVertex(p.surfacePoint);let kept;
  try{
   const ranked=solids.map((solid,i)=>({i,d:R.measureDistanceBetween(vertex,solid)})).sort((a,b)=>a.d-b.d);
   if(!ranked.length||ranked[0].d>.2)throw Error('選択した破片が見つかりません。選択し直してください');
   if(ranked[1]&&Math.abs(ranked[1].d-ranked[0].d)<1e-7)throw Error('破片の境界ではなく面の内側を選択してください');
   const remaining=solids.filter((_,i)=>i!==ranked[0].i);
   if(remaining.length){kept=remaining.length===1?remaining[0].clone():R.makeCompound(remaining).asShape3D();emit(p.target,kept);}else remove.push(p.target);
  }finally{kept?.delete();vertex.delete();for(const solid of solids)solid.delete();}
 }
 else if(p.type==='extrusion'){
  if(p.feature.targetBodies&&(!p.feature.targetBodies.length||p.feature.targetBodies.some(id=>!bodies.has(id))))throw Error('加工する対象ボディを1個以上選択してください');
  if(p.feature.operation!=='new'&&!base&&!(multipleExtrusionTargets(p.feature)&&extrusionTargetEntries(p.feature,bodies).length))throw Error('切り取り・結合する対象ボディを選択してください');
  const tool=extrusionTool(p.feature,bodies);let shape;try{if(p.feature.operation==='new'){emit(p.feature.id,tool);const source=copiedThreadSource(features,p.feature);if(source)outputs.at(-1).threadSource=source;return {outputs,remove};}
   if(p.feature.operation==='cut'&&multipleExtrusionTargets(p.feature)){for(const [id,body] of extrusionTargetEntries(p.feature,bodies)){let cut;try{cut=body.cut(tool);const originalVolume=R.measureVolume(body),remainingVolume=R.measureVolume(cut);if(originalVolume-remainingVolume<=Math.max(1e-7,originalVolume*1e-9))continue;if(Math.abs(remainingVolume)<1e-9){remove.push(id);continue;}const check=new (R.getOC().BRepCheck_Analyzer)(cut.wrapped,true,false);try{if(!check.IsValid())throw Error('加工後の形状が不正です。距離や輪郭を変更してください');}finally{check.delete();}emit(id,cut);}finally{cut?.delete();}}if(!outputs.length&&!remove.length)throw Error('切り取り形状がボディと重なっていません。方向・距離・対象を確認してください');return {outputs,remove};}
   if(p.feature.operation==='join'&&multipleExtrusionTargets(p.feature)){
    const box=tool.boundingBox,contact=[];try{const bounds=box.bounds;for(const [id,body]of extrusionTargetEntries(p.feature,bodies)){const other=body.boundingBox;try{if(bounds[0].some((lo,i)=>lo>other.bounds[1][i]+1e-6||bounds[1][i]<other.bounds[0][i]-1e-6))continue;}finally{other.delete();}if(R.measureDistanceBetween(body,tool)<=1e-6)contact.push(id);}}finally{box.delete();}
    if(!contact.length)throw Error('押し出し形状が結合対象のボディと接していません。方向・距離を確認してください');
    const anchor=contact.includes(p.target)?p.target:contact[0];let joined=fuseSolid(bodies.get(anchor),tool);
    try{for(const id of contact)if(id!==anchor){const next=fuseSolid(joined,bodies.get(id));joined.delete();joined=next;}emit(anchor,joined);remove.push(...contact.filter(id=>id!==anchor));return {outputs,remove};}finally{joined.delete();}
   }
   if(p.feature.operation==='join'&&R.measureDistanceBetween(base,tool)>1e-6)throw Error('押し出し形状が結合対象のボディと接していません。方向・距離・対象を確認してください');
   shape=p.feature.operation==='cut'?base.cut(tool):fuseSolid(base,tool);if(p.feature.operation==='cut'&&Math.abs(R.measureVolume(shape))<1e-9){remove.push(p.target);return {outputs,remove};}if(p.feature.operation==='cut'&&Math.abs(R.measureVolume(base)-R.measureVolume(shape))<=Math.max(1e-7,R.measureVolume(base)*1e-9))throw Error('切り取り形状がボディと重なっていません。方向・距離・対象を確認してください');const check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);try{if(!check.IsValid())throw Error('加工後の形状が不正です。距離や輪郭を変更してください');}finally{check.delete();}emit(p.target,shape);}finally{shape?.delete();tool.delete();}
 }
 else if(p.type==='svgWrap'){if(!base)throw Error('対象ボディが見つかりません');const wrapped=wrapSvgSolid(base,p,onProgress);try{emit(p.target,wrapped.shape);analysis=wrapped.info;}finally{wrapped.shape.delete();}}
 else if(p.type==='trimSurface'){const selection=p.faces?.[0];const result=trimSurface(base,bodies.get(selection?.bodyId),selection,p.trimSide);try{emit(p.target,result);}finally{result.delete();}}
 else if(p.type==='trimInterior'){const selection=p.faces?.[0];const result=trimInterior(base,bodies.get(selection?.bodyId),selection);try{emit(p.target,result);}finally{result.delete();}}
 else if(p.type==='pipe'){
 const tool=makePipe(p.pathFeature||features.find(f=>f.id===p.path),p.diameter,p.hollow==='中空'?p.wall:0);let result;
 try{if(p.operation==='新規ボディ'){result=tool.clone();}else{if(!base)throw Error('対象ボディを選択してください');result=p.operation==='切り取り'?base.cut(tool):base.fuse(tool);}const check=new (R.getOC().BRepCheck_Analyzer)(result.wrapped,true,false);try{if(!check.IsValid())throw Error('この経路と太さではパイプを作成できません。外径を小さくしてください');}finally{check.delete();}emit(p.operation==='新規ボディ'?p.id:p.target,result);}finally{result?.delete();tool.delete();}
 }
 else if(p.type==='sphere'){
 if(!Number.isFinite(p.radius)||p.radius<=0||![p.x,p.y,p.z].every(Number.isFinite))throw Error('半径は0より大きい数値、中心位置は数値で指定してください');
 const shape=R.makeSphere(p.radius).translate([p.x,p.y,p.z]);try{emit(p.id,shape);}finally{shape.delete();}
 }
 else if(p.type==='templateExport'){

  if(!base)throw Error('保存するボディを選択してください');
  const vertices=base.mesh().vertices,lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(let i=0;i<vertices.length;i++) {const axis=i%3;lo[axis]=Math.min(lo[axis],vertices[i]);hi[axis]=Math.max(hi[axis],vertices[i]);}
  emit(p.id,base.clone().translate([-(lo[0]+hi[0])/2,-(lo[1]+hi[1])/2,-lo[2]]));
 }
 else if(p.type==='templateImport'){if(typeof p.brep!=='string'||!p.brep.length||p.brep.length>30000000)throw Error('部品テンプレートの形状データが不正です');const shape=R.deserializeShape(p.brep).asShape3D();try{if(!(R.measureVolume(shape)>1e-8))throw Error('立体の形状データではありません');const offset=templatePlacement(vertexBounds(shape.mesh().vertices),p.occupiedBounds||[]);const placed=shape.clone().translate(offset);try{emit(p.id,placed);}finally{placed.delete();}}finally{shape.delete();}}
 else if(p.type==='shell'){
  const sourceHistory=p.direction!=='外側'?decoratedShellHistory(features,p.target):null;
  let shape;
  if(sourceHistory){
   const sourceBodies=kernelBodies(sourceHistory);
   try{const source=sourceBodies.get(p.target),info=svgCylinderInfo(source,features[sourceHistory.length].spec.surfacePoint);shape=shellDecoratedBody(base,source,p,circularLoftInfoForBody(sourceHistory,p.target),info.radius);}
   finally{for(const body of sourceBodies.values())body.delete();}
  }else shape=shellBody(base,p,circularLoftInfoForBody(features,p.target));
  try{emit(p.target,shape);}finally{shape.delete();}
 }
 else if(p.type==='fillet'){const groups=p.edges?.length?[...new Set(p.edges.map(e=>e.bodyId))]:[p.target];for(const id of groups){const solid=bodies.get(id);if(!solid)throw Error('対象ボディを選択してください');let filter;const points=p.edges?.length?p.edges.filter(e=>e.bodyId===id).map(e=>e.point):p.edgePoint?[p.edgePoint]:[];if(points.length){const edges=points.map(coords=>{const point=new THREE.Vector3(...coords),candidates=solid.edges.map(edge=>{let distance=Infinity;for(let i=0;i<=128;i++)distance=Math.min(distance,new THREE.Vector3(...edge.pointAt(i/128).toTuple()).distanceTo(point));return {edge,distance};}).sort((a,b)=>a.distance-b.distance);if(!candidates.length||candidates[0].distance>1)throw Error('選択した辺を特定できません。辺の中央付近を選び直してください');return candidates[0].edge;});filter=e=>e.inList(edges);}else if(p.face){const b=basisFor(p.face),plane=new R.Plane(b.n.clone().multiplyScalar(p.face.offset).toArray(),b.u.toArray(),b.n.toArray());filter=e=>e.inPlane(plane);}if(!Number.isFinite(p.radius)||p.radius<=0)throw Error('半径は0より大きくしてください');try{emit(id,solid.fillet(p.radius,filter));}catch{throw Error('この半径ではフィレットを作成できません。半径を小さくするか、隣接する短い辺・薄い部分を確認してください');}}}
 else if(p.type==='copiedThread'){
 const source=p.copySource,adjusted=p.copyDistance?allThreadPullSpec(source.spec,-p.copyDistance):source.spec,result=regeneratedThread(source,adjusted),copyBodies=kernelBodies([{kind:'cadop',...result}]);let shape;
 try{shape=featureSolid(p.copyFeature,copyBodies);emit(p.target,shape);}finally{shape?.delete();for(const body of copyBodies.values())body.delete();}
 }
 else if(p.type==='pull'){
  if(!Number.isFinite(p.distance)||Math.abs(p.distance)<.001)throw Error('プル距離は0.001 mm以上の絶対値で指定してください');
  const selected=p.faces||[],ids=p.allThreadFaces?[p.target]:[...new Set(selected.map(f=>f.bodyId))];
  if(!ids.length)throw Error('プルする面を選択してください');
  for(const id of ids){
   const body=bodies.get(id),faces=selected.filter(f=>f.bodyId===id);if(!body)throw Error('選択ボディがありません');
   const source=threadSource(features,id);
   if(p.allThreadFaces&&!source)throw Error('編集可能なねじがあるボディを選択してください');
   const updated=source?(p.allThreadFaces?allThreadPullSpec(source.spec,p.distance):source.spec.type==='copiedThread'?null:threadPullSpec(kernelBodies(source.features).get(id),body,faces,source.spec,p.distance)):null;
   if(updated){const result=regeneratedThread(source,updated);for(const output of result.outputs)outputs.push({...output,threadSource:{...source,spec:updated}});}
   else emit(id,pullFaces(body,faces,p.distance));
  }
 }
 else if(p.type==='coilJoint'){const result=makeCoilJoint(base,p,onProgress,{preview:context.coilPreview===true,preferredAxis:jointSourceAxis(features,p.target)});analysis=result.analysis;try{onProgress?.({stage:'表示データを作成しています'});emit(p.target,result.parts[0]);emit(p.id+'-lid',result.parts[1]);}finally{result.parts.forEach(shape=>shape.delete());}}
 else if(p.type==='enclose'){if(p.faces?.some(f=>f.bodyId&&f.bodyId!==p.target))throw Error('同じ対象ボディの開口面を選択してください');const parts=encloseParts(base,p);analysis={...(parts.analysis||{boxExtra:0,effectiveClearance:p.clearance}),...(parts.hingeFrame?{hingeFrame:parts.hingeFrame}:{})};try{parts.forEach((shape,i)=>emit(i?p.id+'-part2':p.id,shape));}finally{parts.forEach(shape=>shape.delete());}}
 else if(p.type==='move'){let moved=base;if(p.rotation){for(let i=0;i<3;i++)if(p.rotation[i])moved=moved.rotate(p.rotation[i],p.pivot||[0,0,0],[[1,0,0],[0,1,0],[0,0,1]][i]);}else moved=moved.rotate(p.angle,[0,0,0],axis);emit(p.target,moved.translate([p.x,p.y,p.z]));const source=threadSource(features,p.target);if(source)outputs.at(-1).threadSource={...source,transforms:[...(source.transforms||[]),structuredClone(p)]};}
 else if(p.type==='join'){const ids=[...new Set(p.others||[p.other])];if(!ids.length||ids.some(id=>!bodies.has(id)||id===p.target))throw Error('別のボディを選択してください');let joined=base;try{if(p.combineMode==='交差'){let tool=bodies.get(ids[0]);for(const id of ids.slice(1))tool=tool.fuse(bodies.get(id));joined=base.intersect(tool);}else if(p.combineMode==='切り取り')joined=cutWithClearance(base,ids.map(id=>bodies.get(id)),p.cutClearance??0);else for(const id of ids)joined=fuseSolid(joined,bodies.get(id));if(Math.abs(R.measureVolume(joined))<1e-8)throw Error('結果が空です。対象ボディとツールの重なりを確認してください');const check=new (R.getOC().BRepCheck_Analyzer)(joined.wrapped,true,false);try{if(!check.IsValid())throw Error('正常なソリッドとして結合できませんでした。元のボディは変更していません');}finally{check.delete();}emit(p.target,joined);if(p.keepTools!=='保持')remove.push(...ids);}finally{if(joined!==base)joined.delete();}}
 else if(p.type==='split'){const b=p.splitFrame?basisFor({frame:p.splitFrame}):null;const plane=b?new R.Plane(b.n.clone().multiplyScalar(p.offset).toArray(),b.u.toArray(),b.n.toArray()):p.plane;const keep=p.keep??'both';if(!['both','positive','negative'].includes(keep))throw Error('残す側を選択してください');const parts=base.split(plane,b?0:p.offset);try{if(!parts.positive||!parts.negative)throw Error('指定平面がボディを横切っていません');const emitPart=(id,part)=>{const continuous=part.simplify();try{emit(id,continuous);}finally{continuous.delete();}};if(keep==='positive')emitPart(p.target,parts.positive);else{emitPart(p.target,parts.negative);if(keep==='both')emitPart(p.id,parts.positive);}}finally{parts.positive?.delete();parts.negative?.delete();}}
 else if(p.type==='mirror'){if(p.mirrorNormal){const n=new THREE.Vector3(...p.mirrorNormal).normalize(),origin=new THREE.Vector3(...p.mirrorOrigin).addScaledVector(n,p.offset||0),u=(Math.abs(n.x)<.9?new THREE.Vector3(1,0,0):new THREE.Vector3(0,1,0));u.addScaledVector(n,-u.dot(n)).normalize();emit(p.id,base.mirror(new R.Plane(origin.toArray(),u.toArray(),n.toArray())));}else emit(p.id,base.mirror(p.plane,[0,0,0]).translate(p.plane==='XY'?[0,0,2*p.offset]:p.plane==='XZ'?[0,2*p.offset,0]:[2*p.offset,0,0]));}
 else if(['circular','rectangular'].includes(p.type))patternSolids(base,p,axis,emit);
 else if(p.type==='revolve'&&p.sourceBody){
 const body=bodies.get(p.sourceBody);if(!body)throw Error('回転するボディを選択してください');
 if(!Number.isFinite(p.angle)||p.angle<=0||p.angle>360)throw Error('角度は0より大きく360度以下で指定してください');
 if(!p.origin?.every(Number.isFinite)||!p.axisVector?.every(Number.isFinite)||Math.hypot(...p.axisVector)<1e-8)throw Error('回転軸を選択してください');
 if(p.bodySweep){
  let sweep;try{sweep=bodyRevolution(body,p);}catch(e){if(/[\u3040-\u9fff]/.test(e.message||''))throw e;throw Error('この形状の回転範囲を結合できません。回転軸や角度を変更してください');}try{if(p.operation==='new')emit(p.id,sweep);else{if(!base)throw Error('対象ボディを選択してください');const shape=p.operation==='cut'?base.cut(sweep):base.fuse(sweep);try{if(p.operation==='cut'&&Math.abs(R.measureVolume(shape)-R.measureVolume(base))<1e-7)throw Error('回転範囲が対象ボディと重なっていません');emit(p.target,shape);}finally{shape.delete();}}}finally{sweep.delete();}return {outputs,remove};
 }
 if(!['new','move'].includes(p.operation))throw Error('ボディの回転方法を選択してください');
 const shape=body.clone().rotate(p.direction==='逆方向'?-p.angle:p.angle,p.origin,p.axisVector);try{emit(p.operation==='move'?p.sourceBody:p.id,shape);}finally{shape.delete();}
 }
 else if(p.type==='revolve'){

  if(!p.region||!p.origin||!p.axisVector)throw Error('領域と回転軸を選択してください');
  if(!Number.isFinite(p.angle)||p.angle<=0||p.angle>360)throw Error('角度は0より大きく360度以下で指定してください');
  let direction=new THREE.Vector3(...p.axisVector);if(direction.length()<1e-8)throw Error('回転軸が不正です');direction.normalize();
  const normal=basisFor(p.region).n,origin=new THREE.Vector3(...p.origin);
  if(Math.abs(direction.dot(normal))>1e-5||Math.abs(origin.dot(normal)-p.region.offset)>1e-4)throw Error('回転軸は領域と同じ平面内に指定してください');
  const side=normal.clone().cross(direction);let min=Infinity,max=-Infinity;for(const point of p.region.outer){const d=worldPoint(p.region,point).sub(origin).dot(side);min=Math.min(min,d);max=Math.max(max,d);}if(min< -1e-5&&max>1e-5)throw Error('軸が領域を横切っています。輪郭の端か外側に軸を指定してください');
  if(p.direction==='逆方向')direction.negate();
  let shape=profileSketch(p.region).revolve(direction.toArray(),{origin:p.origin,angle:p.angle});
  if(p.direction==='対称')shape=shape.rotate(-p.angle/2,p.origin,direction.toArray());
  if(p.operation==='new')emit(p.id,shape);
  else {if(!base)throw Error('対象ボディを選択してください');const result=p.operation==='cut'?base.cut(shape):base.fuse(shape);if(p.operation==='cut'&&Math.abs(R.measureVolume(base)-R.measureVolume(result))<1e-7)throw Error('回転形状が対象ボディと重なっていません');emit(p.target,result);}
 }
 else if(p.type==='loft'){if(!p.sections||p.sections.length<2)throw Error('断面を2つ以上選択してください');const circle=coaxialCircularLoftInfo(p.sections);emit(p.id,circle?makeCoaxialCircularLoft(circle):profileSketch(p.sections[0]).loftWith(p.sections.slice(1).map(profileSketch)));}
 else if(p.type==='thread'&&p.target){if(!base||!p.surfacePoint)throw Error('ねじにする円柱の側面を選択してください');const point=new THREE.Vector3(...p.surfacePoint);let selected=null;for(const face of base.faces){if(face.geomType!=='CYLINDRE')continue;const cyl=face.surface.wrapped.Cylinder(),loc=cyl.Location(),dir=cyl.Axis().Direction(),origin=new THREE.Vector3(loc.X(),loc.Y(),loc.Z()),normal=new THREE.Vector3(dir.X(),dir.Y(),dir.Z()),bounds=face.UVBounds,delta=point.clone().sub(origin),v=delta.dot(normal),radius=cyl.Radius(),radial=delta.addScaledVector(normal,-v);if(Math.abs(radial.length()-radius)<.3&&v>=bounds.vMin-.1&&v<=bounds.vMax+.1){selected={origin:origin.addScaledVector(normal,bounds.vMin),normal,radius,internal:new THREE.Vector3(...face.normalAt(point.toArray()).toTuple()).dot(radial)<0,height:bounds.vMax-bounds.vMin,fromTop:v>(bounds.vMin+bounds.vMax)/2};break;}}if(!selected)throw Error('選択位置に円柱の側面がありません');const metric=p.profile==='metric60',pitch=p.pitch,wire=metric?pitch*.875:p.wire;
 if(!Number.isFinite(pitch)||pitch<=0||(!metric&&pitch<=wire*1.05))throw Error('ピッチと断面寸法を確認してください');
 const offset=p.fullLength?0:Number(p.offset||0),length=p.fullLength?selected.height:(metric?p.length:pitch*p.turns);
 if(!Number.isFinite(length+offset)||length<=0||offset<0||length+offset>selected.height+.001)throw Error('ねじの長さとオフセットが円筒面の範囲を超えています');
 if(length/pitch>100)throw Error('ねじは100巻き以内になるように長さまたはピッチを調整してください');
 const nominal=metric&&p.threadVersion===2;
 if(nominal){const a=selected.normal.toArray(),dominant=a.reduce((best,v,i)=>Math.abs(v)>Math.abs(a[best])?i:best,0);if(a[dominant]<0){selected.origin.addScaledVector(selected.normal,selected.height);selected.normal.negate();selected.fromTop=!selected.fromTop;}}
 const start=selected.fromTop?selected.height-offset-length:offset;
 selected.origin.addScaledVector(selected.normal,start);
 const externalCut=nominal&&!selected.internal;
 if(externalCut){emit(p.target,nominalMaleThread(base,selected,p,length));outputs.at(-1).threadSource={features,spec:{...p,threadInternal:false}};return {outputs,remove};}
 const radius=selected.radius,path=threadHelix(pitch,length,radius,!!p.leftHand),sign=nominal?-1:selected.internal?-1:1;
 let points=metric?[[ -sign*pitch*.02,-pitch*.45],[sign*pitch*.541266,-pitch*.125],[sign*pitch*.541266,pitch*.125],[-sign*pitch*.02,pitch*.45]]:[[-sign*wire/2,-wire/2],[sign*wire/2,0],[-sign*wire/2,wire/2]];
 if(p.threadFaceOffsets){const offsets=[...p.threadFaceOffsets];if(selected.internal)offsets[3]=Math.max(offsets[3]||0,-(p.threadCylinderOffset||0));points=offsetThreadProfile(points,offsets);} let profile=R.draw(points[0]);for(const pt of points.slice(1))profile=profile.lineTo(pt);
 const section=profile.close().sketchOnPlane(new R.Plane([radius,0,0],[1,0,0],[0,-1,0])).wire;let ridge=R.genericSweep(section,path,{frenet:true});if(metric)ridge=ridge.intersect(R.makeCylinder(radius+pitch*2,length-.0002,[0,0,.0001]));const z=new THREE.Vector3(0,0,1),angle=z.angleTo(selected.normal)*180/Math.PI,axis=z.clone().cross(selected.normal);if(angle>1e-6)ridge=ridge.rotate(angle,[0,0,0],axis.length()<1e-6?[1,0,0]:axis.normalize().toArray());ridge=ridge.translate(selected.origin.toArray());let threadBase=base;const wallOffset=p.threadCylinderOffset||0;
 if(selected.internal&&wallOffset){const r=radius-wallOffset;if(r<=0)throw Error('調整距離が大きすぎます');const outer=R.makeCylinder(Math.max(radius,r),length,selected.origin.toArray(),selected.normal.toArray()),inner=R.makeCylinder(Math.min(radius,r),length,selected.origin.toArray(),selected.normal.toArray());let sleeve;try{sleeve=outer.cut(inner);threadBase=wallOffset<0?base.cut(sleeve):base.fuse(sleeve);}finally{sleeve?.delete();outer.delete();inner.delete();}}
 try{emit(p.target,fuseThread(threadBase,ridge));}finally{if(threadBase!==base)threadBase.delete();}if(nominal)outputs.at(-1).threadSource={features,spec:{...p,threadInternal:selected.internal}};}
 else if(p.type==='coil'&&p.rim){emit(p.target,coilOnRim(base,p));}
 else if(p.type==='coil'||p.type==='thread'){if(p.pitch<=p.wire*1.05)throw Error('ピッチを断面の太さより大きくしてください');const path=R.makeHelix(p.pitch,p.pitch*p.turns,p.radius);const section=p.type==='coil'?R.drawCircle(p.wire/2).sketchOnPlane(new R.Plane([p.radius,0,0],[1,0,0],[0,-1,0])).wire:R.draw([-p.wire/2,-p.wire/2]).lineTo([p.wire/2,0]).lineTo([-p.wire/2,p.wire/2]).close().sketchOnPlane(new R.Plane([p.radius,0,0],[1,0,0],[0,-1,0])).wire;let shape=R.genericSweep(section,path,{frenet:true});if(p.type==='thread')shape=shape.fuse(R.makeCylinder(p.radius-p.wire*.25,p.pitch*p.turns));emit(p.id,shape.translate([p.x,p.y,p.z]));}
 else throw Error('未対応の形状操作です');return {outputs,remove,...(analysis?{analysis}:{})};}finally{for(const body of bodies.values())body.delete();}}

function remapHistoryReferences(before,after,spec){
 const oldBodies=kernelBodies(before),newBodies=kernelBodies(after);
 try{
  const bounds=s=>vertexBounds(s.mesh().vertices);
  const point=(id,p)=>{const a=oldBodies.get(id),b=newBodies.get(id);if(!a||!b)throw Error('参照していたボディがありません');if(a.serialize()===b.serialize())return p;
   if(a.faces.length!==b.faces.length||a.edges.length!==b.edges.length)throw Error('面・辺の構成が変わりました。加工対象を選び直してください');
   const lo=bounds(a),hi=bounds(b);return p.map((v,i)=>hi.min[i]+(v-lo.min[i])*(hi.max[i]-hi.min[i])/Math.max(1e-9,lo.max[i]-lo.min[i]));};
  for(const key of ['faces','edges'])if(spec[key])spec[key]=spec[key].map(r=>({...r,point:point(r.bodyId||spec.target,r.point)}));
  if(spec.edgePoint)spec.edgePoint=point(spec.target,spec.edgePoint);
  if(spec.surfacePoint)spec.surfacePoint=point(spec.target,spec.surfacePoint);
  for(const r of [spec.face,...(spec.sections||[]),spec.region].filter(Boolean)){if(r.bodyId&&oldBodies.get(r.bodyId)?.serialize()!==newBodies.get(r.bodyId)?.serialize())throw Error('参照するソリッドの面が変わりました。面を選び直してください');if(!r.bodyId&&!r.sourceIds?.length&&[...oldBodies].some(([id,b])=>b.serialize()!==newBodies.get(id)?.serialize()))throw Error('この工程の古い面参照は自動更新できません。面を選び直してください');}
  if(spec.rim&&oldBodies.get(spec.target)?.serialize()!==newBodies.get(spec.target)?.serialize())throw Error('コイルの基準円周が変わりました。円周を選び直してください');
  return spec;
 }finally{for(const b of oldBodies.values())b.delete();for(const b of newBodies.values())b.delete();}
}

function extrusionTargetHistory(features,target,source){
if(source&&source!==target)return features;
 for(let i=features.length-1;i>=0;i--){const f=features[i],result=f.cadResult||(f.kind==='cadop'?f:null);if(result){if(result.remove.includes(target))return features;const o=result.outputs.find(o=>o.id===target);if(o)return [{kind:'cadop',id:target,outputs:[o],remove:[]}];}else if(f.kind==='extrusion'&&(f.id===target||f.target===target))return features;}
 return features;
}
