import fs from 'node:fs/promises';import assert from 'node:assert/strict';import * as R from 'replicad';import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';import {exteriorVerticalEdges,interiorEdges} from '../src/interior-edge-selection.js';import {filletSolid} from '../src/solid-fillet.js';import {runOperation} from '../src/kernel.js';import {edgeFilletReferences} from '../src/edge-references.js';import {matchesInteriorEdge} from '../src/interior-edge-tool.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const box=R.makeBox([0,0,0],[40,32,24]),tool=R.makeBox([3,3,3],[37,29,30]),tray=box.cut(tool),closed=R.makeBox([0,0,0],[40,32,24]).cut(R.makeBox([3,3,3],[37,29,21]));
for(const shape of [box,tray,closed]){
 const outside=exteriorVerticalEdges(shape,{bodyId:'box'});
 assert.equal(outside.length,4);
 assert(outside.every(({a,b})=>a[0]===b[0]&&a[1]===b[1]&&[0,40].includes(a[0])&&[0,32].includes(a[1])));
 const result=filletSolid(shape,.5,{references:outside.map(e=>e.reference)});
 try{assert.equal(result.edgeCount,4);}finally{result.shape.delete();}
}
for(const [axis,index] of [['X',0],['Y',1],['Z',2]]){
 const outside=exteriorVerticalEdges(closed,{axis});
 assert.equal(outside.length,4,'closed cavity edges are excluded on '+axis);
 assert(outside.every(({a,b})=>a.every((value,i)=>i===index?value!==b[i]:value===b[i])));
}
const across=throughCutAlongX();
try{assert.equal(exteriorVerticalEdges(across,{axis:'X'}).length,4);}
finally{across.delete();}
function throughCutAlongX(){
 const cutter=R.makeBox([-1,3,3],[41,29,21]);
 try{return box.cut(cutter);}finally{cutter.delete();}
}
const spun=tray.clone().rotate(31,[0,0,0],[0,0,1]);
const tilted=box.clone().rotate(15,[0,0,0],[1,1,0]);
try{
 assert.equal(exteriorVerticalEdges(spun).length,4,'outer corners follow rotation about Z');
 assert.equal(exteriorVerticalEdges(tilted).length,0,'tilted edges do not count as Z-parallel');
}finally{spun.delete();tilted.delete();}
const before=R.measureVolume(tray),selected=interiorEdges(tray,{bodyId:'tray'});assert.equal(selected.length,8);assert(selected.every(e=>e.points.every(p=>p[0]>=3-1e-6&&p[0]<=37+1e-6&&p[1]>=3-1e-6&&p[1]<=29+1e-6)));assert.equal(interiorEdges(box).length,0);assert.equal(interiorEdges(closed).length,0);
const rounded=filletSolid(tray,.5,{references:selected.map(e=>e.reference)});assert.equal(rounded.edgeCount,8);rounded.shape.delete();assert.equal(R.measureVolume(tray),before);
for(const [angle,axis] of [[90,[1,0,0]],[90,[0,1,0]],[180,[1,0,0]],[118,[1,1,0]]]){
 const turned=tray.clone().rotate(angle,[0,0,0],axis);
 try{
  const result=interiorEdges(turned);
  assert.equal(result.length,8,'the opening follows the rotation of the body');
  const filleted=filletSolid(turned,.5,{references:result.map(edge=>edge.reference)});
  try{assert.equal(filleted.edgeCount,8);}
  finally{filleted.shape.delete();}
 }finally{turned.delete();}
}
const sideThrough=throughCutAlongX();
try{assert.equal(interiorEdges(sideThrough).length,0,'a sideways through-hole has no back wall');}
finally{sideThrough.delete();}
const cup=R.makeCylinder(20,25).cut(R.makeCylinder(17,30,[0,0,3])),cupEdges=interiorEdges(cup,{bodyId:'cup'});assert.equal(cupEdges.length,1);assert(cupEdges[0].curved);assert(Math.abs(cupEdges[0].point[2]-3)<1e-6);
const native=cupEdges[0],ui={bodyId:'cup',nativeReference:native.reference,curve:{points:native.points}};assert.equal(edgeFilletReferences([ui]).length,1);const rim=filletSolid(cup,.5,{references:edgeFilletReferences([ui])});assert.equal(rim.edgeCount,1);rim.shape.delete();assert(matchesInteriorEdge(ui,{bodyId:'cup',point:[0,17,3]}));assert(!matchesInteriorEdge(ui,{bodyId:'cup',point:[0,20,25]}));
const cells=R.makeBox([0,0,0],[64,34,24]).cut(R.makeBox([3,3,3],[30,31,30])).cut(R.makeBox([34,3,3],[61,31,30]));
const sideCells=cells.clone().rotate(90,[0,0,0],[0,1,0]);
try{
 for(const [shape,axis,partition] of [[cells,0,32],[sideCells,2,-32]]){
  const edges=interiorEdges(shape);
  const compartments=[...new Set(edges.map(edge=>edge.compartment))];
  assert.equal(compartments.length,2);
  for(const id of compartments){
   const group=edges.filter(edge=>edge.compartment===id);
   assert.equal(group.filter(edge=>edge.corner==='back').length,4);
   assert.equal(group.filter(edge=>edge.corner==='side').length,4);
   const firstSide=group[0].point[axis]<partition;
   assert.ok(group.every(edge=>(edge.point[axis]<partition)===firstSide));
  }
 }
}finally{sideCells.delete();}
const through=R.makeBox([0,0,0],[40,32,24]).cut(R.makeBox([3,3,-1],[37,29,30]));assert.equal(interiorEdges(through).length,0);
const rotated=tray.clone().rotate(31,[0,0,0],[0,0,1]);assert.equal(interiorEdges(rotated).length,8);
const beveled=tray.clone().chamfer(.7,f=>f.inPlane('XY',24)),beveledEdges=interiorEdges(beveled);assert.equal(beveledEdges.length,8,'entry chamfer and its short corner continuations belong to the opening rim');assert(beveledEdges.every(e=>e.point[2]<24-1e-6));
const lip=R.makeBox([0,0,0],[40,32,24]).cut(R.makeBox([3,3,3],[37,29,22])).cut(R.makeBox([5,5,21],[35,27,30])),lipEdges=interiorEdges(lip);assert.equal(lipEdges.filter(e=>Math.abs(e.point[2]-3)<1e-6).length,4,'floor beneath inward lip is in an open cavity');assert(lipEdges.every(e=>e.point[2]<24-1e-6));
const notch=R.makeBox([0,0,0],[40,32,24]).cut(R.makeBox([3,-5,3],[37,29,30]));assert.equal(interiorEdges(notch).length,0,'external recess is not an enclosed container');
const taperedTool=R.drawRectangle(28,20).sketchOnPlane('XY',[0,0,3]).loftWith(R.drawRectangle(36,28).sketchOnPlane('XY',[0,0,30]),{ruled:true}),tapered=R.makeBox([-22,-18,0],[22,18,25]).cut(taperedTool);assert.equal(interiorEdges(tapered).length,8,'sloped walls must not be mistaken for entry chamfers');const taperedBevel=tapered.clone().chamfer(.7,f=>f.inPlane('XY',25));assert.equal(interiorEdges(taperedBevel).length,8,'entry chamfer corners on sloped walls are excluded');taperedBevel.delete();
const boss=tray.clone().fuse(R.makeBox([15,12,2],[25,20,9]));assert(interiorEdges(boss).some(e=>Math.abs(e.point[2]-9)<1e-6),'internal ledge top edges remain selectable');
let angled=R.makeBox([-68,-42,0],[68,42,38]);for(let r=0;r<2;r++)for(let c=0;c<4;c++){const p=[(c-1.5)*31,-19+r*33,7],t=R.drawRectangle(25.6,25.6).sketchOnPlane('XY',p).extrude(70).rotate(-12,p,[1,0,0]);angled=angled.cut(t);}assert.equal(interiorEdges(angled).length,64);
const features=[{kind:'cadop',id:'fixture',name:'入れ物',outputs:[{id:'a',brep:tray.serialize()},{id:'b',brep:cup.serialize()}],remove:[]}],unchanged=JSON.stringify(features),result=runOperation(features,{type:'interiorEdges',targets:['a','b']});assert.equal(result.edges.length,9);assert.deepEqual(result.analysis.interiorEdges.bodyIds,['a','b']);assert.equal(JSON.stringify(features),unchanged);
const compartmentInspection=runOperation([{kind:'cadop',id:'cells',name:'区画付きの箱',outputs:[{id:'cells',brep:cells.serialize()}],remove:[]}],{
 type:'interiorEdges',targets:['cells'],includeCompartmentFaces:true,faceSeeds:[
  {bodyId:'cells',point:[16,17,3],normal:[0,0,1]},
  {bodyId:'cells',point:[3,17,10],normal:[1,0,0]},
  {bodyId:'cells',point:[48,17,3],normal:[0,0,1]},
  {bodyId:'cells',point:[32,17,24],normal:[0,0,1]},
 ],
});
const [floor,wall,otherFloor,rimFace]=compartmentInspection.analysis.interiorEdges.faceSelections;
assert.ok(floor.compartment&&otherFloor.compartment);
assert.equal(floor.compartment,wall.compartment);
assert.notEqual(floor.compartment,otherFloor.compartment);
assert.deepEqual(rimFace,{bodyId:'cells',compartment:null,reason:'rim'});
for(const [compartment,minX,maxX] of [[floor.compartment,3,30],[otherFloor.compartment,34,61]]){
 const surfaces=compartmentInspection.compartmentFaces.filter(face=>face.compartment===compartment);
 assert.equal(surfaces.length,5,'four inner walls and a floor');
 assert.ok(surfaces.every(({positions})=>positions.every((value,i)=>i%3!==0||(value>=minX&&value<=maxX))));
 assert.ok(surfaces.some(({positions})=>positions.every((value,i)=>i%3!==2||value===3)),'the floor is included');
 assert.ok(surfaces.every(({positions})=>!positions.every((value,i)=>i%3!==2||value===24)),'the rim is excluded');
}
for(const shape of [box,tray,closed,cup,cells,through,rotated,lip,notch,angled,beveled,tapered,boss])shape.delete();
await fs.mkdir('.sites-runtime',{recursive:true});await fs.writeFile('.sites-runtime/interior-edge-selection-native-proof.json',JSON.stringify({pass:true,syntheticFixturesOnly:true,rectangular:8,circular:1,multipleCavities:16,tiltedPockets:64,beveledOpening:8,taperedWalls:8,taperedBevel:8,interiorBoss:true,lip:true,closedVoidExcluded:true,throughVoidExcluded:true,exteriorNotchExcluded:true,nativeCurveReference:true,sourcePreserved:true},null,2));
console.log('PASS internal corners, outer/rim exclusion, round/multiple/tilted cavities and lip, closed/through/exterior void exclusion, explicit native curve references, deselection, multi-body kernel operation and unchanged source');
