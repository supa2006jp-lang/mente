import assert from 'node:assert/strict';
import * as THREE from 'three';
import {measurePointComponent,measurementEndpoints,measureCircle} from '../src/dimension-measure-geometry.js';
import {measurementEdges} from '../src/dimension-measure-edges.js';
import {readMeasurementState} from '../src/dimension-measure-state.js';
import {encodeProjectDocument,decodeProjectDocument} from '../src/project-codec.js';
import {defaults,validateProject} from '../src/geometry.js';
const near=(a,b)=>assert(Math.abs(a-b)<1e-8,a+' != '+b),a=[2,3,4],b=[-1,7,16];
near(measurePointComponent(a,b).distance,13);for(const [axis,distance,index]of [['x',3,0],['y',4,1],['z',12,2]]){const measured=measurePointComponent(a,b,axis);near(measured.distance,distance);const [first,last]=measurementEndpoints(measured);assert.deepEqual(first.toArray(),a);const expected=[...a];expected[index]=b[index];assert.deepEqual(last.toArray(),expected);}
near(measurePointComponent([0,0,0],[0,4,5],'x').distance,0);assert.throws(()=>measurePointComponent(a,b,'bad'));
const circleFeature={...defaults,id:'circle',name:'circle',kind:'sketch',profile:'circle',plane:'XZ',x:5,y:7,z:9,diameter:20},edge=measurementEdges([circleFeature],[])[0],rim=[15,7,9],records=[];
for(const [kind,distance]of [['circumference',Math.PI*20],['diameter',20],['radius',10]]){const measured=measureCircle(edge,kind,rim);near(measured.distance,distance);if(kind!=='circumference')near(new THREE.Vector3(...measured.a).distanceTo(new THREE.Vector3(...measured.b)),distance);measured.offset={x:37,y:-24};records.push(measured);}
records.push({...measurePointComponent(a,b,'z'),offset:{x:-40,y:55},label:'高さ'});const source={version:1,records},before=JSON.stringify(source),state=readMeasurementState(source);assert.equal(JSON.stringify(source),before);assert.deepEqual(state.records.map(r=>r.offset),records.map(r=>r.offset));assert.equal(state.records[3].component,'z');
const document={format:'forma-cad',version:1,features:[circleFeature],measurements:state};for(const compress of [false,true]){const decoded=(await decodeProjectDocument((await encodeProjectDocument(document,{compress})).text)).document;assert.deepEqual(validateProject(decoded),[circleFeature]);assert.deepEqual(readMeasurementState(decoded.measurements),state);}
assert.equal(readMeasurementState(undefined),null);assert.equal(readMeasurementState(null),null);for(const invalid of [{version:2,records:[]},{version:1,records:new Array(21).fill(records[0])},{version:1,records:[{...records[3],a:[1,2,NaN]}]},{version:1,records:[{...records[3],offset:{x:Infinity,y:0}}]},{version:1,records:[{...records[0],circle:{...records[0].circle,radius:-1}}]},{version:1,records:[{...records[0],circle:{...records[0].circle,normal:[0,0,0]}}]},{version:1,records:[{...records[3],component:'bad'}]}])assert.throws(()=>readMeasurementState(invalid));
console.log('PASS world-axis components/projection/zero, tilted circle circumference/diameter/radius, annotation offsets, ordinary/compressed project roundtrip, legacy/malformed metadata and immutable validation');
