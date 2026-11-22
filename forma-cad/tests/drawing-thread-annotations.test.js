import assert from 'node:assert/strict';
import {before,test} from 'node:test';
import {readFile} from 'node:fs/promises';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {defaults} from '../src/geometry.js';
import {runOperation} from '../src/kernel.js';
import {drawingHoleCandidates,holeAnchor,reconcileHoleTable} from '../src/drawing-hole-references.js';
import {drawingPDFPages} from '../src/drawing-pdf-pages.js';
import {drawingSheet} from '../src/drawing-sheet.js';
import {drawingThreadLeader,reconcileDrawingThreadLeaders} from '../src/drawing-thread-annotations.js';

before(async()=>R.setOC(await init({wasmBinary:await readFile(new URL('../node_modules/replicad-opencascadejs/dist/replicad_single.wasm',import.meta.url))})));

const box={...defaults,kind:'extrusion',id:'block',name:'プレート',width:44,height:38,depth:12};
const hole={...defaults,kind:'extrusion',id:'hole',name:'穴',profile:'circle',diameter:6,z:12,depth:-9,hole:true,operation:'cut',target:box.id};
const spec={type:'thread',target:box.id,id:'thread',surfacePoint:[3,0,10],pitch:1,profile:'metric60',
 threadVersion:2,fullLength:true,leftHand:true};
const targets=[box.id],base=[box,hole];
const project=(features,ids=targets)=>runOperation(features,{type:'orthographic',targets:ids,views:['top','bottom']});
const op=(features,spec)=>[...features,{kind:'cadop',id:spec.id,name:spec.type,spec,...runOperation(features,spec)}];
const options={paper:'A4',orientation:'landscape',name:'ねじテスト',material:'',date:'',viewSelection:['top'],
 frame:true,positions:{top:[24,30],holeTable:[110,26]},isoMode:'hidden'};

test('modeled thread settings follow the numbered hole and callout through replay and PDF layout',()=>{
 const original=op(base,spec),first=project(original),bore=first.views.top.holeMachining[0];
 assert.equal(bore.depth,9);
 assert.deepEqual(bore.thread,{id:'thread',bodyId:'block',end:'high',diameter:6,pitch:1,length:9,leftHand:true});
 const table={view:'top',origin:[-20,15],holes:drawingHoleCandidates(first.views.top,'top',original,targets).map((row,i)=>({number:i+1,...holeAnchor(row)}))};
 assert.equal(table.holes[0].sourceId,'hole');
 const originalNote={id:'leader-test',...drawingThreadLeader('top',bore,[34,32])};
 const proposed=structuredClone(original);
 proposed[2].spec={...spec,fullLength:false,length:5,pitch:.75,leftHand:false};
 const next=runOperation(proposed,{type:'replay',before:original,start:2}).features;
 const data=project(next),leaders=reconcileDrawingThreadLeaders([originalNote],data.views);
 assert.equal(leaders[0].text,'M6×0.75\nねじ深さ 5 mm · 右ねじ');
 const updated=reconcileHoleTable(table,drawingHoleCandidates(data.views.top,'top',next,targets),data.views.top.viewBox);
 assert.equal(updated.holes[0].number,1);
 assert.equal(updated.holes[0].review,undefined);
 const sheet=drawingSheet(data,1,true,[],'',{...options,holeTable:updated,leaders});
 assert.match(sheet.svg,/M6×0.75 \/ 5 mm \/ 右ねじ/);
 assert.match(sheet.svg,/ねじ深さ 5 mm/);
 const pages=drawingPDFPages(data,1,true,[],'',{...options,holeTable:updated,leaders});
 assert.ok(pages.some(page=>page.svg.includes('M6×0.75 / 5 mm / 右ねじ')));
 assert.ok(pages.some(page=>page.svg.includes('ねじ深さ 5 mm')));
 const plain=project(base);
 const [unlinked]=reconcileDrawingThreadLeaders(leaders,plain.views);
 assert.equal(unlinked.review,true);
 assert.doesNotMatch(drawingSheet(plain,1,true,[],'',{...options,holeTable:updated,leaders:[unlinked]}).svg,/M6×/);
});

test('a translated thread stays attached, and an occluding boss or a reamed bore cannot acquire its settings',()=>{
 const threaded=op(base,{...spec,fullLength:false,length:2});
 const moved=op(threaded,{type:'move',id:'move',target:box.id,x:10,y:-5,z:3,angle:0,axis:'Z'});
 const [bore]=project(moved).views.top.holeMachining;
 assert.deepEqual(bore.center.map(Math.round),[10,5]);
 assert.equal(bore.thread.length,2);
 const cover={...defaults,kind:'extrusion',id:'cover',name:'ボス',profile:'circle',diameter:6,z:14,depth:1};
 assert.ok(!project([...threaded,cover],[...targets,cover.id]).views.top.holeMachining.some(row=>row.thread));
 const reamed=op(threaded,{type:'extrusion',id:'ream',target:box.id,feature:{...hole,id:'ream'}});
 assert.ok(!project(reamed).views.top.holeMachining.some(row=>row.thread));
});
