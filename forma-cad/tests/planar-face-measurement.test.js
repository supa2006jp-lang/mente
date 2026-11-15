import assert from 'node:assert/strict';
import test from 'node:test';
import {planarFaceMeasurement} from '../src/planar-face-measurement.js';

test('measures the actual sides of a rotated rectangle',()=>{
 const a=Math.PI/7;
 const outer=[[0,0],[100,0],[100,50],[0,50]].map(([x,y])=>[
  x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a),
 ]);
 const {sides,outline}=planarFaceMeasurement({outer});
 assert.ok(Math.abs(sides[0]-50)<1e-9&&Math.abs(sides[1]-100)<1e-9);
 assert.equal(outline,undefined);
});

test('reports diameter for a circle and outside diameter when it has holes',()=>{
 const outer=Array.from({length:72},(_,i)=>{
  const angle=i*Math.PI*2/72,a=angle+.24*Math.sin(angle);
  return [10+25*Math.cos(a),-24+25*Math.sin(a)];
 });
 for(const holes of [[],[outer.map(([x,y])=>[10+(x-10)/2,-24+(y+24)/2])]]){
  const result=planarFaceMeasurement({outer,holes});
  assert.ok(Math.abs(result.diameter-50)<1e-9);
  assert.equal(result.hasHoles,holes.length>0);
 }
});

test('reports the outline extents of an irregular face',()=>{
 const outer=[[5,-12],[43,11],[15,40]];
 assert.deepEqual(planarFaceMeasurement({outer}),{sides:[38,52],outline:true});
});
