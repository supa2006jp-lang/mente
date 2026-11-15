import assert from 'node:assert/strict';
import test from 'node:test';
import {createFaceOpeningSketch} from '../src/face-opening-sketch.js';
import {planeCoordinates,sketchPoints} from '../src/regions.js';

const frame={u:[0,1,0],v:[0,0,1],n:[1,0,0]};
const face={plane:'CUSTOM',frame,offset:12};
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8);

test('copies the second opening as a circle in the original face plane',()=>{
 const ring=Array.from({length:64},(_,i)=>[8+6*Math.cos(i*Math.PI/32),-2+6*Math.sin(i*Math.PI/32)]);
 const sketch=createFaceOpeningSketch({...face,holes:[[[0,0],[2,0],[0,2]],ring]},1,7);
 assert.equal(sketch.profile,'circle');
 assert.equal(sketch.groupNumber,7);
 assert.deepEqual(sketch.frame,frame);
 near(sketch.diameter,12);
 near(sketch.x,12);
 near(sketch.y,8);
 near(sketch.z,-2);
});

test('retains a rotated rectangular outline and copies irregular openings as closed polylines',()=>{
 const angle=.41,c=Math.cos(angle),s=Math.sin(angle);
 const rectangle=[[0,0],[20,0],[20,10],[0,10]].map(([x,y])=>[x*c-y*s+2,x*s+y*c-7]);
 const triangle=[[4,5],[6,9],[9,5]];
 const source={...face,holes:[rectangle,triangle]};
 const rect=createFaceOpeningSketch(source,0,1);
 assert.equal(rect.profile,'rect');
 near(planeCoordinates(rect).offset,face.offset);
 for(const corner of rectangle)assert.ok(sketchPoints(rect).some(p=>Math.hypot(p[0]-corner[0],p[1]-corner[1])<1e-8));
 const polyline=createFaceOpeningSketch(source,1,2);
 assert.equal(polyline.profile,'polyline');
 assert.equal(polyline.closed,true);
 assert.deepEqual(sketchPoints(polyline),[...triangle,triangle[0]]);
 assert.throws(()=>createFaceOpeningSketch(source,2,3),/開口の輪郭/);
});
