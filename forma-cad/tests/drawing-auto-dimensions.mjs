import assert from 'node:assert/strict';
import {autoDrawingDimensions,completeDrawingCircles} from '../src/drawing-auto-dimensions.js';
import {drawingSheet} from '../src/drawing-sheet.js';
import {drawingDimensionGeometry,dimensionLabel,dimensionValue} from '../src/drawing-dimensions.js';
import {captureDrawingReferences,reconcileDrawingDimensions} from '../src/drawing-dimension-references.js';
import {arrangeDrawingDimensions,dimensionPlacement,drawingDimensionConflicts,reflowResizedDrawingDimensions} from '../src/drawing-dimension-layout.js';
const circle='M 14 -8 A 4 4 0 0 1 6 -8 A 4 4 0 0 1 14 -8 Z';
const data={bounds:[[0,0,0],[40,25,20]],bodyCount:1,views:{front:{visible:['M 0 -20 L 40 -20 L 40 0 L 0 0 Z'],hidden:[]},top:{visible:['M 0 -25 L 40 -25 L 40 0 L 0 0 Z',circle],hidden:[]},right:{visible:['M 0 -20 L 25 -20 L 25 0 L 0 0 Z'],hidden:[]},iso:{visible:[],hidden:[],viewBox:[0,0,40,30]}}};
assert.equal(completeDrawingCircles({visible:[circle,circle]}).length,1);
assert.equal(completeDrawingCircles({visible:['M 14 -8 A 4 4 0 0 1 6 -8','M 14 -8 A 4 4 0 0 1 6 -8']}).length,0,'duplicate semicircles do not form a circle');
const sheet=drawingSheet(data,1,true,[],'',{frame:true});
const {dimensions}=autoDrawingDimensions(data,1,[],sheet);
assert.deepEqual(dimensions.filter(d=>d.overall).map(dimensionValue),[40,20,40,25,25,20]);
for(const [view,values]of [['front',[40,20]],['top',[40,25]],['right',[25,20]]])assert.deepEqual(dimensions.filter(d=>d.view===view&&d.overall).map(dimensionValue),values,'both axes are dimensioned in '+view);
assert.deepEqual(dimensions.filter(d=>d.kind==='diameter').map(dimensionValue),[8]);
assert.deepEqual(dimensions.filter(d=>d.view==='top'&&d.kind==='horizontal'&&!d.overall).map(dimensionValue),[10]);
assert.deepEqual(dimensions.filter(d=>d.view==='top'&&d.kind==='vertical'&&!d.overall).map(dimensionValue),[17]);
assert.equal(autoDrawingDimensions(data,1,dimensions,sheet).dimensions.length,0,'repeated auto dimension is idempotent');
const configured=autoDrawingDimensions(data,1,[],sheet,{views:{front:['vertical'],top:['diameter'],right:[]},fontSize:5.2}).dimensions;
assert.deepEqual(configured.map(d=>[d.view,d.kind,d.fontSize]),[['front','vertical',5.2],['top','diameter',5.2]]);
const spacing=autoDrawingDimensions(data,1,[],sheet,{views:{front:[],top:['spacing'],right:[]}}).dimensions;
assert.deepEqual(spacing.map(dimensionValue),[10,17]);
const manual=structuredClone(dimensions);for(const d of manual){delete d.automatic;delete d.overall;}
assert.equal(autoDrawingDimensions(data,1,manual,sheet).dimensions.length,0,'manual equivalents are preserved without duplicates');
const legacy=dimensions.filter(d=>['fronthorizontal','frontvertical','topvertical'].includes(d.overall)),upgrade=autoDrawingDimensions(data,1,legacy,sheet);
assert.deepEqual(upgrade.dimensions.filter(d=>d.overall).map(d=>d.overall),['tophorizontal','righthorizontal','rightvertical'],'existing drawings get only their missing view dimensions');
const noCircles=structuredClone(data);noCircles.views.top.visible=noCircles.views.top.visible.slice(0,1);
assert.equal(autoDrawingDimensions(noCircles,1,[],drawingSheet(noCircles,1)).dimensions.length,6,'all three views get dimensions without any circles');
const shifted=structuredClone(data);shifted.bounds=[[12,-35,6],[52,-10,26]];
const shiftedOverall=autoDrawingDimensions(shifted,1,[],drawingSheet(shifted,1)).dimensions.filter(d=>d.overall);
assert.deepEqual(shiftedOverall.map(dimensionValue),[40,20,40,25,25,20],'translated bodies use the correct projection axes');
const flat=structuredClone(noCircles);flat.bounds=[[0,0,0],[40,25,0]];
assert.equal(autoDrawingDimensions(flat,1,[],drawingSheet(flat,1)).dimensions.length,4,'zero thickness dimensions are omitted');
const half=autoDrawingDimensions(data,.5,[],drawingSheet(data,.5,true,[],'',{frame:true}));
assert.deepEqual(half.dimensions.map(dimensionValue),dimensions.map(dimensionValue),'printed scale changes placement, not measurements');
const lots=structuredClone(data);lots.views.top.visible=Array.from({length:80},(_,i)=>circle.replaceAll('14',String(14+i*20)).replaceAll('6 -8',String(6+i*20)+' -8'));
const capped=autoDrawingDimensions(lots,1,[],drawingSheet(lots,1));assert.equal(capped.dimensions.filter(d=>d.kind==='diameter').length,1);assert.equal(capped.dimensions.find(d=>d.kind==='diameter').count,80,'group all occurrences before applying the annotation limit');
assert.equal(autoDrawingDimensions(data,1,Array.from({length:500},()=>dimensions[0]),sheet).dimensions.length,0);
const tracked=dimensions.map(d=>d.kind==='diameter'?{...d,note:'貫通 <A&B>',tolerance:.1}:d);
const refs=captureDrawingReferences(data,tracked);
const edited=structuredClone(data);edited.bounds[1][0]=48;
edited.views.top.visible[1]='M 18 -8 A 4 4 0 0 1 10 -8 A 4 4 0 0 1 18 -8 Z';
const updated=reconcileDrawingDimensions(edited,tracked,refs);
assert(!updated.some(d=>d.review));
assert.equal(dimensionValue(updated.find(d=>d.overall==='fronthorizontal')),48);
assert.deepEqual(updated.find(d=>d.kind==='diameter').center,[14,-8]);
assert.equal(dimensionValue(updated.find(d=>d.view==='top'&&d.kind==='horizontal'&&!d.overall)),14);
assert.equal(dimensionLabel(updated.find(d=>d.kind==='diameter')),'Ø8 ±0.1 貫通 <A&B>');
const removed=reconcileDrawingDimensions(noCircles,tracked,refs);
assert.equal(dimensionLabel(removed.find(d=>d.kind==='diameter')),'要確認');
assert(removed.filter(d=>d.overall).every(d=>!d.review));
assert(reconcileDrawingDimensions(data,tracked,refs,{targetsChanged:true}).every(d=>d.review));
const mixed=drawingSheet(data,1,false,updated,'',{hiddenViews:{right:true}});
assert.equal((mixed.svg.match(/data-hidden="true"/g)||[]).length,1);
assert.match(mixed.svg,/Ø8 ±0\.1 貫通 &lt;A&amp;B&gt;/);
const coloredDimensions=[
 {...updated[0],textColor:'#006600'},
 {...updated.find(d=>d.kind==='diameter'),lineColor:'#000099'},
 {...updated[1],review:true,textColor:'#006600',lineColor:'#000099'},
];
const colored=drawingSheet(data,1,false,coloredDimensions,'',{dimensionColors:{lineColor:'#cc0000',textColor:'#111111'}}).svg;
assert.match(colored,/<g data-dimension="0" stroke="#cc0000"[^]*?<path [^>]*fill="#cc0000"[^]*?<text [^>]*fill="#006600"/);
assert.match(colored,/<g data-dimension="1" stroke="#000099"[^]*?<path [^>]*fill="#000099"[^]*?<text [^>]*fill="#111111"/);
assert.match(colored,/<g data-dimension="2" data-dimension-review="true"[^]*?<text [^>]*fill="#a85014"/);
const rounded=structuredClone(data);
rounded.views.top.visible=['M 0 -20 L 0 -5 A 5 5 0 0 0 5 0 L 35 0 A 5 5 0 0 0 40 -5 L 40 -25 L 0 -25 Z',circle];
const roundedSheet=drawingSheet(rounded,2,true,[],'',{viewSelection:['top'],isoMode:'hidden'});
const radii=autoDrawingDimensions(rounded,2,[],roundedSheet,{views:{top:['radius','diameter']}}).dimensions;
assert.equal(radii.filter(d=>d.kind==='radius').length,1);
assert.equal(radii.find(d=>d.kind==='radius').count,2);
assert.equal(dimensionLabel(radii.find(d=>d.kind==='radius')),'2×R5');
assert.equal(radii.filter(d=>d.kind==='diameter').length,1);
assert(radii.filter(d=>d.kind==='radius').every(d=>d.radius===5&&d.arcPoint));
assert.equal(autoDrawingDimensions(rounded,2,[],roundedSheet,{views:{top:['diameter']}}).dimensions.filter(d=>d.kind==='radius').length,0);
const crowdedSheet={width:297,contentBottom:175,layout:{top:{x:204,y:32,bx:0,by:0,scale:1.49,width:74.5,height:74.5}},
 note:{x:186,y:40,width:17,height:48}};
