import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {strFromU8,unzipSync} from 'three/addons/libs/fflate.module.js';
import {cadMesh} from '../src/cad-mesh.js';
import {makeTSlotFrame} from '../src/t-slot-frame-cad.js';
import {frameAssembly,frameBill,framePartBounds,measureFrameBox,savedFrameAssembly} from '../src/t-slot-frame.js';
import {Vector3} from 'three';
import {framePlate3mf,framePrintPlates,readFrameStock} from '../src/t-slot-frame-print.js';
import {inspectStlMesh} from '../src/stl-mesh-health.js';
import {defaults,validateProject} from '../src/geometry.js';
import {runOperation} from '../src/kernel.js';
import {assemblyLinks,assemblyTargets} from '../src/assembly-state.js';

R.setOC(await init({wasmBinary:await fs.readFile(new URL('../node_modules/replicad-opencascadejs/dist/replicad_single.wasm',import.meta.url))}));
const stock=readFrameStock(await fs.readFile(new URL('../assets/t-slot-m8.dat',import.meta.url)));
const guide=size=>({origin:[0,0,0],axes:[[1,0,0],[0,1,0],[0,0,1]],size});

test('rotated solid follows its own twelve edges; curved and cut solids are rejected',()=>{
  const solid=R.makeBox([0,0,0],[90,100,180]).rotate(23,[0,0,0],[1,2,3]).translate([40,-70,22]);
  const cylinder=R.makeCylinder(8,150),notch=R.makeBox([0,0,0],[5,5,5]);
  const plain=R.makeBox([0,0,0],[80,80,80]),cut=plain.cut(notch);
  try{
    const {vertices,triangles}=cadMesh(solid),box=measureFrameBox(vertices,triangles);
    assert.deepEqual(box.size,[90,100,180]);
    assert.ok(box.axes[0].some((v,i)=>i&&Math.abs(v)>.01));
    const assembly=frameAssembly(box);
    assert.ok(assembly.parts.every(p=>Math.abs(p.matrix.determinant()-1)<1e-8));
    for(const shape of [cylinder,cut]){const m=cadMesh(shape);assert.throws(()=>measureFrameBox(m.vertices,m.triangles),/直方体/);}
  }finally{[solid,cylinder,notch,plain,cut].forEach(s=>s.delete());}
});
test('long members are split, each joint is clamped, and short sides use exterior straps',()=>{
  const assembly=frameAssembly(guide([160,160,160]));
  assert.deepEqual(Object.fromEntries(frameBill(assembly).map(p=>[p.key,p.count])),
    {'rail-108':8,splice:4,'rail-160':8,corner:16,bolt:48,nut:48});
  const short=frameAssembly(guide([20,55,16]));
  assert.equal(short.parts.filter(p=>p.shared).length,4);
  assert.equal(short.parts.filter(p=>p.kind==='strap'&&!p.shared).length,8);
  assert.equal(short.fixings,28);
  const tinyBox=guide([12,18,12]),tiny=frameAssembly(tinyBox);
  assert.deepEqual(tiny.clearance,[0,0,0]);
  assert.deepEqual(tiny.runs.map(r=>r.length),[12,18,68]);
  assert.equal(tiny.parts.filter(p=>p.keyed).length,8);
  assert.equal(tiny.fixings,16);
  const old=savedFrameAssembly({tSlotBox:tinyBox});
  assert.deepEqual(old.clearance,[4,1,0]);
  assert.equal(old.fixings,24);
  const long=frameAssembly(guide([621,440,501]));
  const rails=long.parts.filter(p=>p.kind==='rail'),splices=long.parts.filter(p=>p.kind==='splice');
  assert.ok(rails.every(p=>p.length<=160));
  assert.equal(rails.length,12+splices.length);
  assert.ok(Math.abs(rails.reduce((sum,p)=>sum+p.length,0)-4*(621+440+501+56))<1e-5);
  for(const n of [-1,1.2,NaN,Infinity])assert.throws(()=>frameBill(assembly,n,0));
});
test('arbitrary real lengths are extruded from the 28 mm section, with identical pieces on a split edge',()=>{
  const box=guide([117.25,245,344]);
  const current=makeTSlotFrame(box,{id:'fractional'});
  const assembly=savedFrameAssembly(current.analysis);
  assert.deepEqual(assembly.runs.map(r=>[r.span,r.length,r.count]),[[117.25,117.25,1],[245,122.5,2],[400,400/3,3]]);
  const rails=frameBill(assembly).filter(p=>p.kind==='rail');
  const expected=new Map(rails.map(p=>[p.length,p.count]));
  assert.deepEqual(expected,new Map([[117.25,4],[122.5,8],[400/3,12]]));
  const cad=R.deserializeShape(current.outputs[0].brep).asShape3D(),solids=cad.solids;
  try {
    const native=solids.map(s=>R.measureVolume(s)/348.19);
    for(const [length,n] of expected)assert.equal(native.filter(v=>Math.abs(v-length)<1e-6).length,n);
  } finally {solids.forEach(s=>s.delete());cad.delete();}
  for(const p of rails){
    const report=inspectStlMesh(stock.mesh(p),{includeComponents:true});
    assert.ok(report.ok&&report.components.length===1&&report.removedDegenerate===0);
    assert.ok(Math.abs(report.volume-348.19*p.length)<.02);
    assert.deepEqual(framePartBounds(p),[[-14,-14,0],[14,14,p.length]]);
  }
  const oldThirds=frameBill(savedFrameAssembly({tSlotBox:box})).filter(p=>p.kind==='rail'&&p.length>133&&p.length<134);
  assert.deepEqual(oldThirds.map(p=>[p.length,p.count]),[[133.333333,8],[133.333334,4]]);
  for(const span of [159.9999,160,160.0001,319.9999,320,320.0001]){
    const {runs}=frameAssembly(guide([span,100,100])),{count,length}=runs[0];
    assert.equal(count,Math.ceil(span/160));assert.ok(length<=160&&Math.abs(count*length-span)<1e-8);
  }
});
test('short rails are captured by a one-piece sliding key and both M8 fasteners land on the posts',()=>{
  const box=guide([12.5,18.25,38]), made=makeTSlotFrame(box,{id:'short'});
  const assembly=savedFrameAssembly(made.analysis),compact=assembly.parts.filter(p=>p.keyed);
  const rails=R.deserializeShape(made.outputs[0].brep).asShape3D();
  const fixtures=R.deserializeShape(made.outputs[1].brep).asShape3D(),solids=fixtures.solids;
  try{
    assert.equal(compact.length,8);assert.equal(solids.length,8);assert.equal(assembly.fixings,16);
    const overlap=rails.intersect(fixtures);
    try{assert.ok(Math.abs(R.measureVolume(overlap))<1e-5);}finally{overlap.delete();}
    const volumes=solids.map(s=>R.measureVolume(s));
    for(const part of compact) {
      const mesh=stock.mesh(part),health=inspectStlMesh(mesh,{includeComponents:true});
      assert.ok(health.ok&&health.components.length===1&&health.removedDegenerate===0);
      // The print mesh approximates two cylindrical holes by 64-sided polygons.
      assert.ok(volumes.some(v=>Math.abs(v-health.volume)<2));
      const box=health.components[0].bounds,expected=framePartBounds(part);
      assert.ok(box.every((v,j)=>v.every((x,i)=>Math.abs(x-expected[j][i])<1e-5)));
    }
    const outward=new Vector3(0,0,-1).transformDirection(compact[0].matrix).multiplyScalar(3);
    const pulled=solids[0].clone().translate(outward.toArray()),caught=rails.intersect(pulled);
    try{assert.ok(R.measureVolume(caught)>1);}finally{caught.delete();pulled.delete();}
  }finally{solids.forEach(s=>s.delete());rails.delete();fixtures.delete();}
});
test('native assembly contains separate rail and fixture solids, leaving the reference uncut',()=>{
  for(const size of [[160,160,160],[21,55,16]]) {
    const source=R.makeBox([0,0,0],size),made=makeTSlotFrame(guide(size),{id:'frame'});
    try{
      const parts=frameAssembly(made.analysis.tSlotBox).parts;
      for(const [i,output] of made.outputs.entries()){
        const shape=R.deserializeShape(output.brep).asShape3D(),solids=shape.solids;
        try{
          assert.equal(solids.length,parts.filter(p=>(p.kind==='rail')===(i===0)).length);
          const overlap=source.intersect(shape);
          try{assert.ok(Math.abs(R.measureVolume(overlap))<1e-5);}finally{overlap.delete();}
        }finally{solids.forEach(s=>s.delete());shape.delete();}
      }
    }finally{source.delete();}
  }
});
test('a closed mesh-only guide works alongside older mesh bodies and an open box is rejected',()=>{
  const solid=R.makeBox([0,0,0],[22,44,88]);
  try{
    const mesh=cadMesh(solid),spec={type:'tSlotFrame',target:'import',id:'kit'};
    const entry={kind:'cadop',id:'import',name:'取込',outputs:[{id:'import',...mesh}],remove:[]};
    const result=runOperation([entry],spec);
    assert.deepEqual(result.analysis.tSlotBox.size,[22,44,88]);
    const open=mesh.triangles.filter((_,i)=>{const t=i-i%3;return [0,1,2].some(j=>mesh.vertices[3*mesh.triangles[t+j]+2]>0);});
    assert.throws(()=>measureFrameBox(mesh.vertices,open),/直方体/);
  }finally{solid.delete();}
});
test('all hardware and independent extras are counted once on disjoint 180 mm plates',()=>{
  const bill=frameBill(frameAssembly(guide([160,160,160])),3,5),plates=framePrintPlates(bill);
  assert.ok(plates.length>1);
  const totals=new Map(),cache=new Map();
  for(const plate of plates){
    const archive=unzipSync(framePlate3mf(plate,stock,cache));
    const model=strFromU8(archive['3D/3dmodel.model']);
    assert.equal((model.match(/<item /g)||[]).length,plate.placements.length);
    assert.equal((model.match(/<object /g)||[]).length,new Set(plate.placements.map(p=>p.part.key)).size);
    assert.equal(JSON.parse(strFromU8(archive['Metadata/project_settings.config'])).printer_model,'Bambu Lab A1 mini');
    for(const [i,p] of plate.placements.entries()){
      assert.ok(p.min.every(v=>v>=0)&&p.max.every(v=>v<=180));
      const [lo,hi]=framePartBounds(p.part);
      assert.ok(Math.abs(p.max[2]-(hi[2]-lo[2]))<1e-5&&p.min[2]===0);
      for(const other of plate.placements.slice(0,i))assert.ok([0,1].some(k=>p.max[k]<other.min[k]||other.max[k]<p.min[k]));
      totals.set(p.part.key,1+(totals.get(p.part.key)||0));
    }
  }
  assert.deepEqual(Object.fromEntries(totals),Object.fromEntries(bill.map(p=>[p.key,p.count])));
  assert.equal(totals.get('bolt'),51);assert.equal(totals.get('nut'),53);
  assert.equal(framePrintPlates([{kind:'nut',key:'nut',count:1}]).length,1);
  const variants=[...bill,...frameBill(frameAssembly(guide([20,50,40])))];
  for(const part of new Map(variants.map(p=>[p.key,p])).values()){
    const report=inspectStlMesh(stock.mesh(part),{includeComponents:true,maxSegments:0});
    assert.ok(report.ok&&report.removedDegenerate===0&&report.components.length===1,part.key);
  }
});
test('replaying an edited guide updates the kit and moving its fixtures includes its rails',()=>{
  const base={...defaults,kind:'extrusion',id:'cube',name:'試験',width:100,height:100,depth:100};
  const spec={type:'tSlotFrame',id:'frame',target:'cube'};
  const entry={kind:'cadop',id:spec.id,name:'T溝フレーム',spec,...runOperation([base],spec)};
  const unknown={...entry,analysis:{...entry.analysis,tSlotSizingVersion:99}};
  assert.throws(()=>validateProject({format:'forma-cad',version:1,features:[base,unknown]}),/寸法形式/);
  const before=[base,entry], changed=[{...base,depth:160},entry];
  const after=runOperation(changed,{type:'replay',before,start:1}).features;
  validateProject({format:'forma-cad',version:1,features:after});
  assert.deepEqual(after[1].analysis.tSlotBox.size,[100,100,160]);
  const ids=after[1].outputs.map(o=>o.id);
  assert.deepEqual(new Set(assemblyTargets(after,[ids[1]])),new Set(ids));
  const link=assemblyLinks(after)[0];
  assert.equal(assemblyLinks([...after,{kind:'cadop',spec:{type:'assemblyRelease',linkId:link.id},outputs:[],remove:[]}]).length,0);
});
