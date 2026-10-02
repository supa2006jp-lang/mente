import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import {clipExtrusionAtSolids,contactSearchDistance} from '../src/extrude-to-solid.js';

R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));

test('curved blocker stops the extrusion at the actual sphere surface',()=>{
 const tool=R.drawCircle(5).sketchOnPlane('XY').extrude(20);
 const blocker=R.makeSphere(20).translate([0,0,25]);
 let result,overlap;
 try{
  result=clipExtrusionAtSolids(tool,[blocker],[0,0,1],20);
  overlap=result.intersect(blocker);
  assert.ok(Math.abs(R.measureVolume(overlap))<1e-5,
   'extrusion penetrates the curved target by '+R.measureVolume(overlap)+' mm³');
 }finally{overlap?.delete();result?.delete();blocker.delete();tool.delete();}
});

test('an end face touching a thin blocker is a completed extrusion',()=>{
 const tool=R.makeBox([-5,-5,0],[5,5,20]);
 const blocker=R.makeBox([-6,-6,20],[6,6,20.005]);
 let result;
 try{
  result=clipExtrusionAtSolids(tool,[blocker],[0,0,1],20);
  assert.ok(Math.abs(R.measureVolume(result)-2000)<1e-5);
 }finally{result?.delete();blocker.delete();tool.delete();}
});

test('a profile hole is not treated as an uncovered column',()=>{
 const outer=R.drawCircle(10).sketchOnPlane('XY').extrude(20);
 const inner=R.drawCircle(3).sketchOnPlane('XY').extrude(20);
 const tool=outer.cut(inner);
 outer.delete();inner.delete();
 const plate=R.makeBox([-11,-11,8],[11,11,10]);
 const bore=R.drawCircle(3).sketchOnPlane('XY',[0,0,7]).extrude(4);
 const blocker=plate.cut(bore);
 plate.delete();bore.delete();
 let result;
 try{
  result=clipExtrusionAtSolids(tool,[blocker],[0,0,1],20);
  assert.ok(Math.abs(R.measureVolume(result)-Math.PI*(10**2-3**2)*8)<1e-4);
 }finally{result?.delete();blocker.delete();tool.delete();}
});

test('a rear surface behind the sketch does not hide a later cavity wall',()=>{
 const tool=R.drawCircle(5).sketchOnPlane('XY').extrude(25);
 const outer=R.makeSphere(22);
 const inner=R.makeSphere(20);
 const shell=outer.cut(inner);
 const expected=tool.intersect(inner);
 let result,missing,extra,overlap;
 try{
  result=clipExtrusionAtSolids(tool,[shell],[0,0,1],25);
  missing=expected.cut(result);
  extra=result.cut(expected);
  overlap=result.intersect(shell);
  assert.ok(Math.abs(R.measureVolume(missing))<1e-5,
   'the extrusion ends before reaching the cavity wall');
  assert.ok(Math.abs(R.measureVolume(extra))<1e-5,
   'the extrusion continues beyond the cavity wall');
  assert.ok(Math.abs(R.measureVolume(overlap))<1e-5,
   'the extrusion penetrates the shell');
 }finally{
  overlap?.delete();extra?.delete();missing?.delete();result?.delete();
  expected.delete();shell.delete();inner.delete();outer.delete();tool.delete();
 }
});

// Reproduce the supplied model without embedding its saved data: a sideways
// revolved frustum has radii 30/50 and a 30-by-10 face starts at x=70.
// The automatic search extends past the far side of this periodic cone.
test('a long search reaches the entry face of a sideways revolved cone',()=>{
 const blocker=R.draw([0,0]).lineTo([30,0]).lineTo([50,50]).lineTo([0,50]).close().sketchOnPlane('XY').revolve([0,1,0]);
 const initial=R.makeBox([49,10,0],[70,40,10]);
 const short=R.makeBox([10,10,0],[70,40,10]);
 const expected=short.cut(blocker);
 const search=contactSearchDistance(initial,[blocker],[-1,0,0]);
 const tool=R.makeBox([70-search,10,0],[70,40,10]);
 let result,missing,extra,overlap,manual,contactOnly;
 try{
  assert.ok(search>120,'automatic search includes the far side of the cone');
  const info={};
  result=clipExtrusionAtSolids(tool,[blocker],[-1,0,0],search,{contactInfo:info});
  assert.ok(Math.abs(R.measureVolume(result)-9127.207124)<.001,'the valid bridge must not be erased');
  assert.ok(Math.abs(info.contactDepth-(70-Math.sqrt(34**2-10**2)))<1e-5,'last contact uses the curved surface');
  missing=expected.cut(result);extra=result.cut(expected);overlap=result.intersect(blocker);
  assert.ok(Math.abs(R.measureVolume(missing))<1e-4,'no valid part before the cone is missing');
  assert.ok(Math.abs(R.measureVolume(extra))<1e-4,'nothing extends past the first curved contact');
  assert.ok(Math.abs(R.measureVolume(overlap))<1e-5,'the bridge does not penetrate the cone');
  manual=clipExtrusionAtSolids(tool,[blocker],[-1,0,0],search,{maxDepth:10});
  assert.ok(Math.abs(R.measureVolume(manual)-3000)<1e-5,'manual shortening stops before the curve');
  contactOnly=clipExtrusionAtSolids(tool,[blocker],[-1,0,0],search,{contactOnly:true});
  assert.ok(Math.abs(R.measureVolume(contactOnly)-R.measureVolume(expected))<1e-4,'contact-only also preserves the bridge');
 }finally{
  contactOnly?.delete();manual?.delete();overlap?.delete();extra?.delete();missing?.delete();result?.delete();
  tool.delete();expected.delete();short.delete();initial.delete();blocker.delete();
 }
});
