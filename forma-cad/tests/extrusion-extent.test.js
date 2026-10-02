import test from 'node:test';
import assert from 'node:assert/strict';
import {depthToGridPlane} from '../src/extrusion-extent.js';

test('押し出しは各基準グリッドの原点平面で正確に止まる',()=>{
 assert.equal(depthToGridPlane({plane:'XY',x:3,y:4,z:25},'XY'),-25);
 assert.equal(depthToGridPlane({plane:'XZ',x:3,y:-12,z:4},'XZ'),12);
 assert.equal(depthToGridPlane({plane:'YZ',x:30,y:4,z:5},'YZ'),-30);
});

test('領域の offset と逆向き custom frame でも符号を保つ',()=>{
 const frame={u:[1,0,0],v:[0,-1,0],n:[0,0,-1]};
 assert.equal(depthToGridPlane({region:{plane:'CUSTOM',frame,offset:7}},'XY'),-7);
 assert.equal(depthToGridPlane({plane:'CUSTOM',frame,x:0,y:0,z:-5},'XY'),-5);
 assert.equal(depthToGridPlane({region:{plane:'XZ',offset:-8}},'XZ'),8);
});

test('到達不能な平面、短すぎる距離、長すぎる距離を拒否する',()=>{
 assert.throws(()=>depthToGridPlane({plane:'XY',x:0,y:0,z:5},'XZ'),/平行ではない/);
 assert.throws(()=>depthToGridPlane({plane:'XY',x:0,y:0,z:0},'XY'),/0.1 mm 未満/);
 assert.throws(()=>depthToGridPlane({plane:'XY',x:0,y:0,z:.099},'XY'),/0.1 mm 未満/);
 assert.equal(depthToGridPlane({plane:'XY',x:0,y:0,z:.1},'XY'),-.1);
 assert.throws(()=>depthToGridPlane({plane:'XY',x:0,y:0,z:10000.01},'XY'),/10000 mm 以下/);
 assert.throws(()=>depthToGridPlane({plane:'XY',x:0,y:0,z:5},'CUSTOM'),/XY・XZ・YZ/);
});
