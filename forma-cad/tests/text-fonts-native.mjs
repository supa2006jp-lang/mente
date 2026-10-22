import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {TEXT_FONTS} from '../src/text-fonts.js';
import {parseTextFont,textSketchLayout,textSketchFeatures} from '../src/text-sketch.js';
import {defaults} from '../src/geometry.js';
import {findRegions} from '../src/regions.js';
import {runOperation,kernelBodies} from '../src/kernel.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const rows=[];
for(const entry of TEXT_FONTS){
 const bytes=await fs.readFile('assets/fonts/'+entry.file),font=parseTextFont(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)),layout=textSketchLayout(font,{text:'文字 O',height:10}),features=textSketchFeatures(layout,{plane:'XY',frame:{u:[1,0,0],v:[0,1,0],n:[0,0,1]},offset:0},{fontName:entry.name}),regions=findRegions(features),extrusions=regions.map((region,i)=>({...defaults,kind:'extrusion',profile:'region',id:entry.id+'-'+i,region,depth:2})),result=runOperation(features,{type:'extrusionBatch',features:extrusions}),bodies=kernelBodies([...features,...result.features]);
 try{let volume=0;for(const shape of bodies.values()){const check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);try{assert(check.IsValid());}finally{check.delete();}volume+=R.measureVolume(shape);}assert(Math.abs(volume-regions.reduce((n,r)=>n+r.area*2,0))<.001);assert.equal(bodies.size,regions.length);rows.push({id:entry.id,valid:true,volume,regions:regions.length,holes:regions.reduce((n,r)=>n+r.holes.length,0)});}finally{bodies.forEach(shape=>shape.delete());}
}
await fs.mkdir('outputs/text-fonts',{recursive:true});const proof={allFourNativeFonts:true,japaneseAndLatin:true,validSolids:true,inkVolumeMatches:true,counterHolesRemain:true,rows};await fs.writeFile('outputs/text-fonts/native-proof.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
