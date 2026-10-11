import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as R from 'replicad';
import * as THREE from 'three';
import {STLExporter} from 'three/addons/exporters/STLExporter.js';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {runOperation} from '../src/kernel.js';
import {defaults,validateProject} from '../src/geometry.js';
import {ballJointDefaults,ballJointSettings} from '../src/ball-joint-settings.js';
import {ballJointNeckLayout} from '../src/ball-joint-neck-layout.js';
import {ballJointNeck,placeBallJointBase} from '../src/ball-joint-neck.js';
import {ballJointNeckRootDimensions} from '../src/ball-joint-neck-root.js';
import {ballJointMountBase} from '../src/ball-joint-mount.js';
import {ballJointFixHole} from '../src/ball-joint-fix-hole.js';
import {fuseSolid} from '../src/solid-fuse.js';
import {solidMeshComplete} from '../src/solid-mesh.js';
import {cleanBinaryStl} from '../src/clean-stl.js';
import {binaryStlReport} from './stl-topology.mjs';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const volume=s=>Math.abs(R.measureVolume(s));
function stl(output){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(output.vertices,3));g.setIndex(output.triangles);const mesh=new THREE.Mesh(g);mesh.updateMatrixWorld(true);try{return cleanBinaryStl(new STLExporter().parse(mesh,{binary:true}));}finally{g.dispose();mesh.material.dispose();}}
function boundaryEdges(data){
 const edges=new Map();for(let i=0;i<data.getUint32(80,true);i++){const p=Array.from({length:3},(_,j)=>Array.from({length:3},(_,k)=>data.getFloat32(96+i*50+j*12+k*4,true)).join(','));for(let j=0;j<3;j++){const key=[p[j],p[(j+1)%3]].sort().join('|');edges.set(key,(edges.get(key)||0)+1);}}
 return [...edges.entries()].filter(([,n])=>n===1).map(([k])=>k).sort();
}

