import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {runOperation} from '../src/kernel.js';
import {defaults,validateProject} from '../src/geometry.js';
import {makeSnapLid} from '../src/snap-lid.js';
import {snapLidSectionData,poseSnapPoint,unposeSnapPoint,unposeSnapNormal} from '../src/snap-lid-section.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const p={type:'snapLid',id:'closure',target:'body',lidTarget:'lid',bodyWall:4.2,lidWall:2.4,floor:2.4,insertion:4,clearance:.2,ridge:.4,pose:'assembled',openingGroove:true,openingWidth:24,openingHeight:3,openingDepth:.8};
const base={...defaults,id:'body',name:'本体',kind:'extrusion',width:80,height:50,depth:30,z:3,x:10,y:-5},history=[base,{...base,id:'lid',z:33,depth:12}];
const both=runOperation(history,p),plain=runOperation(history,{...p,openingGroove:false});
function loss(result){const a=R.deserializeShape(plain.outputs[1].brep).asShape3D(),b=R.deserializeShape(result.outputs[1].brep).asShape3D();try{return R.measureVolume(a)-R.measureVolume(b);}finally{a.delete();b.delete();}}
for(const openingSide of [0,1]){const input={...p,openingMode:'single',openingSide},result=runOperation(history,input);assert.equal(result.analysis.opening.count,1);assert.deepEqual(result.analysis.opening.sides[0],both.analysis.opening.sides[openingSide]);assert.ok(Math.abs(loss(both)-2*loss(result))<1e-5,'only the chosen pocket is cut');}
const long=both.analysis.sectionSides.find(s=>s.length===80),face={point:[...long.center,39],normal:long.normal},selected={...p,openingMode:'selected',openingFace:face},result=runOperation(history,selected);assert.equal(result.analysis.opening.count,1);assert.equal(result.analysis.opening.sides[0].length,80);assert.ok(Math.abs(loss(result)-loss(both)/2)<1e-5);validateProject({format:'forma-cad',version:1,features:[...history,{kind:'cadop',id:p.id,name:'被せ蓋',spec:selected,...result}]});
for(const openingFace of [null,{...face,normal:[0,0,1]},{...face,normal:face.normal.map(v=>-v)},{...face,point:[...long.center,3]},{...face,point:[1e4,1e4,39]}])assert.throws(()=>runOperation(history,{...selected,openingFace}),/側面/);
assert.throws(()=>runOperation(history,{...p,openingMode:'single',openingSide:2}));assert.throws(()=>runOperation(history,{...p,openingMode:'bad'}));
function envelope(data){return data.parts.map(part=>{const points=[];for(let i=0;i<part.segments.length;i+=3)points.push([part.segments[i],part.segments[i+2]]);return [Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))];});}
const section=snapLidSectionData(result,selected),printed=runOperation(history,{...selected,pose:'print'}),printSection=snapLidSectionData(printed,{...selected,pose:'print'});assert.ok(section.parts.every(p=>p.segments.length>0&&p.fill.length>0));
for(const [i,bounds]of envelope(section).entries())for(const [j,v]of bounds.entries())assert.ok(Math.abs(v-envelope(printSection)[i][j])<2e-5,'actual cross section is independent of print pose');
for(const point of [[...long.center,39],[14,-3,45]])assert.ok(unposeSnapPoint(poseSnapPoint(point,1,printed.analysis,'print'),1,printed.analysis,'print').every((v,i)=>Math.abs(v-point[i])<1e-8));
assert.deepEqual(unposeSnapNormal(unposeSnapNormal(face.normal,'print'),'print'),face.normal);
// At ridge peak, the real section edges have the expected two material boundaries.
const crossings=part=>{const values=[];for(let i=0;i<part.segments.length;i+=6){const a=[part.segments[i],part.segments[i+2]],b=[part.segments[i+3],part.segments[i+5]],z=2;if(Math.abs(b[1]-a[1])>1e-7&&z>=Math.min(a[1],b[1])-1e-6&&z<=Math.max(a[1],b[1])+1e-6)values.push(a[0]+(b[0]-a[0])*(z-a[1])/(b[1]-a[1]));}return values;};
for(const [index,point]of [section.gap.a,section.gap.b].entries())assert.ok(crossings(section.parts[index]).some(x=>Math.abs(x-point[0])<2e-5),'dimension terminates on actual ridge or groove edge');assert.ok(Math.abs(section.gap.b[0]-section.gap.a[0]-.2)<1e-8);
for(const angle of [0,32]){const lower=R.makeBox([-20,-20,3],[20,20,33]).rotate(angle,[0,0,3],[0,0,1]),upper=R.makeBox([-20,-20,33],[20,20,45]).rotate(angle,[0,0,3],[0,0,1]);try{const initial=makeSnapLid(lower,upper,{...p,openingGroove:false});const side=initial.analysis.sectionSides[2];initial.body.delete();initial.lid.delete();const cut=makeSnapLid(lower,upper,{...selected,openingFace:{point:[...side.center,39],normal:side.normal}});assert.equal(cut.analysis.opening.count,1);assert.deepEqual(cut.analysis.opening.sides[0].center,side.center);cut.body.delete();cut.lid.delete();}finally{lower.delete();upper.delete();}}
const circle=history.map(f=>({...f,profile:'circle',diameter:60})),c=runOperation(circle,{...p,openingGroove:false,pose:'print'});assert.ok(snapLidSectionData(c,{...p,pose:'print'}).parts.every(p=>p.fill.length));
console.log('PASS single/both/selected long and rotated square faces, invalid selection, safe native pockets, actual section boundaries and print pose recovery');
