import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {addFormPoint,formCurves,formGeometryRings,formMirrorPoint,formPointCount,formSectionLimit,interpolateFormRing,moveFormPoint,newFormProfile,removeFormPoint,setFormCorner,setFormSymmetry,setFormSymmetryPlane,validateFormProfile} from '../src/form-profile.js';
import {formGuideFromSketch} from '../src/form-guides.js';
import {formDragGeometry} from '../src/form-drag-preview.js';
import {formWallCandidates} from '../src/form-wall.js';
import {symmetryFromFace,symmetryFromSketch} from '../src/form-symmetry.js';
import {formBasis} from '../src/form-orientation.js';
import {formSectionBounds,resizeFormSection,smoothFormPoint} from '../src/form-refinement.js';
import {formCurvatureChanges} from '../src/form-curvature.js';
import {addFormSeam,findFormSeam} from '../src/form-seam.js';
import {importFormRings} from '../src/form-source.js';
import {runOperation} from '../src/kernel.js';
import {decodeProjectDocument,encodeProjectDocument} from '../src/project-codec.js';
import {defaults,validateProject} from '../src/geometry.js';
import {findRegions} from '../src/regions.js';

R.setOC(await init({wasmBinary:await fs.readFile(new URL('../node_modules/replicad-opencascadejs/dist/replicad_single.wasm',import.meta.url))}));
const form=newFormProfile();
form.rings[0].locked=true;
const rim=structuredClone(form.rings[0]);
assert.equal(moveFormPoint(form,0,0,28,3),false);
setFormSymmetry(form,false);
setFormSymmetry(form,true);
assert.deepEqual(form.rings[0],rim);
assert(moveFormPoint(form,1,0,27,2));
assert.deepEqual(form.rings[1].points[4],[-27,2]);

const crossed=structuredClone(form);
crossed.symmetric=false;
moveFormPoint(crossed,1,0,-31,6);
assert.throws(()=>validateFormProfile(crossed),error=>error.diagnostics.formSections.includes(1)&&error.diagnostics.formPoints.length>0);
assert(runOperation([],{type:'formPreview',form}).triangles.length>0);
const sizing=newFormProfile(),axes=formBasis();
setFormSymmetryPlane(sizing,{u:7});
const sectionBounds=formSectionBounds(sizing.rings[1],axes);
for(const [anchor,edge] of [['bottom','min'],['top','max']]){
 const resized=resizeFormSection(sizing,1,[42,28],anchor,axes);
 const next=formSectionBounds(resized.rings[1],axes);
 assert(next.size.every((value,i)=>Math.abs(value-[42,28][i])<1e-6));
 assert(Math.abs(next[edge][1]-sectionBounds[edge][1])<1e-6);
 assert(Math.abs((next.min[0]+next.max[0])/2-7)<1e-6);
 assert.deepEqual(resized.rings[0],sizing.rings[0]);
}
assert.equal(resizeFormSection(form,0,[10,10],'bottom',axes),null);
moveFormPoint(sizing,1,0,38,1,{strength:0});
const smoothed=smoothFormPoint(sizing,1,0,.5);
assert(smoothed.rings[1].points[0][0]<38);
assert.equal(smoothed.rings[1].points[0][0]+smoothed.rings[1].points[4][0],14);
assert.deepEqual(smoothed.rings[1].points[1],sizing.rings[1].points[1]);
setFormCorner(sizing,1,0,true);
assert.equal(smoothFormPoint(sizing,1,0,.5),null);
assert.equal(smoothFormPoint(form,0,0,.5),null);
const curveField=formCurvatureChanges(runOperation([],{type:'formPreview',form}));
assert(curveField.length>0&&curveField.every(Number.isFinite)&&curveField.some(value=>value>.08));
assert.deepEqual([...formCurvatureChanges({
 vertices:[0,0,0,1,0,0,1,1,0,0,1,0],triangles:[0,1,2,0,2,3],normals:[0,0,1,0,0,1,0,0,1,0,0,1]
})],[0,0,0,0]);
const operation=(history,spec)=>({kind:'cadop',id:spec.id,name:spec.type,spec,...runOperation(history,spec)});
const shell=operation([],{type:'form',id:'outer',form});
assert.equal(shell.outputs[0].shapeMetrics.solids,1);
const sphere=operation([shell],{type:'sphere',id:'cutter',radius:5,x:0,y:0,z:34});
const clearance=(feature)=>runOperation([feature],{type:'formClearance',target:feature.id,form});
const interference=clearance(sphere);
assert.equal(interference.row.status,'interference');
assert(interference.row.volume>0&&interference.highlight.triangles.length>0);
const inside=clearance(operation([],{type:'sphere',id:'inside',radius:2,x:0,y:0,z:12}));
assert.equal(inside.row.status,'interference');
for(const [height,status,distance] of [[39,'contact',0],[39.2,'gap',.2]]){
 const reading=clearance(operation([],{type:'sphere',id:'above',radius:5,x:0,y:0,z:height}));
 assert.equal(reading.row.status,status);
 assert(Math.abs(reading.row.distance-distance)<1e-5&&reading.row.points.length===2);
}
const cut=operation([shell,sphere],{type:'join',id:'cut',target:'outer',other:'cutter',combineMode:'切り取り',keepTools:'削除'});
assert(cut.outputs[0].shapeMetrics.volume<shell.outputs[0].shapeMetrics.volume);
const project={format:'forma-cad',version:1,features:[shell,sphere,cut]};
const loaded=(await decodeProjectDocument((await encodeProjectDocument(project,{compress:true})).text)).document;
validateProject(loaded);
const edited=structuredClone(loaded.features);
moveFormPoint(edited[0].spec.form,1,0,29,2);
const replay=runOperation(edited,{type:'replay',before:loaded.features,start:0}).features;
assert.deepEqual(replay[0].spec.form.rings[0],rim);
assert.equal(replay[2].outputs[0].shapeMetrics.solids,1);
assert(replay[2].outputs[0].shapeMetrics.volume>cut.outputs[0].shapeMetrics.volume);

