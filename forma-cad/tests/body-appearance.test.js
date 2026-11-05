import test from 'node:test';
import assert from 'node:assert/strict';
import {bodyAppearances,bodyMaterialOptions,importBodyAppearance} from '../src/body-appearance.js';

test('existing file colours and glazing survive a save and a shape edit',()=>{
 const original=[
  {kind:'cadop',id:'import',outputs:[{id:'cab'},{id:'glass'},{id:'tire'},{id:'plain'}],remove:[]},
  {kind:'cadop',id:'trim',spec:{target:'glass'},remove:['glass'],outputs:[{id:'glass'}]}
 ];
 const next=importBodyAppearance(original,{displayColors:{cab:'#E7E9DF',glass:'#355a6c',tire:'#20252a',plain:'url(invalid)',absent:'#ffffff'},displayOpacity:{glass:.58}});
 const saved=JSON.parse(JSON.stringify(next));
 assert.equal(original[0].bodyAppearance,undefined);
 assert.equal(next[0].outputs,original[0].outputs);
 assert.deepEqual([...bodyAppearances(saved)],[['cab',{color:'#e7e9df'}],['tire',{color:'#20252a'}],['glass',{color:'#355a6c',opacity:.58}]]);
 assert.equal(bodyAppearances([...saved,{kind:'cadop',id:'remove',remove:['glass'],outputs:[]}]).has('glass'),false);
});

test('transparent bodies use their assigned colour without weakening section or QR contrast',()=>{
 const glass={color:'#355a6c',opacity:.58};
 assert.deepEqual(bodyMaterialOptions(glass),{color:'#355a6c',vertexColors:false,roughness:.28,opacity:.58,transparent:true,depthWrite:false});
 assert.equal(bodyMaterialOptions(glass,{splitColor:0x65a9d8}).opacity,1);
 assert.equal(bodyMaterialOptions(glass,{vertexColors:true}).color,0xffffff);
 assert.equal(bodyMaterialOptions().color,0xa3a197);
});
