import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {defaults,validateFeature} from '../src/geometry.js';
import {sketchEndpoints,endpointSketchPoint,existingEndpointPoint} from '../src/sketch-endpoint.js';
import {findRegions} from '../src/regions.js';
const feature=patch=>({...defaults,id:'source',kind:'sketch',groupId:'group',groupNumber:2,groupHidden:false,...patch});

test('rotated lines and closed corners use exact endpoints, circles have none',()=>{
 const f=feature({profile:'line',mode:'thin',width:20,angle:90,x:4,y:6,z:3});
 const ends=sketchEndpoints(f);assert.equal(ends.length,2);
 assert.ok(ends[0].distanceTo(new Vector3(4,-4,3))<1e-10);
 assert.ok(ends[1].distanceTo(new Vector3(4,16,3))<1e-10);
 assert.equal(sketchEndpoints(feature({profile:'rect'})).length,4);
 assert.deepEqual(sketchEndpoints(feature({profile:'circle'})),[]);
 assert.deepEqual(sketchEndpoints({...f,groupHidden:true}),[]);
});
test('curves exclude tessellation vertices and closed splines have no ends',()=>{
 const f=feature({profile:'spline',points:[[0,0],[10,20],[30,0]],closed:false});
 assert.deepEqual(sketchEndpoints(f).map(p=>p.toArray()),[[0,0,0],[30,0,0]]);
 assert.deepEqual(sketchEndpoints({...f,closed:true}),[]);
 assert.equal(sketchEndpoints(feature({profile:'polyline',arc:{},points:[[0,0],[5,5],[10,0]]})).length,2);
});
test('endpoint points retain custom plane/group and do not alter closed regions',()=>{
 const f=feature({profile:'rect',x:0,y:20,z:0,plane:'CUSTOM',frame:{u:[1,0,0],v:[0,0,-1],n:[0,1,0]}});
 const p=sketchEndpoints(f)[0],point=endpointSketchPoint(f,p,'point');
 validateFeature(point);assert.equal(point.groupId,f.groupId);assert.equal(point.groupNumber,2);
 assert.equal(point.profile,'point');assert.equal(point.y,20);assert.deepEqual(point.frame,f.frame);assert.notEqual(point.frame,f.frame);
 assert.deepEqual(findRegions([f,point]),findRegions([f]));
 assert.equal(existingEndpointPoint([point],f,p),point);
 assert.equal(existingEndpointPoint([{...point,groupId:'other'}],f,p),undefined);
 assert.equal(existingEndpointPoint([point],f,p.clone().add(new Vector3(.01,0,0))),undefined);
});
