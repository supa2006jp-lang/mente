import * as R from 'replicad';import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {orthographicProjection} from '../src/orthographic.js';import {hatchPaths,snapDimension,withDetails,viewPoints} from '../src/drawing-annotations.js';import {drawingSheet} from '../src/drawing-sheet.js';
import {drawingProjectedFrame} from '../src/drawing-view-preferences.js';
import {drawingFrontFrame} from '../src/drawing-front.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));const outer=R.makeCylinder(15,30),hole=R.makeCylinder(12,30).translate([0,0,3]),cup=outer.cut(hole);
try{const sections=[];for(const view of ['front','top','right'])for(const orientation of ['vertical','horizontal'])for(const reverse of [false,true])sections.push({id:'section-'+sections.length,view,orientation,coordinate:orientation==='vertical'||view==='top'?0:-15,reverse});const result=orthographicProjection(new Map([['cup',cup]]),['cup'],sections);assert.deepEqual(result.sectionErrors,{});const area=triangles=>triangles.reduce((sum,[a,b,c])=>sum+Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))/2,0);for(const s of sections){const v=result.views[s.id],horizontal=s.orientation==='horizontal'&&s.view!=='top';assert.ok(Math.abs(area(v.triangles)-(horizontal?Math.PI*(225-144):252))<(horizontal?.2:.0001));assert.ok(v.visible.length);if(horizontal){const path=hatchPaths(v.triangles,1),ns=path.match(/-?\d+(?:\.\d+)?/g).map(Number);for(let i=0;i<ns.length;i+=4){const x=(ns[i]+ns[i+2])/2,y=(ns[i+1]+ns[i+3])/2;assert.ok(Math.hypot(x,y)>=11.99,'hole must remain unhatched');}}}
const invalid=orthographicProjection(new Map([['cup',cup]]),['cup'],[{id:'section-out',view:'front',orientation:'vertical',coordinate:100,reverse:false}]);assert.ok(invalid.sectionErrors['section-out']);
const d={view:'top',kind:'horizontal',a:[0,0],b:[10,0],at:[0,20]},near=snapDimension(d,[2,20.8],[d],1);assert.equal(near.at[1],20);assert.equal(snapDimension(d,[2,22],[d],1).at[1],22);
const options={paper:'auto',sections:sections.slice(0,2),details:[{id:'detail-a',view:'top',center:[0,0],radius:8,factor:4}],markers:[]};const sheet=drawingSheet({...result,views:Object.fromEntries(Object.entries(result.views).filter(([key])=>!key.startsWith('section-')||['section-0','section-1'].includes(key)))},.5,true,[], '',options);assert.equal(sheet.layout['detail-a'].scale,2);assert.match(sheet.svg,/SCALE 1:2/);assert.match(sheet.svg,/data-hatch/);assert.match(sheet.svg,/clipPath/);console.log('PASS 12 section directions, cap area, holes unhatched, outside rejection, snapping threshold, scaled detail geometry');}finally{cup.delete();outer.delete();hole.delete();}
const shifted=R.makeBox([10,20,30],[70,60,55]);
try{
 const requested=['left','back','bottom'];
 const sections=[
  {id:'section-left',view:'left',orientation:'vertical',coordinate:-35,reverse:false},
  {id:'section-back',view:'back',orientation:'vertical',coordinate:-28,reverse:false},
  {id:'section-bottom',view:'bottom',orientation:'horizontal',coordinate:35,reverse:false},
 ];
 const result=orthographicProjection(new Map([['shifted',shifted]]),['shifted'],sections,requested);
 assert.deepEqual(Object.keys(result.views),[...requested,...sections.map(s=>s.id)]);
 assert.deepEqual(result.sectionErrors,{});
 for(const name of requested){
  const {bx,by,width,height}=drawingProjectedFrame(name,result.bounds);
  assert.deepEqual(result.views[name].viewBox.map(v=>Math.round(v)),[bx,by,width,height].map(v=>Math.round(v)));
 }
 const oriented=orthographicProjection(new Map([['shifted',shifted]]),['shifted'],[
  {id:'section-turned',view:'front',orientation:'vertical',coordinate:35,reverse:false},
 ],['front','top','right'],drawingFrontFrame([0,0,1]));
 assert.deepEqual(oriented.sectionErrors,{});
 assert.deepEqual(oriented.views.front.viewBox.map(Math.round),[10,-60,60,40]);
 assert.deepEqual(oriented.views.top.viewBox.map(Math.round),[10,30,60,25]);
 assert.deepEqual(oriented.views.right.viewBox.map(Math.round),[-55,-60,25,40]);
 const worldBox=shifted.boundingBox;
 try{assert.deepEqual(worldBox.bounds.map(p=>p.map(Math.round)),[[10,20,30],[70,60,55]]);}
 finally{worldBox.delete();}
}finally{shifted.delete();}