const source={...defaults,id:'c',name:'円柱',kind:'extrusion',profile:'circle',diameter:24,depth:40};
const cases=[
 {name:'straight',extra:{}},
 {name:'short bent',extra:{neckBend:true,neckLength:1}},
 {name:'bent 90',extra:{neckBend:true,neckExtension:15,neckBendDirection:90}},
 {name:'tilted 270',extra:{neckBend:true,neckExtension:15,neckBaseTilt:true,neckBendDirection:270}},
 {name:'short cylinder',height:1,extra:{neckBend:true,neckExtension:15,neckBaseTilt:true}},
 {name:'threaded base and fixing hole',extra:{neckBend:true,neckExtension:15,neckBaseTilt:true,neckBendDirection:90,mountThread:true,mountSide:'ball',mountPitch:1.5,mountLength:4,fixHole:true,fixSide:'ball',fixBallDiameter:4,fixBallPitch:.7,fixBallDepth:4}}
];
for(const {name,height=40,extra} of cases.filter(c=>!process.env.FORMA_ROOT_CASE||c.name===process.env.FORMA_ROOT_CASE)){
 const src={...source,depth:height},info={radius:12,height},p={...ballJointDefaults(info),...extra,type:'ballJoint',id:'joint',target:'c',pose:'assembled'},s=ballJointSettings(info,p),q=ballJointNeckLayout(s),d=ballJointNeckRootDimensions(s,info.radius),owned=[],hold=x=>(owned.push(x),x);
 try{
  const base=placeBallJointBase(hold(ballJointMountBase(info.radius,s.ballBaseHeight,s,'ball').translate([0,0,s.ballBaseStart])),s,hold);
  // Radius zero disables the added root for an exact pre-change reference.
  const bare=ballJointNeck(s,hold,0),sphere=hold(R.makeSphere(s.r).translate([0,0,s.splitPosition]));
  const referenceBase=s.fixHole?hold(ballJointFixHole(base,height,s,'ball')):base;
  const result=runOperation([src],p),ball=hold(R.deserializeShape(result.outputs[0].brep).asShape3D());
  assert.ok(result.analysis.overlap.every(v=>v<1e-5),'no socket/nut interference');
  for(const original of [referenceBase,bare,sphere])assert.ok(volume(hold(original.cut(ball)))<1e-5,'no original material removed');
  const added=hold(hold(hold(ball.cut(referenceBase)).cut(bare)).cut(sphere));assert.ok(volume(added)>.05,'positive reinforcement volume');
  let localAdded=hold(added.clone().translate(q.offset.map(v=>-v)));
  if(q.tilt)localAdded=hold(localAdded.rotate(-q.tilt,[0,0,q.bottom],q.rotationAxis));
  const bounds=localAdded.boundingBox;try{assert.ok(bounds.bounds[0][2]>=q.bottom-.10001);assert.ok(bounds.bounds[1][2]<=q.bottom+d.height+.00001,'changes stay at the root');}finally{bounds.delete();}
  const toLocal=shape=>{let copy=hold(shape.clone().translate(q.offset.map(v=>-v)));if(q.tilt)copy=hold(copy.rotate(-q.tilt,[0,0,q.bottom],q.rotationAxis));return copy;};
  const layer=hold(R.makeCylinder(info.radius+5,.02,[0,0,q.bottom+d.height*.2]));
  assert.ok(volume(hold(toLocal(ball).intersect(layer)))>volume(hold(toLocal(bare).intersect(layer)))+1e-4,'wider cross-section above the base');
  const direction=s.neckBend?q.direction:[0,0,1],center=q.base.map((v,i)=>v+direction[i]*.15),probe=hold(R.makeSphere(.05).translate(center));
  assert.ok(Math.abs(volume(hold(ball.intersect(probe)))-volume(probe))<1e-7,'root remains solid');
  for(const [outputIndex,output] of result.outputs.entries()){
   const shape=hold(R.deserializeShape(output.brep).asShape3D()),check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false),solids=shape.solids;
   try{assert.ok(check.IsValid());assert.equal(solids.length,1);assert.ok(solidMeshComplete(shape));}finally{check.delete();solids.forEach(x=>x.delete());}
   const data=stl(output),report=binaryStlReport(data);
   for(const k of ['degenerate','nonmanifold','orientation'])assert.equal(report[k],0,name+' '+result.analysis.roles[outputIndex]+' STL '+k);
   if(name==='threaded base and fixing hole'&&outputIndex===0){
    // The pre-existing mounting-thread face has mismatched tessellation edges.
    // Compare their exact coordinates to the original, unreinforced part:
    // reinforcement must neither add nor move these unrelated boundaries.
    const original=hold(ballJointFixHole(hold(fuseSolid(hold(fuseSolid(base,bare)),sphere)),height,s,'ball'));
    assert.deepEqual(boundaryEdges(data),boundaryEdges(stl(original.mesh({tolerance:.08,angularTolerance:.15}))),'existing mounting-thread boundaries stay unchanged');
    console.log('PASS existing threaded-base STL boundaries unchanged',report.boundary);
   }else assert.equal(report.boundary,0,name+' '+result.analysis.roles[outputIndex]+' STL boundary');
  }
  const feature={kind:'cadop',id:'joint',name:'根元を補強したボール接合',spec:p,...result},history=[src,feature];validateProject({format:'forma-cad',version:1,features:history});
  if(name==='straight'){
   const replay=runOperation(history,{type:'replay',before:history,start:1});assert.equal(replay.features[1].analysis.ballDiameter,result.analysis.ballDiameter);
   await fs.mkdir('.sites-runtime',{recursive:true});await fs.writeFile('.sites-runtime/ball-joint-root-project.json',JSON.stringify({format:'forma-cad',version:1,features:history}));
  }
  console.log('PASS root reinforcement',{name,width:d.width,height:d.height,addedVolume:volume(added)});
 }finally{owned.reverse().forEach(x=>x.delete());}
}
console.log('PASS material added only at the solid root, larger contact section, valid single solids, closed STL on plain bases, unchanged legacy threaded-base boundaries, no joint interference and saved replay');
