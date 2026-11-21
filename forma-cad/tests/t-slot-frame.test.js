import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as R from 'replicad';
import ClipperLib from 'clipper-lib';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {strFromU8,unzipSync} from 'three/addons/libs/fflate.module.js';
import {cadMesh} from '../src/cad-mesh.js';
import {makeFramePart,makeTSlotFrame} from '../src/t-slot-frame-cad.js';
import {frameAssembly,frameBill,framePartBounds,measureFrameBox,plateDimensions,plateKey,savedFrameAssembly} from '../src/t-slot-frame.js';
import {Ray,Vector3} from 'three';
import {framePlate3mf,framePrintPlates,framePlateRails,readFrameStock} from '../src/t-slot-frame-print.js';
import {estimateFrameFilament} from '../src/t-slot-filament.js';
import {manualFrameBill,mergeFrameBill,partChoices} from '../src/t-slot-parts.js';
import {framePanels,panelTiles,panelAssemblyNotes} from '../src/t-slot-panels.js';
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
    {'rail-108':8,'splice-2':4,'rail-160':8,'corner-panel':16,bolt:40,nut:40});
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
test('45 mm splices use two M8 fasteners, and old saved kits retain their four-hole stock',()=>{
  const box=guide([160,160,160]),now=frameAssembly(box),part=now.parts.find(p=>p.kind==='splice');
  assert.deepEqual(plateDimensions(part),{length:45,width:22,height:8,holes:[-13.5,13.5]});
  assert.deepEqual(framePartBounds(part),[[-22.5,-11,0],[22.5,11,9.5]]);
  assert.ok(13.5-framePartBounds({kind:'nut'})[1][1]-plateKey(part).halfLength>=.59);
  const shape=makeFramePart(part),printed=inspectStlMesh(stock.mesh(part),{includeComponents:true});
  try{
    assert.ok(printed.ok&&printed.components.length===1&&Math.abs(printed.volume-R.measureVolume(shape))<2);
    for(const x of [-13.5,13.5]){
      const shank=R.makeCylinder(4.49,11,[x,0,-1]),hit=shape.intersect(shank);
      try{assert.ok(Math.abs(R.measureVolume(hit))<1e-6);}finally{hit.delete();shank.delete();}
    }
  }finally{shape.delete();}
  for(const version of [1,2]){
    const old=savedFrameAssembly({tSlotBox:box,tSlotSizingVersion:version}),p=old.parts.find(p=>p.kind==='splice');
    assert.equal(old.fixings,48);assert.equal(now.fixings,40);
    assert.deepEqual(framePartBounds(p),[[-45,-11,0],[45,11,8]]);
    assert.ok(!old.parts.some(p=>p.panelHole));
    const both=frameBill({parts:[...now.parts,...old.parts],fixings:now.fixings+old.fixings});
    for(const [key,n] of [['splice-2',4],['splice',4],['corner-panel',16],['corner',16]])assert.equal(both.find(p=>p.key===key).count,n);
  }
});

