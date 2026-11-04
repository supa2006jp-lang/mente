import test from 'node:test';
import assert from 'node:assert/strict';
import {KernelClient,cancelAutomaticPrecisionPreviews,subscribeKernelActivity} from '../src/kernel-client.js';
import {setPrecisionPreviewAutomatic,setPrecisionPreviewMode,rememberSlowPrecisionPreview,authorizePrecisionPreview,precisionPreviewWaiting,clearPrecisionPreviewRequests} from '../src/precision-preview-mode.js';
import {LegacyDisplayCache,legacyBodyStates,rebuiltBodyRecord} from '../src/legacy-rebuild.js';
import {createLegacyRebuilder} from '../src/legacy-rebuild-client.js';
import {defaults,rebuild,volume,validateProject} from '../src/geometry.js';
import {cadPosition} from '../src/cad-coordinates.js';
import {failureRecord,failureDocument} from '../src/failure-recovery-store.js';
import {MachiningPreviewCache} from '../src/machining-preview-cache.js';

test('manual precision mode authorizes only the latest exact document and settings; commits and analysis remain available',async()=>{
 const workers=[],client=new KernelClient(()=>{const w={postMessage(message){this.last=message;},terminate(){}};workers.push(w);return w;}),document=[],spec={type:'preview',operation:{type:'shell',id:'p',target:'box',thickness:1}};
 const finish=async promise=>{client.worker.onmessage({data:{id:client.active,result:{outputs:[],remove:[]}}});return promise;};
 setPrecisionPreviewAutomatic(false);
 try{
  await assert.rejects(client.run(document,spec),{code:'preview-manual'});assert.equal(workers.length,0);assert.equal(precisionPreviewWaiting(),true);
  const changed={type:'preview',operation:{...spec.operation,thickness:2}};
  await assert.rejects(client.run(document,changed),{code:'preview-manual'});authorizePrecisionPreview();
  await finish(client.run(document,changed));
  await assert.rejects(client.run(document,spec),{code:'preview-manual'});
  authorizePrecisionPreview();await assert.rejects(client.run([...document],spec),{code:'preview-manual'});
  for(const probe of [{type:'sketchRegionAnalysis'},{type:'legacyDisplayRebuild'},{type:'nativeExtrusionProbe'},{type:'meshExtrusionProbe'},spec.operation,{type:'stl'},{type:'preview',operation:{type:'coilTestPiece'}}])await finish(client.run(document,probe));
  await assert.rejects(client.run(document,{type:'revolve',angle:90},{automaticPreview:true}),{code:'preview-manual'});
  assert.equal(client.pending.size,0);
 }finally{client.reset();setPrecisionPreviewAutomatic(true);clearPrecisionPreviewRequests();}
});

test('switching to manual cancels precision jobs without cancelling real modelling or region analysis',async()=>{
 const make=()=>new KernelClient(()=>({postMessage(){},terminate(){}})),preview=make(),commit=make(),analysis=make();
 const p=preview.run([],{type:'revolve'},{automaticPreview:true}),rejected=assert.rejects(p,{code:'cancelled'}),c=commit.run([],{type:'revolve'}),a=analysis.run([],{type:'sketchRegionAnalysis'});
 cancelAutomaticPrecisionPreviews();await rejected;assert.equal(commit.pending.size,1);assert.equal(analysis.pending.size,1);
 for(const client of [commit,analysis])client.worker.onmessage({data:{id:client.active,result:{outputs:[],remove:[]}}});await Promise.all([c,a]);for(const client of [preview,commit,analysis])client.reset();
});

test('legacy reconstruction cache preserves history, display topology and CAD coordinate doubles across undo and unrelated edits',async()=>{
 const first={...defaults,kind:'extrusion',name:'base',id:'box',width:20,height:20,depth:12,x:100.123456789},cut={...first,name:'cut',id:'cut',operation:'cut',target:'box',width:8,height:8,depth:6,z:6},history=[first,cut],saved=JSON.stringify(history),cache=new LegacyDisplayCache(),records=[];
 const exact=rebuild(history,{onLegacyStep:(i,id,body)=>records.push({key:legacyBodyStates(history.slice(0,i+1)).get(id).key,output:rebuiltBodyRecord(id,body)})});
 try{
  assert.throws(()=>cache.augmented(history),{code:'background-rebuild-required'});cache.store(records);
  const augmented=cache.augmented(history);assert.equal(augmented.length,3);assert.equal(history.length,2);assert.equal(JSON.stringify(history),saved);validateProject({format:'forma-cad',version:1,features:history});
  const copied=rebuild(augmented);
  try{assert.deepEqual(Array.from(cadPosition(copied.get('box').geometry).array),Array.from(cadPosition(exact.get('box').geometry).array));assert.equal(volume(copied.get('box').geometry),volume(exact.get('box').geometry));assert.deepEqual(Array.from(copied.get('box').geometry.index.array),Array.from(exact.get('box').geometry.index.array));}finally{for(const body of copied.values())body.geometry.dispose();}
  assert.equal(cache.missing([...history,{...defaults,kind:'sketch',name:'extra',id:'sketch'}]).length,0);
  assert.equal(cache.missing(history.map(f=>({...f,name:'renamed'}))).length,0);
  assert.equal(cache.missing([first]).length,0);assert.equal(cache.missing([first,{...cut,depth:4}]).length,1);
  const canonical={...records[0].output,vertices:[1.1234567890123,2,3,4,5,6,7,8,9],triangles:[0,1,2]};delete canonical.normals;cache.store([{key:records[0].key,output:canonical}]);assert.equal(cache.augmented(history).at(-1).outputs[0].vertices[0],1.1234567890123);
 }finally{for(const body of exact.values())body.geometry.dispose();}
});

