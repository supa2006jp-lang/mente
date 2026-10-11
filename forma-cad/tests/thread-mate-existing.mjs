import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {defaults,validateProject} from '../src/geometry.js';
import {runOperation} from '../src/kernel.js';
import {threadMateSource} from '../src/thread-source.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const shape=o=>R.deserializeShape(o.brep).asShape3D();
for(const role of ['male','female']){
 const history=JSON.parse(await fs.readFile('.sites-runtime/thread-mate-'+role+'.forma.json','utf8')).features;
 const box={...defaults,kind:'extrusion',id:'box',name:'加工先',width:24,height:24,depth:16,x:30,y:0,z:0};
 const features=[...history,box],saved=JSON.stringify(features),spec={type:'threadMate',id:'mate-in-body',target:'base',destination:'existing',length:5,wall:2,clearance:0,placement:{bodyId:'box',point:[30,0,16],normal:[0,0,1]}};
 const result=runOperation(features,spec);
 assert.deepEqual(result.outputs.map(o=>o.id),['box']);assert.deepEqual(result.remove,[]);assert.equal(JSON.stringify(features),saved);
 const made=shape(result.outputs[0]),check=new (R.getOC().BRepCheck_Analyzer)(made.wrapped,true,false);assert.ok(check.IsValid());check.delete();
 const volume=R.measureVolume(made);assert.ok(role==='male'?volume<24*24*16:volume>24*24*16);
 assert.equal(result.outputs[0].threadSource.spec.leftHand,role==='female');assert.equal(result.outputs[0].threadSource.spec.threadInternal,role==='male');
 const bounds=made.boundingBox;assert.ok(Math.abs(bounds.bounds[1][2]-(role==='male'?16:21))<.001);bounds.delete();
 const source=shape(history.at(-1).outputs[0]),assembled=source.clone().translate([30,0,role==='male'?11:16]),overlap=made.intersect(assembled);
 assert.ok(Math.abs(R.measureVolume(overlap))<.001,'matched threads do not interfere');source.delete();assembled.delete();overlap.delete();made.delete();
 const project={format:'forma-cad',version:1,features:[...features,{kind:'cadop',id:spec.id,name:'相手ねじ',spec,...result}]};validateProject(JSON.parse(JSON.stringify(project)));
 assert.ok(threadMateSource(project.features,'box'));assert.ok(threadMateSource(project.features,'base'));
 const replay=runOperation(project.features,{type:'replay',before:project.features,start:features.length});assert.equal(replay.features.at(-1).outputs[0].id,'box');
 const loose=runOperation(features,{...spec,clearance:.1}),looseShape=shape(loose.outputs[0]);assert.ok(R.measureVolume(looseShape)<volume-.1);looseShape.delete();
 assert.throws(()=>runOperation(features,{...spec,placement:{...spec.placement,bodyId:'base'}}),/別の/);
 assert.throws(()=>runOperation(features,{...spec,placement:{...spec.placement,point:[30,0,17]}}),/平面/);
 assert.throws(()=>runOperation(features,{...spec,placement:{...spec.placement,point:[41,0,16]}}),/不足|支える/);
 assert.throws(()=>runOperation(features,{...spec,placement:{...spec.placement,normal:[0,0,2]}}),/方向/);
 if(role==='male')assert.throws(()=>runOperation(features,{...spec,length:17}),/不足/);
 // Side-face and downward placement must follow the selected face, not the view.
 const side=runOperation(features,{...spec,id:'side',clearance:.1,placement:{bodyId:'box',point:[42,0,8],normal:[1,0,0]}});
 const down=runOperation(features,{...spec,id:'down',clearance:.1,placement:{bodyId:'box',point:[30,0,0],normal:[0,0,-1]}});
 for(const r of [side,down]){const b=shape(r.outputs[0]),check=new (R.getOC().BRepCheck_Analyzer)(b.wrapped,true,false);assert.ok(check.IsValid());check.delete();b.delete();}

 if(role==='female'){
  const cylinder={...box,profile:'circle',diameter:10,depth:8};
  const r=runOperation([...history,cylinder],{...spec,id:'coaxial',placement:{bodyId:'box',point:[30,0,8],normal:[0,0,1]}});
  const made=shape(r.outputs[0]),old=R.makeCylinder(5,8,[30,0,0]),missing=old.cut(made);
  assert.ok(Math.abs(R.measureVolume(missing))<.001,'only the newly extended cylinder is threaded; existing coaxial base is preserved');
  made.delete();old.delete();missing.delete();
 }
 if(role==='male'){
  const changed=structuredClone(project.features);changed[history.length].x=35;changed[history.length].depth=18;
  const r=runOperation(changed,{type:'replay',before:project.features,start:history.length});
  assert.deepEqual(r.features.at(-1).spec.placement.point,[35,0,18],'placement follows earlier body position and height edits');
 }
 console.log('PASS existing',role==='male'?'female hole':'male stud','matching fit, hand, allowance, source preservation, save/replay, side/down placement and invalid placement guards');
}
