import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bodyFilletEntries} from '../src/body-fillet-list.js';
const features=[
 {kind:'cadop',id:'source',name:'元のソリッド'},
 {kind:'cadop',id:'A-round',name:'フィレット1',spec:{type:'fillet',target:'A',radius:2}},
 {kind:'cadop',id:'move',name:'移動',spec:{type:'move',target:'A'}},
 {kind:'cadop',id:'shared',name:'フィレット2',spec:{type:'fillet',target:'A',radius:1,edges:[{bodyId:'A'},{bodyId:'B'},{bodyId:'B'}],suppressedTargets:['A']}},
 {kind:'cadop',id:'A-off',name:'フィレット3',spec:{type:'fillet',target:'A',radius:.5,suppressed:true}},
 {kind:'cadop',id:'B-round',name:'フィレット4',spec:{type:'fillet',target:'B',radius:3}},
 {kind:'cadop',id:'chamfer',name:'面取り',spec:{type:'chamfer',target:'A',distance:2}},
];
test('lists only the selected body’s fillets, including disabled entries in history order',()=>{
 const entries=bodyFilletEntries(features,'A');
 assert.deepEqual(entries.map(e=>[e.id,e.index,e.radius,e.suppressed]),[['A-round',1,2,false],['shared',3,1,true],['A-off',4,.5,true]]);
});
test('shared operations appear once and show the state of the selected body',()=>{
 const a=bodyFilletEntries(features,'A').find(e=>e.id==='shared'),b=bodyFilletEntries(features,'B');
 assert.equal(a.shared,true);assert.equal(a.suppressed,true);assert.deepEqual(b.map(e=>e.id),['shared','B-round']);assert.equal(b[0].suppressed,false);assert.equal(b[0].shared,true);
});
test('empty histories and missing body IDs leave project data unchanged',()=>{
 const snapshot=JSON.stringify(features);assert.deepEqual(bodyFilletEntries(features,'missing'),[]);assert.deepEqual(bodyFilletEntries([],'A'),[]);bodyFilletEntries(features,'B');assert.equal(JSON.stringify(features),snapshot);
});
