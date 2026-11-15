import assert from 'node:assert/strict';
import test from 'node:test';
import {customBodyName,inheritBodyNames,setBodyName} from '../src/body-names.js';

test('names individual outputs without renaming the feature or other bodies',()=>{
 const initial=[{id:'split',kind:'cadop',name:'分離',outputs:[{id:'top'},{id:'base'}]}];
 const renamed=setBodyName(initial,'base','  台座  ');
 assert.equal(customBodyName(renamed,'base'),'台座');
 assert.equal(customBodyName(renamed,'top'),undefined);
 assert.equal(renamed[0].name,'分離');
 assert.equal(initial[0].bodyNames,undefined);
 assert.throws(()=>setBodyName(initial,'missing','新しい名前'));
 assert.throws(()=>setBodyName(initial,'base','   '));
});

test('replaying a feature restores names only for outputs that retain their IDs',()=>{
 const before=[{id:'split',kind:'cadop',outputs:[{id:'top'},{id:'base'}],bodyNames:{top:'カバー',base:'台座'}}];
 const replayed=inheritBodyNames([{id:'split',kind:'cadop',outputs:[{id:'base'},{id:'other'}]}],before);
 assert.deepEqual(replayed[0].bodyNames,{base:'台座'});
});
