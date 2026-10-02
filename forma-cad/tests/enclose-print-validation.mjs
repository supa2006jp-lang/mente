import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {runOperation} from '../src/kernel.js';
import {encloseParts} from '../src/enclose.js';

R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const body=R.makeBox([0,0,0],[10,10,5]);
const lid=R.makeBox([20,0,0],[25,5,5]);
const source=R.makeBox([-5,-5,-5],[-4,-4,-4]);
const entry=(id,shape)=>({id,brep:shape.serialize()});
const features=[
 {kind:'cadop',id:'source-feature',outputs:[entry('source',source)],remove:[]},
 {kind:'cadop',id:'box-feature',outputs:[entry('body',body),entry('lid',lid)],remove:[]},
 {kind:'cadop',id:'delete-source',outputs:[],remove:['source']},
];
const command={type:'enclosePrintValidate',bodyId:'body',lidId:'lid',hinge:[14,-4,0],axis:[0,0,1],turnAngle:-90};
const result=runOperation(features,command);
assert.ok(result.clearance>0.02,'the 90 degree pose has positive clearance even after source deletion');
assert.ok(result.overlap<=1e-5);
assert.throws(()=>runOperation(features,{...command,turnAngle:90}),/90°.*干渉/,'a collision appearing only at 90 degrees blocks export');
assert.throws(()=>runOperation(features,{...command,lidId:'missing'}),/CAD形状が見つかりません/);

const second=R.makeBox([30,0,0],[31,1,1]);
const disconnected=R.makeCompound([lid,second]).asShape3D();
const broken=[
 {kind:'cadop',id:'body-feature',outputs:[entry('body',body),entry('lid',disconnected)],remove:[]},
];
assert.throws(()=>runOperation(broken,command),/一つながりのソリッドではありません/,'disconnected lid blocks export');

const target=R.makeBox([0,0,0],[30,20,20]);
const spec={boxMode:true,thickness:2,clearance:.5,boxExtra:3,enclosureSplit:'XY',splitOffset:10,hinge:true,hingeEdge:'+Y',hingeRadialGap:.5,hingeAxialGap:.5,hingeAngle:0};
const actual=encloseParts(target,spec);
const actualFeatures=[{kind:'cadop',id:'enclosure',outputs:[entry('box-body',actual[0]),entry('box-lid',actual[1])],remove:[]}];
const actualCheck=runOperation(actualFeatures,{type:'enclosePrintValidate',bodyId:'box-body',lidId:'box-lid',hinge:actual.hingeFrame.point,axis:[1,0,0],turnAngle:-90});
assert.ok(actualCheck.clearance>=0.02,'a generated hinged BOX is printable at exactly 90 degrees');
const reinforced=encloseParts(target,{...spec,hardwareScale:1.3,latchProfile:'triangle',snapLatch:true,latchGap:.45,latchEngagement:.25,seamGap:.4});
const reinforcedFeatures=[{kind:'cadop',id:'reinforced-enclosure',outputs:[entry('reinforced-body',reinforced[0]),entry('reinforced-lid',reinforced[1])],remove:[]}];
const reinforcedCheck=runOperation(reinforcedFeatures,{type:'enclosePrintValidate',bodyId:'reinforced-body',lidId:'reinforced-lid',hinge:reinforced.hingeFrame.point,axis:[1,0,0],turnAngle:-90});
assert.ok(reinforcedCheck.clearance>=0.02,'the enlarged hinge and triangular latch remain printable at exactly 90 degrees');
reinforced.forEach(shape=>shape.delete());
actual.forEach(shape=>shape.delete());target.delete();
for(const shape of [body,lid,source,second,disconnected])shape.delete();
console.log('PASS print pose validates closed solids, source deletion, and collision at 90 degrees');