import assert from 'node:assert/strict';
import {extrusionTipWheelPosition} from '../src/extrusion-wheel.js';
const overlap=(a,b)=>a.x<b.right&&a.x+104>b.left&&a.y<b.bottom&&a.y+104>b.top;
for(const [angle,dx,dy]of [[0,0,-1],[90,1,0],[180,0,1],[-90,-1,0]]){
 const p=extrusionTipWheelPosition({width:800,height:600,x:300,y:300,angle});assert.ok(p);assert.ok(Math.abs(p.x+52-300-dx*92)<1e-6);assert.ok(Math.abs(p.y+52-300-dy*92)<1e-6);
}
for(const [x,y]of [[22,22],[778,22],[22,578],[778,578],[400,300]]){
 const obstacle={left:325,top:120,right:475,bottom:220},p=extrusionTipWheelPosition({width:800,height:600,x,y,angle:0,obstacles:[obstacle]});assert.ok(p);assert.ok(p.x>=8&&p.y>=8&&p.x+104<=792&&p.y+104<=592);assert.ok(!overlap(p,obstacle));assert.ok(!overlap(p,{left:x-30,top:y-30,right:x+30,bottom:y+30}));
}
assert.equal(extrusionTipWheelPosition({width:110,height:600,x:55,y:300,angle:0}),null);
assert.equal(extrusionTipWheelPosition({width:300,height:300,x:150,y:150,angle:0,obstacles:[{left:0,top:0,right:300,bottom:300}]}),null);
console.log('PASS arrow direction, viewport edges, obstacle/handle avoidance and insufficient space');
