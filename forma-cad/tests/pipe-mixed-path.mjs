import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {defaults,validateProject} from '../src/geometry.js';
import {basisFor} from '../src/frames.js';
import {pipeSketchPaths,pipePathIncludes,refreshPipePath,pipeWorldPoints} from '../src/pipe-path.js';
import {makePipe} from '../src/pipe.js';
import {runOperation} from '../src/kernel.js';
import {historyImpact} from '../src/history-impact.js';
import {replayHistory} from '../src/history-replay.js';

const basisCases=[{plane:'XY'},{plane:'XZ'},{plane:'YZ'},{plane:'CUSTOM',frame:{u:[Math.SQRT1_2,0,-Math.SQRT1_2],v:[0,1,0],n:[Math.SQRT1_2,0,Math.SQRT1_2]}}];
function fixture(placement={plane:'XY'}){
 const b=basisFor(placement),origin=b.n.clone().multiplyScalar(7),base={...defaults,...placement,kind:'sketch',name:'スケッチ',groupId:'mixed',groupNumber:1,x:origin.x,y:origin.y,z:origin.z};
 const line=(id,a,z)=>{const center=origin.clone().addScaledVector(b.u,(a[0]+z[0])/2).addScaledVector(b.v,(a[1]+z[1])/2);return {...base,id,profile:'line',mode:'thin',width:Math.hypot(z[0]-a[0],z[1]-a[1]),angle:Math.atan2(z[1]-a[1],z[0]-a[0])*180/Math.PI,x:center.x,y:center.y,z:center.z};};
 const curve={...base,id:'curve',profile:'spline',closed:false,points:[[0,0],[10,2],[20,0]],tangents:{start:0,end:0}};
 // Deliberately shuffled and reversed: creation order is not traversal order.
 return {base,line,curve,features:[line('right',[40,0],[20,0]),curve,line('left',[-20,0],[0,0])]};
}
for(const placement of basisCases){
 const {features,line,base}=fixture(placement),snapshot=JSON.stringify(features),paths=pipeSketchPaths(features);
 assert.equal(paths.length,1);const path=paths[0];assert.equal(path.pathSegments.length,3);assert.equal(path.closed,false);
 assert.deepEqual(path.pathSegments.map(s=>s.feature.id),['right','curve','left']);assert.deepEqual(path.pathSegments.map(s=>s.reverse),[false,true,true]);
 for(const feature of features)assert.ok(pipePathIncludes(path,feature.id));
 assert.equal(JSON.stringify(features),snapshot,'source splines and tangent settings are not modified');
 const distant=line('distant',[60,0],[70,0]),otherGroup={...line('other',[40,0],[50,0]),groupId:'other'},otherPlane={...line('off-plane',[40,0],[50,0])};otherPlane.x+=basisFor(base).n.x;otherPlane.y+=basisFor(base).n.y;otherPlane.z+=basisFor(base).n.z;
 assert.equal(pipeSketchPaths([...features,distant,otherGroup,otherPlane]).length,4);
 const gap=line('gap',[40.0001,0],[50,0]);assert.equal(pipeSketchPaths([...features,gap]).length,2,'real gaps are not bridged');
 const branch=pipeSketchPaths([...features,line('branch',[20,0],[20,10])])[0];assert.match(branch.pathError,/分岐/);assert.throws(()=>makePipe(branch,2),/分岐/);
 const closed=pipeSketchPaths([line('a',[0,0],[30,0]),line('c',[30,30],[0,0]),line('b',[30,0],[30,30])])[0];assert.equal(closed.closed,true);assert.equal(closed.pathSegments.length,3);
 const spec={type:'pipe',id:'pipe',path:path.id,pathFeature:path,diameter:2,hollow:'中実',operation:'新規ボディ'};
 const history=[...features,{kind:'cadop',id:'pipe',name:'パイプ',spec,outputs:[],remove:[]}];
 const loaded=validateProject(JSON.parse(JSON.stringify({format:'forma-cad',version:1,features:history})));
 assert.deepEqual(loaded.at(-1).spec.pathFeature.sourceIds,path.sourceIds);
 for(const feature of features)assert.equal(historyImpact(history,feature.id).affected,1,'all member sketches track their pipe dependency');
 const edited=structuredClone(features);edited[1].points[1][1]=4;
 const refreshed=refreshPipePath(edited,spec);assert.equal(refreshed.pathSegments.find(s=>s.feature.id==='curve').feature.points[1][1],4);
 let replayed;
 replayHistory(history,[...edited,history.at(-1)],1,(prefix,next)=>{replayed=next.pathFeature;return {outputs:[],remove:[]};});
 assert.equal(replayed.pathSegments.find(s=>s.feature.id==='curve').feature.points[1][1],4,'history replay refreshes every path member');
 assert.throws(()=>refreshPipePath(edited.slice(1),spec),/見つかりません/);
 const broken=structuredClone(edited);broken[1].points[0][0]+=1;assert.throws(()=>refreshPipePath(broken,spec),/接続が切れ/);
 const standalone=features[1];assert.deepEqual(refreshPipePath(features,{path:standalone.id,pathFeature:standalone}),standalone,'old one-element pipe specs retain their path');
}
{
 const {features}=fixture(),app=await fs.readFile('src/app.js','utf8'),source=app.match(/function pipeSketchSources\(\)\{[^\n]+\}/)[0];
 const sources=(items,spec)=>vm.runInNewContext('('+source+')()',{features:spec?[...items,{id:'edit-pipe',spec}]:items,editingPipeId:spec?'edit-pipe':null,pipeSketchPaths,pipePathIncludes});
 assert.equal(sources(features)[0].pathSegments.length,3,'the real UI offers a single mixed path');
 const legacy={path:'curve',pathFeature:features[1]};assert.equal(sources(features,legacy)[0].id,'curve');assert.equal(sources(features,legacy)[0].pathSegments,undefined,'reopening a legacy pipe does not silently extend it');
 const path=pipeSketchPaths(features)[0];assert.equal(sources(features,{path:path.id,pathFeature:path})[0].pathSegments.length,3);
}
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const check=shape=>{const analyzer=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);try{assert.ok(analyzer.IsValid());assert.equal(shape.solids.length,1);}finally{analyzer.delete();}};
for(const placement of basisCases){
 const {features}=fixture(placement),path=pipeSketchPaths(features)[0];
 for(const wall of [0,.4]){const shape=makePipe(path,2,wall);try{check(shape);assert.ok(R.measureVolume(shape)>(wall?100:180),'the pipe includes both straight extensions, not just the spline');}finally{shape.delete();}}
}
{
 const {base,line}=fixture(),arc={...base,id:'closed-arc',profile:'polyline',arc:{},points:Array.from({length:65},(_,i)=>[20*Math.sin(i*Math.PI/64),20-20*Math.cos(i*Math.PI/64)]),closed:false};
 const left={...arc,id:'left-arc',points:Array.from({length:65},(_,i)=>[-40-20*Math.sin(i*Math.PI/64),20+20*Math.cos(i*Math.PI/64)])};
 const path=pipeSketchPaths([arc,line('top',[0,40],[-40,40]),left,line('bottom',[-40,0],[0,0])])[0];assert.equal(path.closed,true);
 for(const wall of [0,.4]){const shape=makePipe(path,2,wall);try{check(shape);assert.ok(R.measureVolume(shape)>100);}finally{shape.delete();}}
}
const {base,line}=fixture(),arc={...base,id:'arc',profile:'polyline',arc:{},points:Array.from({length:33},(_,i)=>[20*Math.sin(i*Math.PI/64),20-20*Math.cos(i*Math.PI/64)]),closed:false};
const arcPath=pipeSketchPaths([line('start',[-20,0],[0,0]),arc,line('end',[20,40],[20,20])])[0];
assert.equal(arcPath.pathSegments.length,3);
for(const wall of [0,.4]){const shape=makePipe(arcPath,2,wall);try{check(shape);const expected=Math.PI*(1-(wall?.36:0))*(40+Math.PI*10);assert.ok(Math.abs(R.measureVolume(shape)-expected)<.01);}finally{shape.delete();}}
{
 const {features}=fixture(),path=pipeSketchPaths(features)[0],spec={type:'pipe',id:'native-pipe',path:path.id,pathFeature:path,diameter:2,hollow:'中空',wall:.4,operation:'新規ボディ'},result=runOperation(features,spec);
 assert.equal(result.outputs.length,1);const shape=R.deserializeShape(result.outputs[0].brep).asShape3D();check(shape);shape.delete();
 const history=[...features,{kind:'cadop',id:spec.id,name:'パイプ',spec,...result}],loaded=validateProject(JSON.parse(JSON.stringify({format:'forma-cad',version:1,features:history}))),edited=structuredClone(loaded);edited[1].points[1][1]=4;
 const replay=runOperation(edited,{type:'replay',before:loaded,start:1}).features;
 assert.equal(replay.at(-1).spec.pathFeature.pathSegments.find(s=>s.feature.id==='curve').feature.points[1][1],4);
 const after=R.deserializeShape(replay.at(-1).outputs[0].brep).asShape3D();check(after);after.delete();
 await fs.writeFile('.sites-runtime/pipe-mixed-fixture.json',JSON.stringify({format:'forma-cad',version:1,features}));
}
console.log('PASS connected and reversed line/spline/arc paths, all workplanes, separate groups/gaps, branch errors, solid/hollow CAD sweeps, save/load and member edits/history');
