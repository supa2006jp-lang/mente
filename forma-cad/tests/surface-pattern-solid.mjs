import {clearBodyCache} from '../src/body-cache.js';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';import fs from 'node:fs/promises';import assert from 'node:assert/strict';
import {runOperation} from '../src/kernel.js';import {defaults,validateProject} from '../src/geometry.js';import {surfacePattern,surfacePatternNames} from '../src/surface-pattern.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const base={...defaults,id:'c',name:'円柱',kind:'extrusion',profile:'circle',diameter:60,depth:60};
function inspect(result){const shape=R.deserializeShape(result.outputs[0].brep).asShape3D(),check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false),parts=shape.solids;try{assert.ok(check.IsValid());assert.equal(parts.length,1);return R.measureVolume(shape);}finally{check.delete();parts.forEach(p=>p.delete());shape.delete();}}
const ringArea=ring=>Math.abs(ring.reduce((s,p,i)=>{const q=ring[(i+1)%ring.length];return s+p[0]*q[1]-q[0]*p[1];},0)/2),area=p=>p.regions.reduce((s,r)=>s+ringArea(r.outer)-r.holes.reduce((n,h)=>n+ringArea(h),0),0);
for(const kind of (process.env.FORMA_NEW_PATTERNS?['zigzag','dots','diamonds','honeycomb','bricks','weave']:Object.keys(surfacePatternNames)).filter(k=>!process.env.FORMA_PATTERN_KIND||k===process.env.FORMA_PATTERN_KIND))for(const operation of ['emboss','engrave'].filter(k=>!process.env.FORMA_PATTERN_OPERATION||k===process.env.FORMA_PATTERN_OPERATION)){
 clearBodyCache();R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
 const t=performance.now(),p=surfacePattern(60*Math.PI,48,{kind,...(process.env.FORMA_LINKED_PATTERN?{autoRows:true}:{})}),spec={type:'svgWrap',id:'p',target:'c',surfacePoint:[30,0,30],pattern:p.regions,generator:p.settings,height:48,offset:6,depth:.6,seam:'single',angle:0,operation},result=runOperation([base],spec),volume=inspect(result),sign=operation==='emboss'?1:-1,expected=Math.PI*900*60+sign*area(p)*48*Math.PI*((30+sign*.6)**2-900)*sign;
 assert.ok(Math.abs(volume-expected)<.05,kind+' exact radial volume');
 const feature={kind:'cadop',id:'p',name:'模様生成',spec,...result};validateProject({format:'forma-cad',version:1,features:[base,feature]});
 if(kind==='scales'&&operation==='emboss'){
  const shell=runOperation([base,feature],{type:'shell',id:'s',target:'c',thickness:1.5,direction:'内側',faces:[{point:[0,0,60],normal:[0,0,1]}]});assert.ok(Math.abs(inspect(shell)-(volume-Math.PI*28.5**2*58.5))<.05,'shell preserves procedural relief');
  const changed={...spec,generator:{...spec.generator,size:30}},replay=runOperation([base,{...feature,spec:changed}],{type:'replay',before:[base,feature],start:1});assert.notEqual(replay.features[1].outputs[0].brep,result.outputs[0].brep);assert.ok(inspect(replay.features[1])>Math.PI*900*60);
  const wider={...base,diameter:70},wide=runOperation([wider],{...spec,surfacePoint:[35,0,30]});assert.ok(inspect(wide)>Math.PI*35**2*60,'regenerates pattern from the changed cylinder');
 }
 console.log('PASS '+kind+' '+operation+' valid one-solid radial relief ('+((performance.now()-t)/1000).toFixed(1)+'s)');
}
