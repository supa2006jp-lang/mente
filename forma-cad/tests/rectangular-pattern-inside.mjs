import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {betweenPatternLayout,rectangularOffsets} from '../src/rectangular-pattern.js';
import {meshPatternExtent,solidPatternExtent} from '../src/pattern-bounds.js';
import {patternTransforms} from '../src/patterns.js';
import {runOperation,kernelBodies} from '../src/kernel.js';
import {validateProject} from '../src/geometry.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const p={type:'rectangular',distribution:'between',betweenAlignment:'inside',count:4,count2:1,startPoint:[0,0,5],endPoint:[60,0,5],patternAnchor:[15,25,5],patternExtent:{min:-5,max:5}};
const layout=betweenPatternLayout(p);near(layout.gap,4);assert.deepEqual(layout.offsets.map(o=>o[0]+15),[9,23,37,51]);assert.equal(patternTransforms(p).length,4);
const touching=betweenPatternLayout({...p,endPoint:[40,0,5]});near(touching.gap,0);assert.throws(()=>rectangularOffsets({...p,endPoint:[39,0,5]}),/収まりません/);
for(const extent of [undefined,{min:0,max:0},{min:NaN,max:1}])assert.throws(()=>rectangularOffsets({...p,patternExtent:extent}));
const mesh=new THREE.Mesh(new THREE.BoxGeometry(10,10,10),new THREE.MeshBasicMaterial());mesh.position.set(15,25,5);const previewExtent=meshPatternExtent(mesh,p.startPoint,p.endPoint,p.patternAnchor);near(previewExtent.min,-5);near(previewExtent.max,5);mesh.geometry.dispose();mesh.material.dispose();
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const box=R.makeBox([10,20,0],[20,30,10]),boxMesh=box.mesh({tolerance:.08,angularTolerance:.15}),snapshot=box.serialize(),features=[{kind:'cadop',id:'seed',name:'原型',outputs:[{id:'body',...boxMesh,brep:snapshot}],remove:[]}];
for(const [a,b,count] of [[[0,0,5],[60,0,5],4],[[60,0,5],[0,0,5],4],[[0,0,0],[0,0,70],6],[[0,0,0],[100,80,-50],4],[[0,0,0],[650,0,0],60]]){
 const d=b.map((v,i)=>v-a[i]),distance=Math.hypot(...d),u=d.map(v=>v/distance),width=10*u.reduce((sum,v)=>sum+Math.abs(v),0),gap=(distance-count*width)/(count+1);
 const spec={...p,id:'inside',target:'body',operation:'新規ボディ',startPoint:a,endPoint:b,count,patternExtent:{min:-999,max:999},patternAnchor:[999,999,999]},result=runOperation(features,spec);
 assert.equal(result.outputs.length,count);assert.equal(result.outputs[0].id,'body');let previous=0;
 for(const [i,out]of result.outputs.entries()){
  const vertices=out.vertices,values=[];for(let k=0;k<vertices.length;k+=3)values.push(dot(vertices.slice(k,k+3).map((v,j)=>v-a[j]),u));
  const min=Math.min(...values),max=Math.max(...values);near(min-previous,gap);near(max-min,width);previous=max;
  const shape=R.deserializeShape(out.brep).asShape3D();near(R.measureVolume(shape),1000);shape.delete();if(i===count-1)near(distance-max,gap);
 }
 const saved=validateProject(JSON.parse(JSON.stringify({format:'forma-cad',version:1,features:[...features,{kind:'cadop',id:spec.id,name:'矩形状パターン',spec,...result}]}))),bodies=kernelBodies(saved);assert.equal(bodies.size,count);for(const body of bodies.values())body.delete();
}
assert.equal(box.serialize(),snapshot);assert.throws(()=>runOperation(features,{...p,id:'short',target:'body',endPoint:[39,0,5]}),/収まりません/);
// A diagonal triangle has asymmetric support about its bounding-box center.
// Its real width is 7.2 mm along (0.6, 0.8, 0), not its AABB's 13.6 mm.
const triangle=R.draw([0,0]).lineTo([12,0]).lineTo([0,8]).close().sketchOnPlane('XY').extrude(4),extent=solidPatternExtent(triangle,[0,0,0],[60,80,0],[6,4,2]);near(extent.min,-6.8);near(extent.max,.4);
const asymmetric={...p,patternAnchor:[6,4,2],patternExtent:extent,startPoint:[0,0,0],endPoint:[60,80,0]},triangleLayout=betweenPatternLayout(asymmetric);near(dot(asymmetric.patternAnchor.map((v,i)=>v+triangleLayout.offsets[0][i]),[.6,.8,0])+extent.min,triangleLayout.gap);triangle.delete();
const cylinder=R.makeCylinder(5,20),u=[.6,0,.8],curved=solidPatternExtent(cylinder,[0,0,0],u,[0,0,10]);near(curved.max-curved.min,22);cylinder.delete();box.delete();
console.log('PASS equal body/end gaps, containment, negative/diagonal/vertical directions, 60 bodies, zero-gap fit, too-short rejection, exact curved/asymmetric CAD widths, stale dimensions ignored, original ID/input and save/reload');
