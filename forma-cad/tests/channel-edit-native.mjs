import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {defaults} from '../src/geometry.js';
import {channelSketch,channelParameters} from '../src/channel-sketch.js';
import {pipeSketchPaths} from '../src/pipe-path.js';
import {findRegions} from '../src/regions.js';
import {runOperation,kernelBodies} from '../src/kernel.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const dir='outputs/channel-edit/',f=channelSketch({...defaults,id:'u',kind:'sketch',name:'コの字',groupId:'g',groupNumber:1,width:40,height:30},'left'),path=pipeSketchPaths([f])[0],spec={type:'pipe',id:'pipe',path:path.id,pathFeature:path,diameter:2,hollow:'中実',operation:'新規ボディ'},history=[f,{kind:'cadop',id:'pipe',name:'パイプ',spec,...runOperation([f],spec)}],snapshot=JSON.stringify(history);
function metric(features){const bodies=kernelBodies(features);try{const s=bodies.get('pipe'),box=s.boundingBox,check=new (R.getOC().BRepCheck_Analyzer)(s.wrapped,true,false);try{assert.ok(check.IsValid());return {volume:R.measureVolume(s),bounds:box.bounds};}finally{box.delete();check.delete();}}finally{bodies.forEach(s=>s.delete());}}
for(const opening of ['left','right','up','down']){const params=channelParameters(f),edited=channelSketch({...f,...params,width:55,height:25},opening,params.reversed),proposed=[edited,history[1]],result=runOperation(proposed,{type:'replay',before:history,start:0}).features,nextPath=pipeSketchPaths([edited])[0],nextSpec={...spec,path:nextPath.id,pathFeature:nextPath},fresh=[edited,{kind:'cadop',id:'pipe',name:'パイプ',spec:nextSpec,...runOperation([edited],nextSpec)}],actual=metric(result),expected=metric(fresh);assert.ok(Math.abs(actual.volume-expected.volume)<1e-6);actual.bounds.flat().forEach((v,i)=>assert.ok(Math.abs(v-expected.bounds.flat()[i])<1e-6));}
const closing={...f,id:'end',name:'閉じる線',points:[f.points.at(-1),f.points[0]]},region=findRegions([f,closing])[0],extrusion={...defaults,id:'solid',name:'押し出し',kind:'extrusion',profile:'region',region,depth:3},closedHistory=[f,closing,extrusion],closedSnapshot=JSON.stringify(closedHistory),changed=channelSketch({...f,...channelParameters(f),width:20},'left');assert.throws(()=>runOperation([changed,closing,extrusion],{type:'replay',before:closedHistory,start:0}),/接続|輪郭/);assert.equal(JSON.stringify(closedHistory),closedSnapshot);assert.equal(JSON.stringify(history),snapshot);
await fs.mkdir(dir,{recursive:true});await fs.writeFile(dir+'native-proof.json',JSON.stringify({dependentPipeReplay:true,allOpenings:true,exactBoundsAndVolume:true,validSolids:true,brokenConnectionRejected:true,originalHistoryPreserved:true,errors:[]},null,2));console.log('PASS channel edit native pipe replay, exact bounds/volume, valid solids, broken dependent contour rejected atomically');
