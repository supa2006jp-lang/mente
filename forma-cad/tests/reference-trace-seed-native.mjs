import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {kernelBodies} from '../src/kernel.js';
import {inspectCadStl} from '../src/stl-cad-inspection.js';
import {findRegions} from '../src/regions.js';
import {defaults,validateProject} from '../src/geometry.js';
import {basisFor} from '../src/frames.js';

const input=process.env.FORMA_TRACE_SEED_MODEL||'.sites-runtime/reference-trace-seed/browser/result.forma.json',output=process.env.FORMA_TRACE_SEED_NATIVE_PROOF||'.sites-runtime/reference-trace-seed/native-proof.json';
const doc=JSON.parse(await fs.readFile(input,'utf8'));validateProject(doc);const before=JSON.stringify(doc),regions=findRegions(doc.features.filter(f=>f.kind==='sketch'));assert.equal(regions.length,2);
const extrusions=regions.map((region,i)=>{const b=basisFor(region),origin=b.n.multiplyScalar(region.offset);return {...defaults,id:'outline-'+i,kind:'extrusion',name:'個別輪郭の押し出し',profile:'region',plane:region.plane,frame:region.frame,region,depth:3,x:origin.x,y:origin.y,z:origin.z};});
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));const bodies=kernelBodies([...doc.features,...extrusions]),rows=[];
try{assert.equal(bodies.size,3);for(const f of extrusions){const shape=bodies.get(f.id),analyzer=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false),solids=shape.solids;try{assert.ok(analyzer.IsValid());assert.equal(solids.length,1);}finally{analyzer.delete();solids.forEach(s=>s.delete());}const volume=R.measureVolume(shape),expected=f.region.area*3;assert.ok(Math.abs(volume-expected)<.001);assert.ok(inspectCadStl({id:f.id,brep:shape.serialize()}).report.ok);rows.push({id:f.id,volume,expectedVolume:expected,validCad:true,closedStl:true});}assert.equal(JSON.stringify(doc),before);const proof={pass:true,browserDocument:input,independentRegions:2,photoPlane:regions[0].plane,offset:regions[0].offset,extrusions:rows,inputUnchanged:true};await fs.writeFile(output,JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));}finally{bodies.forEach(shape=>shape.delete());}
