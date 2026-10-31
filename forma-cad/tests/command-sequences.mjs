import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import {runOperation,kernelBodies} from '../src/kernel.js';
import {defaults,validateProject} from '../src/geometry.js';
import {inspectCadStl} from '../src/stl-cad-inspection.js';
import {PreviewResultGuard,resultSnapshot,assertPreviewResult} from '../src/preview-result-guard.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const out='.sites-runtime/command-sequences',rows=[];await fs.mkdir(out,{recursive:true});
const close=(a,b,label)=>assert.ok(Math.abs(a-b)<Math.max(1e-5,Math.abs(b)*2e-7),label+': '+a+' / '+b);
function inspect(history,{volume,count},label){
 validateProject({format:'forma-cad',version:1,features:history});
 const bodies=kernelBodies(JSON.parse(JSON.stringify(history)));let total=0;
 try{assert.equal(bodies.size,count,label+' body count');for(const shape of bodies.values()){const check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);try{assert.ok(check.IsValid(),label+' valid native solid');}finally{check.delete();}total+=R.measureVolume(shape);}close(total,volume,label+' material volume');}finally{bodies.forEach(s=>s.delete());}
}
function workflow(label){
 let history=[],steps=[];const guard=new PreviewResultGuard();
 return {
  apply(spec,expected){const before=history,saved=JSON.stringify(before),preview=runOperation(before,{type:'preview',operation:spec});guard.accept(before,{type:'preview',operation:spec},preview);const committed=runOperation(before,spec);const checked=guard.accept(before,spec,committed);assert.ok(checked.measured>0,label+' native preview measurements');assert.equal(JSON.stringify(before),saved,label+' preserved input');
   for(const output of committed.outputs){const audit=inspectCadStl(output).report;assert.ok(audit.ok,label+' closed export mesh '+JSON.stringify(audit.counts));}
   history=[...before,{kind:'cadop',id:spec.id,name:spec.type,spec,...committed}];inspect(history,expected,label+'/'+spec.type);steps.push({type:spec.type,before,expected:structuredClone(expected),previewChecked:checked.measured});return committed;
  },
  async finish(expected){const saved=JSON.stringify(history);const replay=runOperation(history,{type:'replay',before:history,start:0,forceFull:true});inspect(replay.features,expected,label+'/forced replay');assert.equal(JSON.stringify(history),saved,label+' replay input');
   for(const step of steps.slice(1))inspect(step.before,steps[steps.indexOf(step)-1].expected,label+'/undo');inspect(JSON.parse(saved),expected,label+'/redo and reload');
   rows.push({name:label,commands:steps.map(s=>s.type),nativePreviewChecks:steps.reduce((n,s)=>n+s.previewChecked,0),volume:expected.volume,bodies:expected.count,closedStl:true,forcedReplay:true,undoRedoReload:true,inputPreserved:true});await fs.writeFile(out+'/results.json',JSON.stringify({pass:false,rows},null,2));
  },
  get history(){return history;}
 };
}
for(const scale of [.7,1,1.3]){
 // Analytic rounded-box volume (Minkowski sum of an inner box and a ball).
 const a=30*scale,b=20*scale,c=10*scale,r=.5*scale,A=a-2*r,B=b-2*r,C=c-2*r,rounded=A*B*C+2*r*(A*B+B*C+C*A)+Math.PI*r*r*(A+B+C)+4*Math.PI*r*r*r/3;
 const w=workflow('fillet-extrude-cut-'+scale),box={...defaults,id:'box',kind:'extrusion',name:'box',width:a,height:b,depth:c};
 // Seed through a native extrusion so every later stage has real CAD data.
 w.apply({type:'extrusion',id:'box-op',feature:box},{volume:a*b*c,count:1});
 w.apply({type:'fillet',id:'round',target:'box',radius:r},{volume:rounded,count:1});
 const extension={...defaults,id:'extension',name:'extension',kind:'extrusion',width:8*scale,height:6*scale,depth:4*scale,z:c,operation:'join',target:'box'};
 const added=192*scale**3;w.apply({type:'extrusion',id:'extend',target:'box',feature:extension},{volume:rounded+added,count:1});
 const cut={...extension,id:'pocket',width:4*scale,height:2*scale,z:14*scale,depth:-6*scale,operation:'cut'};
 const expected={volume:rounded+added-48*scale**3,count:1};w.apply({type:'extrusion',id:'pocket-op',target:'box',feature:cut},expected);await w.finish(expected);
 const before=JSON.stringify(w.history);assert.throws(()=>runOperation(w.history,{type:'extrusion',target:'box',feature:{...cut,x:100*scale}}),/重なっていません/);assert.equal(JSON.stringify(w.history),before);
 console.log('PASS fillet -> extrusion -> cut, scale '+scale);
}
for(const angle of [180,360]){
 const fraction=angle/360,w=workflow('revolve-join-split-move-'+angle),revolve=(id,outer,z0,z1)=>({type:'revolve',id,region:{plane:'XZ',offset:0,outer:[[3,z0],[outer,z0],[outer,z1],[3,z1]],holes:[]},origin:[0,0,0],axisVector:[0,0,1],angle,direction:'片側',operation:'new'});
 const v1=Math.PI*91*8*fraction,v2=Math.PI*135*6*fraction,joined=Math.PI*1174*fraction;
 w.apply(revolve('ring1',10,0,8),{volume:v1,count:1});w.apply(revolve('ring2',12,4,10),{volume:v1+v2,count:2});
 w.apply({type:'join',id:'join',target:'ring1',other:'ring2',combineMode:'結合',keepTools:'削除'},{volume:joined,count:1});
 // XZ divides a full ring; YZ divides both 180 and 360 degree sweeps.
 w.apply({type:'split',id:'section',target:'ring1',plane:'YZ',offset:0,keep:'both'},{volume:joined,count:2});
 const expected={volume:joined,count:2};w.apply({type:'move',id:'turn',target:'ring1',targets:['ring1','section'],rotation:[90,0,0],pivot:[0,0,0],x:3,y:-2,z:5},expected);await w.finish(expected);
 console.log('PASS revolve -> join -> split -> rotated move, angle '+angle);
}
for(const scale of [.8,1.2]){
 const w=workflow('mirror-join-through-cut-'+scale),box={...defaults,id:'half',kind:'extrusion',name:'half',width:12*scale,height:16*scale,depth:8*scale,x:6*scale},one=1536*scale**3;
 w.apply({type:'extrusion',id:'seed',feature:box},{volume:one,count:1});
 w.apply({type:'mirror',id:'mirror',target:'half',plane:'YZ',offset:0,mirrorMode:'コピー'},{volume:one*2,count:2});
 w.apply({type:'join',id:'join',target:'half',other:'mirror',combineMode:'結合',keepTools:'削除'},{volume:one*2,count:1});
 const cutter={...defaults,id:'tool',kind:'extrusion',name:'tool',profile:'circle',diameter:4*scale,depth:8*scale};
 const toolVolume=Math.PI*32*scale**3;w.apply({type:'extrusion',id:'tool-op',feature:cutter},{volume:one*2+toolVolume,count:2});
 const expected={volume:one*2-toolVolume,count:1};w.apply({type:'join',id:'cut',target:'half',other:'tool',combineMode:'切り取り',keepTools:'削除'},expected);await w.finish(expected);
 console.log('PASS mirror -> join -> same-height through cut, scale '+scale);
}
// A deliberate bad final result must fail even when its outer box is unchanged.
const valid={outputs:[{id:'body',shapeMetrics:{volume:100,solids:1,bounds:[[0,0,0],[10,10,1]]}}],remove:[]},broken=structuredClone(valid);broken.outputs[0].shapeMetrics.volume=50;
assert.throws(()=>assertPreviewResult(resultSnapshot(valid,{type:'split'}),resultSnapshot(broken,{type:'split'})),e=>e.code==='preview-mismatch');
const proof={pass:true,deterministicVariants:rows.length,operations:rows.reduce((n,r)=>n+r.commands.length,0),negativeControls:true,rows};await fs.writeFile(out+'/results.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
