import assert from 'node:assert/strict';
import {defaults,makeGeometry} from '../src/geometry.js';
import {findRegions} from '../src/regions.js';
import {thinEndDimensions,thinDimensionsText,mergeDimensionMeshes} from '../src/thin-extrusion-dimensions.js';
import * as R from 'replicad';import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';import fs from 'node:fs/promises';import {runOperation} from '../src/kernel.js';
const near=(a,b,t=.01)=>assert.ok(Math.abs(a-b)<t,a+' vs '+b),mesh=g=>({vertices:g.attributes.position.array,triangles:g.index?.array});
for(const plane of ['XY','XZ','YZ','CUSTOM'])for(const depth of [8,-8])for(const taperAngle of [0,4,-4])for(const side of ['inside','outside','center']){
 const f={...defaults,mode:'thin',width:40,height:30,depth,wall:2,side,taperAngle,plane,angle:27,x:3,y:-5,z:7,...(plane==='CUSTOM'?{frame:{u:[0,1,0],v:[-Math.SQRT1_2,0,Math.SQRT1_2],n:[Math.SQRT1_2,0,Math.SQRT1_2]}}:{})},g=makeGeometry(f);
 try{const d=thinEndDimensions(f,mesh(g)),out=side==='outside'?2:side==='center'?1:0,inn=2-out,shift=2*Math.abs(depth)*Math.tan(taperAngle*Math.PI/180);assert.equal(d.kind,'rect');assert.equal(d.inners.length,1);near(d.outer.width,40+2*out+shift);near(d.outer.height,30+2*out+shift);near(d.inners[0].width,40-2*inn-shift);near(d.inners[0].height,30-2*inn-shift);}finally{g.dispose();}
}
const regionRect=findRegions([{...defaults,kind:'sketch',id:'s',width:40,height:30}])[0],regionCircle=findRegions([{...defaults,kind:'sketch',id:'s',profile:'circle',diameter:40}])[0];
for(const profile of ['circle','region'])for(const side of ['inside','outside','center'])for(const taperAngle of [0,4,-4]){
 const f={...defaults,profile,region:profile==='region'?regionCircle:undefined,mode:'thin',diameter:40,side,wall:2,depth:-8,taperAngle},g=makeGeometry(f);
 try{const d=thinEndDimensions(f,mesh(g)),out=side==='outside'?2:side==='center'?1:0,inn=2-out,shift=16*Math.tan(taperAngle*Math.PI/180);assert.equal(d.kind,'circle');near(d.outer.diameter,40+2*out+shift,.015);near(d.inners[0].diameter,40-2*inn-shift,.015);assert.match(thinDimensionsText(d,v=>v.toFixed(2)),/外径.*内径/s);}finally{g.dispose();}
}
for(const [outer,holes,expected]of [
 [[[-20,-15],[20,-15],[20,15],[-20,15]],[],1],
 [[[-20,-15],[20,-15],[20,0],[0,0],[0,15],[-20,15]],[],1],
 [[[-20,-15],[20,-15],[20,15],[-20,15]],[[[-5,-5],[-5,5],[5,5],[5,-5]]],2]
]){const f={...defaults,profile:'region',mode:'thin',wall:2,side:'inside',region:{...regionRect,outer,holes}},g=makeGeometry(f);try{const d=thinEndDimensions(f,mesh(g));assert.equal(d.inners.length,expected);if(holes.length||outer.length>4){assert.equal(d.kind,'bounds');assert.match(thinDimensionsText(d,String),/内寸（外接）/);}else {assert.equal(d.kind,'rect');near(d.inners[0].width,36);near(d.inners[0].height,26);}}finally{g.dispose();}}
const rectangleMesh=makeGeometry({...defaults,profile:'rect',width:40,height:30,mode:'thin'});try{const partial=thinEndDimensions({...defaults,profile:'circle',diameter:40,mode:'thin'},mesh(rectangleMesh));assert.equal(partial.kind,'rect');near(partial.outer.width,40);near(partial.outer.height,30);assert.equal(partial.outer.diameter,undefined);}finally{rectangleMesh.dispose();}
const line={...defaults,profile:'line',mode:'thin'},lg=makeGeometry(line);assert.equal(thinEndDimensions(line,mesh(lg)).kind,'open');assert.match(thinDimensionsText(thinEndDimensions(line,mesh(lg)),String),/なし（開いた線）/);lg.dispose();assert.equal(thinEndDimensions(defaults,{vertices:[]}),null);
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
for(const [profile,region]of [['rect',undefined],['region',regionRect],['region',regionCircle]])for(const side of ['inside','outside','center']){
 const f={...defaults,profile,region,mode:'thin',width:40,height:30,diameter:40,depth:-8,wall:2,side,taperAngle:8},r=runOperation([],{type:'extrusionToolPreview',feature:f}),d=thinEndDimensions(f,mergeDimensionMeshes(r.outputs)),out=side==='outside'?2:side==='center'?1:0,inn=2-out,shift=16*Math.tan(8*Math.PI/180);assert.ok(d.inners?.length===1);if(region===regionCircle){assert.equal(d.kind,'circle');near(d.outer.diameter,40+2*out+shift,.015);near(d.inners[0].diameter,40-2*inn-shift,.015);}else {near(d.outer.width,40+2*out+shift);near(d.inners[0].width,40-2*inn-shift);}
}
// Large meshes merge without exceeding the JavaScript argument limit.
const large=mergeDimensionMeshes([{vertices:Array(300000).fill(0),triangles:[0,1,2]},{vertices:[1,1,1,2,2,2,3,3,3],triangles:[0,1,2]}]);assert.equal(large.vertices.length,300009);assert.deepEqual(large.triangles,[0,1,2,100000,100001,100002]);
console.log('PASS actual inner and outer dimensions on rotated/custom planes, signed/tapered rectangles and circles, sketch regions, concave/multiple openings, open lines and native indexed CAD meshes');
