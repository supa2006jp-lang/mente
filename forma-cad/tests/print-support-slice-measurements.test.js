import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {cadMesh} from '../src/cad-mesh.js';
import {inspectSupportSlicePaths,supportSlicePoint} from '../src/print-support-slice-paths.js';
import {captureSupportSliceReport,createSupportSliceHistory,supportSliceComparisonScope} from '../src/print-support-slice-comparison.js';

const rotated=[0,1,0,-1,0,0,0,0,1,45,55,0];
const moved=[1,0,0,0,1,0,0,0,1,110,98,2];

function machinePaths(matrix,{prior=false}={}){
 const lines=['G90','M83','; OBJECT_ID: 1'];
 function path(a,b,feature,width){
  const p=supportSlicePoint(matrix,[...a,0]),q=supportSlicePoint(matrix,[...b,0]);
  lines.push('; FEATURE: '+feature,'; LINE_WIDTH: '+width,'G0 X'+p[0]+' Y'+p[1],'G1 X'+q[0]+' Y'+q[1]+' E.3');
 }
 for(let i=1;i<=10;i++){
  const z=i*.25+matrix[11];
  lines.push('; Z_HEIGHT: '+z,'; LAYER_HEIGHT: .25','G1 Z'+z);
  if(i<=8)path([.65,.1],[.65,3.9],'Outer wall',.5);
  if(i<=7&&(!prior||i!==2)&&(prior||i!==7))path([1.45,.1],[1.45,3.9],'Outer wall',.5);
  if(i<=7&&i!==3)path([6,.1],[6,3.9],'Outer wall',.4);
  if(i===7)path([4,.1],[4,3.9],'Support interface',.4);
  if(i>=9){
   path([.9,2],[7.8,2],'Bottom surface',.4);
   path([7.8,2],[7.8,3.7],'Bottom surface',.4);
  }
 }
 return lines.join('\n');
}

test('lateral gaps and first ceiling paths use the deposited width and CAD registration',async()=>{
 const wasmBinary=await readFile(new URL('../node_modules/replicad-opencascadejs/dist/replicad_single.wasm',import.meta.url));
 R.setOC(await init({wasmBinary}));
 const wall=R.makeBox([0,0,0],[.8,4,2]),roof=R.makeBox([0,0,2],[8,4,3]);
 const model=wall.fuse(roof),near=R.makeBox([1.3,0,0],[1.8,4,1.7]),far=R.makeBox([5.8,0,0],[6.2,4,1.7]);
 const solid=R.makeCompound([near,far]),models=[{id:'ceiling',...cadMesh(model)}];
 try{
  const face={vertices:[.8,0,2,8,0,2,8,4,2,.8,4,2],triangles:[0,1,2,0,2,3]};
  const sources=[{target:'ceiling',mesh:{id:'ribs',...cadMesh(solid)},sideGap:.5,topGap:.3,bedZ:0,lineWidth:.4,wallThickness:.5,
   baseIds:['ceiling'],skins:[],columns:[],ceilings:[{id:'under',number:1,face}],ribs:[
    {id:'near',number:1,axis:0,center:1.5,ceiling:2,bounds:[[1.3,0,0],[1.8,4,1.7]]},
    {id:'far',number:2,axis:0,center:6,ceiling:2,bounds:[[5.8,0,0],[6.2,4,1.7]]},
   ]}];
  const before=inspectSupportSlicePaths({gcode:machinePaths(rotated,{prior:true}),objectId:'1',matrix:rotated,sources,models});
  const lateral=before.lateral[0];
  assert.equal(lateral.requested,.5);
  assert.equal(lateral.layers[0].index,1);
  assert(Math.abs(lateral.layers[0].minimum-.3)<1e-6);
  assert(lateral.layers[0].samples.every(sample=>sample.from[0]>sample.to[0]&&sample.widthKnown));
  assert(lateral.layers[0].samples.every(sample=>sample.from[2]===lateral.layers[0].z&&sample.to[2]===lateral.layers[0].z));
  const ceiling=before.ceilings[0].measured;
  assert.equal(ceiling.index,9);
  assert.equal(ceiling.z,2.25);
  assert(ceiling.lengths.rib>0&&ceiling.lengths.auto>0&&ceiling.lengths.open>0);
  assert(ceiling.longest>1&&ceiling.longest<=ceiling.lengths.open);
  for(const paths of Object.values(ceiling.paths))for(let i=0;i<paths.length;i+=6){
   assert(Math.abs(paths[i]-paths[i+3])<1e-6||Math.abs(paths[i+1]-paths[i+4])<1e-6,'do not draw a shortcut across a turn');
  }
  const previous=captureSupportSliceReport(before.rows);
  previous[0].missing.push([7,3,1]);
  const after=inspectSupportSlicePaths({gcode:machinePaths(moved),objectId:'1',matrix:moved,sources,models,previous});
  const comparison=after.comparison[0];
  assert(comparison.restored.count>0);
  assert(comparison.remaining.count>0);
  assert.equal(comparison.moved.count,1);
  assert(comparison.vertical.count>0);
  assert(comparison.vertical.changes.some(item=>item.role==='upper'&&item.before.layers===1&&item.after.layers===2));
  assert(Math.abs(after.lateral[0].layers[0].minimum-.3)<1e-6);
 }finally{[wall,roof,model,near,far,solid].forEach(shape=>shape.delete());}
});

test('slice history is reusable for the same CAD body and isolated by model geometry',()=>{
 const storage=new Map(),get=()=>({getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)});
 const original={id:'target',vertices:[0,0,0,1,0,0,1,1,0],triangles:[0,1,2]};
 const sources=[{target:'target'}],key=supportSliceComparisonScope(sources,[original]);
 const history=createSupportSliceHistory(get);
 history.remember(key,{name:'before.3mf',report:[{id:'target',missing:[[.5,.5,.2]],contacts:[]}]});
 const reordered={...original,vertices:[1,1,0,0,0,0,1,0,0]};
 const different={...original,vertices:[0,0,0,3,0,0,1,1,0]};
 const reopened=createSupportSliceHistory(get);
 assert.equal(reopened.previous(supportSliceComparisonScope(sources,[reordered])).name,'before.3mf');
 assert.equal(reopened.previous(supportSliceComparisonScope(sources,[different])),null);
});
