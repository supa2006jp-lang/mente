import assert from 'node:assert/strict';
import {coilSplitPlacement} from '../src/coil-split-view.js';
const q={origin:[10,20,30],axis:[0,1,0],radius:20,outerRadius:25,split:48,wall:3.3,neckLength:14.4,extension:1.4,sourceHeight:80,auto:true,minimumSplit:16.3,minimumLidHeight:19.3};
const near=(actual,expected)=>actual.forEach((v,i)=>assert.ok(Math.abs(v-expected[i])<1e-8));
let s=coilSplitPlacement(q,'閉じた状態');near(s.center.toArray(),[10,68,30]);near(s.axis.toArray(),[0,1,0]);near(s.handle.toArray(),[38,68,30]);assert.equal(s.min,16.3);assert.equal(s.max,9980.7);
s=coilSplitPlacement(q,'分けて並べる');near(s.center.toArray(),[10,20,48]);near(s.axis.toArray(),[0,0,1]);near(s.handle.toArray(),[38,20,48]);
s=coilSplitPlacement({...q,auto:false},'開閉スライダー',60);near(s.center.toArray(),[10,80,30]);assert.equal(s.max,60.7);
s=coilSplitPlacement({...q,axis:[1,0,0]},'1回転開く',50);near(s.center.toArray(),[60,20,30]);near(s.axis.toArray(),[1,0,0]);
console.log('PASS split placement for translated X/Y axes, separated XY print pose, and automatic/manual height limits');
