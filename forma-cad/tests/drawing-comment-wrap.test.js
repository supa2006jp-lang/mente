import test from 'node:test';
import assert from 'node:assert/strict';
import {drawingSheet} from '../src/drawing-sheet.js';
import {optimizeDrawingLayout} from '../src/drawing-auto-layout.js';
import {drawingPDFPages} from '../src/drawing-pdf-pages.js';
import {drawingCommentPlacementIssue} from '../src/drawing-comments.js';

const view={visible:[],hidden:[]};
const part={bodyCount:1,bounds:[[0,0,0],[60,25,12]],views:{top:view,front:view,right:view}};
const first='取付面と取付穴の位置を図面と照合し、部品番号を確認する。';
const second='組み立て前にケーブルとカバーの間隔を確保し、干渉がないことを確認する。';
const text=first+'\n\n'+second;
const options={paper:'A4',orientation:'landscape',frame:true};
const at=(x,y,extra={})=>({...options,positions:{comment:[x,y]},...extra});
const sheet=(options,textValue=text)=>drawingSheet(part,1,true,[],textValue,options);

test('moving notes uses the remaining paper width and preserves hard breaks and blank lines',()=>{
 const wide=sheet(at(18,80)).note,narrow=sheet(at(240,80)).note;
 assert.deepEqual(wide.lines,[first,'',second]);
 assert.ok(narrow.lines.length>wide.lines.length);
 assert.equal(narrow.lines.join(''),first+second);
 assert.equal(narrow.lines.filter(line=>line==='').length,1);
 assert.equal(narrow.x,240);
 assert.ok(narrow.x+narrow.width<=297-5);
 assert.ok(sheet(at(18,80),second.repeat(3)).note.lines[0].length>60);
 assert.deepEqual(sheet(at(18,80),first+'\r\n\r\n'+second+'\n').note.lines,[first,'',second,'']);
});

test('paper orientation, font size and the title block set the available space',()=>{
 const small=sheet(at(125,60,{orientation:'portrait'})).note;
 const larger=sheet(at(125,60,{paper:'A3'})).note;
 assert.deepEqual(larger.lines,[first,'',second]);
 assert.ok(small.lines.length>larger.lines.length);
 assert.ok(sheet(at(125,60,{commentSize:8})).note.lines.length>larger.lines.length);
 const bottom=sheet(at(18,180),'組'.repeat(38));
 assert.ok(bottom.note.lines.length>1);
 assert.ok(bottom.note.x+bottom.note.width<bottom.titleBlock.x);
 assert.equal(drawingCommentPlacementIssue(bottom.note,bottom),null);
 const outside=sheet(at(300,30),'用紙外');
 assert.deepEqual(outside.note.lines,['用','紙','外']);
 assert.equal(drawingCommentPlacementIssue(outside.note,outside),'paper');
});

test('new and auto-sized drawings provide room for the comment beside or below the views',()=>{
 for(const paper of ['A4','auto']){
  const s=sheet({...options,paper});
  assert.deepEqual(s.note.lines,[first,'',second]);
  assert.ok(Object.values(s.layout).every(box=>box.x+box.width<s.note.x||box.y+box.height<s.note.y));
  assert.ok(s.note.x+s.note.width<s.width);
 }
 const long=sheet({...options,paper:'auto'},'加'.repeat(2000));
 assert.equal(long.note.lines.join('').length,2000);
 assert.ok(long.note.y+long.note.height<long.contentBottom);
});

const overlaps=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;

test('auto-layout and multipage PDF use the free space on each page',()=>{
 const added={id:'comment-extra',text:'短い注記',size:4,font:'',color:'#e03030'};
 const content='加'.repeat(220),settings={...options,comments:[added],positions:{comment:[265,20]}};
 const fit=optimizeDrawingLayout(part,{comment:content,options:settings});
 const s=drawingSheet(part,fit.scale,true,[],content,{...settings,layout:fit.layout,positions:fit.positions});
 for(const note of s.notes){
  const box=fit.boxes.find(item=>item.key===note.id);
  assert.ok(note.height<=box.height);
  for(const other of fit.boxes.filter(box=>box.key!==note.id))assert.ok(!overlaps(note,other));
  assert.equal(drawingCommentPlacementIssue(note,s),null);
 }
 assert.ok(s.notes[1].width<25);
 const pages=drawingPDFPages(part,1,true,[],content,{...settings,pdfLayout:'manual',
  pageAssignments:{pageCount:2,views:{},comments:{comment:2,'comment-extra':1}}});
 assert.equal(pages[1].note.lines.join(''),content);
 assert.ok(pages[1].note.lines.length<=s.note.lines.length);
 assert.deepEqual(pages[0].notes.map(note=>note.id),[added.id]);
});

test('fixed-scale views still fit alongside a long comment, including a saved left-hand column',()=>{
 const largePart={...part,bounds:[[0,0,0],[205,140,12]]},content='組'.repeat(100);
 const settings={...options,layout:'compact',viewSelection:['top'],isoMode:'hidden',viewScales:{top:1}};
 const fit=optimizeDrawingLayout(largePart,{comment:content,options:settings});
 const next=positions=>drawingSheet(largePart,fit.scale,true,[],content,{...settings,positions});
 const s=next(fit.positions);
 assert.equal(s.layout.top.scale,1);
 assert.equal(s.note.lines.join(''),content);
 assert.ok(!overlaps(s.note,s.layout.top));
 assert.equal(drawingCommentPlacementIssue(s.note,s),null);
 const oldColumn=next({comment:[10,45],top:[84,40]});
 assert.ok(oldColumn.note.width>60);
 assert.ok(oldColumn.note.x+oldColumn.note.width<oldColumn.layout.top.x);
 assert.ok(!overlaps(oldColumn.note,oldColumn.layout.top));
});