const soft=newFormProfile(),beforeSoft=structuredClone(soft.rings);
soft.rings[0].locked=true;
soft.soft=70;
moveFormPoint(soft,1,0,28,2,{from:beforeSoft});
assert.deepEqual(soft.rings[0].points,beforeSoft[0].points);
assert.notDeepEqual(soft.rings[1].points[1],beforeSoft[1].points[1]);
assert.notDeepEqual(soft.rings[2].points[0],beforeSoft[2].points[0]);
assert.deepEqual(soft.rings[2].points[4],[-soft.rings[2].points[0][0],soft.rings[2].points[0][1]]);
moveFormPoint(soft,1,0,...beforeSoft[1].points[0],{from:beforeSoft});
assert.deepEqual(soft.rings.map(ring=>ring.points),beforeSoft.map(ring=>ring.points));

const importRings=sections=>importFormRings(sections,formPointCount,formSectionLimit);
const profiles=[
 {...defaults,id:'base-circle',name:'Base',kind:'sketch',profile:'circle',diameter:40,z:0},
 {...defaults,id:'top-circle',name:'Top',kind:'sketch',profile:'circle',diameter:32,z:26}
];
const sections=findRegions(profiles),fixed=importRings(sections);
assert.throws(()=>importRings([sections[0],sections[0]]),/高さが異なる/);
assert.throws(()=>importRings([sections[0],{...sections[1],holes:[sections[1].outer]}]),/穴のない/);
const loft=operation(profiles,{type:'loft',id:'loft',sections});
const middle=interpolateFormRing(...fixed);
const fromLoft={version:1,symmetric:false,soft:70,rings:[fixed[0],middle,fixed[1]]};
const fixedBefore=structuredClone(fixed);
moveFormPoint(fromLoft,1,0,middle.points[0][0]+2,middle.points[0][1]);
assert.deepEqual([fromLoft.rings[0],fromLoft.rings[2]],fixedBefore);
const converted=operation(profiles,{type:'form',id:loft.id,form:fromLoft});
assert.equal(converted.outputs[0].id,loft.outputs[0].id);
assert.equal(converted.outputs[0].shapeMetrics.solids,1);
const loftCutter=operation([...profiles,loft],{type:'sphere',id:'loft-cutter',radius:5,x:0,y:0,z:26});
const loftCut=operation([...profiles,loft,loftCutter],
 {type:'join',id:'loft-cut',target:loft.id,other:loftCutter.id,combineMode:'切り取り',keepTools:'削除'});
