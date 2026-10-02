import assert from 'node:assert/strict';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';import {setOC} from 'replicad';import fs from 'node:fs/promises';import * as THREE from 'three';import {runOperation} from '../src/kernel.js';import {defaults,rebuild} from '../src/geometry.js';
setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
for(const radius of [10,15,30]){const pitch=8,wire=3,turns=3,b={...defaults,id:'b',profile:'circle',diameter:radius*2,depth:40},r=runOperation([b],{type:'coil',target:'b',rim:{center:[0,0,40],radius},wire,pitch,turns}),g=rebuild([b,{kind:'cadop',id:'coil',...r}]).get('b').geometry,m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));m.updateMatrixWorld(true);let misses=[];
for(const side of [-1,1])for(let i=2;i<358;i++){const t=i/120,a=-2*Math.PI*t,dir=new THREE.Vector3(Math.cos(a),Math.sin(a),0),z=40-(wire/2+pitch*t+side*wire*.25),ray=new THREE.Raycaster(dir.clone().multiplyScalar(radius+wire*2).setZ(z),dir.clone().negate()),hit=ray.intersectObject(m)[0];if(!hit||Math.hypot(hit.point.x,hit.point.y)<radius+wire*.2)misses.push(i);}
assert.equal(misses.length,0,'Continuous upper/lower coil surface at radius '+radius);console.log('PASS continuous coil surface, radius',radius);}

