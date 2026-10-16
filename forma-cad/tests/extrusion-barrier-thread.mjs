import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {defaults,validateProject} from '../src/geometry.js';
import {runOperation,kernelBodies} from '../src/kernel.js';
import {allThreadPullSpec} from '../src/thread-pull-spec.js';
import {clearBodyCache} from '../src/body-cache.js';
import {fuseSolids} from '../src/solid-fuse.js';
import {solidMeshComplete} from '../src/solid-mesh.js';

R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const decode=output=>R.deserializeShape(output.brep).asShape3D();
function check(shape){const analyzer=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);try{assert.ok(analyzer.IsValid(),'female cavity must remain a valid solid');}finally{analyzer.delete();}}
function verify(shape,male,gap){check(shape);assert.ok(solidMeshComplete(shape),'threaded cavity must mesh without missing faces');const distance=R.measureDistanceBetween(shape,male);assert.ok(distance>=gap-1e-5&&distance<gap+.003,`clearance ${distance} must follow ${gap} mm`);const faces=shape.faces;try{assert.ok(faces.some(face=>face.geomType==='BSPLINE_SURFACE'),'the cavity must retain helical grooves');}finally{faces.forEach(face=>face.delete());}}
function threaded(before,{leftHand=false,pull=0,surfacePoint=[5,0,3]}={}){let spec={type:'thread',target:'bolt',profile:'metric60',threadVersion:2,pitch:1.5,fullLength:true,leftHand,surfacePoint};if(pull)spec=allThreadPullSpec(spec,pull);return [...before,{kind:'cadop',id:'thread',name:'M10ねじ',spec,...runOperation(before,spec)}];}
const cylinder={...defaults,id:'bolt',name:'M10 円柱',profile:'circle',diameter:10,depth:5},history=threaded([cylinder]),snapshot=JSON.stringify(history);
const feature={...defaults,kind:'extrusion',id:'female',name:'ねじを避けた押し出し',width:20,height:20,depth:5,barrier:true,barrierGap:.4};
const male=decode(history.at(-1).outputs[0]);let created;
try{
 const preview=runOperation(history,{type:'extrusionToolPreview',feature});assert.equal(preview.barrierClearance.length,1);assert.equal(preview.barrierThreadRelief,.4);assert.equal(preview.barrierClearanceWarning,undefined);
 const stages=[];created=runOperation(history,{type:'extrusion',feature},progress=>stages.push(progress.stage));
 assert.ok(!stages.includes('ねじ山に沿うすき間形状を作成しています'),'confirmed preview must reuse the validated threaded clearance');
 const female=decode(created.outputs[0]);try{verify(female,male,.4);const bore=R.makeCylinder(5.4,3,[0,0,1]),ridges=female.intersect(bore);try{assert.ok(R.measureVolume(ridges)>.1,'thread ridges must remain inside the equivalent smooth bore');}finally{bore.delete();ridges.delete();}}finally{female.delete();}
 const saved=[...history,{...feature,cadResult:created}];validateProject(JSON.parse(JSON.stringify({format:'forma-cad',version:1,features:saved})));
 const changed=structuredClone(saved);changed.at(-1).barrierGap=.25;
 const replay=runOperation(changed,{type:'replay',before:saved,start:history.length}).features,updated=decode(replay.at(-1).cadResult.outputs[0]);try{verify(updated,male,.25);}finally{updated.delete();}
 const rebuilt=kernelBodies([...history,{...feature,barrierGap:.25}]);try{verify(rebuilt.get('female'),male,.25);}finally{rebuilt.forEach(shape=>shape.delete());}
 assert.equal(JSON.stringify(history),snapshot,'original screw and history must not change');
 await fs.writeFile('.sites-runtime/extrusion-barrier-thread-fixture.forma.json',JSON.stringify({format:'forma-cad',version:1,features:saved}));
}finally{male.delete();}
clearBodyCache();
const left=threaded([cylinder],{leftHand:true,pull:-.1}),motion={type:'move',target:'bolt',rotation:[0,35,20],pivot:[0,0,0],x:9,y:4,z:3};
const moved=[...left,{kind:'cadop',id:'moved',name:'移動',spec:motion,...runOperation(left,motion)}],movedMale=decode(moved.at(-1).outputs[0]);
const movedFemale=decode(runOperation(moved,{type:'extrusion',feature:{...feature,width:40,height:40,z:-3,depth:22}}).outputs[0]);
try{verify(movedFemale,movedMale,.4);}finally{movedFemale.delete();movedMale.delete();}
clearBodyCache();
const points=Array.from({length:6},(_,i)=>[8*Math.cos(i*Math.PI/3),8*Math.sin(i*Math.PI/3)]);let drawing=R.draw(points[0]);for(const point of points.slice(1))drawing=drawing.lineTo(point);
const head=drawing.close().sketchOnPlane('XY').extrude(3),stem=R.makeCylinder(5,6,[0,0,3]),raw=fuseSolids([head,stem]);
const seed={kind:'cadop',id:'head',name:'六角頭と軸',outputs:[{id:'bolt',...raw.mesh(),brep:raw.serialize()}],remove:[]};head.delete();stem.delete();raw.delete();
const headed=threaded([seed],{surfacePoint:[5,0,6]}),headedMale=decode(headed.at(-1).outputs[0]),headedFemale=decode(runOperation(headed,{type:'extrusion',feature:{...feature,width:24,height:24,z:-1,depth:12}}).outputs[0]);
try{verify(headedFemale,headedMale,.4);}finally{headedFemale.delete();headedMale.delete();}
clearBodyCache();
const motionForJoin={type:'move',target:'bolt',rotation:[0,0,0],x:-8,y:0,z:0},shifted={kind:'cadop',id:'shift',name:'移動',spec:motionForJoin,...runOperation(history,motionForJoin)};
const anchor={...defaults,id:'anchor',name:'結合先',width:3,height:20,depth:6,x:1.5};
const sideFace={id:'face',plane:'YZ',offset:0,outer:[[-10,0],[10,0],[10,6],[-10,6]],holes:[],area:120,sourceIds:[],bodyId:'anchor',cadFace:{bodyId:'anchor',point:[0,0,3],normal:[-1,0,0]}};
const joined=runOperation([...history,shifted,anchor],{type:'extrusion',target:'anchor',feature:{...feature,profile:'region',operation:'join',target:'anchor',region:sideFace,depth:-20}});
assert.deepEqual(joined.outputs.map(output=>output.id),['anchor']);assert.deepEqual(joined.remove,[]);
const joinedShape=decode(joined.outputs[0]),shiftedMale=decode(shifted.outputs[0]);try{verify(joinedShape,shiftedMale,.4);}finally{joinedShape.delete();shiftedMale.delete();}
console.log('PASS threaded 0.4/0.25 mm barrier cavities, helical ridges, preview colours, cache reuse, save/replay/rebuild, moved/rotated left-hand pulled screw, hexagonal head, side-face join and immutable source');
