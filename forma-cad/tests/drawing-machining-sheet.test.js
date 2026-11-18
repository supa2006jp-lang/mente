import assert from 'node:assert/strict';
import {before,test} from 'node:test';
import {readFile} from 'node:fs/promises';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {orthographicProjection} from '../src/orthographic.js';
import {drawingFrontFrame} from '../src/drawing-front.js';
import {drawingTableHoles,resolveDrawingHoleTable} from '../src/drawing-hole-table.js';
import {drawingFileStem,drawingSheet} from '../src/drawing-sheet.js';
import {drawingPDFPages} from '../src/drawing-pdf-pages.js';
import {readDrawingState} from '../src/drawing-state.js';

before(async()=>R.setOC(await init({wasmBinary:await readFile(new URL('../node_modules/replicad-opencascadejs/dist/replicad_single.wasm',import.meta.url))})));

function plate(blindDepth=8){
 let part=R.makeBox([0,0,0],[60,24,12]);
 for(const [x,radius,depth] of [[8,2.5,15],[20,2.5,blindDepth],[32,2.5,9],[32,4.5,3],[45,2.5,15],[45,4.5,4]]){
  const cutter=R.makeCylinder(radius,depth,[x,12,12],[0,0,-1]),next=part.cut(cutter);
  cutter.delete();part.delete();part=next;
 }
 return part;
}
const options={paper:'A4',orientation:'landscape',name:'連結プレート',material:'',date:'',revision:'02',
 frame:true,positions:{},viewSelection:['top'],isoMode:'hidden'};

test('the final solid distinguishes equal-diameter through, blind and counterbored holes from the visible side',()=>{
 const part=plate(),bodies=new Map([['plate',part]]);
 try{
  const data=orthographicProjection(bodies,['plate'],[],['top','bottom']);
  const rows=drawingTableHoles(data.views.top).map(hole=>hole.machining);
  assert.deepEqual(rows.map(({center,radius,through,depth,counterbore})=>[center[0],radius*2,through??depth,counterbore?.depth]),[
   [8,5,true,undefined],[20,5,8,undefined],[32,5,9,3],[45,5,true,4]]);
  assert.equal(rows[2].counterbore.radius*2,9);
  const bottom=drawingTableHoles(data.views.bottom);
  assert.deepEqual(bottom.map(hole=>hole.center[0]),[8,45]);
  assert.ok(bottom.every(hole=>hole.machining.through&&!hole.machining.counterbore));
  const front=orthographicProjection(bodies,['plate'],[],['front'],drawingFrontFrame([0,0,1]));
  assert.deepEqual(drawingTableHoles(front.views.front).map(h=>[Math.round(h.center[0]),h.machining?.depth??'through']),
   [[8,'through'],[20,8],[32,9],[45,'through']]);
 }finally{part.delete();}
});

test('old tables resolve from current geometry and group the two rims on an independent PDF page',()=>{
 const oldTable={view:'top',origin:[0,0],holes:[{center:[20,-12],radius:2.5},{center:[32,-12],radius:4.5},{center:[32,-12],radius:2.5}]};
 const part=plate(6);
 try{
  const data=orthographicProjection(new Map([['plate',part]]),['plate'],[],['top']);
  const resolved=resolveDrawingHoleTable(oldTable,data.views);
  assert.deepEqual(resolved.holes.map(h=>[h.radius,h.machining.depth]),[[2.5,6],[2.5,9]]);
  assert.equal(oldTable.holes.length,3);
  const pages=drawingPDFPages(data,1,true,[],'',{...options,holeTable:oldTable});
  assert.equal(pages.length,2);
  assert.deepEqual(Object.keys(pages[1].layout),[]);
  assert.match(pages[1].svg,/座ぐり深さ/);
  assert.match(pages[1].svg,/>6<\/text>/);
  assert.doesNotMatch(pages[1].svg,/>H3</);
  assert.ok(pages.every(page=>page.fileStem==='連結プレート_Rev02'&&page.svg.includes('改訂番号')));
 }finally{part.delete();}
});

test('a circular boss hiding a hole does not inherit the machining data behind it',()=>{
 const part=plate(),boss=R.makeCylinder(2.5,2,[8,12,14]);
 try{
  const data=orthographicProjection(new Map([['plate',part],['boss',boss]]),['plate','boss'],[],['top']);
  const hole=drawingTableHoles(data.views.top).find(h=>h.center[0]===8);
  assert.ok(hole);assert.equal(hole.machining,undefined);
  const sheet=drawingSheet(data,.5,true,[],'',{...options,holeTable:{view:'top',origin:[0,0],holes:[hole]}});
  assert.match(sheet.svg,/>—</);
 }finally{boss.delete();part.delete();}
});

test('drawing filenames and optional revisions support old projects, Japanese names and filesystem limits',()=>{
 assert.equal(drawingFileStem(),'three-views');
 assert.equal(drawingFileStem('取付板',''),'取付板');
 assert.equal(drawingFileStem('ロッカー連結プレート','02'),'ロッカー連結プレート_Rev02');
 assert.equal(drawingFileStem('部品/A. ',' Rev. 02 '),'部品_A_Rev02');
 assert.equal(drawingFileStem('NUL.1'),'_NUL.1');
 assert.equal(drawingFileStem('..','A'),'three-views_RevA');
 const long=drawingFileStem('板'.repeat(80),'改'.repeat(20));
 assert.ok(Buffer.byteLength(long+'.pdf')<=255);assert.ok(long.endsWith('_Rev'+'改'.repeat(20)));
 const state={version:1,signature:'test',targets:['plate'],targetMode:'visible',scale:1,hidden:true,comment:'',dimensions:[],options:{...options}};
 assert.equal(readDrawingState(state).options.revision,'02');
 delete state.options.revision;assert.equal(readDrawingState(state).options.revision,undefined);
 assert.throws(()=>readDrawingState({...state,options:{...options,revision:'x'.repeat(21)}}));
});
