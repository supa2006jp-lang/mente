import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';import fs from 'node:fs/promises';import assert from 'node:assert/strict';
import {makeSnapLid} from '../src/snap-lid.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const p={bodyWall:4.2,lidWall:2.4,floor:2.4,insertion:4,clearance:.2,ridge:.4,pose:'assembled',filletInside:true,innerFilletRadius:1};
const lower=R.makeBox([-40,-25,0],[40,25,30]),upper=R.makeBox([-40,-25,30],[40,25,42]);
function material(shape,x,y,z){const box=R.makeBox([x-.01,y-.01,z-.01],[x+.01,y+.01,z+.01]),hit=shape.intersect(box);try{return R.measureVolume(hit);}finally{box.delete();hit.delete();}}
try{for(const radius of [.25,1,3,10])for(const options of [{},{filletOutside:true,outerFilletRadius:1,openingGroove:true,openingWidth:24,openingHeight:3,openingDepth:.8}]){
 const result=makeSnapLid(lower,upper,{...p,...options,innerFilletRadius:radius});try{const r=result.analysis.fillet.innerRadius,x=40-p.bodyWall-r*.12,y=25-p.bodyWall-r*.12;
 for(const z of [20,29.95,30.05,32,33.95])assert.ok(material(result.body,x,y,z)>1e-6,'inner corner must stay rounded through height '+z+' at R'+r);
 assert.ok(result.analysis.overlap<1e-5);console.log('PASS R'+radius+' optional outer/groove='+!!options.filletOutside+': continuous internal corner from body to neck top');
 }finally{result.body.delete();result.lid.delete();}
}}finally{lower.delete();upper.delete();}
