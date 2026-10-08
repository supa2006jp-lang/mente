import assert from 'node:assert/strict';
import {faceGridCellRegions as cells} from '../src/grid-cell.js';
import {regionContains} from '../src/regions.js';
const face={plane:'XY',offset:20,bodyId:'source',cadFace:4,outer:[[-12.5,-12.5],[12.5,-12.5],[12.5,12.5],[-12.5,12.5]],holes:[]};
const area=rs=>rs.reduce((s,r)=>s+r.area,0);
assert.equal(area(cells(face,[5,5],10)),100);
assert.equal(area(cells(face,[11,11],10)),6.25);
assert.equal(area(cells(face,[-11,-11],10)),6.25);
assert.deepEqual(cells(face,[25,25],10),[]);
const holed={...face,outer:[[0,0],[20,0],[20,20],[0,20]],holes:[[[2,2],[8,2],[8,8],[2,8]]]};
let rs=cells(holed,[1,1],10);assert.equal(area(rs),64);assert.equal(rs[0].holes.length,1);assert.ok(!regionContains(rs[0],[5,5]));
rs=cells({...holed,holes:[[[4,-1],[6,-1],[6,11],[4,11]]]},[1,1],10);assert.equal(area(rs),80);assert.equal(rs.length,2,'slot leaves two disconnected pieces');
assert.equal(area(cells(face,[35,35],10,{patches:[{u:[20,40],v:[20,40]}]})),100);
assert.equal(area(cells(face,[49,49],10,{mode:'100'})),100);
assert.equal(area(cells(face,[51,51],10,{mode:'100'})),0);
assert.equal(area(cells(face,[99,99],10,{mode:'200'})),100);
assert.equal(area(cells(face,[500,500],10,{mode:'unlimited'})),100);
for(const r of cells(face,[11,11],10)){assert.equal(r.offset,20);assert.equal(r.bodyId,undefined);assert.equal(r.cadFace,undefined);}
console.log('PASS grid cell clipping, negative coordinates, holes, disconnected pieces, local patches and fixed scopes');
