import * as R from 'replicad';import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {orthographicProjection} from '../src/orthographic.js';import {drawingSheet} from '../src/drawing-sheet.js';
import {dimensionValue} from '../src/drawing-dimensions.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const outer=R.makeBox([0,0,0],[40,25,20]),hole=R.drawCircle(4).sketchOnPlane('XY',[10,8,-1]).extrude(22),shape=outer.cut(hole),bodies=new Map([['part',shape]]),before=R.measureVolume(shape),data=orthographicProjection(bodies,['part']);
for(const name of ['front','top','right','iso'])assert.ok(data.views[name].visible.length,name);assert.ok(data.views.iso.viewBox.every(Number.isFinite));assert.ok(data.views.iso.viewBox[2]>40);assert.ok(data.views.front.hidden.length);assert.ok(data.views.right.hidden.length);assert.equal(R.measureVolume(shape),before);
const vertices=data.views.iso.dimensionVertices;
const bottom=vertices.find(({model})=>model.join(',')==='40,0,0');
const top=vertices.find(({model})=>model.join(',')==='40,0,20');
assert.ok(bottom&&top,'visible isometric vertices keep their B-rep positions');
assert.ok(Math.abs(bottom.point[1]-top.point[1])<20);
assert.equal(dimensionValue({view:'iso',kind:'aligned',a:bottom.point,b:top.point,modelA:bottom.model,modelB:top.model}),20);
assert.ok(!vertices.some(({model})=>model.join(',')==='0,25,0'),'unseen rear vertex is omitted');
const foreground=R.makeBox([60,-60,60],[100,-35,80]);
try{
 const coincident=orthographicProjection(new Map([['rear',outer],['front',foreground]]),['rear','front'],[],['iso']);
 assert.equal(coincident.views.iso.dimensionVertices.length,7);
 assert.ok(coincident.views.iso.dimensionVertices.every(({model})=>model[2]>=60),'coincident projections pick the front body');
}finally{foreground.delete();}
const sheet=drawingSheet(data,1,true),small=drawingSheet(data,.5,false);assert.match(sheet.svg,/stroke-dasharray/);assert.ok(!small.svg.includes('stroke-dasharray'));assert.match(sheet.svg,/width="297mm"/);assert.match(small.svg,/SCALE 1:2/);assert.throws(()=>orthographicProjection(bodies,[]));
await fs.writeFile('.sites-runtime/orthographic.json',JSON.stringify(data));await fs.writeFile('.sites-runtime/orthographic.svg',sheet.svg);await fs.writeFile('.sites-runtime/orthographic-fixture.json',JSON.stringify({format:'forma-cad',version:1,features:[{kind:'cadop',id:'part',name:'穴付きブロック',outputs:[{id:'part',brep:shape.serialize(),...shape.mesh({tolerance:.08,angularTolerance:.15})}],remove:[]}]}));console.log('PASS exact projections, hidden edges, scale, vector SVG and unchanged solid');shape.delete();hole.delete();outer.delete();
