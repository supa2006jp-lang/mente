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

function circle(radius,x=10,y=-24){
 return Array.from({length:72},(_,i)=>{
  const angle=i*Math.PI*2/72,a=angle+.24*Math.sin(angle);
  return [x+radius*Math.cos(a),y+radius*Math.sin(a)];
 });
}

test('measures the outer diameter, inner diameter and uniform radial thickness',()=>{
 const outer=circle(25),plain=planarFaceMeasurement({outer});
 assert.ok(Math.abs(plain.diameter-50)<1e-9);
 assert.deepEqual(plain.openings,[]);
 const ring=planarFaceMeasurement({outer,holes:[circle(15).reverse()]});
 assert.ok(Math.abs(ring.openings[0].diameter-30)<1e-9);
 assert.ok(Math.abs(ring.rimThickness-10)<1e-9);
 const eccentric=planarFaceMeasurement({outer,holes:[circle(15,12,-24)]});
 assert.ok(Math.abs(eccentric.openings[0].diameter-30)<1e-9);
 assert.equal(eccentric.rimThickness,undefined);
});

test('measures rectangular and circular openings independently',()=>{
 const outer=[[0,0],[100,0],[100,50],[0,50]];
 const holes=[[[5,5],[5,25],[45,25],[45,5]],circle(8,70,30)];
 const {sides,openings,rimThickness}=planarFaceMeasurement({outer,holes});
 assert.deepEqual(sides,[50,100]);
 assert.deepEqual(openings[0].sides,[20,40]);
 assert.ok(Math.abs(openings[1].diameter-16)<1e-9);
 assert.equal(rimThickness,undefined);
});

test('reports the outline extents of an irregular face',()=>{
 const outer=[[5,-12],[43,11],[15,40]];
 assert.deepEqual(planarFaceMeasurement({outer}),{sides:[38,52],outline:true,openings:[]});
});