const loftHistory=[...profiles,loft,loftCutter,loftCut];
const updated=runOperation([...profiles,converted,loftCutter,loftCut],{type:'replay',before:loftHistory,start:3}).features;
assert.equal(updated.at(-1).outputs[0].shapeMetrics.solids,1);
assert(updated.at(-1).outputs[0].shapeMetrics.volume<converted.outputs[0].shapeMetrics.volume);
const body=R.deserializeShape(converted.outputs[0].brep).asShape3D();
try{
 const faces=body.faces;
 try{
  const caps=faces.filter(face=>face.geomType==='PLANE').map(face=>R.measureArea(face)).sort((a,b)=>a-b);
  assert.equal(caps.length,2);
  assert(Math.abs(caps[0]-Math.PI*16**2)<.001);
  assert(Math.abs(caps[1]-Math.PI*20**2)<.001);
 }finally{faces.forEach(face=>face.delete());}
}finally{body.delete();}
const rectangle={...profiles[1],profile:'rect',width:30,height:24};
const mixed=importRings(findRegions([profiles[0],rectangle]));
assert(runOperation([],{type:'formPreview',form:{version:1,symmetric:false,rings:[mixed[0],interpolateFormRing(...mixed),mixed[1]]}}).triangles.length>0);
const importedProject={format:'forma-cad',version:1,features:[...profiles,converted]};
const reopened=(await decodeProjectDocument((await encodeProjectDocument(importedProject,{compress:true})).text)).document;
validateProject(reopened);
assert.deepEqual(reopened.features.at(-1).spec.form.rings[0].reference.outer,fixedBefore[0].reference.outer);

const sculpted=newFormProfile();
const untouched=structuredClone(sculpted.rings[0]);
const added=addFormPoint(sculpted,1,0);
assert.equal(sculpted.rings[1].points.length,10);
assert.deepEqual(sculpted.rings[0],untouched);
moveFormPoint(sculpted,1,added,26,7);
assert.deepEqual(sculpted.rings[1].points[formMirrorPoint(sculpted.rings[1],added)],[-26,7]);
setFormCorner(sculpted,1,added,true);
const curves=formCurves(sculpted.rings[1]);
const incoming=curves[added-1],outgoing=curves[added];
const u=incoming.end.map((v,i)=>v-incoming.b[i]),v=outgoing.a.map((v,i)=>v-outgoing.start[i]);
assert(Math.abs(u[0]*v[1]-u[1]*v[0])>.01);
assert.equal(operation([],{type:'form',id:'sculpted',form:sculpted}).outputs[0].shapeMetrics.solids,1);
assert.equal(removeFormPoint(sculpted,1,added),0);
assert.equal(sculpted.rings[1].points.length,8);
assert.deepEqual(sculpted.rings[1].corners,[]);

const guideSketch={...defaults,id:'roof-guide',kind:'sketch',name:'ルーフライン',profile:'polyline',
 plane:'XZ',points:[[21,0],[25,-12],[27,-18],[22,-24],[15,-34]]};
const guide={...formGuideFromSketch(guideSketch),name:guideSketch.name,knot:0};
assert.equal(guide.axis,0);
assert(guide.points.some(([z,x])=>z===18&&x===27));
assert.equal(formGuideFromSketch({...guideSketch,points:[[0,0],[1,-10],[2,-4]]}),null);
const guided=newFormProfile();
guided.guides=[guide];
guided.rings[0].locked=true;
assert.deepEqual(formGeometryRings(guided).find(ring=>ring.z===18).points[0],[27,0]);
assert.deepEqual(formGeometryRings(guided).find(ring=>ring.z===18).points[4],[-27,0]);
assert.throws(()=>validateFormProfile({...guided,guides:[{...guide,points:[[0,30],[34,15]]}]}),/固定断面/);
assert.throws(()=>validateFormProfile({...guided,guides:[{...guide,points:[[1,21],[34,15]]}]}),/一番下/);
const guidedBody=operation([],{type:'form',id:'guided',form:guided});
assert.equal(guidedBody.outputs[0].shapeMetrics.solids,1);
const guidedRims={version:1,symmetric:false,rings:structuredClone(fixed),
 guides:[{...guide,points:[[0,fixed[0].points[0][0]],[13,21],[26,fixed[1].points[0][0]]]}]};
