import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {setOC,measureVolume} from 'replicad';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {runOperation,kernelBodies} from '../src/kernel.js';
import {defaults,validateProject} from '../src/geometry.js';
import {findRegions} from '../src/regions.js';
import {mirrorSketchWorkflow} from '../src/mirror-workflow.js';
setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const body={...defaults,id:'b',name:'三角柱',profile:'polyline',points:[[0,0],[12,0],[0,8]],closed:true,mode:'solid',x:20,y:0,z:0,depth:5},source=[body];
const bounds=o=>{const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<o.vertices.length;i++) {const j=i%3;min[j]=Math.min(min[j],o.vertices[i]);max[j]=Math.max(max[j],o.vertices[i]);}return {min,max};};
const baseline=runOperation(source,{type:'move',target:'b',x:0,y:0,z:0,rotation:[0,0,0],pivot:[20,0,0]}).outputs[0],baseBounds=bounds(baseline);
for(const direction of [[30,0,0],[0,30,0],[0,0,30],[18,24,12]])for(const reverseCopy of [false,true]){
 const spec={type:'move',target:'b',id:'copy',copy:true,reverseCopy,x:direction[0],y:direction[1],z:direction[2],rotation:[0,0,30],pivot:[20,0,0]},result=runOperation(source,spec),out=result.outputs[0];assert.equal(out.id,'copy');assert.deepEqual(result.remove,[]);
 const history=[...source,{kind:'cadop',id:'op',name:'複製',spec,...result}],bodies=kernelBodies(history);assert.equal(bodies.size,2);assert.ok(Math.abs(measureVolume(bodies.get('b'))-measureVolume(bodies.get('copy')))<1e-5);assert.deepEqual(bounds(runOperation(history,{type:'move',target:'b',x:0,y:0,z:0,rotation:[0,0,0]}).outputs[0]),baseBounds);
 // Each original mesh vertex must have its rotated, optionally reflected and translated counterpart.
 const angle=Math.PI/6,n=direction.map(v=>v/Math.hypot(...direction));
 for(let i=0;i<baseline.vertices.length;i+=3){let p=[baseline.vertices[i]-20,baseline.vertices[i+1],baseline.vertices[i+2]],rot=[p[0]*Math.cos(angle)-p[1]*Math.sin(angle),p[0]*Math.sin(angle)+p[1]*Math.cos(angle),p[2]];if(reverseCopy){const d=rot.reduce((s,v,j)=>s+v*n[j],0);rot=rot.map((v,j)=>v-2*d*n[j]);}const expected=rot.map((v,j)=>v+direction[j]+(j===0?20:0));assert.ok(out.vertices.some((_,k)=>k%3===0&&Math.hypot(...expected.map((v,j)=>out.vertices[k+j]-v))<1e-5));}
 validateProject(JSON.parse(JSON.stringify({format:'forma-cad',version:1,features:history})));
 const replay=runOperation(history,{type:'replay',before:history,start:1});assert.equal(kernelBodies(replay.features).size,2);
}
const normal=runOperation(source,{type:'move',target:'b',x:10,y:0,z:0,rotation:[0,0,0]});assert.equal(normal.outputs[0].id,'b');
assert.throws(()=>runOperation(source,{type:'move',target:'b',id:'copy',copy:true,reverseCopy:true,x:0,y:0,z:0,rotation:[0,0,0]}),/方向/);
for(const mirrorMode of ['コピー','反転移動']){const result=runOperation(source,{type:'mirror',target:'b',id:'mirror',plane:'YZ',offset:0,mirrorMode});assert.equal(result.outputs[0].id,mirrorMode==='コピー'?'mirror':'b');assert.equal(kernelBodies([...source,{kind:'cadop',id:'op',...result}]).size,mirrorMode==='コピー'?2:1);}
const sketch={...defaults,id:'sketch',kind:'sketch',name:'元の輪郭',width:12,height:8,x:24},region=findRegions([sketch])[0],extrusion={...defaults,id:'extrusion',name:'押し出し',kind:'extrusion',profile:'region',region,depth:5},history=[sketch,extrusion];
for(const selection of [null,new Map([['sketch',new Set([0,1,2,3])]])]){
 const workflow=mirrorSketchWorkflow(history,[sketch],{plane:'V'},{move:true,selection});assert.equal(workflow.features[0].id,'sketch');assert.equal(workflow.features[1].id,'extrusion');
 const replay=runOperation(workflow.features,{type:'replay',before:history,start:0});assert.equal(replay.features[1].region.sourceIds[0],'sketch');assert.ok(replay.features[1].region.outer.every(p=>p[0]<0));assert.equal(kernelBodies(replay.features).size,1);
}
console.log('PASS duplicate move: unchanged source, rotations, directional mirror X/Y/diagonal, volumes, persistence/replay, mirror replacement and downstream extrusion replay');
