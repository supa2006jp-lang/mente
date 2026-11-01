import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';import fs from 'node:fs/promises';import assert from 'node:assert/strict';
import {kernelBodies} from '../src/kernel.js';import {basisFor} from '../src/frames.js';import {cadMesh} from '../src/cad-mesh.js';import {serializeCadShape} from '../src/cad-serialization.js';import {inspectCadStl} from '../src/stl-cad-inspection.js';
const out='.sites-runtime/angled-sketch-grid',document=JSON.parse(await fs.readFile(out+'/extruded.forma.json','utf8'));R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const bodies=kernelBodies(document.features);try{
 const sketch=document.features.find(f=>f.kind==='sketch'),basis=basisFor(sketch),last=document.features.at(-1),shape=bodies.get(last.id),mesh=cadMesh(shape);
 assert.ok(Math.abs(basis.n.z-Math.SQRT1_2)<1e-8);assert.ok(Math.abs(R.measureVolume(shape)-960)<.01);assert.ok(Math.abs(R.measureVolume(bodies.get('body'))-12000)<.01);
 const box=shape.boundingBox;try{const [lo,hi]=box.bounds;assert.ok(hi[2]-lo[2]>10,'angled extrusion is not flattened onto XY');}finally{box.delete();}
 assert.ok(inspectCadStl({...mesh,brep:serializeCadShape(shape)}).report.ok);assert.equal(document.features.some(f=>f.kind==='plane'),false);
 const proof={pass:true,browserGeneratedExtrusion:true,angle:45,expectedVolume:960,originalVolume:12000,watertight:true,noConstructionPlane:true};await fs.writeFile(out+'/native-proof.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}finally{bodies.forEach(b=>b.delete());}
