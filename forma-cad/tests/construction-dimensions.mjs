import assert from 'node:assert/strict';
import * as THREE from 'three';
import {defaults,validateFeature,validateProject,makeSketchGeometry} from '../src/geometry.js';
import {findRegions} from '../src/regions.js';
import {sketchLine} from '../src/sketch-line.js';
import {portableSketch} from '../src/selection-template.js';
import {measurePoints,firstMeasurementSegmentHit,measurementDirection} from '../src/dimension-measure-geometry.js';
import {sketchMirrorDuplicateKey} from '../src/sketch-mirror-duplicates.js';
import {encodeProjectDocument,decodeProjectDocument} from '../src/project-codec.js';
const f=(id,points,extra={})=>({...defaults,id,name:id,kind:'sketch',profile:'polyline',points,closed:false,...extra}),box=f('box',[[0,0],[40,0],[40,30],[0,30]],{closed:true}),divider=f('helper',[[20,-10],[20,40]],{construction:true});
assert.equal(findRegions([box,divider]).length,1);assert.equal(findRegions([box,{...divider,construction:false}]).length,2);assert.equal(findRegions([{...box,construction:true}]).length,0);assert.equal(portableSketch(divider).construction,true);assert.notEqual(sketchMirrorDuplicateKey(divider),sketchMirrorDuplicateKey({...divider,construction:false}));assert.throws(()=>validateFeature({...divider,construction:'yes'}));assert.throws(()=>validateFeature({...divider,kind:'extrusion'}));
const line=sketchLine(makeSketchGeometry(divider),{construction:true,color:0x8a65b5});assert(line.children.every(c=>c.material.dashed));assert(line.children.every(c=>c.geometry.getAttribute('instanceDistanceStart')));line.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
const data={format:'forma-cad',version:1,features:[box,divider]};assert.deepEqual(validateProject((await decodeProjectDocument((await encodeProjectDocument(data,{compress:true})).text)).document),data.features);
assert.equal(measurePoints([0,0,0],[3,4,12]).distance,13);assert.throws(()=>measurementDirection([0,0,0]));assert.throws(()=>measurementDirection([NaN,0,0]));
const segments=[{a:[10,-5,0],b:[10,5,0],label:'near'},{a:[30,-5,0],b:[30,5,0],label:'far'},{a:[-10,-5,0],b:[-10,5,0],label:'back'}];let hit=firstMeasurementSegmentHit([0,0,0],[1,0,0],segments);assert.equal(hit.distance,10);assert.equal(hit.label,'near');assert.equal(firstMeasurementSegmentHit([0,0,0],[-1,0,0],segments).label,'back');assert.equal(firstMeasurementSegmentHit([0,10,0],[1,0,0],segments),null);assert.equal(firstMeasurementSegmentHit([0,0,2],[1,0,0],segments),null);
hit=firstMeasurementSegmentHit([10,0,0],[1,0,0],segments);assert.equal(hit.label,'far');assert.equal(hit.distance,20);assert.equal(firstMeasurementSegmentHit([0,0,0],[1,0,0],[{a:[2,0,0],b:[5,0,0]}]).distance,2);assert(Math.abs(firstMeasurementSegmentHit([0,0,0],[1,1,0],[{a:[10,0,0],b:[10,20,0]}]).distance-Math.sqrt(200))<1e-8);
for(const axis of [0,1,2]){const a=[0,0,0],b=[0,0,0],direction=[0,0,0];direction[axis]=1;a[axis]=b[axis]=7;a[(axis+1)%3]=-2;b[(axis+1)%3]=2;assert.equal(firstMeasurementSegmentHit([0,0,0],direction,[{a,b}]).distance,7);}
console.log('PASS construction-only geometry exclusion, divider behavior, dashed strokes, saved flags/library portability, 3D distance, finite directional segments, first hit, reverse/no-hit/self-contact and XYZ planes');
