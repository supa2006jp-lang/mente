import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {findRegions} from '../src/regions.js';
import {defaults} from '../src/geometry.js';
import {profileSketch,runOperation} from '../src/kernel.js';

R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const sketches=[{...defaults,kind:'sketch',id:'small',profile:'circle',diameter:70,z:2},{...defaults,kind:'sketch',id:'large',profile:'circle',diameter:100,z:122}];
const sections=findRegions(sketches),spec={type:'loft',id:'body',sections};
assert.equal(sections.length,2);
const shellSpec={type:'shell',target:'body',thickness:2,direction:'内側',faces:[{bodyId:'body',point:[0,0,122],normal:[0,0,1]}]};
function checkShell(before,output,bottom=2){
 const after=R.deserializeShape(output.outputs[0].brep).asShape3D(),opening=R.makeVertex([0,0,122]),floor=R.makeVertex([0,0,bottom]);
 const analyzer=new (R.getOC().BRepCheck_Analyzer)(after.wrapped,true,false);
 try{
  assert.ok(analyzer.IsValid(),'shelled body is a valid BRep');
  const solids=after.solids;
  try{assert.equal(solids.length,1,'shell remains one connected solid');}finally{solids.forEach(solid=>solid.delete());}
  assert.ok(R.measureVolume(after)<R.measureVolume(before)*.2,'inside has been removed');
  assert.ok(R.measureDistanceBetween(opening,after)>45,'selected top cap is open');
  assert.ok(R.measureDistanceBetween(floor,after)<1e-5,'bottom cap remains');
 }finally{analyzer.delete();opening.delete();floor.delete();after.delete();}
}
const smoothResult=runOperation(sketches,spec),smooth=R.deserializeShape(smoothResult.outputs[0].brep).asShape3D();
try{
 assert.equal(smooth.faces.filter(face=>face.geomType==='CONE').length,1,'new coaxial circular loft has one smooth conical side');
 assert.equal(smooth.faces.length,3,'new loft has two caps and one side');
 checkShell(smooth,runOperation([...sketches,{kind:'cadop',id:'smooth',spec,...smoothResult}],shellSpec));
}finally{smooth.delete();}

const legacy=profileSketch(sections[0]).loftWith([profileSketch(sections[1])]);
try{
 assert.ok(legacy.faces.length>100,'legacy circular loft has many side faces');
 const oldFeature={kind:'cadop',id:'old',spec,outputs:[{id:'body',brep:legacy.serialize()}],remove:[]};
 checkShell(legacy,runOperation([...sketches,oldFeature],shellSpec));
 const base=R.makeCylinder(35,2),joined=legacy.fuse(base);
 try{
  const joinFeature={kind:'cadop',id:'joined',spec:{type:'join',target:'body'},outputs:[{id:'body',brep:joined.serialize()}],remove:[]};
  checkShell(joined,runOperation([...sketches,oldFeature,joinFeature],shellSpec),0);
 }finally{joined.delete();base.delete();}
}finally{legacy.delete();}
console.log('PASS smooth circular loft and inside/outside shell of saved polygonal loft and joined base');
