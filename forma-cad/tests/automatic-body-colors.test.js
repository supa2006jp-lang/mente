import test from 'node:test';
import assert from 'node:assert/strict';
import {automaticBodyColors,automaticColorPlan} from '../src/automatic-body-colors.js';

test('role names distinguish lamp parts while existing colors and equivalent shapes are respected',()=>{
 const part=(id,name,dimensions,appearance)=>({id,name,dimensions,appearance});
 const parts=[
  part('cab','キャビン本体・窓開口とホイールアーチ',[90,60,40]),
  part('lens','ヘッドライト・レンズ',[8,5,2]),
  part('bezel','ヘッドライト・ベゼル',[8,5,2]),
  part('window','フロントガラス',[45,30,1]),
  part('right','押し出し（1）',[6,6,30]),
  part('left','押し出し（2）',[30,6,6]),
  part('painted','荷台',[60,70,15],{color:'#00aaff',customColor:true}),
  part('imported','タイヤ',[20,20,10],{color:'#222222'})
 ];
 const colors=automaticBodyColors(parts);
 assert.equal(colors.size,6);
 assert.notEqual(colors.get('lens'),colors.get('bezel'));
 assert.notEqual(colors.get('window'),colors.get('cab'));
 assert.notEqual(colors.get('right'),colors.get('cab'));
 assert.equal(colors.get('right'),colors.get('left'));
 assert.deepEqual(automaticBodyColors([...parts].reverse()),colors);
 assert.equal(automaticBodyColors(parts.map(body=>({...body,appearance:body.appearance||{color:colors.get(body.id)}}))).size,0);
});

test('print palette counts manual, imported and surface colors before assigning body colors',()=>{
 const bodies=[
  {id:'a',name:'車体',dimensions:[20,20,20],appearance:{color:'#00aaff',customColor:true}},
  {id:'b',name:'タイヤ',dimensions:[8,8,4],appearance:{color:'#222222'}},
  {id:'c',name:'ガラス',dimensions:[20,8,1],surfaceColors:['#ff0000']},
  {id:'d',name:'ホイール',dimensions:[8,8,3],appearance:{color:'#e3e6df',automatic:true}}
 ];
 assert.equal(automaticColorPlan(bodies,{limit:2}).blocked,true);
 const limited=automaticColorPlan(bodies,{limit:3});
 assert.deepEqual([...limited.used],['#00aaff','#222222','#ff0000']);
 assert.deepEqual([...limited.changes.keys()],['c','d']);
 const keep=automaticColorPlan(bodies,{limit:4,replace:false});
 assert.ok(keep.used.has('#e3e6df'));
 assert.equal(keep.changes.has('d'),false);
 assert.notDeepEqual(automaticColorPlan(bodies,{limit:6,theme:'muted'}).changes,
  automaticColorPlan(bodies,{limit:6,theme:'contrast'}).changes);
 const spools=['#00aaff','#222222','#ff0000','#ffff00'];
 const registered=automaticColorPlan(bodies,{limit:4,filaments:spools});
 assert.equal(registered.blocked,false);
 assert.ok([...registered.changes.values()].every(color=>spools.includes(color)));
 assert.deepEqual(automaticColorPlan(bodies,{limit:4,filaments:spools.slice(1)}).outside,['#00aaff']);
});
