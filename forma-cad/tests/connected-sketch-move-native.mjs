import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {defaults} from '../src/geometry.js';
import {basisFor} from '../src/frames.js';
import {findRegions} from '../src/regions.js';
import {pipeSketchPaths} from '../src/pipe-path.js';
import {runOperation,kernelBodies} from '../src/kernel.js';
import {connectedMoveSources,translateConnectedSketch} from '../src/connected-sketch-move.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const dir='outputs/connected-sketch-move/';
function metrics(history,id){const bodies=kernelBodies(history);try{const shape=bodies.get(id),box=shape.boundingBox;try{return {bounds:box.bounds,volume:R.measureVolume(shape)};}finally{box.delete();}}finally{bodies.forEach(s=>s.delete());}}
function moved(before,after,delta){assert(Math.abs(before.volume-after.volume)<Math.max(1e-7,Math.abs(before.volume)*1e-8));for(let i=0;i<2;i++)for(let j=0;j<3;j++)assert(Math.abs(after.bounds[i][j]-before.bounds[i][j]-delta.getComponent(j))<1e-6);}
for(const placement of [{plane:'XY'},{plane:'XZ'},{plane:'CUSTOM',frame:{u:[Math.SQRT1_2,0,-Math.SQRT1_2],v:[0,1,0],n:[Math.SQRT1_2,0,Math.SQRT1_2]}}]){
 const b=basisFor(placement),origin=b.n.clone().multiplyScalar(3),base={...defaults,...placement,kind:'sketch',groupId:'path',groupNumber:1,name:'線',x:origin.x,y:origin.y,z:origin.z};
 const line=(id,a,c)=>{const p=origin.clone().addScaledVector(b.u,(a[0]+c[0])/2).addScaledVector(b.v,(a[1]+c[1])/2);return {...base,id,mode:'thin',profile:'line',width:Math.hypot(c[0]-a[0],c[1]-a[1]),angle:Math.atan2(c[1]-a[1],c[0]-a[0])*180/Math.PI,x:p.x,y:p.y,z:p.z};};
 const sketch=[line('a',[0,0],[20,0]),line('b',[20,0],[20,15]),line('c',[20,15],[0,15]),line('d',[0,15],[0,0])],region=findRegions(sketch)[0],extrusion={...defaults,...placement,id:'solid',name:'押し出し',kind:'extrusion',profile:'region',region,depth:8,x:origin.x,y:origin.y,z:origin.z},history=[...sketch,extrusion],snapshot=JSON.stringify(history),sources=connectedMoveSources(history,{featureId:'a'}),delta=b.u.clone().multiplyScalar(10).addScaledVector(b.v,-5),next=translateConnectedSketch(history,sources,delta),result=runOperation(next,{type:'replay',before:history,start:0});moved(metrics(history,'solid'),metrics(result.features,'solid'),delta);assert.equal(JSON.stringify(history),snapshot);
 if(placement.plane==='XY')await fs.writeFile(dir+'downstream.forma.json',JSON.stringify({format:'forma-cad',version:1,features:history}));
 const paths=[line('left',[-20,0],[0,0]),{...base,id:'curve',profile:'spline',closed:false,points:[[0,0],[10,2],[20,0]],tangents:{start:0,end:0}},line('right',[20,0],[40,0])],path=pipeSketchPaths(paths)[0],spec={type:'pipe',id:'pipe',path:path.id,pathFeature:path,diameter:2,hollow:'中実',operation:'新規ボディ'},created=runOperation(paths,spec),pipeHistory=[...paths,{kind:'cadop',id:'pipe',name:'パイプ',spec,...created}],changed=translateConnectedSketch(pipeHistory,connectedMoveSources(pipeHistory,{featureId:'curve'}),delta),replayed=runOperation(changed,{type:'replay',before:pipeHistory,start:0});moved(metrics(pipeHistory,'pipe'),metrics(replayed.features,'pipe'),delta);
}
const proof={downstreamExtrusion:true,downstreamMixedCurvePipe:true,worldAndTiltedPlanes:true,nativeBoundsTranslatedExactly:true,volumePreserved:true,originalHistoryUnchanged:true};await fs.writeFile(dir+'native-proof.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
