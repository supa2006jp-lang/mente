import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';import fs from 'node:fs/promises';import assert from 'node:assert/strict';
import {runOperation,kernelBodies} from '../src/kernel.js';import {defaults,validateProject} from '../src/geometry.js';import {wrapSvgSolid} from '../src/svg-wrap.js';
import {svgWrapPieces,periodicSvgRegions,svgRepeatLayout} from '../src/svg-wrap-pattern.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const base={...defaults,id:'cylinder',kind:'extrusion',name:'円柱',profile:'circle',diameter:40,depth:40};
const pattern=[{outer:[[0,.2],[1,.2],[1,.8],[0,.8]],holes:[[[.2,.4],[.8,.4],[.8,.6],[.2,.6]]]}];
const spec={type:'svgWrap',id:'wrap',target:'cylinder',surfacePoint:[20,0,20],pattern,height:30,offset:5,depth:.6,seam:'mirror',angle:27,operation:'emboss',fileName:'test.svg'};
const before=Math.PI*400*40;
function inspect(result){const shape=R.deserializeShape(result.outputs[0].brep).asShape3D(),check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);try{assert.ok(check.IsValid());assert.equal(shape.solids.length,1,'seam and strips remain one solid');return R.measureVolume(shape);}finally{check.delete();shape.delete();}}
const info=runOperation([base],{type:'svgWrapInfo',target:base.id,surfacePoint:spec.surfacePoint});assert.deepEqual(info,{radius:20,height:40,origin:[0,0,0],axis:[0,0,1]});
for(const operation of ['emboss','engrave'])for(const seam of ['mirror','single','repeat']){
 const result=runOperation([base],{...spec,operation,seam,...(seam==='repeat'?{repeatCount:5,tileWidth:25}: {})});const actual=inspect(result),sign=operation==='emboss'?1:-1,expected=before+sign*2*Math.PI*20*30*.48*.6*(1+sign*.6/40);assert.ok(Math.abs(actual-expected)<.015,'wrapped SVG keeps holes and has uniform radial depth');
 const feature={kind:'cadop',id:'wrap',name:'SVG巻き付け',spec:{...spec,operation,seam,...(seam==='repeat'?{repeatCount:5,tileWidth:25}: {})},...result};validateProject({format:'forma-cad',version:1,features:[base,feature]});
 const replay=runOperation([base,{...feature,spec:{...feature.spec,depth:.8}}],{type:'replay',before:[base,feature],start:1});assert.ok(Math.abs(inspect(replay.features[1])-actual)>100);
}
// Opposing border profiles must match under mirror tiling, even for an asymmetric input.
const asym=[{outer:[[0,.1],[1,.6],[1,.9],[0,.4]],holes:[]}];const periodic=periodicSvgRegions(asym,'mirror');assert.ok(periodic.length);assert.ok(svgWrapPieces(asym).length);
const rotated=runOperation([base],{type:'move',target:'cylinder',axis:'Y',angle:90,x:10,y:5,z:7});const imported={kind:'cadop',id:'move',name:'回転',...rotated};const turn=runOperation([imported],{...spec,surfacePoint:[30,5,-13]});assert.ok(Math.abs(inspect(turn)- (before+2*Math.PI*20*30*.48*.6*(1+.6/40)))<.02);
const bad=[{depth:0},{seam:'repeat',repeatCount:0},{seam:'repeat',repeatCount:25},{seam:'repeat',repeatCount:1.5},{seam:'repeat'},{height:50},{offset:-1},{surfacePoint:[0,0,40]},{pattern:[]},{pattern:[{outer:[[0,0],[NaN,1],[1,0]],holes:[]}]}];for(const patch of bad)assert.throws(()=>runOperation([base],{...spec,...patch}));
const block={...defaults,id:'block',kind:'extrusion',name:'直方体'};assert.throws(()=>runOperation([block],{...spec,target:'block'}),/円柱/);
// There must be material on both sides of the periodic seam after an asymmetric mirrored pattern.
const test=runOperation([base],{...spec,pattern:asym,angle:0});const solid=R.deserializeShape(test.outputs[0].brep).asShape3D();for(const angle of [-.001,.001]){const ball=R.makeSphere(.01).translate([20.3*Math.cos(angle),20.3*Math.sin(angle),12]),common=solid.intersect(ball);assert.ok(Math.abs(R.measureVolume(common)-4*Math.PI*1e-6/3)<1e-8);common.delete();ball.delete();}solid.delete();
// A shallow recess under a motif leaves only nominal surface contact. The retry
// must join it into the body instead of returning a separate relief solid.
const stock=R.makeCylinder(20,40),inside=R.makeCylinder(19.99995,40),skin=stock.cut(inside),box=R.makeBox([-10,10,8],[10,30,32]),patch=skin.intersect(box),recessed=stock.cut(patch),events=[];
const repaired=wrapSvgSolid(recessed,{...spec,pattern:[{outer:[[.2,.3],[.3,.3],[.3,.7],[.2,.7]],holes:[]}],height:40,offset:0,angle:0,seam:'single'},p=>events.push(p.stage));
assert.ok(events.includes('SVGの接合を調整しています'),'surface contact failure retries internally');
const repairedSolids=repaired.shape.solids;assert.equal(repairedSolids.length,1);for(const solid of repairedSolids)solid.delete();
const repairedCheck=new (R.getOC().BRepCheck_Analyzer)(repaired.shape.wrapped,true,false);assert.ok(repairedCheck.IsValid());repairedCheck.delete();repaired.shape.delete();for(const resource of [recessed,patch,box,skin,inside,stock])resource.delete();
const layout=svgRepeatLayout(40*Math.PI,25);assert.equal(layout.count,5);assert.ok(Math.abs(layout.width-25.1327412287)<1e-8);assert.equal(svgRepeatLayout(100,300).count,1);for(const width of [0,-1,NaN,.1])assert.throws(()=>svgRepeatLayout(100,width));
console.log('PASS exact radial emboss/engrave volume, holes, mirrored and single 360-degree seams, valid one-solid BRep, arbitrary cylinder axis, save/replay and invalid input');
