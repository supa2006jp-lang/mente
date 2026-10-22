import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {TEXT_FONTS,TEXT_FONT_ASSETS,createTextFontLibrary} from '../src/text-fonts.js';
import {parseTextFont,textSketchLayout,textSketchFeatures} from '../src/text-sketch.js';
import {findRegions} from '../src/regions.js';
import {validateFeature} from '../src/geometry.js';
const dir='outputs/text-fonts/';await fs.mkdir(dir,{recursive:true});const rows=[];
for(const entry of TEXT_FONTS){
 const bytes=await fs.readFile('assets/fonts/'+entry.file),font=parseTextFont(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)),layout=textSketchLayout(font,{text:'文字 OB8',height:10}),features=textSketchFeatures(layout,{plane:'XY',frame:{u:[1,0,0],v:[0,1,0],n:[0,0,1]},offset:0},{fontName:entry.name}),regions=findRegions(features);
 features.forEach(validateFeature);assert.equal(regions.length,6);assert.equal(regions.reduce((n,r)=>n+r.holes.length,0),6);assert(features.every(f=>f.textOutline.fontName===entry.name));assert(Math.abs(layout.bounds.max[1]-layout.bounds.min[1]-10)<.03);
 assert.equal(findRegions(JSON.parse(JSON.stringify(features))).length,6);rows.push({id:entry.id,name:entry.name,vertices:layout.vertices,area:regions.reduce((n,r)=>n+r.area,0),regions:regions.length,holes:6});
}
assert.equal(new Set(rows.map(r=>r.area.toFixed(3))).size,4);
for(const file of TEXT_FONT_ASSETS)assert((await fs.stat('assets/fonts/'+file)).size>0);
const calls=[],library=createTextFontLibrary(bytes=>({bytes:bytes.byteLength}),{fetchFont:async url=>{calls.push(url);return {ok:true,arrayBuffer:async()=>new ArrayBuffer(12)};}});assert.equal(calls.length,0);const [a,b]=await Promise.all([library.load('gothic'),library.load('gothic')]);assert.equal(a,b);assert.equal(calls.length,1);await library.load('rounded');assert.equal(calls.length,2);await assert.rejects(()=>library.load('unknown'));assert.equal(calls.length,2);
let attempts=0;const retry=createTextFontLibrary(()=>({}),{fetchFont:async()=>({ok:++attempts>1,arrayBuffer:async()=>new ArrayBuffer(2)})});await assert.rejects(()=>retry.load('mincho'));await retry.load('mincho');assert.equal(attempts,2);
const proof={fourDistinctFonts:true,japaneseAndLatin:true,allCountersPreserved:true,physicalHeight:true,saveReload:true,fontNameRecorded:true,licenseAssetsPresent:true,lazyLoading:true,sharedInflightAndCache:true,retryAfterFailure:true,unknownRejected:true,rows};await fs.writeFile(dir+'geometry-proof.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
