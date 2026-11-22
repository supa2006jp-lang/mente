import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Vector3} from 'three';
import {basisFor,worldPoint} from '../src/frames.js';
import {nearestFaceGridPoint,nearestHolePoint,sketchPointsOnFace} from '../src/face-hole-points.js';

const face={frame:{u:[0,1,0],v:[0,0,1],n:[1,0,0]},offset:12,outer:[[-4,-4],[9,-4],[9,9],[-4,9]],
 holes:[[[2,2],[7,2],[7,7],[2,7]]]};
const basis=basisFor(face);

test('grid picking finds a valid crossing when the nearest rounded crossing falls in a hole',()=>{
 const point=worldPoint(face,[4.5,4.9]);
 const distance=candidate=>candidate.distanceTo(point);
 assert.deepEqual(nearestFaceGridPoint(face,basis,point,5,distance).toArray(),[12,0,5]);
 assert.equal(nearestFaceGridPoint(face,basis,point,5,distance,4),null);
});

test('sketch point picking uses visible points on the selected surface, projected onto its exact plane',()=>{
 const sketch=(x,y,z,groupHidden=false)=>({kind:'sketch',profile:'point',x,y,z,groupHidden});
 const features=[sketch(12.00005,1.24,3.9),sketch(0,1.24,3.9),sketch(12,4,4),sketch(12,1.5,2,true)];
 const points=sketchPointsOnFace(features,face,basis);
 assert.deepEqual(points.map(point=>point.toArray()),[[12,1.24,3.9]]);
 const pointer=new Vector3(12,1.4,4);
 assert.equal(nearestHolePoint(points,point=>point.distanceTo(pointer),.5),points[0]);
});
