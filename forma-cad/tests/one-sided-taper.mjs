import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {featureSolid,runOperation} from '../src/kernel.js';
import {defaults,makeGeometry,volume,validateFeature,validateProject} from '../src/geometry.js';
import {basisFor} from '../src/frames.js';
import {findRegions} from '../src/regions.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const close=(a,b,t=.003)=>assert.ok(Math.abs(a-b)<t,`${a} ≠ ${b}`),f={...defaults,id:'t',name:'片側テーパー',kind:'extrusion',width:10,height:8,depth:40,taperAngle:45,taperMode:'oneSide',taperSide:'u+'};
function check(feature,expected,tolerance=.005){const shape=featureSolid(feature),g=makeGeometry(feature);try{const valid=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);try{assert.ok(valid.IsValid());}finally{valid.delete();}const props=new (R.getOC().GProp_GProps)();try{R.getOC().BRepGProp.VolumePropertiesGK(shape.wrapped,props,1e-8,true,true,false,false,false);close(props.Mass(),expected,tolerance);}finally{props.delete();}close(volume(g),expected,tolerance);return shape.mesh({tolerance:.01,angularTolerance:.1}).vertices;}finally{shape.delete();g.dispose();}}
const frame={u:[0,1,0],v:[-Math.SQRT1_2,0,Math.SQRT1_2],n:[Math.SQRT1_2,0,Math.SQRT1_2]};
for(const plane of ['XY','XZ','YZ','CUSTOM'])for(const depth of [40,-40])for(const taperSide of ['u+','u-','v+','v-']){
 const feature={...f,plane,depth,taperSide,...(plane==='CUSTOM'?{frame}:{})},tail=40,along=taperSide[0]==='u'?10:8,across=taperSide[0]==='u'?8:10,vertices=check(feature,40*80+across*tail*tail/2),b=basisFor(feature),axis=taperSide[0]==='u'?b.u:b.v,levels=[0,40];
 for(const level of levels){const coords=[];for(let i=0;i<vertices.length;i+=3){const p=vertices.slice(i,i+3),z=p[0]*b.n.x+p[1]*b.n.y+p[2]*b.n.z;if(Math.abs(z-Math.sign(depth)*level)<1e-5)coords.push(p[0]*axis.x+p[1]*axis.y+p[2]*axis.z);}assert.ok(coords.length);const delta=level,sign=taperSide[1]==='+'?1:-1;close(sign>0?Math.min(...coords):Math.max(...coords),-sign*along/2);close(Math.max(...coords)-Math.min(...coords),along+delta);}
}
for(const angle of [30,-30])for(const taperSide of ['u+','u-','v+','v-']){
 const feature={...f,depth:10,taperAngle:angle,taperSide,angle:27},across=taperSide[0]==='u'?8:10;check(feature,800+across*100*Math.tan(angle*Math.PI/180)/2);
}
const circle={...f,profile:'circle',diameter:20,depth:10,taperAngle:15};check(circle,Math.PI*100*(10+100*Math.tan(Math.PI/12)/40),2);
const outer={...defaults,kind:'sketch',id:'outer',width:40,height:30},inner={...defaults,kind:'sketch',id:'inner',profile:'circle',diameter:10},region=findRegions([outer,inner]).find(r=>r.holes.length),area=1200-Math.PI*25;
check({...f,profile:'region',region,depth:10,taperAngle:10},area*(10+100*Math.tan(Math.PI/18)/80),2);
check({...f,mode:'thin',wall:1,depth:10,taperAngle:15},32*(10+100*Math.tan(Math.PI/12)/20));
for(const patch of [{taperMode:'bad'},{taperSide:'bad'}])assert.throws(()=>validateFeature({...f,...patch}),/テーパー/);
assert.throws(()=>featureSolid({...f,taperAngle:-45}),/テーパー/);
check({...f,depth:10,symmetric:true},2400);
const base={...defaults,id:'base',kind:'extrusion',name:'土台',width:80,height:60,depth:10};
for(const operation of ['join','cut']){const tool={...f,id:'tool',depth:operation==='cut'?-5:5,z:10,operation,target:'base'},features=runOperation([base],{type:'extrusionBatch',features:[tool]}).features,output=R.deserializeShape(features.at(-1).cadResult.outputs[0].brep).asShape3D();try{close(R.measureVolume(output),48000+(operation==='cut'?-500:500));}finally{output.delete();}}
const result=runOperation([],{type:'extrusionBatch',features:[f]}).features,old=structuredClone(result),edited=structuredClone(result);edited[0].taperSide='u-';const replayed=runOperation(edited,{type:'replay',before:old,start:0}).features;validateProject(JSON.parse(JSON.stringify({format:'forma-cad',version:1,features:replayed})));assert.equal(replayed[0].taperSide,'u-');assert.ok(replayed[0].cadResult.outputs[0].brep);
await fs.mkdir('outputs/one-sided-taper',{recursive:true});await fs.writeFile('outputs/one-sided-taper/geometry-proof.json',JSON.stringify({allDirections:true,signedDepth:true,allPlanes:true,oppositeSideFixed:true,rotatedProfiles:true,arcsAndHoles:true,thin:true,invalidRejected:true,saveAndReplay:true,errors:[]},null,2));
console.log('PASS one-sided taper CAD/mesh volume and dimensions, fixed opposite side, directions, planes, signed depth, rotation, arcs/holes/thin, validation, save/replay');