assert.equal(operation([],{type:'form',id:'guided-fixed-rims',form:guidedRims}).outputs[0].shapeMetrics.solids,1);
const result=R.deserializeShape(guidedBody.outputs[0].brep).asShape3D();
try{
 const mesh=result.mesh({tolerance:.02,angularTolerance:.08});
 const nearBend=[];
 for(let i=0;i<mesh.vertices.length;i+=3)if(Math.abs(mesh.vertices[i+2]-18)<.5)nearBend.push(mesh.vertices[i]);
 assert(nearBend.length&&Math.max(...nearBend)>26.7,'guide bend must appear on the exported solid');
}finally{result.delete();}
const tilted=newFormProfile();
tilted.orientation={plane:'XZ',tiltU:22,tiltV:-15};
const tiltedBody=operation([],{type:'form',id:'tilted',form:tilted});
assert.equal(tiltedBody.outputs[0].shapeMetrics.solids,1);
const tiltedMesh=runOperation([],{type:'formPreview',form:tilted}),direction=formBasis(tilted.orientation).n;
const distances=[];
for(let i=0;i<tiltedMesh.vertices.length;i+=3){
 const [x,y,z]=tiltedMesh.vertices.slice(i,i+3);distances.push(x*direction.x+y*direction.y+z*direction.z);
}
assert(Math.abs(Math.min(...distances))<1e-5&&Math.abs(Math.max(...distances)-34)<1e-5);

const joined=newFormProfile();
joined.symmetric=false;
const angle=.2,c=Math.cos(angle),s=Math.sin(angle),edge=-19*s;
const targetFace={plane:'CUSTOM',offset:19*c,frame:{u:[0,1,0],v:[-s,0,c],n:[c,0,s]},
 outer:[[-20,edge-8],[20,edge-8],[20,edge],[-20,edge]]};
joined.seam=findFormSeam(targetFace,formBasis(),joined.rings[0],[0,1,2,3,4,5,6,7],0,'start','台座');
const tangentBody=operation([],{type:'form',id:'tangent',form:joined});
assert.equal(tangentBody.outputs[0].shapeMetrics.solids,1);
const tangentShape=R.deserializeShape(tangentBody.outputs[0].brep).asShape3D();
const seamMid=[19,(joined.seam.a[1]+joined.seam.b[1])/2,0],seamPoint=R.makeVertex(seamMid),tangentFaces=tangentShape.faces;
try{
 const patch=tangentFaces.find(face=>face.geomType!=='PLANE'&&R.measureDistanceBetween(face,seamPoint)<1e-6);
 assert(patch,'the tangent face must touch the selected body edge');
 const normal=patch.normalAt(seamMid);
 try{
  const [x,,z]=normal.toTuple();
  assert(Math.abs(c*x+s*z)>1-1e-6,'the tangent face normal must align with the selected plane');
 }
 finally{normal.delete();}
}finally{tangentFaces.forEach(face=>face.delete());seamPoint.delete();tangentShape.delete();}
const settingsDocument={format:'forma-cad',version:1,features:[tiltedBody,tangentBody]};
const settingsRoundTrip=(await decodeProjectDocument((await encodeProjectDocument(settingsDocument,{compress:true})).text)).document;
validateProject(settingsRoundTrip);
assert.deepEqual(settingsRoundTrip.features[0].spec.form.orientation,tilted.orientation);
assert.deepEqual(settingsRoundTrip.features[1].spec.form.seam,joined.seam);
const secondFace={plane:'CUSTOM',offset:14,frame:{u:[-1,0,0],v:[0,0,1],n:[0,1,0]},
 outer:[[-20,-8],[20,-8],[20,0],[-20,0]]};
const secondSeam=findFormSeam(secondFace,formBasis(),joined.rings[0],[0,1,2,3,4,5,6,7],1,'start','側面');
const multi=structuredClone(joined);
multi.seams=addFormSeam(multi,secondSeam);delete multi.seam;
assert.deepEqual(multi.seams[0].b,multi.seams[1].a);
assert(Math.abs(multi.seams[0].b[0]-19)<1e-9&&Math.abs(multi.seams[0].b[1]-14)<1e-9);
const multiOutput=operation([],{type:'form',id:'multi',form:multi}).outputs[0];
assert.equal(multiOutput.shapeMetrics.solids,1);
const multiShape=R.deserializeShape(multiOutput.brep).asShape3D(),multiFaces=multiShape.faces;
try{
 for(const seam of multi.seams){
  const point=[...seam.a.map((value,i)=>(value+seam.b[i])/2),seam.z],vertex=R.makeVertex(point);
  try{
   const patch=multiFaces.find(face=>face.geomType!=='PLANE'&&R.measureDistanceBetween(face,vertex)<1e-6);
   assert(patch);
   const normal=patch.normalAt(point);
   try{assert(Math.abs(normal.toTuple().reduce((sum,v,i)=>sum+v*seam.normal[i],0))>1-1e-6);}
   finally{normal.delete();}
  }finally{vertex.delete();}
 }
}finally{multiFaces.forEach(face=>face.delete());multiShape.delete();}

