import {test} from 'node:test';
import assert from 'node:assert/strict';
import {strFromU8,unzipSync} from 'three/addons/libs/fflate.module.js';
import {prepareColor3mfParts,packColor3mf,color3mfPreviewParts,color3mfRepairMessage} from '../src/color-3mf.js';
import {indexedPrintSupportMesh} from '../src/print-support-3mf-mesh.js';
import {inspectStlMesh} from '../src/stl-mesh-health.js';

function cube(x,y=0,otherDiagonal=false){
 const vertices=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]]
  .flatMap(([a,b,c])=>[x+a,y+b,c]);
 const quads=[[0,3,2,1],[4,5,6,7],[0,1,5,4],[3,7,6,2],[0,4,7,3],[1,2,6,5]];
 return {vertices,triangles:quads.flatMap(([a,b,c,d])=>otherDiagonal?[a,b,d,b,c,d]:[a,b,c,a,c,d])};
}
function join(a,b){
 return {vertices:[...a.vertices,...b.vertices],triangles:[...a.triangles,...b.triangles.map(i=>i+a.vertices.length/3)]};
}
function faceKey(part,i){
 return part.triangles.slice(i*3,i*3+3).map(v=>part.vertices.slice(v*3,v*3+3).join(',')).sort().join('|');
}
const xmlOf=bytes=>strFromU8(unzipSync(bytes)['3D/3dmodel.model']);

test('surface paint follows surviving exterior faces across alternate diagonals and anonymous parts',async()=>{
 const x=0.123456789;
 const a={...join(cube(x),cube(x+1,1)),name:'Red & clear',color:'#da2050'};
 const b={...join(cube(x+1,0,true),cube(x,1,true)),name:'Green',color:'#228855'};
 a.colors=Array.from({length:24},(_,i)=>i===0?'transparent:#123456':a.color);
 a.triangles.unshift(0,0,1);a.colors.unshift('#ffff00'); // discarded face before the painted one
 const far={...cube(5),name:'Other',color:'#123456'};
 const input=[a,b,far],before=structuredClone(input);
 const parts=await prepareColor3mfParts(input);
 assert.equal(parts.length,2);
 const [shell,other]=parts;
 assert.equal(shell.removedFaces,16);
 assert.equal(shell.triangles.length/3,32);
 assert.equal(inspectStlMesh(shell).volume.toFixed(5),'4.00000');
 assert.doesNotThrow(()=>indexedPrintSupportMesh(shell));
 assert.ok(shell.vertices.includes(x),'3MF keeps the original double, including in the repaired shell');
 assert.deepEqual(other.triangles,far.triangles);
 const exterior=new Map();
 for(const source of [a,b])for(let i=0;i<source.triangles.length/3;i++)exterior.set(faceKey(source,i),source.colors?.[i]??source.color);
 for(const [i,color] of shell.colors.entries())assert.equal(exterior.get(faceKey(shell,i)),color);
 assert.equal(shell.colors.filter(c=>c==='transparent:#123456').length,1);
 const preview=color3mfPreviewParts(parts);
 assert.deepEqual(preview.map(p=>p.triangles.length/3),[16,16,12]);
 assert.equal(preview[0].faceColors.filter(v=>v==='#123456').length,1);
 assert.equal(preview[1].color,'#228855');
 const {data,colorCount}=packColor3mf(parts),xml=xmlOf(data);
 assert.equal(colorCount,4);assert.ok(xml.includes('name="Red &amp; clear / Green"'));
 const palette=[...xml.matchAll(/<m:color color="(#[0-9A-F]{6})FF"/g)].map(m=>m[1].toLowerCase());
 const faces=[...xml.matchAll(/pid="1" p1="([0-9]+)" p2="([0-9]+)" p3="([0-9]+)"/g)];
 assert.equal(faces.length,44);
 for(const [i,match] of faces.entries()){
  const expected=i<32?shell.colors[i]:far.color;
  assert.equal(match[1],match[2]);assert.equal(match[1],match[3]);
  assert.equal(palette[Number(match[1])],expected==='transparent:#123456'?'#123455':expected);
 }
 assert.match(color3mfRepairMessage(parts),/16枚/);
 assert.deepEqual(input,before);
});

test('independently repairable colours keep separate objects and material components',async()=>{
 const group={id:'parent',name:'Assembly'};
 for(const grouped of [false,true]){
  const common=grouped?{group}:{};
  const a={...cube(0),id:'a',name:'First',color:'#ff0000',...common};
  const b={...cube(1),id:'b',name:'Second',color:'#00ff00',...common};
  a.triangles.push(...a.triangles.slice(0,3));
  const prepared=await prepareColor3mfParts([a,b]);
  assert.deepEqual(prepared.map(p=>p.name),['First','Second']);
  assert.equal(prepared[0].removedFaces,1);assert.equal(prepared[1].removedFaces,undefined);
  assert.deepEqual(color3mfPreviewParts(prepared).map(p=>p.id),grouped?['parent','parent']:['a','b']);
  const zip=unzipSync(packColor3mf(prepared).data);
  if(grouped){const config=strFromU8(zip['Metadata/model_settings.config']);
   assert.match(config,/key="extruder" value="2"/);assert.match(strFromU8(zip['3D/3dmodel.model']),/<component objectid="3"/);}
 }
 const a={...join(cube(0),cube(1,1)),id:'a',name:'A',color:'#ff0000',group};
 const b={...join(cube(1),cube(0,1)),id:'b',name:'B',color:'#00ff00',group};
 await assert.rejects(prepareColor3mfParts([a,b]),/A の3MF出力に失敗/);
});

test('open surfaces, sub-float gaps and raised panels do not become sealed by rounding',async()=>{
 const base={name:'Unclosed',color:'#aa4422'};
 const open={...cube(10000),...base};
 open.triangles.splice(0,3);open.triangles.push(...open.triangles.slice(0,3));
 await assert.rejects(prepareColor3mfParts([open]),/Unclosed/);
 const a=cube(10000),b=cube(10001+0.000001);
 await assert.rejects(prepareColor3mfParts([{...join(a,b),...base}]),/Unclosed/);
 const panel=cube(10001);
 panel.vertices.push(10001.000001,.5,.5);
 panel.triangles.splice(24,6,0,4,8,4,7,8,7,3,8,3,0,8);
 await assert.rejects(prepareColor3mfParts([{...join(a,panel),...base}]),/Unclosed/);
});

test('native fallback and cancellation never transfer paint to a different triangulation',async()=>{
 const part={...cube(0),name:'Native',color:'#123456',brep:'solid'};
 part.triangles.splice(0,3);
 let calls=0;
 const remesh=async p=>{assert.equal(p,part);calls++;return cube(0);};
 const [fixed]=await prepareColor3mfParts([part],{remesh});
 assert.equal(fixed.triangles.length,36);assert.equal(calls,1);
 await assert.rejects(prepareColor3mfParts([{...part,colors:Array(11).fill('#ffffff')}],{remesh}),/Native/);
 assert.equal(calls,1);
 let current=true;
 await assert.rejects(prepareColor3mfParts([part],{isCurrent:()=>current,remesh:async()=>{current=false;return cube(0);}}),/モデルが変更/);
});
