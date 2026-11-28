import {test} from 'node:test';
import assert from 'node:assert/strict';
import {strFromU8,unzipSync} from 'three/addons/libs/fflate.module.js';
import {bambuPaintCode,packColor3mf} from '../src/color-3mf.js';
import {bambuModelPlacement} from '../src/bambu-a1-mini-project.js';

const tetra={vertices:[0,0,0,1,0,0,0,1,0,0,0,1],triangles:[0,2,1,0,1,3,0,3,2,1,2,3]};
const color=i=>'#'+(0x112200+i).toString(16);
const make=(n)=>Array.from({length:n},(_,i)=>({...tetra,name:'Part '+(i+1),color:color(i)}));
function unpack(parts,options){
 const files=unzipSync(packColor3mf(parts,options).data);
 return Object.fromEntries(Object.entries(files).map(([k,v])=>[k,strFromU8(v)]));
}
test('native assembly preserves each material and explicitly paints non-base facets above slot 16',()=>{
 const parts=make(25);
 parts[24].name='Reflector & rim';parts[24].colors=[color(24),color(1),color(17),color(23)];
 const options={bambuA1Mini:true,assemblyName:'CT125 & test'},f=unpack(parts,options);
 const project=JSON.parse(f['Metadata/project_settings.config']),model=f['3D/3dmodel.model'],meta=f['Metadata/model_settings.config'];
 assert.equal(project.printer_settings_id,'Bambu Lab A1 mini 0.4 nozzle');
 assert.deepEqual(project.filament_colour,parts.map(p=>p.color.toUpperCase()));
 assert.equal(project.filament_settings_id.length,25);assert.equal(project.filament_is_support.length,25);
 assert.deepEqual(project.nozzle_diameter,['0.4']);assert.equal(project.flush_volumes_matrix.length,625);
 assert.equal(project.inherits_group.length,27);assert.equal(project.flush_volumes_vector.length,50);
 assert.equal((model.match(/<item /g)||[]).length,1);
 assert.equal((model.match(/<component /g)||[]).length,25);
 assert.match(model,/BambuStudio-02.04.00.70/);
 assert.equal((model.match(/paint_color="/g)||[]).length,4);
 for(const id of [2,18,24,25])assert.ok(model.includes('paint_color="'+bambuPaintCode(id)+'"'));
 assert.match(meta,/key="name" value="Reflector &amp; rim"/);
 assert.match(meta,/key="extruder" value="25"/);
 assert.deepEqual([1,2,3,17,18,22,23,25,32].map(bambuPaintCode),['4','8','0C','EC','0FC','4FC','5FC','7FC','EFC']);
});
test('plate placements keep independent build items and native material volumes retain their parent',()=>{
 const parts=make(3);parts[0].group=parts[1].group={id:'join',name:'Insert'};
 const f=unpack(parts,{bambuA1Mini:true});
 assert.equal((f['3D/3dmodel.model'].match(/<item /g)||[]).length,2);
 assert.match(f['Metadata/model_settings.config'],/key="extruder" value="3"/);
 assert.ok(!unpack(parts,{})['Metadata/project_settings.config']);
 const one=JSON.parse(unpack([parts[2]],{bambuA1Mini:true})['Metadata/project_settings.config']);
 assert.equal(one.filament_colour.length,1);assert.deepEqual(one.flush_volumes_matrix,['0']);
});
test('Bambu Studio accepts up to 32 paint slots and the standard file can contain more',()=>{
 assert.doesNotThrow(()=>packColor3mf(make(32),{bambuA1Mini:true}));
 assert.throws(()=>packColor3mf(make(33),{bambuA1Mini:true}),/32色/);
 assert.equal(packColor3mf(make(33)).colorCount,33);
});
test('bed fit scales only the assembly instance and centres its original CAD coordinates',()=>{
 const parts=make(2);parts[1].vertices=parts[1].vertices.map((x,i)=>i%3===0?x+199:x);
 const before=structuredClone(parts),placement=bambuModelPlacement(parts,true);
 assert.equal(placement.scale,166/200);assert.deepEqual(placement.offset,[7,90-placement.scale/2,-0]);
 const model=unpack(parts,{assemblyName:'bike',bambuA1Mini:true,placement})['3D/3dmodel.model'];
 assert.ok(model.includes('transform="0.83 0 0 0 0.83 0 0 0 0.83 7 89.585 0"'));
 assert.ok(model.includes('<vertex x="200"'));assert.deepEqual(parts,before);
 assert.equal(bambuModelPlacement(parts,false).scale,1);
 assert.equal(bambuModelPlacement(make(1),true).scale,1);
});
