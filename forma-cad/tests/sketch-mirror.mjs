import assert from 'node:assert/strict';
import * as THREE from 'three';
import {defaults,makeSketchGeometry,validateFeature} from '../src/geometry.js';
import {mirrorSketch,sketchMirrorPlane} from '../src/sketch-mirror.js';
import {basisFor,validateFrame,worldPoint} from '../src/frames.js';
import {sketchPoints,planeCoordinates,findRegions} from '../src/regions.js';
import {selectedSketchParts,sketchSegments} from '../src/sketch-selection.js';

const frames=[{plane:'XY'}, {plane:'XZ'}, {plane:'YZ'}, {plane:'CUSTOM',frame:{u:[Math.SQRT1_2,0,-Math.SQRT1_2],v:[0,1,0],n:[Math.SQRT1_2,0,Math.SQRT1_2]}}];
const world=f=>sketchPoints(f).map(p=>worldPoint({...f,offset:planeCoordinates(f).offset},p));
for(const frame of frames)for(const profile of ['point','line','rect','circle','polyline','spline'])for(const plane of ['U','V','XY','XZ','YZ','LINE']){
 const source={...defaults,...frame,id:'s',name:profile,kind:'sketch',profile,mode:profile==='line'?'thin':'solid',x:12,y:5,z:7,angle:27,points:[[4,2],[8,4],[12,1]],closed:false,tangents:{start:37,end:-68},tangentLengths:{start:4,end:7},groupId:'g',groupNumber:1};
 const spec=plane==='LINE'?{mirrorNormal:[1,2,3],mirrorOrigin:[4,5,6],offset:2}:{plane,offset:3};
 const original=structuredClone(source),copy=mirrorSketch(source,spec);validateFeature(copy);validateFrame(copy.frame);assert.deepEqual(source,original);assert.notEqual(copy.id,source.id);assert.equal(copy.profile,profile);
 const {normal,origin}=sketchMirrorPlane(source,spec),expected=world(source).map(p=>p.clone().addScaledVector(normal,2*origin.clone().sub(p).dot(normal))),actual=world(copy);
 // Rectangles and circles keep their primitive representation; their sample order reverses.
 for(const p of expected)assert.ok(actual.some(q=>q.distanceTo(p)<1e-7),profile+' '+frame.plane+' '+plane);
 if(['U','V'].includes(plane)){assert.ok(basisFor(copy).n.distanceTo(basisFor(source).n)<1e-7);assert.equal(copy.groupId,'g');}
 if(profile==='spline'){assert.equal(copy.tangents.start,-37);assert.deepEqual(copy.tangentLengths,source.tangentLengths);assert.equal(copy.points.length,source.points.length);}
 const twice=mirrorSketch(copy,{mirrorNormal:normal.toArray(),mirrorOrigin:origin.toArray()});for(const p of world(source))assert.ok(world(twice).some(q=>q.distanceTo(p)<1e-7),'double mirror restores shape');
}
const rect={...defaults,id:'r',name:'枠',kind:'sketch',profile:'rect',width:20,height:10,x:25,y:3,z:0,groupId:'g',groupNumber:1};
const partial=selectedSketchParts(rect,new Set([0,1]));assert.equal(partial.length,1);const partialCopy=mirrorSketch(partial[0],{plane:'V'});assert.equal(partialCopy.profile,'polyline');assert.equal(sketchSegments(partialCopy).length,2,'only selected edges copied');
const copy=mirrorSketch(rect,{plane:'V'}),regions=findRegions([rect,copy]);assert.equal(regions.length,2);for(const region of regions)assert.ok(Math.abs(region.area-200)<1e-5,'mirrored closed profile remains extrudable');
const hidden=mirrorSketch({...rect,groupHidden:true},{plane:'V'});assert.equal(hidden.groupHidden,false);assert.equal(hidden.groupId,undefined);
assert.throws(()=>mirrorSketch(rect,{plane:'LINE'}));assert.throws(()=>mirrorSketch(rect,{mirrorNormal:[0,0,0]}));assert.throws(()=>mirrorSketch(rect,{plane:'V',offset:NaN}));
console.log('PASS sketch mirror primitives, fit points/tangents, custom planes, normal direction, selected edges, closed regions, source immutability and double reflection');
