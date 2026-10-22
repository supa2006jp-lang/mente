import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {TEXT_FONTS} from '../src/text-fonts.js';
import {parseTextFont,flattenTextPath,textSketchLayout,textSketchFeatures} from '../src/text-sketch.js';
import {verticalTextRings} from '../src/text-vertical-layout.js';
import {textBoxCorners,textDragMove,textDragScale} from '../src/text-sketch-manipulator.js';
import {findRegions} from '../src/regions.js';
const dir='outputs/text-layout-edit/';await fs.mkdir(dir,{recursive:true});const rows=[];
for(const entry of TEXT_FONTS){
 const b=await fs.readFile('assets/fonts/'+entry.file),font=parseTextFont(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)),spec={text:'文字 OB8',height:10,spacing:1,writingMode:'vertical'},layout=textSketchLayout(font,spec),features=textSketchFeatures(layout,{plane:'XY',frame:{u:[1,0,0],v:[0,1,0],n:[0,0,1]},offset:0},{fontName:entry.name}),regions=findRegions(features);
 assert.equal(regions.length,6);assert.equal(regions.reduce((n,r)=>n+r.holes.length,0),6);assert(layout.bounds.max[1]>layout.bounds.max[0]*5);assert(features.every(f=>f.textOutline.writingMode==='vertical'));assert.equal(findRegions(JSON.parse(JSON.stringify(features))).length,6);
 const raw=verticalTextRings(font,['日月','火'],{height:10,spacing:1,align:'left',tolerance:.01,flatten:flattenTextPath});assert.deepEqual(raw.glyphs.map(g=>g.character),['日','月','火']);assert(raw.glyphs[0].center[1]>raw.glyphs[1].center[1]);assert(raw.glyphs[0].center[0]>raw.glyphs[2].center[0]);const centered=verticalTextRings(font,['日月','火'],{height:10,spacing:1,align:'center',tolerance:.01,flatten:flattenTextPath}),bottom=verticalTextRings(font,['日月','火'],{height:10,spacing:1,align:'right',tolerance:.01,flatten:flattenTextPath});assert(Math.abs(centered.glyphs[2].center[1]+raw.pitch/2)<1e-7);assert(Math.abs(bottom.glyphs[2].center[1]+raw.pitch)<1e-7);
 const bar=textSketchLayout(font,{text:'ー',height:10,writingMode:'vertical'});assert(bar.bounds.max[1]>bar.bounds.max[0]*3);const h=textSketchLayout(font,{text:'A',height:10}),v=textSketchLayout(font,{text:'A',height:10,writingMode:'vertical'});assert(Math.abs(h.bounds.max[0]-v.bounds.max[0])<.01);
 const punctuation=verticalTextRings(font,['（ー）。'],{height:10,spacing:0,align:'left',tolerance:.01,flatten:flattenTextPath});assert(punctuation.glyphs.slice(0,3).every(g=>g.substituted||g.rotated));rows.push({id:entry.id,regions:regions.length,holes:6,verticalPunctuation:true});
}
const layout={u:10.25,v:-5.5,height:12.5,spacing:1,angle:32,localBounds:{min:[-15,0],max:[20,40]}};
for(let corner=0;corner<4;corner++){
 const c=textBoxCorners(layout),fixed=c[(corner+2)%4],moving=c[corner],delta=moving.map((n,i)=>(n-fixed[i])*.5),scaled=textDragScale(layout,corner,delta),next={...layout,...scaled,localBounds:{min:layout.localBounds.min.map(n=>n*scaled.scale),max:layout.localBounds.max.map(n=>n*scaled.scale)}},result=textBoxCorners(next);
 assert(Math.abs(scaled.scale-1.5)<1e-10);assert(Math.abs(scaled.height-18.75)<1e-10);assert(Math.abs(scaled.spacing-1.5)<1e-10);assert(Math.hypot(...result[(corner+2)%4].map((n,i)=>n-fixed[i]))<1e-9);assert(Math.hypot(...result[corner].map((n,i)=>n-moving[i]-delta[i]))<1e-9);assert(Math.abs(textDragScale(layout,corner,delta,{shift:true}).scale-1.05)<1e-10);
}
const snapped=textDragMove(layout,[2,3],{enabled:true,step:10});assert.equal(snapped.u,10);assert.equal(snapped.v,0);const free=textDragMove(layout,[2,3],{enabled:true,step:10,shift:true});assert.equal(free.u,12.25);assert.equal(free.v,-2.5);
const proof={verticalJapaneseAndLatin:true,uprightLetters:true,rightToLeftColumns:true,verticalAlignment:true,punctuationFormsAndFallback:true,holesAndSaveReload:true,fourCornerUniformScaling:true,oppositeCornerFixed:true,spacingScalesWithText:true,shiftFineResize:true,moveGridSnapAndShift:true,rows};await fs.writeFile(dir+'geometry-proof.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
