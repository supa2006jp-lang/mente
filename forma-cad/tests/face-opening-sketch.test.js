import assert from 'node:assert/strict';
import test from 'node:test';
import {createFaceOpeningSketch,createFaceOpeningSketches} from '../src/face-opening-sketch.js';
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

test('creates one sketch group with inward clearance for distinct openings',()=>{
 const circle=Array.from({length:64},(_,i)=>[8+6*Math.cos(i*Math.PI/32),-2+6*Math.sin(i*Math.PI/32)]);
 const rect=[[20,0],[30,0],[30,8],[20,8]];
 const triangle=[[35,0],[45,0],[35,10]];
 const input={...face,holes:[circle,rect,triangle]};
 const [a,b,c]=createFaceOpeningSketches(input,[0,1,2],9,.2);
 assert.equal(new Set([a.groupId,b.groupId,c.groupId]).size,1);
 assert.equal(new Set([a.id,b.id,c.id]).size,3);
 assert.ok([a,b,c].every(sketch=>sketch.groupNumber===9));
 near(a.diameter,11.6);
 near(a.y,8);
 near(a.z,-2);
 near(b.width,9.6);
 near(b.height,7.6);
 near(b.y,25);
 near(b.z,4);
 near(Math.min(...c.points.map(p=>p[0])),35.2);
 near(Math.min(...c.points.map(p=>p[1])),.2);
 near(planeCoordinates(c).offset,12);
 assert.throws(()=>createFaceOpeningSketches(input,[0,1],9,4),/開口 2/);
 assert.throws(()=>createFaceOpeningSketches(input,[2],9,4),/開口 3/);
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
