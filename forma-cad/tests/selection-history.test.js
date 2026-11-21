import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {defaults,validateProject} from '../src/geometry.js';
import {findRegions} from '../src/regions.js';
import {kernelBodies,runOperation} from '../src/kernel.js';
import {planNamedDimensionChange} from '../src/named-dimensions.js';
import {validateSelectionTemplate} from '../src/selection-template.js';

R.setOC(await init({wasmBinary:await readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
function savedExtrusion(features,spec){
 return {...spec,cadResult:runOperation(features,{type:'extrusion',target:spec.target,feature:spec})};
}
function exportPart(features,targets,options={}){
 return runOperation(features,{type:'selectionTemplateExport',name:'ブラケット',includeHistory:true,targets:targets.map(id=>({id,name:id})),...options});
}
function bodiesOf(features,callback){
 const bodies=kernelBodies(features);
 try{return callback(bodies);}
 finally{bodies.forEach(body=>body.delete());}
}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,a+' != '+b);
const sketch={...defaults,id:'sketch',name:'板の外形',kind:'sketch',groupId:'group-1',groupNumber:1,
 width:24,height:20,x:13,y:4,z:2,dimensionLinks:{width:'板幅'}};
const extrusion={...defaults,id:'part',name:'押し出し',kind:'extrusion',profile:'region',
 region:findRegions([sketch])[0],sourceSketchIds:['sketch'],depth:8,z:2};
const hole={...defaults,id:'hole',name:'穴あけ',kind:'extrusion',target:'part',operation:'cut',
 profile:'circle',diameter:4,depth:8,x:13,y:4,z:2,dimensionLinks:{diameter:'穴径'}};
const stray={...defaults,id:'stray',name:'他の部品',kind:'extrusion',x:-50,depth:6};

test('a library part keeps its linked sketch and hole editable after independent placements',()=>{
 const stock=savedExtrusion([sketch],extrusion),bore=savedExtrusion([sketch,stock],hole);
 const source=[stray,sketch,stock,bore],snapshot=JSON.stringify(source);
 const variables={板幅:24,穴径:4,不要:19},part=exportPart(source,['part'],{namedDimensions:variables});
 assert.deepEqual(part.history.features.map(f=>f.id),['sketch','part','hole']);
 assert.deepEqual(part.history.namedDimensions,{板幅:24,穴径:4});
 assert.equal(JSON.stringify(source),snapshot);
 const data=validateSelectionTemplate(JSON.parse(JSON.stringify(part)));
 const preview=runOperation([],{type:'selectionTemplateImport',id:'preview',data,previewOnly:true});
 assert.equal(preview.features.length,1);
 assert.equal(preview.features[0].spec,undefined);
 const host={板幅:88,穴径:9},first=runOperation([],{type:'selectionTemplateImport',id:'first',data,position:[70,40,4],namedDimensions:host});
 const second=runOperation([],{type:'selectionTemplateImport',id:'second',data,position:[145,40,4],namedDimensions:first.namedDimensions});
 assert.equal(first.features.length,4);
 assert.equal(first.features[0].groupHidden,true);
 assert.notEqual(first.features[0].groupId,second.features[0].groupId);
 assert.deepEqual({...second.namedDimensions},{...host,板幅_2:24,穴径_2:4,板幅_3:24,穴径_3:4});
 assert.deepEqual(first.features[0].dimensionLinks,{width:'板幅_2'});
 assert.deepEqual(first.features[2].dimensionLinks,{diameter:'穴径_2'});
 const combined=[stray,...first.features,...second.features];
 validateProject({format:'forma-cad',version:1,features:combined});
 const firstId=first.features.at(-1).spec.target,secondId=second.features.at(-1).spec.target;
 const before=24*20*8-Math.PI*2**2*8;
 bodiesOf(combined,bodies=>{
  assert.equal(bodies.size,3);
  near(R.measureVolume(bodies.get(firstId)),before);
  const box=bodies.get(firstId).boundingBox;
  try{box.bounds[0].forEach((n,axis)=>near(n,[58,30,4][axis]));}
  finally{box.delete();}
 });
 const change=planNamedDimensionChange(combined,second.namedDimensions,{...second.namedDimensions,板幅_2:28,穴径_2:6});
 const replay=runOperation(change.next,{type:'replay',before:combined,start:change.start}).features;
 bodiesOf(replay,bodies=>{
  near(R.measureVolume(bodies.get(firstId)),28*20*8-Math.PI*3**2*8);
  near(R.measureVolume(bodies.get(secondId)),before);
  near(R.measureVolume(bodies.get('stray')),60*40*6);
 });
});

test('kept cutting tools remain in the replay history and are removed from the imported final bodies',()=>{
 const raw={...defaults,id:'base',name:'平板',kind:'extrusion',width:20,height:20,depth:10};
 const tool={...defaults,id:'cutter',name:'抜き形状',kind:'extrusion',profile:'circle',diameter:6,depth:12,z:-1};
 const spec={type:'join',id:'cut',target:'base',others:['cutter'],combineMode:'切り取り',keepTools:'保持'};
 const result=runOperation([raw,tool],spec);
 const features=[raw,tool,{kind:'cadop',id:spec.id,name:'切り取り',spec,...result}];
 const part=exportPart(features,['base']);
 assert.deepEqual(part.history.features.map(f=>f.id),['base','cutter','cut']);
 const pasted=runOperation([],{type:'selectionTemplateImport',id:'pasted',data:part}).features;
 assert.equal(pasted.at(-1).remove.length,1);
 bodiesOf(pasted,bodies=>{
  assert.equal(bodies.size,1);
  near(R.measureVolume([...bodies.values()][0]),4000-90*Math.PI);
 });
 const corrupt={...part,history:{...part.history,features:[stray,...part.history.features]}};
 assert.throws(()=>runOperation([],{type:'selectionTemplateImport',id:'invalid',data:corrupt}),/関係しない工程/);
});
