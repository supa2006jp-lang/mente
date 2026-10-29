import assert from 'node:assert/strict';
import {drawingSheet} from '../src/drawing-sheet.js';
import {drawingViewFrames,optimizeDrawingLayout,rescaleDrawingAnnotations} from '../src/drawing-auto-layout.js';
import {overallDrawingDimensions,autoDrawingDimensions} from '../src/drawing-auto-dimensions.js';
import {dimensionValue} from '../src/drawing-dimensions.js';
import {readDrawingState} from '../src/drawing-state.js';
const data={bounds:[[0,0,0],[100,60,50]],bodyCount:1,views:{front:{visible:['M0 0 H100 V-50 H0 Z'],hidden:[]},top:{visible:['M0 0 H100 V-60 H0 Z'],hidden:[]},right:{visible:['M0 0 H60 V-50 H0 Z'],hidden:[]},iso:{viewBox:[0,0,250,200],visible:['M0 0 L250 200'],hidden:[]}}},base={paper:'A4',orientation:'landscape',frame:true},near=(a,b)=>assert(Math.abs(a-b)<1e-5,`${a} != ${b}`),original=JSON.stringify(data);
const baseline=optimizeDrawingLayout(data,{options:base});
let cases=0;for(const viewPriority of ['balanced','front'])for(const isoMode of ['full','small','hidden'])for(const orientation of ['landscape','portrait']){
 const options={...base,viewPriority,isoMode,orientation},frames=drawingViewFrames(data,options),result=optimizeDrawingLayout(data,{options}),sheet=drawingSheet(data,result.scale,true,[],'',{...options,positions:result.positions,layout:'compact'});
 near(sheet.layout.front.scale,result.scale*(viewPriority==='front'?1.4:1));near(sheet.layout.top.scale,result.scale);near(frames.front.factor,viewPriority==='front'?1.4:1);
 if(isoMode==='hidden'){assert(!sheet.layout.iso);assert(!result.positions.iso);assert(!sheet.svg.includes('data-view="iso"'));}else{near(sheet.layout.iso.scale,result.scale*(isoMode==='small'?.5:1));assert(sheet.svg.includes('ISOMETRIC'+(isoMode==='small'?' / SCALE ':'')));}
 if(viewPriority==='front')assert.match(sheet.svg,/FRONT \/ SCALE/);for(const b of result.boxes){assert(b.x>=result.area.x-1e-6&&b.y>=result.area.y-1e-6);assert(b.x+b.width<=result.area.x+result.area.width+1e-6&&b.y+b.height<=result.area.y+result.area.height+1e-6);}
 const dimensions=overallDrawingDimensions(data,result.scale,sheet);assert.deepEqual(dimensions.map(dimensionValue),[100,50,100,60,60,50]);near((dimensions[0].at[1]-dimensions[0].a[1])*sheet.layout.front.scale,8);const auto=autoDrawingDimensions(data,result.scale,[],sheet);assert.deepEqual(auto.dimensions.map(dimensionValue),[100,50,100,60,60,50]);
 const state={version:1,signature:'p',targets:['a'],targetMode:'visible',scale:result.scale,hidden:true,comment:'',dimensions:[],options:{...options,name:'',material:'',date:'',positions:result.positions,layout:'compact'}};assert.deepEqual(readDrawingState(state),state);cases++;
}
const options={...base,viewPriority:'front',isoMode:'small'},preferred=optimizeDrawingLayout(data,{options});assert(preferred.scale*1.4>baseline.scale*1.2,'front gains paper area when the large isometric view is reduced');
const beforeFrames=drawingViewFrames(data),nextFrames=drawingViewFrames(data,options),dims=overallDrawingDimensions(data,1),updated=rescaleDrawingAnnotations(dims,nextFrames,1,1,beforeFrames);near(updated[0].at[1]*1.4,8);assert.deepEqual(updated.map(dimensionValue),dims.map(dimensionValue));
for(const key of ['viewPriority','isoMode'])assert.throws(()=>readDrawingState({version:1,signature:'p',targets:[],targetMode:'visible',scale:1,hidden:true,comment:'',dimensions:[],options:{...base,[key]:'bad',name:'',material:'',date:'',positions:{}}}));assert.equal(JSON.stringify(data),original);
console.log(JSON.stringify({pass:true,cases,frontGain:preferred.scale*1.4/baseline.scale,explicitScales:true,hideIso:true,realDimensionsPreserved:true,paperAnnotationGapPreserved:true,persistValidation:true}));
