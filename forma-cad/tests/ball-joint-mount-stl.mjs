import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as R from 'replicad';
import * as THREE from 'three';
import {STLExporter} from 'three/addons/exporters/STLExporter.js';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {ballJointMountBase} from '../src/ball-joint-mount.js';
import {ballJointDefaults} from '../src/ball-joint-settings.js';
import {runOperation} from '../src/kernel.js';
import {defaults} from '../src/geometry.js';
import {cleanBinaryStl} from '../src/clean-stl.js';
import {binaryStlReport} from './stl-topology.mjs';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
function closed(o,label){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(o.vertices,3));g.setIndex(o.triangles);const m=new THREE.Mesh(g);m.updateMatrixWorld(true);try{const report=binaryStlReport(cleanBinaryStl(new STLExporter().parse(m,{binary:true})));for(const k of ['degenerate','boundary','nonmanifold','orientation'])assert.equal(report[k],0,label+' '+k);assert.ok(report.volume>0);}finally{g.dispose();m.material.dispose();}}
for(const [radius,pitch,length,height,clearance] of [[12,1.5,4,9.7,.15],[12,3,6.2,10,.15],[20,2,6,10,.15],[5,.5,2,4,.15],[12,.25,1,3,.6]])for(const role of ['ball','socket']){
 const shape=ballJointMountBase(radius,height,{mountThread:true,mountSide:'both',mountPitch:pitch,mountLength:length,mountClearance:clearance},role);
 try{closed(shape.mesh({tolerance:.08,angularTolerance:.15}),role+' pitch '+pitch);const box=shape.boundingBox;try{assert.ok(Math.abs(box.bounds[0][2])<1e-5);assert.ok(Math.abs(box.bounds[1][2]-height)<1e-5);}finally{box.delete();}
 // Regression: eliminating the tangent ledge changes tessellation, not the solid volume.
 if(radius===12&&pitch===1.5&&role==='ball')assert.ok(Math.abs(R.measureVolume(shape)-4203.186419473875)<1e-5);
 }finally{shape.delete();}
 console.log('PASS closed mounting-thread STL',role,radius*2,pitch);
}
const source={...defaults,id:'c',kind:'extrusion',name:'円柱',profile:'circle',diameter:24,depth:40};
const info={radius:12,height:40},spec={...ballJointDefaults(info),type:'ballJoint',target:'c',id:'joint',pose:'print',neckBend:true,neckExtension:15,neckBendDirection:45,mountThread:true,mountSide:'ball',mountPitch:1.5,mountLength:4,fixHole:true,fixSide:'ball',fixBallDiameter:4,fixBallPitch:.7,fixBallDepth:4};
const result=runOperation([source],spec);for(const [i,o]of result.outputs.entries())closed(o,result.analysis.roles[i]);assert.ok(result.analysis.overlap.every(v=>v<1e-5));
await fs.mkdir('.sites-runtime',{recursive:true});await fs.writeFile('.sites-runtime/joint-mount-stl-project.json',JSON.stringify({format:'forma-cad',version:1,features:[source,{kind:'cadop',id:'joint',name:'ねじ付き45°ボール接合',spec,...result}]}));
console.log('PASS individually exported ball, socket and nut: closed STL with bent reinforced rod, mounting thread, fixing hole and print placement');