const wallForm=newFormProfile(),outerForm=operation([],{type:'form',id:'outer-wall-test',form:wallForm});
wallForm.wall={thickness:2,opening:'start'};
const wallPreview=runOperation([],{type:'formPreview',form:wallForm});
assert.equal(wallPreview.formWall.valid,true,wallPreview.formWall.message);
const wallFeature=operation([],{type:'form',id:'hollow-form',form:wallForm});
const bodyBounds=output=>{
 const shape=R.deserializeShape(output.brep).asShape3D(),box=shape.boundingBox;
 try{return box.bounds.flat();}finally{box.delete();shape.delete();}
};
assert.equal(wallFeature.outputs[0].shapeMetrics.solids,1);
assert(wallFeature.outputs[0].shapeMetrics.volume<outerForm.outputs[0].shapeMetrics.volume*.75);
const outerBounds=bodyBounds(outerForm.outputs[0]);
assert(bodyBounds(wallFeature.outputs[0]).every((v,i)=>Math.abs(v-outerBounds[i])<.02));
const wallBad={...wallForm,wall:{thickness:80,opening:'start'}};
const wallFailure=runOperation([],{type:'formPreview',form:wallBad});
assert.equal(wallFailure.formWall.valid,false);
assert(wallFailure.triangles.length>0);
assert.throws(()=>runOperation([],{type:'form',id:'failed-wall',form:wallBad}));
assert(formWallCandidates(1,16).includes(2));
assert(formWallCandidates(80,16).every(candidate=>candidate<16));
const centerline={...defaults,kind:'sketch',profile:'polyline',plane:'XY',points:[[7,-10],[7,10]]};
assert.equal(symmetryFromSketch(centerline,formBasis()),7);
assert.equal(symmetryFromSketch({...centerline,points:[[7,-10],[8,0],[7,10]]},formBasis()),null);
const mirrorPlane={plane:'CUSTOM',offset:-19,frame:{u:[0,-1,0],v:[0,0,1],n:[-1,0,0]}};
assert.equal(symmetryFromFace(mirrorPlane,formBasis()),19);
const shifted=newFormProfile();
shifted.rings[0].locked=true;
const fixedRing=structuredClone(shifted.rings[0]);
setFormSymmetryPlane(shifted,{u:7,source:'下絵の中心線'});
assert.deepEqual(shifted.rings[0],fixedRing);
assert.deepEqual(shifted.rings[1].points[0],[32,0]);
assert.deepEqual(shifted.rings[1].points[4],[-18,0]);
assert.equal(shifted.rings[1].points[2][0],7);
moveFormPoint(shifted,1,0,31,3,{strength:50});
assert.deepEqual(shifted.rings[1].points[4],[-17,3]);
assert.equal(shifted.rings[2].points[2][0],7);
assert.equal(operation([],{type:'form',id:'offset-symmetric',form:shifted}).outputs[0].shapeMetrics.solids,1);
const symmetricGuide=structuredClone(guided);
symmetricGuide.rings[0].locked=false;
setFormSymmetryPlane(symmetricGuide,{u:3});
const guidedRow=formGeometryRings(symmetricGuide).find(ring=>ring.z===18);
assert.deepEqual([guidedRow.points[0][0],guidedRow.points[4][0]],[27,-21]);
const dragGeometry=formDragGeometry(symmetricGuide,formBasis());
try{
 assert(dragGeometry.index.count>0);
 assert(dragGeometry.attributes.position.array.every(Number.isFinite));
}finally{dragGeometry.dispose();}
const comparison=runOperation([],{type:'formOutlineComparison',view:'top',
 mesh:{vertices:[0,0,0,10,0,0,10,10,0,0,10,0,0,0,1,10,0,1,10,10,1,0,10,1],triangles:[0,1,2,2,3,0,4,6,5,6,4,7]},
 outline:[[0,0],[8,0],[8,12],[0,12]],tolerance:.2});
assert(comparison.max>=2);
assert(comparison.segments.some(segment=>segment.state==='outside'));
assert(comparison.referenceSegments.some(segment=>segment.missing));
console.log('PASS form controls, fast mesh, offset symmetry, thickness candidates, exact seams, hollowing, save and replay');
