import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {defaults,validateFeature} from '../src/geometry.js';
import {basisFor} from '../src/frames.js';
import {channelSketch,channelParameters} from '../src/channel-sketch.js';
import {channelResizeHandles,snapChannelResize} from '../src/channel-resize.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
const project=p=>({x:p.x*5,y:p.y*5,z:0});
const base={...defaults,id:'u',kind:'sketch',width:40,height:30,x:-10,y:5};
for(const plane of ['XY','XZ','YZ','CUSTOM'])for(const angle of [0,37,-110])for(const opening of ['left','up','right','down'])for(const reverse of [false,true]){
 const f=channelSketch({...base,plane,angle,...(plane==='CUSTOM'?{frame:{u:[0,1,0],v:[0,0,1],n:[1,0,0]}}:{})},opening,reverse),params=channelParameters(f),handles=channelResizeHandles(f);assert.equal(handles.length,4);
 for(const h of handles){close(h.point.distanceTo(h.center),params[h.key]/2);close(h.direction.length(),1);close(h.direction.dot(h.normal),0);const resized=channelSketch({...f,...params,[h.key]:73.5},opening,reverse);validateFeature(resized);const next=channelResizeHandles(resized).find(n=>n.key===h.key&&n.sign===h.sign);close(next.point.distanceTo(h.point),(73.5-params[h.key])/2);assert.deepEqual(next.center.toArray(),h.center.toArray());close(channelParameters(resized)[h.key==='width'?'height':'width'],params[h.key==='width'?'height':'width']);}
}
const f=channelSketch(base,'left'),handle=channelResizeHandles(f).find(h=>h.key==='width'&&h.sign===1),options={basis:basisFor(f),project};
let result=snapChannelResize(handle,59.4,{...options,step:10});close(result.size,60);assert.equal(result.kind,'grid');close(result.point.x,20);
result=snapChannelResize(handle,49.4,{...options,step:5});close(result.size,50);assert.equal(result.kind,'grid');
result=snapChannelResize(handle,74.1,{...options,references:[[27.25,5,0]],step:10});close(result.size,74.5);assert.equal(result.kind,'vertex');
result=snapChannelResize(handle,74.1,{...options,references:[[27.25,5,8]],step:10});close(result.size,74.1);assert.equal(result.kind,null);
result=snapChannelResize(handle,74.1,{...options,references:[[27.25,5.5,0]],step:10});close(result.size,74.1);assert.equal(result.kind,null);
result=snapChannelResize(handle,74.1,{...options,enabled:false,references:[[27.25,5,0]]});close(result.size,74.1);assert.equal(result.kind,null);
close(snapChannelResize(handle,-5,{...options,enabled:false}).size,.1);close(snapChannelResize(handle,15000,{...options,enabled:false}).size,10000);
// Rotated geometry snaps against the sketch grid, never the global XY plane.
const rotated=channelSketch({...base,plane:'XZ',angle:37},'up'),h=channelResizeHandles(rotated).find(h=>h.key==='height'&&h.sign===-1),b=basisFor(rotated),view=p=>({x:p.dot(b.u)*5,y:p.dot(b.v)*5,z:0}),target=h.center.clone().addScaledVector(h.direction,23.456);
result=snapChannelResize(h,46.8,{basis:b,project:view,references:[target],step:10});close(result.size,46.912);assert.equal(result.kind,'vertex');
assert.deepEqual(channelResizeHandles({...f,closed:true}),[]);
const proof={localAxesAllPlanes:true,centerFixed:true,otherDimensionPreserved:true,mirroredTraversal:true,gridSpacing:true,vertexSnap:true,otherPlaneRejected:true,snapDisabled:true,sizeLimits:true,rotatedPlaneSnap:true};await fs.mkdir('outputs/channel-resize',{recursive:true});await fs.writeFile('outputs/channel-resize/geometry-proof.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
