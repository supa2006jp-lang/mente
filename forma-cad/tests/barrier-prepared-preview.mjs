import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import {defaults,validateProject} from '../src/geometry.js';
import {runOperation} from '../src/kernel.js';
import {clearBodyCache} from '../src/body-cache.js';
import {ExtrusionPreviewCache} from '../src/extrusion-preview-cache.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const seed=(id,shape)=>{try{return {id,kind:'cadop',name:id,outputs:[{id,...shape.mesh(),brep:shape.serialize()}],remove:[]};}finally{shape.delete();}};
const source=seed('source',R.makeBox([-10,-10,-3],[10,10,0])),obstacle=seed('obstacle',R.makeCylinder(3,6,[0,0,8]));
const history=[source,obstacle],snapshot=JSON.stringify(history),cache=new ExtrusionPreviewCache();
const feature={...defaults,id:'barrier',name:'バリア押し出し',kind:'extrusion',width:20,height:20,depth:25,barrier:true,barrierGap:.6};
const savedShape=output=>R.deserializeShape(output.brep).asShape3D();
const blocker=savedShape(obstacle.outputs[0]);
for(const showGap of [false,true])for(const operation of ['new','join']){
 clearBodyCache();const stages=[],f={...feature,operation,target:'source'};
 const ready=runOperation(history,{type:'barrierPreparedPreview',features:[f],showBarrierGap:showGap},p=>stages.push(p.stage));
 assert.equal(ready.features.length,1);assert.equal(ready.previews.length,1);
 const preview=ready.previews[0],result=ready.features[0].cadResult;
 assert.ok(preview.outputs[0].triangles.length);assert.equal(!!preview.barrierClearance?.length,showGap);
 assert.equal(stages.includes('すき間の色表示を作成しています'),showGap,'disabled overlay must skip the display boolean');
 assert.ok(stages.includes('障害物とのすき間を検査しています'),'both modes still validate clearance');
 assert.equal(result.barrierClearance,undefined);assert.equal(result.previews,undefined);
 if(operation==='new'){assert.equal(preview.outputs[0].vertices,result.outputs[0].vertices,'reuse the emitted mesh in the same worker result');assert.equal(preview.outputs[0].triangles,result.outputs[0].triangles);}
 const shape=savedShape(result.outputs[0]);
 try{const check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);try{assert.ok(check.IsValid());}finally{check.delete();}assert.ok(Math.abs(R.measureDistanceBetween(shape,blocker)-.6)<1e-5);}finally{shape.delete();}
 cache.store(history,[f],ready.features,null,{showGap,previews:ready.previews});
 const read=cache.getPreview(history,[{...f,id:'actual'}],null,showGap);assert.ok(read);assert.equal(read.previews[0].outputs[0].id,'actual');
 assert.equal(cache.get(history,[{...f,id:'actual'}]).features[0].cadResult.outputs[0].brep,result.outputs[0].brep);
 validateProject({format:'forma-cad',version:1,features:[...history,...read.features]});
}
assert.throws(()=>runOperation(history,{type:'barrierPreparedPreview',features:[{...feature,operation:'cut',target:'source'}]}),/新規ボディ・結合/);
// Multiple regions are evaluated sequentially against the prepared predecessors.
const a={...feature,id:'a',x:-6,width:8,target:'source',operation:'join'},b={...a,id:'b',x:6};
const batch=runOperation(history,{type:'barrierPreparedPreview',features:[a,b],showBarrierGap:false});
assert.equal(batch.features.length,2);assert.equal(batch.previews.length,2);validateProject({format:'forma-cad',version:1,features:[...history,...batch.features]});
assert.throws(()=>runOperation(history,{type:'barrierPreparedPreview',features:[{...feature,barrierGap:30}]}));
// Keep helical thread geometry and exact clearance when the colour is disabled.
const cylinder={...defaults,id:'bolt',name:'M10 円柱',profile:'circle',diameter:10,depth:5};
const threadSpec={type:'thread',target:'bolt',profile:'metric60',threadVersion:2,pitch:1.5,fullLength:true,surfacePoint:[5,0,3]};
const threadedHistory=[cylinder,{kind:'cadop',id:'thread',name:'M10ねじ',spec:threadSpec,...runOperation([cylinder],threadSpec)}],threadSnapshot=JSON.stringify(threadedHistory),male=savedShape(threadedHistory.at(-1).outputs[0]);
try{
 const f={...feature,id:'female',depth:5,barrierGap:.8},stages=[];
 const prepared=runOperation(threadedHistory,{type:'barrierPreparedPreview',features:[f],showBarrierGap:false},p=>stages.push(p.stage));
 const female=savedShape(prepared.features[0].cadResult.outputs[0]);
 try{assert.ok(Math.abs(R.measureDistanceBetween(female,male)-.8)<.003);const faces=female.faces;try{assert.ok(faces.some(face=>face.geomType==='BSPLINE_SURFACE'));}finally{faces.forEach(face=>face.delete());}}finally{female.delete();}
 assert.ok(!stages.includes('すき間の色表示を作成しています'));assert.equal(prepared.previews[0].barrierClearance,undefined);assert.ok(prepared.previews[0].barrierThreadProfiles.length);assert.equal(JSON.stringify(threadedHistory),threadSnapshot);
}finally{male.delete();}
assert.equal(JSON.stringify(history),snapshot);blocker.delete();clearBodyCache();
console.log('PASS unified new/join/batch preparation, shared mesh, exact gaps, overlay-off skips only display, cached exact BREP, saved schema and unchanged source');