function radialSampler(mesh,cx,cy){
  const v=[];for(let i=0;i<mesh.vertices.length;i+=3)v.push(new Vector3().fromArray(mesh.vertices,i));
  const faces=[];
  for(let i=0;i<mesh.triangles.length;i+=3){
    const [a,b,c]=mesh.triangles.slice(i,i+3).map(j=>v[j]);
    faces.push({a,b,c,lo:Math.min(a.z,b.z,c.z),hi:Math.max(a.z,b.z,c.z)});
  }
  return (z,angle=0)=>{
    const ray=new Ray(new Vector3(cx,cy,z),new Vector3(Math.cos(angle),Math.sin(angle),0)),hit=new Vector3();
    let radius=Infinity;
    for(const {a,b,c,lo,hi} of faces)if(z>=lo&&z<=hi&&ray.intersectTriangle(a,b,c,false,hit))radius=Math.min(radius,hit.distanceTo(ray.origin));
    return radius;
  };
}
test('inside mounting respects rail ends, panel seats, other fixtures and insertion space',()=>{
  const sample=guide([160,160,160]),assembly=frameAssembly(sample),fixtures=assembly.parts.filter(p=>p.mount);
  assert.equal(fixtures.length,20);assert.ok(fixtures.every(p=>p.mount==='inside'));
  const old=frameAssembly(sample,3),before=old.parts.filter(p=>p.kind==='splice'),after=fixtures.filter(p=>p.kind==='splice');
  assert.equal(before.length,after.length);assert.ok(before.every(p=>!after.some(q=>p.matrix.equals(q.matrix))));
  for(const [size,kind,inside,outside] of [
    [[60,60,60],'corner',8,0],[[60,60,60],'strap',0,8],
    [[110,115,106],'splice',0,4],[[28,28,115],'splice',4,0],[[12,15,200],'splice',0,4]
  ]){
    const parts=frameAssembly(guide(size)).parts.filter(p=>p.kind===kind);
    assert.equal(parts.filter(p=>p.mount==='inside').length,inside);
    assert.equal(parts.filter(p=>p.mount==='outside').length,outside);
  }
  // Check actual solids at normal and tight limits, including a 3 mm front panel.
  for(const size of [[160,160,160],[40,40,40],[110,115,106]]){
    const made=makeTSlotFrame(guide(size),{id:'inside'}),[rails,fittings]=made.outputs.map(o=>R.deserializeShape(o.brep).asShape3D());
    const panel=R.makeBox([0,-29,0],[size[0],-26,size[2]]),members=fittings.solids;
    try{
      for(const body of [rails,panel]){const hit=fittings.intersect(body);try{assert.ok(Math.abs(R.measureVolume(hit))<1e-5);}finally{hit.delete();}}
      const bounds=members.map(m=>m.boundingBox.bounds);
      for(let i=0;i<members.length;i++)for(let j=0;j<i;j++){
        if(!bounds[i][0].every((v,k)=>Math.min(bounds[i][1][k],bounds[j][1][k])-Math.max(v,bounds[j][0][k])>.002))continue;
        const hit=members[i].intersect(members[j]);try{assert.ok(Math.abs(R.measureVolume(hit))<1e-5);}finally{hit.delete();}
      }
    }finally{members.forEach(m=>m.delete());panel.delete();rails.delete();fittings.delete();}
  }
});
test('panel seats face out, share a plane and carry a right-hand M8×1.25 thread with −0.20 mm pull',()=>{
  const size=[117.25,245,87.625],parts=frameAssembly(guide(size)).parts.filter(p=>p.panelHole),faces=new Map();
  for(const p of parts){
    const out=new Vector3(0,0,-1).transformDirection(p.matrix),seat=new Vector3(14,14,0).applyMatrix4(p.matrix);
    const axis=Math.abs(out.x)>.5?0:1,other=1-axis,sign=out.getComponent(axis),label=axis+','+sign;
    assert.equal(Math.abs(sign),1);assert.ok(Math.abs(p.matrix.determinant()-1)<1e-9);
    assert.equal(seat.getComponent(axis),sign>0?size[axis]+26:-26);
    const pair=[seat.getComponent(other),seat.z];
    assert.ok([14,size[other]-14].includes(pair[0])&&[14,size[2]-14].includes(pair[1]));
    if(!faces.has(label))faces.set(label,new Set());faces.get(label).add(pair.join(','));
  }
  assert.equal(faces.size,4);for(const seats of faces.values())assert.equal(seats.size,4);
  const cad=makeFramePart(parts[0]),mesh=stock.mesh(parts[0]),health=inspectStlMesh(mesh,{includeComponents:true});
  try{
    assert.ok(health.ok&&health.components.length===1);
    assert.ok(Math.abs(health.volume-R.measureVolume(cad))<8);
    // Both original bolt heads and their insertion paths clear the reinforced web.
    for(const [p,axis] of [[[8.001,27,12],[1,0,0]],[[27,8.001,12],[0,1,0]]]){
      const head=R.makeCylinder(7.3,35,p,axis),hit=cad.intersect(head);
      try{assert.ok(Math.abs(R.measureVolume(hit))<1e-6);}finally{hit.delete();head.delete();}
    }
    const bore=radialSampler(mesh,14,14),bolt=radialSampler(stock.mesh({kind:'bolt'}),0,0);
    const levels=Array.from({length:24},(_,i)=>2.11+i*1.25/24),radii=levels.map(z=>bore(z));
    assert.ok(Math.abs(Math.max(...radii)-4.2)<.01&&Math.abs(Math.min(...radii)-3.5234)<.015);
    for(const z of levels){
      assert.ok(Math.abs(bore(z+1.25)-bore(z))<.01);
      assert.ok(Math.abs(bore(z+1.25/4,Math.PI/2)-bore(z))<.015);
    }
    const gaps=levels.map((_,i)=>Math.min(...levels.map(z=>bore(z)-bolt(z+6+1.25*i/levels.length))));
    assert.ok(Math.max(...gaps)>.1,'the supplied M8 bolt must have a fitting helical phase');
  }finally{cad.delete();}
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
  const assembly=frameAssembly(guide([160,160,160]));
  assert.ok(!frameBill(assembly).some(p=>p.key==='bolt-10'));
  for(const n of [-1,.5,10001,NaN])assert.throws(()=>frameBill(assembly,3,5,n),/整数/);
  assert.equal(frameBill(assembly,0,0,10000).find(p=>p.key==='bolt-10').count,10000);
  const bill=frameBill(assembly,3,5,4),plates=framePrintPlates(bill);
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
  assert.equal(totals.get('bolt'),43);assert.equal(totals.get('bolt-10'),4);assert.equal(totals.get('nut'),45);
  assert.equal(framePrintPlates([{kind:'nut',key:'nut',count:1}]).length,1);
  const variants=[...bill,...frameBill(frameAssembly(guide([20,50,40])))];
  for(const part of new Map(variants.map(p=>[p.key,p])).values()){
    const report=inspectStlMesh(stock.mesh(part),{includeComponents:true,maxSegments:0});
    assert.ok(report.ok&&report.removedDegenerate===0&&report.components.length===1,part.key);
  }
});
test('M8×10 has a 10 mm under-head length, tapered tip and a mating right-hand 1.25 mm pitch',()=>{
  const part={kind:'bolt',length:10},mesh=stock.mesh(part),v=mesh.vertices;
  let seat=-Infinity,tip=-Infinity;
  for(let i=0;i<v.length;i+=3){
    if(Math.hypot(v[i],v[i+1])>4.1)seat=Math.max(seat,v[i+2]);
    tip=Math.max(tip,v[i+2]);
  }
  assert.ok(Math.abs(seat-5.6)<1e-5&&Math.abs(tip-seat-10)<1e-5);
  assert.ok(Math.abs(tip-framePartBounds(part)[1][2])<1e-5);
  const sample=radialSampler(mesh,0,0),pitch=1.25;
  assert.ok(sample(tip-.03)<3.3);
  const z=Array.from({length:24},(_,i)=>2.11+i*pitch/24),male=z.map(h=>sample(h+6));
  assert.ok(Math.abs(Math.max(...male)-3.94)<.01&&Math.abs(Math.min(...male)-3.238)<.01);
  for(const [i,h] of z.entries()){
    assert.ok(Math.abs(sample(h+6+pitch)-male[i])<.01);
    assert.ok(Math.abs(sample(h+6+pitch/4,Math.PI/2)-male[i])<.01);
  }
  for(const bore of [radialSampler(stock.mesh({kind:'nut'}),0,0),radialSampler(stock.mesh({kind:'corner',panelHole:true}),14,14)]){
    const female=z.map(h=>bore(h));
    const clearance=male.map((_,i)=>Math.min(...female.map((r,j)=>r-male[(j+i)%male.length])));
    assert.ok(Math.max(...clearance)>.1&&Math.min(...clearance)<-.1,'threads must both fit and engage');
  }
});
test('both T-nuts retain the inset T-foot and the unpulled M8 thread through a full turn',()=>{
  const pitch=1.25;
  for(const [kind,root] of [['nut',4.18],['wideNut',4.28]]){
    const mesh=stock.mesh({kind}),bore=radialSampler(mesh,0,0);
    const radii=Array.from({length:64},(_,i)=>bore(2+i*pitch/64));
    assert.ok(Math.abs(Math.min(...radii)-(root-pitch*.541266))<.008,kind+' crest');
    assert.ok(Math.abs(Math.max(...radii)-root)<.008,kind+' root');
    for(const [i,r] of radii.entries()){
      const z=2+i*pitch/64;
      assert.ok(Math.abs(bore(z+pitch)-r)<.01&&Math.abs(bore(z+pitch/4,Math.PI/2)-r)<.01);
    }
    const report=inspectStlMesh(mesh,{includeComponents:true});
    assert.ok(report.ok&&report.components.length===1);
    const [lo,hi]=report.components[0].bounds;
    [13.7,19.8,6.2].forEach((size,i)=>assert.ok(Math.abs(hi[i]-lo[i]-size)<.0001));
    let neck=0;
    for(let i=0;i<mesh.vertices.length;i+=3)if(mesh.vertices[i+2]>5.5)neck=Math.max(neck,Math.abs(mesh.vertices[i]));
    assert.ok(Math.abs(2*neck-9.8)<.0001);
  }
});
test('long rails start on the first plate and continue on consecutive plates until all are packed',()=>{
  const bill=manualFrameBill([{id:'corner',count:20},{id:'rail',length:103,count:10},{id:'rail',length:150,count:25}],160);
  const plates=framePrintPlates(bill),cuts=plates.map(framePlateRails);
  assert.deepEqual(cuts.slice(0,3).map(p=>Object.fromEntries(p.cuts)),[{150:16},{150:9,103:7},{103:3}]);
  assert.deepEqual(cuts.slice(0,3).map(p=>p.count),[16,16,3]);
  assert.ok(cuts.slice(3).every(p=>!p.count));
});
test('0.6 mm filament estimates follow independent Bambu Studio slices of full plates',()=>{
  // These are held-out multi-object projects, separate from the single-part samples.
  const cases=[
    {size:[117.25,245,87.625],extras:[3,5],grams:[801.42,135.05,126.32,57.23,52.98],meters:[262.36,44.21,41.35,18.73,17.34]},
    {size:[12.5,31.75,38],extras:[0,0],grams:[251.19,73.39,26.53],meters:[82.23,24.03,8.69]}
  ];
  for(const {size,extras,grams,meters} of cases){
    const plates=framePrintPlates(frameBill(frameAssembly(guide(size)),...extras));
    const estimate=estimateFrameFilament(plates);
    assert.equal(estimate.plates.length,grams.length);
    for(const [i,amount] of estimate.plates.entries()){
      assert.ok(Math.abs(amount.grams-grams[i])<.5,'plate '+(i+1)+' of '+size);
      assert.ok(Math.abs(amount.meters-meters[i])<.17);
    }
    for(const unit of ['meters','grams'])
      assert.ok(Math.abs(estimate.total[unit]-estimate.plates.reduce((sum,p)=>sum+p[unit],0))<1e-8);
  }
});

