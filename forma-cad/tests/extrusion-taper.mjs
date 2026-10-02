import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';import fs from 'node:fs/promises';import assert from 'node:assert/strict';
import {featureSolid,runOperation} from '../src/kernel.js';import {defaults,makeGeometry,volume,validateFeature,validateProject,rebuild} from '../src/geometry.js';import {basisFor} from '../src/frames.js';import {findRegions} from '../src/regions.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const f={...defaults,id:'t',name:'テーパー',kind:'extrusion',width:40,height:30,diameter:30,depth:10,x:3,y:5,z:7};
const close=(a,b,tolerance=.001)=>assert.ok(Math.abs(a-b)<tolerance,a+' ≠ '+b);
function check(feature,expected){const shape=featureSolid(feature),g=makeGeometry(feature);try{const valid=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);try{assert.ok(valid.IsValid());}finally{valid.delete();}close(R.measureVolume(shape),expected);close(volume(g),expected,feature.profile==='circle'?5:.003);return shape.mesh();}finally{shape.delete();g.dispose();}}
for(const plane of ['XY','XZ','YZ','CUSTOM'])for(const depth of [10,-10])for(const taperAngle of [10,-10])for(const profile of ['rect','circle']){
 const feature={...f,plane,depth,taperAngle,profile,...(plane==='CUSTOM'?{frame:{u:[0,1,0],v:[-Math.SQRT1_2,0,Math.SQRT1_2],n:[Math.SQRT1_2,0,Math.SQRT1_2]}}:{})},shift=10*Math.tan(taperAngle*Math.PI/180),expected=profile==='rect'?10*(1200+70*shift+4*shift*shift/3):Math.PI*10*(225+15*shift+shift*shift/3);
 const mesh=check(feature,expected),basis=basisFor(feature),caps={start:[],end:[]};for(let i=0;i<mesh.vertices.length;i+=3){const p=mesh.vertices.slice(i,i+3).map((v,j)=>v-[3,5,7][j]),z=p[0]*basis.n.x+p[1]*basis.n.y+p[2]*basis.n.z,key=Math.abs(z)<1e-6?'start':Math.abs(z-depth)<1e-6?'end':null;if(key)caps[key].push(p[0]*basis.u.x+p[1]*basis.u.y+p[2]*basis.u.z);}
 if(profile==='rect'){close(Math.max(...caps.start)-Math.min(...caps.start),40);close(Math.max(...caps.end)-Math.min(...caps.end),40+2*shift);}
}
const old={...f};delete old.taperAngle;validateProject({format:'forma-cad',version:1,features:[old]});close(R.measureVolume(featureSolid(old)),12000);
for(const taperAngle of [NaN,Infinity,81,-81,'5'])assert.throws(()=>validateFeature({...f,taperAngle}),/テーパー/);
assert.throws(()=>featureSolid({...f,width:10,height:10,depth:100,taperAngle:-70}),/テーパー/);
assert.throws(()=>featureSolid({...f,profile:'circle',diameter:10,depth:100,taperAngle:-70}),/テーパー/);
const outer={...defaults,kind:'sketch',id:'outer',profile:'rect',width:40,height:30},inner={...defaults,kind:'sketch',id:'inner',profile:'circle',diameter:10},region=findRegions([outer,inner]).find(r=>r.holes.length);
for(const taperAngle of [3,-3])for(const holesOnly of [false,true]){const shape=featureSolid({...f,x:0,y:0,z:0,profile:'region',region,taperAngle,holesOnly}),valid=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);try{assert.ok(valid.IsValid());assert.ok(R.measureVolume(shape)>0);}finally{valid.delete();shape.delete();}}
for(const profile of ['rect','circle'])check({...f,profile,mode:'thin',wall:4,taperAngle:5},profile==='rect'?10*(496+124*10*Math.tan(5*Math.PI/180)):Math.PI*10*(104+26*10*Math.tan(5*Math.PI/180)));
const base={...defaults,id:'b',name:'本体',kind:'extrusion',width:80,height:60,depth:20},cut={...defaults,id:'c',name:'傾斜穴',kind:'extrusion',profile:'circle',diameter:20,z:20,depth:-10,taperAngle:10,operation:'cut',target:'b'};
const added=runOperation([base],{type:'extrusionBatch',features:[cut]}).features[0],saved={format:'forma-cad',version:1,features:[base,added]};validateProject(JSON.parse(JSON.stringify(saved)));assert.equal(added.taperAngle,10);const solid=R.deserializeShape(added.cadResult.outputs[0].brep).asShape3D();try{const shift=10*Math.tan(Math.PI/18);close(R.measureVolume(solid),96000-Math.PI*10*(100+10*shift+shift*shift/3));}finally{solid.delete();}
const tapered=runOperation([],{type:'extrusionBatch',features:[{...f,taperAngle:10}]}).features[0],before=[tapered];
for(const taperAngle of [-5,0]){const next=structuredClone(before);next[0].taperAngle=taperAngle;const result=runOperation(next,{type:'replay',before,start:0}).features;const bodies=rebuild(result);try{const shift=10*Math.tan(taperAngle*Math.PI/180);close(volume(bodies.get('t').geometry),10*(1200+70*shift+4*shift*shift/3),.004);}finally{for(const b of bodies.values())b.geometry.dispose();}}
await fs.writeFile('.sites-runtime/taper-browser-fixture.json',JSON.stringify({format:'forma-cad',version:1,features:[old]}));
console.log('PASS analytic taper dimensions/volume, signed depth, XY/XZ/YZ/custom, rectangle/circle/thin/holes, invalid-collapse rejection, exact CAD cutting, legacy files, save and angle replay including 0°');
