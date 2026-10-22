import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {parseTextFont,textSketchLayout,textSketchFeatures} from '../src/text-sketch.js';
import {findRegions,regionContains} from '../src/regions.js';
import {validateFeature} from '../src/geometry.js';
import {translateConnectedSketch} from '../src/connected-sketch-move.js';
const bytes=await fs.readFile('assets/fonts/NotoSansCJKjp-Regular.otf'),font=parseTextFont(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)),xy={plane:'XY',frame:{u:[1,0,0],v:[0,1,0],n:[0,0,1]},offset:0};
const dir='outputs/text-sketch/';await fs.mkdir(dir,{recursive:true});
const sample=spec=>textSketchLayout(font,{text:'OB8',height:10,...spec});
const layout=sample(),sketches=textSketchFeatures(layout,xy),snapshot=JSON.stringify(sketches),regions=findRegions(sketches);sketches.forEach(validateFeature);
assert.equal(regions.length,3);assert.deepEqual(regions.map(r=>r.holes.length).sort(),[1,2,2]);assert.equal(layout.contours.filter(r=>r.hole).length,5);assert(Math.abs(layout.bounds.max[1]-10)<.01);
for(const r of regions)for(const hole of r.holes){const center=hole.reduce((p,q)=>p.map((v,i)=>v+q[i]/hole.length),[0,0]);assert(!regions.some(region=>regionContains(region,center)));}
const jp=sample({text:'日本語 文字 こんにちは'}),jpSketches=textSketchFeatures(jp,xy);jpSketches.forEach(validateFeature);assert(findRegions(jpSketches).length>10);assert(jp.vertices<5000);
const spaced=sample({spacing:2});assert(spaced.bounds.max[0]>layout.bounds.max[0]+3.9);const rotated=sample({angle:90,u:20,v:-5});assert(Math.abs(rotated.bounds.min[0]-10)<.01);assert(Math.abs(rotated.bounds.max[1]-(layout.bounds.max[0]-5))<.01);
for(const align of ['left','center','right']){const l=sample({align}),b=l.bounds;if(align==='center')assert(Math.abs(b.min[0]+b.max[0])<1e-5);if(align==='right')assert.equal(b.max[0],0);}
const multi=sample({text:'AB\n12'});assert(multi.bounds.max[1]>24&&multi.bounds.max[1]<26);assert.equal(findRegions(textSketchFeatures(multi,xy)).length,4);
const moved=translateConnectedSketch(sketches,sketches,new Vector3(5,3,0));assert.equal(findRegions(moved).length,3);assert.equal(JSON.stringify(sketches),snapshot);
const reloaded=JSON.parse(JSON.stringify({format:'forma-cad',version:1,features:sketches}));assert.equal(findRegions(reloaded.features).length,3);await fs.writeFile(dir+'latin.forma.json',JSON.stringify(reloaded));await fs.writeFile(dir+'japanese.forma.json',JSON.stringify({format:'forma-cad',version:1,features:jpSketches}));
for(const spec of [{text:''},{text:'\n '},{text:'😀'},{text:'A'.repeat(81)},{text:'A\n'.repeat(6)},{height:0},{height:NaN},{spacing:-1},{u:Infinity},{angle:361}])assert.throws(()=>sample(spec));assert.throws(()=>parseTextFont(new ArrayBuffer(20)));
const ordinary=sketches.map(({textOutline,...f})=>f);assert.equal(findRegions(ordinary).length,8); // Existing ordinary nested sketch regions remain unchanged.
const proof={japaneseAndLatin:true,countersRemainEmpty:true,onlyInkSelectable:true,physicalHeight:true,spacingRotationAlignment:true,multiline:true,saveReload:true,movedCountersPreserved:true,invalidAndMissingGlyphsRejected:true,ordinarySketchBehaviorUnchanged:true};await fs.writeFile(dir+'geometry-proof.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
