import test from 'node:test';
import assert from 'node:assert/strict';
import {automaticBodyColors} from '../src/automatic-body-colors.js';

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
