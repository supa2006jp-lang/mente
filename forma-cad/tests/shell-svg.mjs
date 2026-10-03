import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';import fs from 'node:fs/promises';import assert from 'node:assert/strict';
import {runOperation} from '../src/kernel.js';import {defaults,validateProject} from '../src/geometry.js';
import {decoratedShellHistory} from '../src/shell-decoration.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const base={...defaults,id:'c',name:'円柱',kind:'extrusion',profile:'circle',diameter:40,depth:40};
const pattern=[{outer:[[0,.2],[1,.2],[1,.8],[0,.8]],holes:[[[.2,.4],[.8,.4],[.8,.6],[.2,.6]]]}];
const wrapSpec={type:'svgWrap',id:'w',target:'c',surfacePoint:[20,0,20],pattern,height:30,offset:5,depth:.6,seam:'repeat',repeatCount:2,angle:0,operation:'emboss'};
const shapeOf=result=>R.deserializeShape(result.outputs[0].brep).asShape3D();
function inspect(result){const solid=shapeOf(result),check=new (R.getOC().BRepCheck_Analyzer)(solid.wrapped,true,false),parts=solid.solids;try{assert.ok(check.IsValid());assert.equal(parts.length,1);return R.measureVolume(solid);}finally{check.delete();for(const part of parts)part.delete();solid.delete();}}
function ballVolume(solid,point){const ball=R.makeSphere(.08).translate(point),common=solid.intersect(ball);try{return R.measureVolume(common);}finally{common.delete();ball.delete();}}
for(const operation of ['emboss','engrave']){
 const spec={...wrapSpec,operation},wrap={kind:'cadop',id:'w',name:'SVG模様',spec,...runOperation([base],spec)},features=[base,wrap];
 const before=inspect(wrap);
 for(const both of [false,true]){
  const faces=[{point:[0,0,40],normal:[0,0,1]}];if(both)faces.push({point:[0,0,0],normal:[0,0,-1]});
  const shellSpec={type:'shell',id:'s',target:'c',thickness:2,direction:'内側',faces};
  const result=runOperation(features,shellSpec),expected=before-Math.PI*18**2*(both?40:38);
  assert.ok(Math.abs(inspect(result)-expected)<.015,'the cavity follows the undecorated cylinder, preserving SVG holes and relief');
  const shape=shapeOf(result);
  try{
   assert.ok(ballVolume(shape,[0,0,39])<1e-9,'the selected top face is open');
   if(!both)assert.ok(ballVolume(shape,[0,0,1])>1e-4,'the 2 mm floor is retained');
   assert.ok(ballVolume(shape,[19,0,20])>1e-4,'the cylindrical wall is retained');
   if(both)assert.ok(ballVolume(shape,[0,0,1])<1e-9,'both openings are clear');
  }finally{shape.delete();}
  const feature={kind:'cadop',id:'s',name:'シェル',spec:shellSpec,...result};
  validateProject({format:'forma-cad',version:1,features:[...features,feature]});
  const replay=runOperation([...features,{...feature,spec:{...shellSpec,thickness:3}}],{type:'replay',before:[...features,feature],start:2});
  assert.ok(Math.abs(inspect(replay.features[2])-(before-Math.PI*17**2*(both?40:37)))<.015,'re-editing shell thickness keeps the decoration');
 }
 const moved=runOperation([base],{type:'move',target:'c',axis:'Y',angle:90,x:10,y:5,z:7});
 const prefix=[{kind:'cadop',id:'move',spec:{type:'move',target:'c'},...moved}],turnedSpec={...spec,surfacePoint:[30,5,-13]},turnedWrap={kind:'cadop',id:'tw',spec:turnedSpec,...runOperation(prefix,turnedSpec)};
 const shell=runOperation([...prefix,turnedWrap],{type:'shell',target:'c',thickness:2,direction:'内側',faces:[{point:[50,5,7],normal:[1,0,0]}]});
 assert.ok(Math.abs(inspect(shell)-(before-Math.PI*18**2*38))<.02,'cavity respects an arbitrary cylinder axis');
 assert.throws(()=>runOperation(features,{type:'shell',target:'c',thickness:25,direction:'内側',faces:[{point:[0,0,40],normal:[0,0,1]}]}));
 assert.equal(inspect(wrap),before,'failed shell never mutates the stored decoration');
 const unrelated={kind:'extrusion',id:'other',operation:'new'};
 assert.deepEqual(decoratedShellHistory([...features,unrelated],'c'),[base]);
 assert.deepEqual(decoratedShellHistory([...features,unrelated,{...wrap,id:'w2'}],'c'),[base]);
 assert.equal(decoratedShellHistory([...features,{kind:'cadop',spec:{type:'move'},outputs:[{id:'c'}]}],'c'),null,'later body edits disable the shortcut');
 assert.equal(decoratedShellHistory([base],'c'),null);
}
console.log('PASS decorated shells: emboss/engrave, SVG holes, exact cavity volume, floor and openings, rotated cylinder, thickness re-edit, history boundaries and failed-operation preservation');
