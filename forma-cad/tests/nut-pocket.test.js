import assert from 'node:assert/strict';
import {before,test} from 'node:test';
import {readFile} from 'node:fs/promises';
import * as R from 'replicad';
import {Vector3} from 'three';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {validateProject} from '../src/geometry.js';
import {runOperation} from '../src/kernel.js';
import {historyImpact} from '../src/history-impact.js';
import {nutPocketSource} from '../src/nut-pocket-settings.js';

let fastener;
before(async()=>{
 R.setOC(await init({wasmBinary:await readFile(new URL('../node_modules/replicad-opencascadejs/dist/replicad_single.wasm',import.meta.url))}));
 const spec={type:'freeScrew',id:'screw',origin:[32,0,0],diameter:4,pitch:.7,length:3.5,threadLength:2.8,
  head:'hex',headSize:7,headHeight:2.6,drive:'none',nut:{id:'nut',shape:'hex',height:2.1,wall:2,autoPull:true,clearance:.1}};
 fastener={kind:'cadop',id:spec.id,name:'ねじとナット',spec,...runOperation([],spec)};
});

const closeTo=(actual,expected,tolerance=1e-5)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} ≠ ${expected}`);
const openings=features=>runOperation(features,{type:'nutPocketOpenings',target:'stock'}).openings;
const pocket=(opening,clearance=.2)=>({type:'nutPocket',id:'recess',target:'stock',sourceBody:'nut',opening,clearance});

function blank({radius=2.25,x=0,height=7,boreDepth=height+.2,rotation=0,shift=[0,0,0],boss=false}={}){
 const stock=R.makeBox([-12,-10,0],[12,10,height]);
 const direction=boss?[0,0,1]:[0,0,-1];
 const tool=R.makeCylinder(radius,boreDepth,[x,0,height+(boss?-.1:.1)],direction);
 let formed,turned,placed;
 try{
  formed=boss?stock.fuse(tool):stock.cut(tool);
  turned=rotation?formed.rotate(rotation,[0,0,0],[1,0,0]):formed;
  placed=turned.translate(shift);
  const brep=placed.serialize();
  return {kind:'cadop',id:'stock',name:'本体',outputs:[{id:'stock',brep,...placed.mesh()}],remove:[]};
 }finally{placed?.delete();turned?.delete();formed?.delete();tool.delete();stock.delete();}
}

test('a flush hex pocket follows the selected entry and keeps the pilot bore, source nut and target identity',()=>{
 const base=blank(),features=[base,fastener];
 const rims=openings(features);
 assert.equal(rims.length,2);
 const top=rims.find(r=>r.normal[2]===1),bottom=rims.find(r=>r.normal[2]===-1);
 assert.deepEqual(top.center,[0,0,7]);assert.deepEqual(bottom.center,[0,0,0]);
 assert.deepEqual(nutPocketSource(features,'nut'),{bodyId:'nut',screwId:'screw',across:8,depth:2.1});
 for(const opening of [top,bottom]){
  const spec=pocket(opening),result=runOperation(features,spec);
  assert.deepEqual(result.outputs.map(o=>o.id),['stock']);assert.deepEqual(result.remove,[]);
  assert.deepEqual(result.analysis.opening,opening);
  closeTo(result.analysis.across,8.4);closeTo(result.analysis.depth,2.1);
  const expected=24*20*7-Math.PI*2.25**2*7-(Math.sqrt(3)/2*8.4**2-Math.PI*2.25**2)*2.1;
  closeTo(result.outputs[0].shapeMetrics.volume,expected);
 }
});

test('rotated and blind round holes are selected by the true rim, with raised bosses excluded',()=>{
 assert.deepEqual(openings([blank({boss:true}),fastener]),[]);
 const angle=38,axis=new Vector3(1,0,0),shift=[4,5,8];
 const features=[blank({boreDepth:4,rotation:angle,shift}),fastener],rims=openings(features);
 assert.equal(rims.length,1);
 const [opening]=rims,radians=angle*Math.PI/180;
 const center=new Vector3(0,0,7).applyAxisAngle(axis,radians).add(new Vector3(...shift));
 const normal=new Vector3(0,0,1).applyAxisAngle(axis,radians);
 assert.ok(new Vector3(...opening.center).distanceTo(center)<1e-5);
 assert.ok(new Vector3(...opening.normal).distanceTo(normal)<1e-5);
 const result=runOperation(features,pocket(opening,0));
 closeTo(result.analysis.across,8);
 assert.ok(result.outputs[0].shapeMetrics.volume>3000);
});

test('pockets that would break through the walls or erase the pilot are rejected',()=>{
 for(const options of [{x:9},{height:2.1},{radius:4.1},{boreDepth:1.5}]){
  const features=[blank(options),fastener],top=openings(features).find(r=>r.normal[2]===1);
  assert.ok(top);
  assert.throws(()=>runOperation(features,pocket(top)),/側壁または底|受け面|円穴が浅く/);
 }
 const features=[blank(),fastener],top=openings(features).find(r=>r.normal[2]===1);
 assert.throws(()=>runOperation(features,pocket({...top,center:[1,0,7]})),/開口が見つかりません/);
 assert.throws(()=>runOperation(features,{...pocket(top),sourceBody:'screw'}),/六角ナット/);
});

test('a saved pocket can be replayed as its stock moves and records the nut dependency',()=>{
 const features=[blank(),fastener],top=openings(features).find(r=>r.normal[2]===1),spec=pocket(top);
 const old=[...features,{kind:'cadop',id:spec.id,name:'六角ナットの埋め込み穴',spec,...runOperation(features,spec)}];
 const saved=validateProject(JSON.parse(JSON.stringify({format:'forma-cad',version:1,features:old})));
 assert.ok(historyImpact(saved,'screw').steps.at(-1).references.includes('nut'));
 const replay=runOperation([blank({shift:[3,5,2]}),...saved.slice(1)],{type:'replay',before:saved,start:0});
 assert.deepEqual(replay.features.at(-1).spec.opening.center,[3,5,9]);
 closeTo(replay.features.at(-1).outputs[0].shapeMetrics.volume,old.at(-1).outputs[0].shapeMetrics.volume);
});
