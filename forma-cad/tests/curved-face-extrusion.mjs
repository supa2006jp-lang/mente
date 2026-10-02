import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {runOperation} from '../src/kernel.js';import {defaults,rebuild} from '../src/geometry.js';import {planarFace} from '../src/frames.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const body=R.drawRoundedRectangle(60,50,6).sketchOnPlane('XY').extrude(20).cut(R.makeCylinder(8,20));
const mesh=body.mesh({tolerance:.08,angularTolerance:.15});const base={kind:'cadop',id:'b',name:'rounded STEP',outputs:[{id:'b',...mesh,planarFaces:body.faces.filter(f=>f.geomType==='PLANE').map(f=>f.hashCode),brep:body.serialize()}],remove:[]};
const geometry=rebuild([base]).get('b').geometry,p=geometry.attributes.position,ix=geometry.index;
let triangle=-1;for(let i=0;i<(ix?ix.count:p.count);i+=3){if([0,1,2].every(j=>Math.abs(p.getZ(ix?ix.getX(i+j):i+j)-20)<1e-5)){triangle=i/3;break;}}assert.ok(triangle>=0);
const region={...planarFace(geometry,triangle),bodyId:'b'};assert.equal(region.holes.length,1);
const feature={...defaults,kind:'extrusion',id:'cut',name:'cut',profile:'region',region,frame:region.frame,mode:'solid',depth:-5,z:20,operation:'cut',target:'b'};
for(const legacy of [true,false]){const f=structuredClone(feature);if(!legacy)f.region.cadFace={bodyId:'b',point:[15,0,20],normal:[0,0,1]};const result=runOperation([base],{type:'extrusionBatch',features:[f]}).features[0];const shape=R.deserializeShape(result.cadResult.outputs[0].brep).asShape3D();assert.ok(Math.abs(R.measureVolume(shape)-R.measureVolume(body)*.75)<.001);const output=result.cadResult.outputs[0];assert.ok(Math.max(...output.vertices.filter((_,i)=>i%3===2))<15.0001,'no corner walls above cut');shape.delete();}
await fs.writeFile('.sites-runtime/rounded-cut-fixture.json',JSON.stringify({format:'forma-cad',version:1,features:[base]}));console.log('PASS curved face cut: exact volume, hole retained, no corner remnants, legacy face reference');
