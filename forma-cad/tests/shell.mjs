import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';import {setOC} from 'replicad';import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {runOperation} from '../src/kernel.js';import {defaults,rebuild,volume} from '../src/geometry.js';
import {inspectCadStl} from '../src/stl-cad-inspection.js';
setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));const b={...defaults,id:'b',name:'box',width:30,height:20,depth:10};
for(const both of [false,true]){const faces=[{point:[0,0,10],normal:[0,0,1]}];if(both)faces.push({point:[0,0,0],normal:[0,0,-1]});const r=runOperation([b],{type:'shell',target:'b',thickness:2,direction:'内側',faces});const g=rebuild([b,{kind:'cadop',id:'s',...r}]).get('b').geometry;assert.ok(Math.abs(volume(g)-(both?1840:2672))<.1);}
const r=runOperation([b],{type:'shell',target:'b',thickness:2,direction:'外側',faces:[{point:[0,0,10],normal:[0,0,1]}]});assert.ok(r.outputs[0].vertices.length>0);assert.throws(()=>runOperation([b],{type:'shell',target:'b',thickness:0,direction:'内側',faces:[]}));console.log('PASS shell wall thickness, single and double openings, outward shell and invalid thickness');

const box={...defaults,kind:'extrusion',id:'rounded-box',name:'box',width:50,height:30,depth:30};
const edges=[-25,25].flatMap(x=>[0,30].map(z=>({bodyId:box.id,point:[x,0,z]})));
const fillet={type:'fillet',id:'rounded-edges',target:box.id,radius:2,edges};
const rounded=runOperation([box],fillet);
const features=[box,{kind:'cadop',id:fillet.id,name:'round',spec:fillet,...rounded}];
const shell={
 type:'shell',target:box.id,thickness:2,direction:'内側',
 faces:[{bodyId:box.id,point:[0,-15,15],normal:[0,-1,0]}],
};
const output=runOperation(features,shell).outputs[0];
const original=rounded.outputs[0].shapeMetrics;
assert.ok(Math.abs(output.shapeMetrics.volume-(original.volume-46*26*28))<1e-6);
assert.deepEqual(output.shapeMetrics.bounds,original.bounds);
assert.equal(output.shapeMetrics.solids,1);
assert.ok(inspectCadStl(output).report.ok);
console.log('PASS shell with wall thickness equal to the corner radius');
