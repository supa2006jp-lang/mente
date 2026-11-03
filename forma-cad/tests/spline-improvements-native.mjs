import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {kernelBodies} from '../src/kernel.js';
import {inspectCadStl} from '../src/stl-cad-inspection.js';
import {validateProject} from '../src/geometry.js';

const input=process.env.FORMA_SPLINE_MODEL||'.sites-runtime/spline-improvements/browser/simplified-with-extrusion.forma.json',output=process.env.FORMA_SPLINE_NATIVE_PROOF||'.sites-runtime/spline-improvements/native-proof.json';
const doc=JSON.parse(await fs.readFile(input,'utf8'));validateProject(doc);const before=JSON.stringify(doc),extrusion=doc.features.find(f=>f.kind==='extrusion');assert.ok(extrusion?.region?.area>0);assert.ok(doc.features[0].closed&&doc.features[0].points.length<40);
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const bodies=kernelBodies(doc.features);let proof;
try{
 assert.equal(bodies.size,1);const shape=bodies.get(extrusion.id),check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false),parts=shape.solids;
 try{assert.ok(check.IsValid());assert.equal(parts.length,1);}finally{check.delete();parts.forEach(p=>p.delete());}
 const volume=R.measureVolume(shape),expected=extrusion.region.area*Math.abs(extrusion.depth);assert.ok(Math.abs(volume-expected)<.001,`${volume} != ${expected}`);
 const stl=inspectCadStl({id:extrusion.id,brep:shape.serialize()});assert.ok(stl.report.ok,JSON.stringify(stl.report.issues));assert.equal(JSON.stringify(doc),before);
 proof={pass:true,browserDocument:input,validCad:true,oneSolid:true,volume,expectedVolume:expected,closedStl:true,fitPoints:doc.features[0].points.length,inputUnchanged:true};await fs.writeFile(output,JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}finally{bodies.forEach(shape=>shape.delete());}
