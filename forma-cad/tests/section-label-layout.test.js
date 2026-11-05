import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sectionLabelIndices,SECTION_LABEL_LIMIT} from '../src/section-label-layout.js';
test('dense assemblies bound placement work and prioritize screen-centre labels',()=>{
 const points=Array.from({length:146},(_,i)=>({x:(i-73)/100,y:0,z:0}));
 const shown=sectionLabelIndices(points);assert.equal(shown.size,SECTION_LABEL_LIMIT);assert.ok(shown.has(73));assert.ok(!shown.has(0));assert.deepEqual([...shown],[...sectionLabelIndices(points)]);
});
test('small sections retain every visible body and omit clipped/outside anchors',()=>{
 assert.deepEqual([...sectionLabelIndices([{x:0,y:0,z:0},null,{x:2,y:0,z:0},{x:0,y:0,z:2},{x:.4,y:.5,z:0}])],[0,4]);
});
