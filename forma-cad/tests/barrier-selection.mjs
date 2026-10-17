import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import {defaults,validateFeature,validateProject} from '../src/geometry.js';
import {runOperation,kernelBodies} from '../src/kernel.js';
import {cylindricalInteriors} from '../src/barrier-parts.js';
import {clearBodyCache} from '../src/body-cache.js';
import {barrierExtrusion} from '../src/extrusion-barrier.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-4,`${a} != ${b}`);
const seed=(id,shape)=>({id,kind:'cadop',name:id,outputs:[{id,...shape.mesh(),brep:shape.serialize()}],remove:[]});
const decode=output=>R.deserializeShape(output.brep).asShape3D();
function valid(shape){const check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);try{assert.ok(check.IsValid());}finally{check.delete();}}
const feature={...defaults,kind:'extrusion',id:'e',name:'バリア選択',width:30,height:30,depth:10,barrier:true,barrierGap:.6};
const wall=R.makeBox([-1,-20,-2],[1,20,12]),other=R.makeCylinder(2,14,[8,0,-2]),wallFeature=seed('wall',wall),otherFeature=seed('other',other),history=[wallFeature,otherFeature],snapshot=JSON.stringify(history);
const preview=f=>runOperation(history,{type:'barrierPreparedPreview',features:[{...feature,...f}],showBarrierGap:false});
const all=preview({}),none=preview({barrierBodies:[]}),one=preview({barrierBodies:['wall']});
for(const [result,volume] of [[none,9000],[one,8040]]){const shape=decode(result.features[0].cadResult.outputs[0]);try{valid(shape);near(R.measureVolume(shape),volume);}finally{shape.delete();}}
assert.equal(all.previews[0].barrierFragments.length,2);assert.equal(one.previews[0].outputs.length,2);
const parts=one.previews[0].barrierFragments,keys=[parts[1].key];
const chosen=preview({barrierBodies:['wall'],barrierFragments:{profile:keys}}),shape=decode(chosen.features[0].cadResult.outputs[0]);
try{valid(shape);near(R.measureVolume(shape),4020);near(R.measureDistanceBetween(shape,wall),.6);assert.equal(shape.solids.length,1);}finally{shape.delete();}
assert.deepEqual(chosen.previews[0].barrierFragments.map(p=>p.selected),[false,true]);
const fullTool=R.makeBox([-15,-15,0],[15,15,10]),anchorBodies=new Map([['wall',wall],['other',other]]);
for(const [targets,expected] of [[['wall'],9000-Math.PI*2.6**2*10],[['wall','other'],9000]]){
 const kept=barrierExtrusion(fullTool,anchorBodies,{...feature,operation:'join',target:'wall',targetBodies:targets},undefined,{cacheKey:'same-base-and-anchor'});try{near(R.measureVolume(kept),expected);}finally{kept.delete();}
}fullTool.delete();
assert.throws(()=>preview({barrierFragments:{profile:['missing']}}),/塊が変わりました/);
assert.throws(()=>preview({barrierBodies:['missing']}),/ボディがなくなりました/);
const source=seed('source',R.makeBox([-15,-15,-3],[15,15,0]));
const sourceRegion={id:'source-top',plane:'XY',offset:0,outer:[[-15,-15],[15,-15],[15,15],[-15,15]],holes:[],area:900,sourceIds:[],bodyId:'source'};
const joined=runOperation([source,wallFeature],{type:'extrusion',target:'source',feature:{...feature,operation:'join',target:'source',profile:'region',region:sourceRegion,barrierBodies:['source','wall']}}),joint=decode(joined.outputs[0]);try{valid(joint);near(R.measureVolume(joint),10740);}finally{joint.delete();}
const outer=R.makeCylinder(8,10),inner=R.makeCylinder(4,10),tube=outer.cut(inner),tubeFeature=seed('中空円柱',tube),tubeHistory=[tubeFeature];
const bores=cylindricalInteriors([tube]);assert.equal(bores.length,1);near(R.measureVolume(bores[0]),Math.PI*16*10);bores.forEach(b=>b.delete());
const volumes={};
for(const side of ['both','inside','outside']){
 const f={...feature,barrierBodies:['中空円柱'],barrierSide:side},result=runOperation(tubeHistory,{type:'barrierPreparedPreview',features:[f],showBarrierGap:false}),body=decode(result.features[0].cadResult.outputs[0]);
 try{valid(body);volumes[side]=R.measureVolume(body);near(R.measureDistanceBetween(body,tube),.6);if(side==='inside')near(volumes[side],Math.PI*3.4**2*10);}
 finally{body.delete();}
 validateProject({format:'forma-cad',version:1,features:[...tubeHistory,...result.features]});
 if(side!=='both'){
  const colored=runOperation(tubeHistory,{type:'barrierPreparedPreview',features:[f],showBarrierGap:true}),vertices=colored.previews[0].barrierClearance[0].vertices;
  for(let i=0;i<vertices.length;i+=3){const radius=Math.hypot(vertices[i],vertices[i+1]);assert.ok(side==='inside'?radius<=4.00001:radius>=7.99999,'clearance overlay follows the chosen side');}
 }
 const saved=JSON.parse(JSON.stringify([...tubeHistory,...result.features])),replayed=runOperation(saved,{type:'replay',before:saved,start:1,refreshStart:true}).features,again=decode(replayed[1].cadResult.outputs[0]);try{near(R.measureVolume(again),volumes[side]);}finally{again.delete();}
}
near(volumes.both,volumes.inside+volumes.outside);
// Rotated inner walls, and a blind cylindrical pocket both have finite interiors.
const rotated=tube.rotate(37,[0,0,0],[1,0,0]),blindTool=R.makeCylinder(4,8,[0,0,2]),blind=outer.cut(blindTool);
for(const body of [rotated,blind]){const spaces=cylindricalInteriors([body]);assert.equal(spaces.length,1);spaces.forEach(s=>s.delete());}
const tiltedTool=R.makeBox([-15,-15,0],[15,15,10]).rotate(37,[0,0,0],[1,0,0]),tiltedInside=barrierExtrusion(tiltedTool,new Map([['tilted',rotated]]),{...feature,barrierBodies:['tilted'],barrierSide:'inside'});
try{valid(tiltedInside);near(R.measureVolume(tiltedInside),volumes.inside);near(R.measureDistanceBetween(tiltedInside,rotated),.6);}finally{tiltedInside.delete();tiltedTool.delete();}
assert.throws(()=>preview({barrierSide:'inside'}),/内側を判定できません/);
for(const patch of [{barrierBodies:['wall','wall']},{barrierBodies:'all'},{barrierSide:'bad'},{barrierFragments:{profile:[]}},{barrierFragments:[]}])assert.throws(()=>validateFeature({...feature,...patch}));
assert.throws(()=>validateProject({format:'forma-cad',version:1,features:[{...feature,barrierBodies:['missing']}]}),/参照が不正/);
// Saved fragment choices survive reconstruction, and changed geometry fails clearly.
const stored=JSON.parse(JSON.stringify([...history,...chosen.features]));validateProject({format:'forma-cad',version:1,features:stored});clearBodyCache();
const reconstructed=kernelBodies(stored.map(f=>f.id==='e'?{...f,cadResult:undefined}:f));try{near(R.measureVolume(reconstructed.get('e')),4020);}finally{for(const b of reconstructed.values())b.delete();}
assert.throws(()=>preview({depth:12,barrierBodies:['wall'],barrierFragments:{profile:keys}}),/塊が変わりました/);
assert.equal(JSON.stringify(history),snapshot);
await fs.writeFile('.sites-runtime/barrier-selection-fixture.forma.json',JSON.stringify({format:'forma-cad',version:1,features:[tubeFeature,{...defaults,kind:'sketch',id:'profile',groupId:'sketch1',groupNumber:1,name:'押し出し用スケッチ',width:30,height:30}]}));
const uiFeature={...feature,barrierBodies:['中空円柱'],name:'内外の押し出し'},uiResult=runOperation(tubeHistory,{type:'barrierPreparedPreview',features:[uiFeature],showBarrierGap:false});
await fs.writeFile('.sites-runtime/barrier-parts-edit-fixture.forma.json',JSON.stringify({format:'forma-cad',version:1,features:[...tubeHistory,...uiResult.features]}));
for(const s of [wall,other,outer,inner,tube,rotated,blindTool,blind])s.delete();clearBodyCache();
console.log('PASS selected/all/no obstacles, disconnected solid choices, stable save/replay, stale selection rejection, hollow inside/outside/both, rotated/blind bore detection, source join and immutable inputs');
