import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {createSketchSnapCycle} from '../src/sketch-snap-cycle.js';
import {gridBoundaryIntersections} from '../src/grid-boundary-snap.js';
const c=(kind,x,y=0)=>({kind,point:new THREE.Vector3(x,y,0)});
test('Tab cycles snap alternatives in both directions without changing automatic preference',()=>{
 const cycle=createSketchSnapCycle(),revision={},a=c('endpoint',1),b=c('gridSketch',2),d=c('midpoint',3);assert.equal(cycle.resolve([a,b,d],{x:10,y:10},revision,'plane').kind,'endpoint');assert.equal(cycle.cycle(),true);assert.equal(cycle.selected.kind,'gridSketch');cycle.cycle();assert.equal(cycle.selected.kind,'midpoint');cycle.cycle();assert.equal(cycle.selected.kind,'endpoint');cycle.cycle(-1);assert.equal(cycle.selected.kind,'midpoint');
});
test('manual choice survives mouse-up, tiny motion and reordering but resets when context or geometry changes',()=>{
 const cycle=createSketchSnapCycle(),revision={},a=c('endpoint',1),b=c('gridSketch',2);cycle.resolve([a,b],{x:0,y:0},revision,'p');cycle.cycle();assert.equal(cycle.resolve([a,b],{x:0,y:0},revision,'p').kind,'gridSketch');assert.equal(cycle.resolve([b,a],{x:2,y:0},revision,'p').kind,'gridSketch');assert.equal(cycle.resolve([a],{x:2,y:0},revision,'p').kind,'endpoint');cycle.resolve([a,b],{x:2,y:0},revision,'p');cycle.cycle();assert.equal(cycle.resolve([a,b],{x:20,y:0},revision,'p').kind,'endpoint');cycle.cycle();assert.equal(cycle.resolve([a,b],{x:20,y:0},revision,'other plane').kind,'endpoint');cycle.cycle();assert.equal(cycle.resolve([a,b],{x:20,y:0},{},'other plane').kind,'endpoint');
});
test('duplicate equivalent hits are removed, candidate count is bounded and empty/singleton sets do not intercept Tab',()=>{
 const cycle=createSketchSnapCycle(),r={};cycle.resolve([c('endpoint',1),c('endpoint',1)],{x:0,y:0},r,'p');assert.equal(cycle.items.length,1);assert.equal(cycle.cycle(),false);cycle.resolve([],{x:0,y:0},r,'p');assert.equal(cycle.cycle(),false);cycle.resolve(Array.from({length:30},(_,i)=>c('endpoint',i)),{x:0,y:0},r,'p');assert.equal(cycle.items.length,16);cycle.clear();assert.equal(cycle.items.length,0);
});
test('crossing candidates retain both finite source lines for emerald feedback',()=>{
 const v=(x,y)=>new THREE.Vector3(x,y,0),boundary=[v(0,3),v(20,13)],grids=[[v(10,0),v(10,20)],[v(11,0),v(11,20)]],hits=gridBoundaryIntersections([boundary],grids,v(10.2,8.1),p=>({x:p.x*5,y:p.y*5}));assert.equal(hits.length,2);assert.ok(hits[0].point.distanceTo(v(10,8))<1e-9);assert.equal(hits[0].boundary,boundary);assert.equal(hits[0].gridLine.length,2);
});