test('one startup per plate, legacy fittings, short rails and nozzle-specific 3MF settings',()=>{
  const nut={kind:'nut',key:'nut',count:4},rail={kind:'rail',key:'rail-160',length:160,count:1};
  const gramFor=parts=>estimateFrameFilament(framePrintPlates(parts)).total.grams;
  assert.ok(Math.abs(gramFor([nut])-5.62)<.01);
  const short={kind:'bolt',key:'bolt-10',length:10,count:4};
  assert.ok(Math.abs(gramFor([short])-5.17)<.01);
  assert.ok(Math.abs(gramFor([{...rail,key:'rail-28',length:28},{...short,count:3},{...nut,count:1},{kind:'bolt',key:'bolt',count:1}])-18.71)<.1);
  assert.ok(Math.abs(gramFor([rail])-63.32)<.01);
  assert.ok(Math.abs(gramFor([{kind:'corner',key:'corner',count:1}])-13.12)<.01);
  assert.ok(Math.abs(gramFor([{kind:'splice',key:'splice',count:1}])-13.00)<.01);
  const tooShort=framePrintPlates([{...rail,key:'rail-0.14',length:.14}]);
  const tooShortEstimate=estimateFrameFilament([...tooShort,...framePrintPlates([nut])]);
  assert.equal(tooShortEstimate.total,null);assert.equal(tooShortEstimate.plates[0],null);
  assert.ok(tooShortEstimate.plates[1].grams>0);
  assert.deepEqual(estimateFrameFilament([]),{plates:[],total:{grams:0,meters:0}});
  for(const [parts,brim] of [[[nut],'no_brim'],[[rail],'outer_only'],[[nut,rail],'outer_only'],[[rail,short],'outer_only']]){
    const [plate]=framePrintPlates(parts),cache=new Map();
    const profile=nozzle=>JSON.parse(strFromU8(unzipSync(framePlate3mf(plate,stock,cache,nozzle))['Metadata/project_settings.config']));
    const old=profile(),fine=profile(.6);
    assert.deepEqual(old.nozzle_diameter,['0.4']);assert.equal(old.layer_height,parts.length===1&&parts[0]===rail?'0.2':'0.16');
    assert.deepEqual(fine.nozzle_diameter,['0.6']);assert.equal(fine.printer_settings_id,'Bambu Lab A1 mini 0.6 nozzle');
    assert.equal(fine.print_settings_id,'0.18mm Fine @BBL A1M 0.6 nozzle');
    assert.equal(fine.layer_height,'0.18');assert.equal(fine.initial_layer_print_height,'0.3');
    assert.equal(fine.wall_loops,'4');assert.equal(fine.sparse_infill_density,'30%');
    assert.deepEqual(fine.filament_diameter,['1.75']);assert.deepEqual(fine.filament_density,['1.27']);
    assert.equal(fine.brim_type,brim);assert.equal(fine.brim_width,'5');
  }
});

