import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {defaults} from '../src/geometry.js';
import {parseTextFont,textSketchLayout,textSketchFeatures} from '../src/text-sketch.js';
import {findRegions} from '../src/regions.js';
import {runOperation,kernelBodies} from '../src/kernel.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
function valid(shape){const check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);try{assert(check.IsValid());}finally{check.delete();}}
const data=await fs.readFile('assets/fonts/NotoSansCJKjp-Regular.otf'),font=parseTextFont(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength)),dir='outputs/text-sketch/';await fs.mkdir(dir,{recursive:true});
for(const [index,plane] of [{plane:'XY',frame:{u:[1,0,0],v:[0,1,0],n:[0,0,1]},offset:0},{plane:'CUSTOM',frame:{u:[Math.SQRT1_2,0,-Math.SQRT1_2],v:[0,1,0],n:[Math.SQRT1_2,0,Math.SQRT1_2]},offset:7}].entries()){
 const layout=textSketchLayout(font,{text:index?'文字':'OB8',height:10}),sketches=textSketchFeatures(layout,plane),regions=findRegions(sketches),extrusions=regions.map((region,i)=>({...defaults,...plane,id:'letter-'+i,kind:'extrusion',profile:'region',name:'文字押し出し',region,sourceSketchIds:region.sourceIds,depth:2,x:plane.frame.n[0]*plane.offset,y:plane.frame.n[1]*plane.offset,z:plane.frame.n[2]*plane.offset}));
 const history=[...sketches,...runOperation(sketches,{type:'extrusionBatch',features:extrusions}).features],bodies=kernelBodies(history);try{let volume=0;for(const shape of bodies.values()){valid(shape);volume+=R.measureVolume(shape);}assert(Math.abs(volume-regions.reduce((n,r)=>n+r.area*2,0))<.001);}finally{bodies.forEach(s=>s.delete());}
 if(index===0){await fs.writeFile(dir+'extruded.forma.json',JSON.stringify({format:'forma-cad',version:1,features:history}));
  const base={...defaults,id:'base',kind:'extrusion',profile:'rect',width:40,height:24,depth:4,x:12,y:5,z:-1},cuts=extrusions.map(f=>({...f,id:'cut-'+f.id,operation:'cut',target:'base',depth:6,z:-1,region:{...f.region,offset:-1}})),result=runOperation([base,...sketches],{type:'extrusionBatch',features:cuts}),cutBodies=kernelBodies([base,...sketches,...result.features]);try{const shape=cutBodies.get('base'),expected=40*24*4-regions.reduce((n,r)=>n+r.area*4,0);assert(Math.abs(R.measureVolume(shape)-expected)<.001);assert.equal(cutBodies.size,1);valid(shape);}finally{cutBodies.forEach(s=>s.delete());}
 }
}
const proof={nativeLatinExtrusion:true,nativeJapaneseExtrusion:true,tiltedPlane:true,inkVolumeMatches:true,countersRemainEmpty:true,engravingCut:true,cutPreservesBase:true,validSolids:true};await fs.writeFile(dir+'native-proof.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
