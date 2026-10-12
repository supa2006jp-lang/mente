import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import * as THREE from 'three';
import {STLExporter} from 'three/addons/exporters/STLExporter.js';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {defaults,makeGeometry,volume,validateFeature,validateProject,rebuild} from '../src/geometry.js';
import {featureSolid,runOperation,kernelBodies} from '../src/kernel.js';
import {basisFor} from '../src/frames.js';
import {findRegions} from '../src/regions.js';
import {throughDepth} from '../src/extrusion-extent.js';
import {binaryStlReport} from './stl-topology.mjs';

R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const base={...defaults,id:'symmetric',name:'対称',kind:'extrusion',width:24,height:18,diameter:16,depth:4,x:3,y:5,z:7,symmetric:true};
const close=(a,b,eps=.003)=>assert.ok(Math.abs(a-b)<eps,a+' != '+b);
function check(f){
 const shape=featureSolid(f),g=makeGeometry(f),half=featureSolid({...f,symmetric:false,depth:Math.abs(f.depth)});
 try{
  const valid=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);try{assert.ok(valid.IsValid(),'valid symmetric CAD solid');}finally{valid.delete();}
  const expected=2*R.measureVolume(half);close(R.measureVolume(shape),expected,.01);close(volume(g),expected,Math.max(.01,expected*.002));
  const n=basisFor(f.region||f).n,offset=f.region?.offset??n.dot(new THREE.Vector3(f.x,f.y,f.z)),p=g.attributes.position,v=new THREE.Vector3(),coords=[];for(let i=0;i<p.count;i++)coords.push(v.fromBufferAttribute(p,i).dot(n)-offset);
  close(Math.min(...coords),-Math.abs(f.depth));close(Math.max(...coords),Math.abs(f.depth));
  const report=binaryStlReport(new STLExporter().parse(new THREE.Mesh(g),{binary:true}));assert.equal(report.boundary,0);assert.equal(report.nonmanifold,0);assert.equal(report.orientation,0);
 }finally{shape.delete();g.dispose();half.delete();}
}
const frames=[{plane:'XY'},{plane:'XZ'},{plane:'YZ'},{plane:'CUSTOM',frame:{u:[Math.SQRT1_2,0,-Math.SQRT1_2],v:[0,1,0],n:[Math.SQRT1_2,0,Math.SQRT1_2]}}];
for(const frame of frames)for(const profile of ['rect','circle'])for(const taperAngle of [0,8,-8])check({...base,...frame,profile,taperAngle,depth:profile==='circle'?-4:4});
for(const profile of ['rect','circle','line'])for(const side of ['inside','outside','center'])check({...base,profile,side,mode:'thin',wall:2});
const sketches=[{...defaults,id:'outer',kind:'sketch',profile:'rect',width:24,height:18},{...defaults,id:'hole',kind:'sketch',profile:'circle',diameter:8}],region=findRegions(sketches).find(r=>r.holes.length);
for(const mode of ['solid','thin'])for(const taperAngle of [0,5])check({...base,x:0,y:0,z:0,profile:'region',region,mode,taperAngle});
check({...base,x:0,y:0,z:0,profile:'region',region,capHoles:true});
// A selected exact CAD face remains on the sketch plane even though extrusion starts below it.
const body={...defaults,id:'b',name:'箱',kind:'extrusion',width:30,height:20,depth:5};
const face={id:'face',plane:'XY',offset:5,outer:[[-15,-10],[15,-10],[15,10],[-15,10]],holes:[],sourceIds:[],cadFace:{bodyId:'b',point:[0,0,5],normal:[0,0,1]}};
for(const operation of ['join','cut']){const f={...base,id:'change',profile:'region',region:face,x:0,y:0,z:5,depth:2,operation,target:'b'},result=runOperation([body],{type:'extrusionBatch',features:[f]}).features[0];assert.equal(result.symmetric,true);const shape=R.deserializeShape(result.cadResult.outputs[0].brep).asShape3D();try{close(R.measureVolume(shape),600*(operation==='join'?7:3));}finally{shape.delete();}}
// Through cutting reaches the farther bound on either side, regardless of the input sign.
const tall={...body,z:-12,depth:17,width:30,height:20},cut={...base,id:'cut',profile:'circle',diameter:8,x:0,y:0,z:0,depth:-1,operation:'cut',target:'b',throughAll:true};
close(throughDepth(cut,[[-15,-10,-12],[15,10,5]]),12.1);
const cutResult=runOperation([tall],{type:'extrusionBatch',features:[cut]}).features[0],cutShape=R.deserializeShape(cutResult.cadResult.outputs[0].brep).asShape3D();try{close(R.measureVolume(cutShape),600*17-Math.PI*16*17,.01);}finally{cutShape.delete();}
// One feature survives save/reload and replays with a changed distance or direction.
const saved={format:'forma-cad',version:1,features:[base]};validateProject(JSON.parse(JSON.stringify(saved)));
for(const symmetric of [true,false]){const next=[{...base,depth:6,symmetric}],replayed=runOperation(next,{type:'replay',before:[base],start:0}).features,bodies=rebuild(replayed),cad=kernelBodies(replayed);try{close(volume(bodies.get(base.id).geometry),24*18*6*(symmetric?2:1));close(R.measureVolume(cad.get(base.id)),24*18*6*(symmetric?2:1));}finally{for(const b of bodies.values())b.geometry.dispose();for(const b of cad.values())b.delete();}}
for(const symmetric of ['true',1,null])assert.throws(()=>validateFeature({...base,symmetric}));for(const extra of [{untilSolid:true},{gridExtentPlane:'XY'}])assert.throws(()=>validateFeature({...base,...extra}));
const legacy={...base};delete legacy.symmetric;const g=makeGeometry(legacy);try{close(volume(g),24*18*4);}finally{g.dispose();}
console.log('PASS symmetric preview/CAD bounds and volumes, signed distance, all planes, taper/thin/holes, manifold STL, exact face join/cut, both-direction through cut, replay and legacy saves');
