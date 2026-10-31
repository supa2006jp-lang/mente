import test from 'node:test';import assert from 'node:assert/strict';
import {defaults} from '../src/geometry.js';import {sketchConnections,SKETCH_CONNECTION_TOLERANCE as EPS} from '../src/sketch-connections.js';
const line=(id,a,b,extra={})=>({...defaults,id,kind:'sketch',name:id,profile:'polyline',mode:'thin',points:[a,b],closed:false,groupId:'s',groupNumber:1,...extra});
const state=features=>{const nodes=sketchConnections(features);return {nodes,connected:nodes.filter(n=>n.connected),open:nodes.filter(n=>!n.connected)};};
test('coincident endpoints have one filled junction and two free ends',()=>{
 const features=[line('a',[0,0],[20,0]),line('b',[20,0],[20,20])],before=JSON.stringify(features),s=state(features);
 assert.equal(s.connected.length,1);assert.equal(s.open.length,2);assert.deepEqual(s.connected[0].point.toArray(),[20,0,0]);assert.deepEqual(s.connected[0].featureIds,['a','b']);assert.equal(s.connected[0].degree,2);assert.equal(JSON.stringify(features),before);
});
test('use modelling tolerance rather than screen proximity, including negative bucket boundaries',()=>{
 for(const x of [0,-EPS/2,100]){const a=line('a',[x-10,0],[x,0]);assert.equal(state([a,line('b',[x+EPS/2,0],[x+10,10])]).connected.length,1);assert.equal(state([a,line('b',[x+EPS*20,0],[x+10,10])]).connected.length,0);}
});
test('different groups, workplanes, hidden geometry and construction lines do not establish connections',()=>{
 const a=line('a',[-10,0],[0,0]);
 for(const b of [line('b',[0,0],[10,10],{groupId:'other'}),line('b',[0,0],[10,10],{plane:'YZ'}),line('b',[0,0],[10,10],{z:.1})])assert.equal(state([a,b]).connected.length,0);
 for(const patch of [{groupHidden:true},{construction:true},{textOutline:{id:'text'}}]){const s=state([a,line('b',[0,0],[10,10],patch)]);assert.equal(s.open.length,2);assert.equal(s.connected.length,0);}
});
test('closed corners and interior polyline vertices are connected without creating extra endpoints',()=>{
 const rect={...defaults,id:'r',kind:'sketch',profile:'rect',groupId:'s',width:20,height:10},s=state([rect]);assert.equal(s.connected.length,4);assert.equal(s.open.length,0);
 const chain={...line('c',[0,0],[10,0]),points:[[0,0],[10,0],[10,10]]};assert.equal(state([chain]).connected.length,1);assert.equal(state([chain]).open.length,2);
 assert.equal(state([{...chain,closed:true}]).connected.length,3);
});
test('curves only expose their true ends; circles and closed splines have no endpoint markers',()=>{
 const spline={...line('s',[0,0],[20,0]),profile:'spline',points:[[0,0],[10,20],[20,0]]},arc={...line('arc',[20,0],[30,0]),arc:{},points:[[20,0],[25,5],[30,0]]};
 const s=state([spline,arc]);assert.equal(s.connected.length,1);assert.equal(s.open.length,2);assert.equal(s.nodes.length,3);
 assert.equal(state([{...spline,closed:true},{...defaults,id:'circle',kind:'sketch',profile:'circle'}]).nodes.length,0);
});
test('crossing segments and a point on the middle of a line are not endpoint joins',()=>{
 assert.equal(state([line('a',[-10,0],[10,0]),line('b',[0,-10],[0,10])]).connected.length,0);
 assert.equal(state([line('a',[-10,0],[10,0]),line('b',[0,0],[0,10])]).connected.length,0);
});
test('rotated/custom planes and three-way endpoint branches preserve world coordinates',()=>{
 const frame={u:[0,1,0],v:[0,0,1],n:[1,0,0]},s=state([line('a',[0,0],[10,0],{plane:'CUSTOM',frame,x:7}),line('b',[10,0],[10,10],{plane:'CUSTOM',frame,x:7}),line('c',[10,0],[20,0],{plane:'CUSTOM',frame,x:7})]);
 assert.equal(s.connected.length,1);assert.equal(s.connected[0].degree,3);assert.deepEqual(s.connected[0].point.toArray(),[7,10,0]);assert.equal(s.open.length,3);
});
