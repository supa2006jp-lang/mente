import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {TEXT_FONTS} from '../src/text-fonts.js';
import {parseTextFont,textSketchLayout,textSketchFeatures} from '../src/text-sketch.js';
import {textBoxCorners,textDragScale} from '../src/text-sketch-manipulator.js';
import {defaults} from '../src/geometry.js';
import {findRegions} from '../src/regions.js';
import {runOperation,kernelBodies} from '../src/kernel.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));const rows=[];
for(const [i,entry] of TEXT_FONTS.entries()){
 const b=await fs.readFile('assets/fonts/'+entry.file),font=parseTextFont(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)),spec={text:'O字8',height:10,spacing:1,angle:20,u:7,v:-4,writingMode:'vertical'},before=textSketchLayout(font,spec),corners=textBoxCorners(before),delta=corners[0].map((n,j)=>(n-corners[2][j])*.5),scaled=textDragScale(before,0,delta),layout=textSketchLayout(font,{...spec,...scaled}),plane=i%2?{plane:'CUSTOM',frame:{u:[Math.SQRT1_2,0,-Math.SQRT1_2],v:[0,1,0],n:[Math.SQRT1_2,0,Math.SQRT1_2]},offset:3}:{plane:'XY',frame:{u:[1,0,0],v:[0,1,0],n:[0,0,1]},offset:0},sketches=textSketchFeatures(layout,plane,{fontName:entry.name}),regions=findRegions(sketches),extrusions=regions.map((region,j)=>({...defaults,...plane,kind:'extrusion',profile:'region',region,id:entry.id+'-'+j,depth:2,x:plane.frame.n[0]*plane.offset,y:plane.frame.n[1]*plane.offset,z:plane.frame.n[2]*plane.offset})),result=runOperation(sketches,{type:'extrusionBatch',features:extrusions}),bodies=kernelBodies([...sketches,...result.features]);
 try{let volume=0;for(const shape of bodies.values()){const check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);try{assert(check.IsValid());}finally{check.delete();}volume+=R.measureVolume(shape);}assert(Math.abs(volume-regions.reduce((n,r)=>n+r.area*2,0))<.001);assert.equal(regions.reduce((n,r)=>n+r.holes.length,0),3);assert(Math.hypot(...textBoxCorners(layout)[2].map((n,j)=>n-corners[2][j]))<.02);rows.push({id:entry.id,valid:true,volume,plane:plane.plane});}finally{bodies.forEach(shape=>shape.delete());}
}
await fs.mkdir('outputs/text-layout-edit',{recursive:true});const proof={verticalExtrusionAllFonts:true,resizedTextExtrudes:true,tiltedPlane:true,counterHoles:true,validSolids:true,volumeMatches:true,oppositeCornerFixed:true,rows};await fs.writeFile('outputs/text-layout-edit/native-proof.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