const fillet={view:'top',kind:'radius',center:[2,48],arcPoint:[2-Math.SQRT2,48+Math.SQRT2],radius:2,
 at:[2,104],automatic:true};
const overall={view:'top',kind:'horizontal',a:[0,50],b:[50,50],at:[0,55.4],automatic:true,pinned:true,overall:'tophorizontal'};
const arrangedFillet=arrangeDrawingDimensions([fillet],crowdedSheet,[overall]).dimensions[0];
assert.deepEqual(arrangedFillet.arcPoint,fillet.arcPoint);
assert(Math.hypot(...arrangedFillet.at.map((n,i)=>n-fillet.arcPoint[i]))*1.49<=20.001);
assert.notDeepEqual(reflowResizedDrawingDimensions([overall,fillet],crowdedSheet).dimensions[1].at,fillet.at);
assert.deepEqual(arrangeDrawingDimensions([{...fillet,pinned:true}],crowdedSheet).dimensions[0].at,fillet.at);
const cornerSheet={width:160,contentBottom:135,layout:{top:{x:40,y:30,bx:0,by:0,scale:1,width:50,height:50}}};
const edgeLength={view:'top',kind:'horizontal',a:[0,50],b:[50,50],at:[25,58],overall:'tophorizontal',automatic:true,pinned:true};
const cornerRadius={view:'top',kind:'radius',center:[48,48],radius:2,arcPoint:[48+Math.SQRT2,48+Math.SQRT2],at:[50.5,57.6],automatic:true};
const placedEdge=dimensionPlacement(edgeLength,cornerSheet);
const intersects=(a,b)=>a.x<b.x+b.width&&b.x<a.x+a.width&&a.y<b.y+b.height&&b.y<a.y+a.height;
const oldBox=dimensionPlacement(cornerRadius,cornerSheet).box;
assert(!intersects(oldBox,placedEdge.box));
assert(intersects(oldBox,placedEdge.arrowBoxes[1]),'R2 covers the end arrow of the 50 mm dimension');
const issues=drawingDimensionConflicts([cornerRadius,edgeLength],cornerSheet);
assert.deepEqual(issues.map(({index,reason})=>[index,reason]),[[0,'文字と矢印'],[1,'文字と矢印']]);
const single=arrangeDrawingDimensions([cornerRadius],cornerSheet,[edgeLength],{preferNearby:true,requireClear:true});
assert.deepEqual(single.unresolved,[]);
assert.deepEqual(drawingDimensionConflicts([single.dimensions[0],edgeLength],cornerSheet),[]);
const blocked={...cornerSheet,viewTitles:{top:{x:5,y:18,width:150,height:116}}};
const unchanged=arrangeDrawingDimensions([cornerRadius],blocked,[edgeLength],{preferNearby:true,requireClear:true});
assert.deepEqual(unchanged.unresolved,[0]);
assert.deepEqual(unchanged.dimensions[0],cornerRadius);
for(const [kind,b,direction] of [['horizontal',[50,0],[1,0]],['vertical',[0,-40],[0,-1]],['aligned',[30,40],[.6,.8]]]){
 const view=cornerSheet.layout.top,original={kind,a:[0,0],b,at:[10,12]},skewed={...original,alongOffset:7};
 const a=drawingDimensionGeometry(original,view),bent=drawingDimensionGeometry(skewed,view);
 assert.equal(dimensionValue(skewed),dimensionValue(original));
 for(let i=0;i<2;i++){
  assert(Math.abs(bent.at[i]-a.at[i]-7*direction[i])<1e-8);
  assert.deepEqual(bent.extensions[i][0],a.extensions[i][0]);
 }
 const [[x,y],[u,v]]=bent.main[0];
 assert(Math.abs(Math.hypot(u-x,v-y)-dimensionValue(original))<1e-8);
}
for(const result of [
 arrangeDrawingDimensions([cornerRadius,edgeLength],cornerSheet),
 reflowResizedDrawingDimensions([cornerRadius,edgeLength],cornerSheet,{radiiOnly:true}),
]){
 const [radius,edge]=result.dimensions;
 assert.deepEqual(edge.at,edgeLength.at);
 assert.deepEqual(radius.arcPoint,cornerRadius.arcPoint);
 assert(!intersects(dimensionPlacement(radius,cornerSheet).box,placedEdge.arrowBoxes[1]));
 assert(Math.hypot(...radius.at.map((n,i)=>n-radius.arcPoint[i]))<=20.001);
}
const w1={view:'top',kind:'horizontal',a:[0,0],b:[40,0],at:[0,12],fontSize:9,automatic:true,pinned:true};
const w2={...w1,pinned:false,a:[2,0],b:[38,0],at:[0,15]};
assert.deepEqual(arrangeDrawingDimensions([w1,w2],roundedSheet).dimensions[0].at,w1.at);
const reflow=reflowResizedDrawingDimensions([w1,w2],roundedSheet);
assert.deepEqual(reflow.dimensions[0].at,w1.at);
assert.notDeepEqual(reflow.dimensions[1].at,w2.at);
console.log('PASS overall and circular feature measurements, full-circle recognition, manual/auto deduplication, scale independence, repeated-feature and document limits');