test('manual parts and saved custom rail limits produce the requested rail lengths and seam hardware',()=>{
  const kit=manualFrameBill([{id:'rail',length:330,count:2},{id:'rail',length:110,count:1},
    {id:'short',count:3},{id:'bolt',count:2},{id:'nut',count:0},{id:'shared',length:25,count:1}],120);
  assert.deepEqual(Object.fromEntries(kit.map(p=>[p.key,p.count])),{'rail-110':7,'splice-2':4,bolt:10,nut:8,'bolt-10':3,'strap-53-shared':1});
  const catalog=manualFrameBill(partChoices.map(c=>({id:c.id,count:1,length:c.initial})),160);
  assert.equal(catalog.length,partChoices.length);
  assert.ok(estimateFrameFilament(framePrintPlates(catalog)).total.grams>0);
  for(const part of catalog){
    const report=inspectStlMesh(stock.mesh(part),{includeComponents:true,maxSegments:0});
    assert.ok(report.ok&&report.components.length===1,part.key);
    const bounds=framePartBounds(part);
    for(const [i,point] of report.components[0].bounds.entries())for(const [k,v] of point.entries())assert.ok(Math.abs(v-bounds[i][k])<1e-4,part.key);
  }
  for(const limit of [0,-1,181,Infinity,NaN])assert.throws(()=>manualFrameBill([],limit));
  assert.throws(()=>manualFrameBill([{id:'nut',count:1.2}],160));
  const old=guide([117.25,245,87.625]),spec={type:'tSlotFrame',target:'box',id:'kit',maxRailLength:105};
  const made=makeTSlotFrame(old,spec),assembly=savedFrameAssembly(made.analysis);
  assert.equal(made.analysis.tSlotMaxRailLength,105);
  assert.deepEqual(assembly.runs.map(r=>r.count),[2,3,2]);
  const native=made.outputs.filter(o=>o.id.startsWith('kit-rails')).map(o=>R.deserializeShape(o.brep).asShape3D());
  const members=native.flatMap(body=>body.solids);
  try{assert.equal(members.length,28);for(const m of members)assert.ok(R.measureVolume(m)/348.19<=105.00001);}
  finally{members.forEach(s=>s.delete());native.forEach(body=>body.delete());}
  assert.deepEqual(savedFrameAssembly({tSlotBox:old,tSlotSizingVersion:4}).runs.map(r=>r.count),[1,2,1]);
});
test('selected clear faces follow the actual corner seats; horizontal mounts clear the solid and support a 2 mm panel',()=>{
  const box=guide([100,120,90]),assembly=frameAssembly(box),out=framePanels(box,assembly,['top','front','bottom']);
  assert.deepEqual(out.plans.map(p=>[p.face.id,p.width,p.height,p.mounts.filter(m=>m.extraCorner).length]),
    [['top',99,119,4],['front',99,89,0],['bottom',99,119,4]]);
  const bill=mergeFrameBill(out.bill);
  for(const [k,n] of [['corner-panel',8],['bolt',16],['nut',16],['bolt-10',12]])assert.equal(bill.find(p=>p.key===k).count,n);
  const upper=out.plans[0];
  assert.deepEqual(upper.mounts.map(m=>m.hole),[[13.5,13.5],[85.5,13.5],[13.5,105.5],[85.5,105.5]]);
  const built=makeTSlotFrame(box,{id:'panel-check'}),bodies=built.outputs.map(o=>R.deserializeShape(o.brep).asShape3D());
  const bracket=makeFramePart({kind:'corner',panelHole:true}).rotate(180,[0,0,0],[1,1,0]).translateZ(116);
  const panel=R.makeBox([.5,.5,116],[99.5,119.5,118]);
  try{
    for(const body of [...bodies,panel]){
      const hit=bracket.intersect(body);try{assert.ok(Math.abs(R.measureVolume(hit))<1e-5);}finally{hit.delete();}
    }
    assert.ok(R.measureDistanceBetween(panel,bracket)<1e-6);
  }finally{bracket.delete();panel.delete();bodies.forEach(b=>b.delete());}
  const rotated={...box,origin:[37,-18,92],axes:[[0,1,0],[0,0,1],[1,0,0]]};
  assert.deepEqual(framePanels(rotated,frameAssembly(rotated),['top','front','bottom']).plans,out.plans);
  const tight=guide([80,75,80]),tightPlan=framePanels(tight,frameAssembly(tight),['top']);
  assert.ok(tightPlan.plans[0].mounts.some(m=>m.anchor));assert.ok(tightPlan.bill.some(p=>p.kind==='panelClamp'));
});
test('two-axis panel tiling preserves corner holes, fits every keyed tile, and supplies backing strips',()=>{
  const box=guide([365,370,190]),assembly=frameAssembly(box),out=framePanels(box,assembly,['top']);
  const plan=out.plans[0],tiles=panelTiles(plan);
  assert.equal(tiles.length,9);assert.equal(plan.cols,3);assert.equal(plan.rows,3);
  assert.equal(tiles.reduce((n,p)=>n+p.holes.length,0),4+2*12);
  assert.equal(out.bill.find(p=>p.key==='panel-join').count,12);
  const shifts=tiles.map((p,i)=>[i%3*plan.width/3,Math.floor(i/3)*plan.height/3]);
  const loops=tiles.map((tile,i)=>tile.outline.map(([x,y])=>({
    X:Math.round((x+shifts[i][0])*10000),Y:Math.round((y+shifts[i][1])*10000)
  })));
  for(const [i,loop] of loops.entries())for(const previous of loops.slice(0,i)){
    const clip=new ClipperLib.Clipper(),intersection=[];
    clip.AddPath(loop,ClipperLib.PolyType.ptSubject,true);
    clip.AddPath(previous,ClipperLib.PolyType.ptClip,true);
    clip.Execute(ClipperLib.ClipType.ctIntersection,intersection);
    assert.equal(intersection.length,0,'Assembled dovetails must fit without overlapping');
  }
  for(const [width,count] of [[180,1],[180.01,2],[350.25,2],[350.26,3]]){
    const row=panelTiles({...plan,width,height:95,mounts:[]});
    assert.equal(row.length,count);
    assert.ok(row.every(p=>p.bounds[1][0]-p.bounds[0][0]<=180.000001));
  }
  const globalHoles=tiles.flatMap((p,i)=>p.holes.map(([x,y])=>[x+shifts[i][0],y+shifts[i][1]]));
  for(const {hole} of plan.mounts)assert.equal(globalHoles.filter(([x,y])=>Math.hypot(x-hole[0],y-hole[1])<1e-4).length,1);
  const at=([x,y])=>globalHoles.some(([a,b])=>Math.hypot(a-x,b-y)<1e-4);
  for(const x of [1,2])for(const y of [0,1,2])for(const d of [-12,12])assert.ok(at([x*plan.width/3+d,(y+.5)*plan.height/3]));
  for(const y of [1,2])for(const x of [0,1,2])for(const d of [-12,12])assert.ok(at([(x+.5)*plan.width/3,y*plan.height/3+d]));
  const sheet=tiles[0],w=plan.width/3,right=sheet.outline.filter(([x])=>x>w+4);
  assert.ok(right.length>=4&&Math.max(...right.map(p=>p[0]))>w+4.8);
  // The neighbour's pocket surrounds the male dovetail, including tip and neck clearance.
  const pocketDepth=Math.max(...tiles[1].outline.filter(([x])=>x<8).map(([x])=>x));
  assert.ok(pocketDepth>Math.max(...right.map(([x])=>x-w)));
  const plates=framePrintPlates(mergeFrameBill(out.bill)),est=estimateFrameFilament(plates);
  assert.ok(est.total.grams>0&&est.plates.every(p=>p.grams>0));
  for(const plate of plates)for(const {part,min,max} of plate.placements){
    assert.equal(!!plate.clear,part.kind==='panel');assert.ok(min.every(v=>v>=-1e-6)&&max.every(v=>v<=180.000001));
    if(plate.clear){const health=inspectStlMesh(stock.mesh(part),{includeComponents:true});assert.ok(health.ok&&health.components.length===1);assert.equal(max[2],2);}
  }
  const notes=panelAssemblyNotes(out.plans);assert.match(notes,/3列 × 3行/);assert.match(notes,/追加の直角ブラケット/);
  const subset=framePanels(box,assembly,['left','bottom']);assert.deepEqual(subset.plans.map(p=>p.face.id),['left','bottom']);
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