test('legacy client deduplicates workers and prepares missing history without storing artificial CAD features',async()=>{
 const history=[{...defaults,kind:'extrusion',name:'base',id:'base',width:10,height:10,depth:10},{...defaults,kind:'extrusion',name:'cut',id:'cut',operation:'cut',target:'base',width:3,height:3,depth:5}],saved=JSON.stringify(history);let calls=0,resolve;const cache=new LegacyDisplayCache(),fake={run(features,spec){calls++;assert.deepEqual(features,[]);assert.equal(spec.type,'legacyDisplayRebuild');return new Promise(r=>resolve=r);},reset(){}};
 const client=createLegacyRebuilder({client:fake,cache}),p=client.prepare(history),q=client.prepare(history);assert.equal(p,q);assert.equal(calls,1);
 const bodies=rebuild(history);try{resolve({records:[{key:legacyBodyStates(history).get('base').key,output:rebuiltBodyRecord('base',bodies.get('base'))}]});await p;await client.prepare(history);assert.equal(calls,1);assert.equal(client.missing(history),false);assert.equal(JSON.stringify(history),saved);}finally{for(const body of bodies.values())body.geometry.dispose();}
});

test('revolve and chamfer reuse exact geometry with protected source IDs, renamed diagnostics, and full dependency invalidation',()=>{
 const cache=new MachiningPreviewCache(),history=[],spec={type:'revolve',id:'preview',sourceBody:'preview-source',target:'base',operation:'cut',angle:90,axisVector:[0,0,1],origin:[0,0,0]},measure={volume:100,solids:1,bounds:[[0,0,0],[10,10,10]]},result={outputs:[{id:'base',brep:'exact',shapeMetrics:measure},{id:'preview-part2',brep:'exact',shapeMetrics:measure},{id:'preview-source',brep:'original',shapeMetrics:measure}],remove:['preview-part3'],analysis:{geometryHealth:{rows:[{id:'preview-part2',after:measure,bounds:measure.bounds}]},bodyIds:['preview-part2','preview-source']}};
 cache.store(history,spec,result);const hit=cache.get(history,{...spec,id:'commit'});assert.deepEqual(hit.outputs.map(o=>o.id),['base','commit-part2','preview-source']);assert.deepEqual(hit.remove,['commit-part3']);assert.deepEqual(hit.analysis.bodyIds,['commit-part2','preview-source']);assert.equal(hit.analysis.geometryHealth.rows[0].id,'commit-part2');assert.equal(result.outputs[1].id,'preview-part2');
 for(const patch of [{angle:180},{operation:'new'},{origin:[1,0,0]},{axisVector:[1,0,0]},{direction:'対称'},{sourceBody:'other'},{target:'other'}])assert.equal(cache.get(history,{...spec,...patch}),null);
 assert.equal(cache.get([...history],spec),null);cache.store(history,{type:'chamfer',id:'preview',distance:1},result);assert.ok(cache.get(history,{type:'chamfer',id:'commit',distance:1}));assert.equal(cache.get(history,{type:'chamfer',id:'commit',distance:2}),null);
 cache.store(history,{type:'coilJoint',id:'preview'},result);assert.equal(cache.get(history,{type:'coilJoint',id:'commit'}),null);
});

test('adaptive mode defers a faceted cut and previously slow operations, while allowing light previews and commits',async()=>{
 const client=new KernelClient(()=>({postMessage(){},terminate(){}}));
 const features=[];
 const outer=Array.from({length:100},(_,i)=>{
  const angle=i*Math.PI/50,radius=i%2?12:17;
  return [radius*Math.cos(angle),radius*Math.sin(angle)];
 });
 const cut={type:'exactExtrusionPreview',features:[{operation:'cut',region:{outer,holes:[]}}]};
 const shell={type:'preview',operation:{type:'shell',target:'base',thickness:1}};
 function complete(promise){
  client.worker.onmessage({data:{id:client.active,result:{outputs:[],remove:[]}}});
  return promise;
 }
 setPrecisionPreviewMode('adaptive');
 try{
  await complete(client.run(features,shell));
  await assert.rejects(client.run(features,cut),{code:'preview-manual'});
  authorizePrecisionPreview();
  await complete(client.run(features,cut));
  await assert.rejects(client.run(features,{...cut,features:[{...cut.features[0],depth:-2}]}),{code:'preview-manual'});
  await complete(client.run(features,{type:'extrusionBatch',features:cut.features}));
  rememberSlowPrecisionPreview(features,shell,4300);
  await assert.rejects(client.run(features,{...shell,operation:{...shell.operation,thickness:2}}),{code:'preview-manual'});
  await complete(client.run([...features],shell));
  await complete(client.run(features,{type:'extrusionToolPreview',feature:cut.features[0]},{foreground:true}));
 }finally{client.reset();setPrecisionPreviewMode('automatic');}
});

test('the active stage survives a worker timeout and export of its failure record',async()=>{
 const client=new KernelClient(()=>({postMessage(){},terminate(){}}));
 let failure;
 const stop=subscribeKernelActivity(event=>{
  if(event.client===client&&event.state==='error')failure=event;
 });
 const spec={type:'preview',operation:{type:'shell',target:'base',thickness:1}};
 const features=[];
 try{
  const result=client.run(features,spec,{timeout:20});
  client.worker.onmessage({data:{id:client.active,progress:{stage:'形状・隙間検査中…'}}});
  await assert.rejects(result,{code:'timeout'});
  assert.equal(failure.calculation.stage,'形状・隙間検査中…');
  assert.ok(failure.calculation.stageElapsedMs>=0);
  const record=failureRecord({features,spec,error:failure.error,calculation:failure.calculation});
  assert.deepEqual(failureDocument(record).failure.calculation,failure.calculation);
 }finally{stop();client.reset();}
});
