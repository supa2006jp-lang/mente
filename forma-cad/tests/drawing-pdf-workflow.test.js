import assert from 'node:assert/strict';
import {test} from 'node:test';
import {autoDrawingDimensions,drawingIsometricOverallAnchors,hideDuplicateOverallDimensions} from '../src/drawing-auto-dimensions.js';
import {arrangeDrawingDimensionConflicts,arrangeDrawingDimensions,dimensionPlacement,drawingDimensionConflicts} from '../src/drawing-dimension-layout.js';
import {drawingBoxPlacementIssue} from '../src/drawing-paper-bounds.js';
import {drawingPDFHasMultiplePages,drawingPDFPages,remapDrawingPDFPages} from '../src/drawing-pdf-pages.js';
import {drawingPDFIssues,drawingSheetOverflow,drawingViewOverlaps} from '../src/drawing-sheet-check.js';
import {dimensionLabel,dimensionValue,drawingDimensionGeometry} from '../src/drawing-dimensions.js';
import {drawingSheet} from '../src/drawing-sheet.js';
import {optimizeDrawingLayout} from '../src/drawing-auto-layout.js';
import {readDrawingState} from '../src/drawing-state.js';
import {drawingScaleLabel,minDrawingScale,maxDrawingScale,parseDrawingScale,projectDrawingIsometric,snapDrawingResizeScale,stepDrawingScale} from '../src/drawing-view-preferences.js';

const rect=(w,h)=>({visible:[`M 0 0 L ${w} 0 L ${w} ${-h} L 0 ${-h} Z`],hidden:[]});
const part={bounds:[[0,0,0],[60,40,20]],bodyCount:1,views:{
 front:rect(60,20),top:rect(60,40),right:rect(40,20),
 'section-a':{...rect(40,20),viewBox:[0,-20,40,20]},
}};
const options={paper:'A4',orientation:'landscape',frame:true,layout:'projection',projectionLocked:true,isoMode:'hidden',
 name:'プレート',material:'',date:'',positions:{top:[50,30],front:[50,100],right:[165,100],'section-a':[195,65],comment:[155,55]},
 sections:[{id:'section-a',view:'front',orientation:'vertical',coordinate:20,reverse:false}],
};
const frontDimension={view:'front',kind:'horizontal',a:[0,0],b:[60,0],at:[25,12]};
const header=sheet=>sheet.svg.match(/data-sheet-scale="true">([^<]+)/)?.[1];

test('the editor announces a PDF only when more than one page will be produced',()=>{
 const views=['front','top','right'];
 assert.equal(drawingPDFHasMultiplePages(views,{pdfLayout:''}),false);
 assert.equal(drawingPDFHasMultiplePages(views,{pdfLayout:'manual',pageAssignments:{pageCount:1}}),false);
 assert.equal(drawingPDFHasMultiplePages(views,{pdfLayout:'manual',pageAssignments:{pageCount:2}}),true);
 assert.equal(drawingPDFHasMultiplePages(views,{pdfLayout:'multi'}),false);
 assert.equal(drawingPDFHasMultiplePages([...views,'section-a'],{pdfLayout:'multi'}),true);
 assert.equal(drawingPDFHasMultiplePages(views,{pdfLayout:'multi',holeTable:{view:'top'}}),true);
});

test('an assigned PDF preserves editor positions, real scales, wrapped notes and sheet size',()=>{
 const dimension={...frontDimension,at:[20,10]},notes='Plate note\nKeep this note with the section.';
 const config={...options,paper:'auto',pdfLayout:'manual',pageAssignments:{pageCount:3,views:{},comments:{comment:2}}};
 const editor=drawingSheet(part,1,true,[dimension],notes,config);
 const pages=drawingPDFPages(part,1,true,[dimension],notes,config,editor);
 assert.equal(pages.length,3);
 assert.deepEqual(pages.map(({width,height})=>[width,height]),Array.from({length:3},()=>[editor.width,editor.height]));
 assert.deepEqual(Object.keys(pages[0].layout).sort(),['front','right','top']);
 assert.deepEqual(pages[0].layout.top,editor.layout.top);
 assert.deepEqual(pages[0].layout.right,editor.layout.right);
 assert.deepEqual(pages[0].dimensions,[dimension]);
 assert.match(pages[0].svg,/THIRD ANGLE/);
 assert.deepEqual(pages[1].layout['section-a'],editor.layout['section-a']);
 assert.doesNotMatch(pages[1].svg,/THIRD ANGLE/);
 assert.deepEqual(pages[1].note,editor.note);
 assert.deepEqual(pages[2].layout,{});
 assert.equal(header(pages[2]),'mm');
});

test('splitting off auxiliary views preserves the overview and auto placement still repacks',()=>{
 const editor=drawingSheet(part,1,true,[],'',options);
 const [first,second]=drawingPDFPages(part,1,true,[],'',{...options,pdfLayout:'multi'},editor);
 assert.deepEqual(first.layout.front,editor.layout.front);
 assert.deepEqual(second.layout['section-a'],editor.layout['section-a']);
 const [auto]=drawingPDFPages(part,1,true,[],'',{...options,pdfLayout:'manual',pdfPlacement:'auto'},editor);
 assert.match(auto.svg,/data-layout="compact"/);
 assert.notDeepEqual(auto.layout.front,editor.layout.front);
 const [side]=drawingPDFPages(part,1,true,[],'',{...options,pdfLayout:'manual',
  viewScales:{right:.5},pageAssignments:{pageCount:2,views:{right:1,front:2,top:2},comments:{}}});
 assert.equal(side.layout.right.scale,.5);
 assert.equal(side.layout.right.y,105);
});

test('paper and view captions use the actual scale on each page',()=>{
 const config={...options,viewScales:{top:2},pdfLayout:'manual',pageAssignments:{pageCount:2,views:{top:2,'section-a':1},comments:{}}};
 const sheet=drawingSheet(part,.5,true,[],'',config);
 assert.equal(header(sheet),'縮尺は各図に記載 / mm');
 assert.match(sheet.svg,/TOP \/ SCALE 2:1/);
 assert.match(sheet.svg,/FRONT \/ SCALE 1:2/);
 const caption=sheet.viewTitles.front,front=sheet.layout.front,cutX=front.x+20*front.scale;
 assert.ok(caption.y+caption.height<front.y);
 assert.ok(caption.y+caption.height<front.y-7.5||caption.x>cutX+5.5);
 const [other,top]=drawingPDFPages(part,.5,true,[],'',config,sheet);
 assert.equal(header(other),'SCALE 1:2 / mm');
 assert.equal(header(top),'SCALE 2:1 / mm');
 assert.equal(top.layout.top.width,120);
 assert.doesNotMatch(top.svg,/TOP \/ SCALE/);
});

test('the layout label shares the right-aligned scale header and can be hidden on every sheet',()=>{
 const config={...options,layout:'compact',pdfLayout:'manual',pageAssignments:{pageCount:2,views:{front:2},comments:{}}};
 const overview=drawingSheet(part,1,true,[],'',config);
 const title='<tspan data-sheet-title="true">FORMA CAD / AUTO LAYOUT</tspan>';
 const scale='<tspan data-sheet-scale="true">SCALE 1:1 / mm</tspan>';
 const heading='<text data-sheet-header="true" x="282" y="12" font-size="3.5" text-anchor="end" xml:space="preserve">';
 assert.ok(overview.svg.includes(heading+title+'    '+scale+'</text>'));
 assert.ok(drawingPDFPages(part,1,true,[],'',config,overview).every(page=>page.svg.includes(title)));

 const hidden={...config,showLayoutLabel:false};
 const sheet=drawingSheet(part,1,true,[],'',hidden);
 for(const page of [sheet,...drawingPDFPages(part,1,true,[],'',hidden,sheet)]){
  assert.ok(page.svg.includes(heading+scale+'</text>'));
  assert.doesNotMatch(page.svg,/FORMA CAD/);
 }
 assert.deepEqual(sheet.layout,overview.layout);
});

test('placement uses the frame and the actual title block instead of reserving entire top and bottom strips',()=>{
 const {front,top,right}=part.views,data={...part,views:{front,top,right}};
 const config={...options,sections:[],layout:'compact',viewScales:{right:.8},viewBackground:'#ffff80',
  positions:{front:[15,5],top:[35,164],right:[170,85]}};
 const sheet=drawingSheet(data,1,true,[],'',config);
 const labels=[{dataset:{dimension:'0'},getBBox:()=>({x:22,y:198,width:25,height:5})}];
 const elements=Object.keys(sheet.layout).map(view=>({dataset:{view}})).concat(labels);
 const svg={querySelectorAll:()=>elements};
 assert.deepEqual(drawingSheetOverflow(svg,sheet),[]);
 assert.equal(sheet.layout.front.y,5);
 const topCaption=sheet.viewTitles.front;
 assert.equal(drawingBoxPlacementIssue(topCaption,sheet),null);
 assert.ok(topCaption.x>sheet.layout.front.x+sheet.layout.front.width);
 assert.match(sheet.svg,/FRONT \/ SCALE 1:1/);
 assert.match(sheet.svg,/縮尺は各図に記載/);
 assert.match(sheet.svg,/<rect data-view-background="front" x="13" y="5"/);

 const closeToTop=drawingSheet(data,1,true,[],'',{...config,positions:{...config.positions,front:[15,12]}});
 const caption=closeToTop.viewTitles.front;
 assert.ok(caption.y>=5);
 assert.ok(caption.y+caption.height<closeToTop.layout.front.y);
 assert.equal(caption.height,sheet.viewTitles.top.height);

 const blocked=drawingSheet(data,1,true,[],'',{...config,positions:{...config.positions,front:[15,4],top:[35,166],right:[160,181]}});
 const issues=drawingSheetOverflow(svg,blocked).map(({element,reason})=>[element.dataset.view,reason]);
 assert.deepEqual(issues,[['top','paper'],['front','paper'],['right','titleBlock']]);
});

test('automatic placement can use the upper space at the chosen scale even when captions would not fit above',()=>{
 const data={bodyCount:1,bounds:[[0,0,0],[144,8,164]],views:{front:rect(144,164),top:rect(144,8)}};
 const config={...options,sections:[],viewSelection:['front','top'],viewScales:{top:.5},projectionLocked:false};
 const result=optimizeDrawingLayout(data,{options:config,fixedScale:true,scale:1});
 assert.equal(result?.scale,1);
 const sheet=drawingSheet(data,result.scale,true,[],'',{...config,layout:'compact',positions:result.positions});
 assert.ok(sheet.layout.front.y<17);
 assert.deepEqual(drawingSheetOverflow({querySelectorAll:()=>Object.keys(sheet.layout).map(view=>({dataset:{view}}))},sheet),[]);
 assert.match(sheet.svg,/FRONT \/ SCALE 1:1/);
});

test('initial large layout keeps every caption inside the frame and clears the adjoining views',()=>{
 const data={bodyCount:1,bounds:[[0,0,0],[60,50,40]],views:{
  top:rect(60,50),front:rect(60,40),right:rect(50,40),
  iso:{...rect(77.78,77.57),viewBox:[0,-130/Math.sqrt(6),110/Math.SQRT2,190/Math.sqrt(6)]},
 }};
 const config={...options,layout:'compact',isoMode:'full',sections:[],positions:{}};
 const placed=optimizeDrawingLayout(data,{options:config,isoOnRight:true,spreadViews:true,preferProjectionOrder:true});
 assert.equal(placed.scale,1.8);
 assert.equal(placed.autoIsoScale,1);
 const sheet=drawingSheet(data,placed.scale,true,[],'',{...config,positions:placed.positions,autoIsoScale:placed.autoIsoScale});
 assert.equal(Object.keys(sheet.viewTitles).length,4);
 for(const title of Object.values(sheet.viewTitles))assert.equal(drawingBoxPlacementIssue(title,sheet),null);
 assert.deepEqual(drawingViewOverlaps(sheet),[]);
 const front=sheet.viewTitles.front;
 assert.ok(front.y+front.height<sheet.layout.front.y);
 assert.match(sheet.svg,/TOP \/ SCALE 1\.8:1/);
});

test('a tight initial layout fits the TOP heading above its view at the fitted scale',()=>{
 const width=50,depth=28,isoWidth=2*width/Math.SQRT2,isoHeight=2*(width+depth)/Math.sqrt(6);
 const data={bodyCount:1,bounds:[[0,0,0],[width,width,depth]],views:{
  top:rect(width,width),front:rect(width,depth),right:rect(width,depth),
  iso:{...rect(isoWidth,isoHeight),viewBox:[0,-(width+2*depth)/Math.sqrt(6),isoWidth,isoHeight]},
 }};
 const config={...options,layout:'compact',isoMode:'full',sections:[],positions:{},linkedProjections:true,linkedProjectionScales:true};
 const result=optimizeDrawingLayout(data,{options:config,isoOnRight:true,spreadViews:true,preferProjectionOrder:true});
 assert.equal(result.scale,2);
 assert.equal(result.autoIsoScale,1);
 const sheet=drawingSheet(data,result.scale,true,[],'',{...config,positions:result.positions,autoIsoScale:result.autoIsoScale});
 const top=sheet.layout.top,title=sheet.viewTitles.top;
 assert.ok(title.y+title.height<top.y);
 assert.ok(title.x>=top.x&&title.x+title.width<=top.x+top.width);
 assert.equal(drawingBoxPlacementIssue(title,sheet),null);
 assert.deepEqual(drawingViewOverlaps(sheet),[]);

 const saved={...config,positions:{...result.positions,top:[top.x,6.5]},autoIsoScale:result.autoIsoScale,
  pdfLayout:'manual',pageAssignments:{pageCount:2,views:{iso:2},comments:{}}};
 const restored=drawingSheet(data,2,true,[],'',saved);
 const [page]=drawingPDFPages(data,2,true,[],'',saved,restored);
 for(const s of [restored,page]){
  const view=s.layout.top,heading=s.viewTitles.top;
  assert.deepEqual([view.y,view.scale],[6.5,2]);
  assert.ok(heading.x>=view.x&&heading.x+heading.width<=view.x+view.width);
  assert.ok(heading.y>=view.y&&heading.y+heading.height<view.y+9);
  assert.equal(drawingBoxPlacementIssue(heading,s),null);
 }
});

test('adjusted view captions follow their view and a PDF page can use its own caption position',()=>{
 const config={...options,sections:[],layout:'compact',viewSelection:['front'],isoMode:'hidden',projectionLocked:false,
  positions:{front:[42,60]},viewTitlePositions:{front:{offset:[31,-20],compact:true}},
  pdfLayout:'manual',pageAssignments:{pageCount:2,views:{front:2},comments:{}},
  pdfViewTitlePositions:{front:{offset:[-12,40]}},pdfPositions:{front:[60,80]}};
 const overview=drawingSheet(part,1,true,[],'',config);
 const caption=overview.viewTitles.front;
 assert.deepEqual([caption.x,caption.y],[73,40]);
 const moved=drawingSheet(part,1,true,[],'',{...config,positions:{front:[57,68]}});
 assert.deepEqual([moved.viewTitles.front.x,moved.viewTitles.front.y],[88,48]);
 const [,page]=drawingPDFPages(part,1,true,[],'',config,overview);
 assert.deepEqual([page.viewTitles.front.x,page.viewTitles.front.y],[48,120]);
 assert.ok(page.viewTitles.front.height>caption.height);
 const clamped=drawingSheet(part,1,true,[],'',{...config,positions:{front:[5,5]},
  viewTitlePositions:{front:{offset:[-1000,-1000]}}});
 assert.equal(drawingBoxPlacementIssue(clamped.viewTitles.front,clamped),null);
});

test('automatic packing fits unlocked views into the space around fixed views',()=>{
 const data={...part,views:{...part.views,iso:{...rect(60,45),viewBox:[0,-45,60,45]}}};
 const viewLocks={
  top:{at:[16,18],scale:1.5},front:{at:[16,92],scale:1.5},right:{at:[118,92],scale:1.5},
 };
 const config={...options,layout:'compact',isoMode:'full',linkedProjections:true,linkedProjectionScales:true,viewLocks,
  details:[{id:'detail-a',view:'front',center:[30,-10],radius:4,factor:2}]};
 const packed=optimizeDrawingLayout(data,{scale:1,options:config,isoOnRight:true,spreadViews:true});
 const lockedSheet=drawingSheet(data,packed.scale,true,[],'',{...config,positions:packed.positions,autoIsoScale:packed.autoIsoScale});
 for(const [name,{at,scale}] of Object.entries(viewLocks)){
  assert.deepEqual(packed.positions[name],at);
  assert.deepEqual([lockedSheet.layout[name].x,lockedSheet.layout[name].y,lockedSheet.layout[name].scale],[...at,scale]);
 }
 for(const id of ['iso','section-a','detail-a']){
  assert.ok(lockedSheet.layout[id]);
  assert.equal(drawingBoxPlacementIssue(lockedSheet.layout[id],lockedSheet),null);
 }
 assert.deepEqual(drawingViewOverlaps(lockedSheet),[]);
 assert.equal(optimizeDrawingLayout(data,{scale:1,fixedScale:true,options:{...config,viewLocks:{front:{at:[290,40],scale:1}}}}),null);

 const pdfOptions={...config,pdfLayout:'manual',pageAssignments:{pageCount:2,views:{right:2},comments:{}},
  pdfViewLocks:{front:{at:[25,97],scale:1.25},right:null},pdfViewScales:{right:.75}};
 const [first,second]=drawingPDFPages(data,packed.scale,true,[],'',pdfOptions,lockedSheet);
 assert.deepEqual([first.layout.front.x,first.layout.front.y,first.layout.front.scale],[25,97,1.25]);
 assert.equal(second.viewLocks.right,undefined);
 assert.equal(second.layout.right.scale,.75);
 const state={version:1,signature:'sample',targets:['part'],targetMode:'visible',scale:1,hidden:true,comment:'',dimensions:[],
  options:{...pdfOptions,viewTitlePositions:{front:{offset:[0,-9]}}}};
 assert.deepEqual(readDrawingState(state),state);
});

test('batch repair moves only warned and movable dimensions and retains the measured points',()=>{
 const sheet=drawingSheet(part,1,true,[],'',{...options,sections:[],positions:{front:[70,70]},
  layout:'compact',projectionLocked:false,viewSelection:['front'],isoMode:'hidden'});
 const fixed={...frontDimension,pinned:true},stacked={...frontDimension},clear={...frontDimension,at:[25,34]};
 const dimensions=[fixed,stacked,clear];
 assert.deepEqual(drawingDimensionConflicts(dimensions,sheet).map(issue=>issue.index),[0,1]);
 const result=arrangeDrawingDimensionConflicts(dimensions,sheet);
 assert.deepEqual(result.moved,[1]);
 assert.equal(result.remaining,0);
 assert.strictEqual(result.dimensions[0],fixed);assert.strictEqual(result.dimensions[2],clear);
 assert.notDeepEqual(result.dimensions[1].at,stacked.at);
 assert.deepEqual([result.dimensions[1].a,result.dimensions[1].b],[stacked.a,stacked.b]);
 assert.deepEqual(arrangeDrawingDimensionConflicts([fixed,{...stacked,pinned:true}],sheet).moved,[]);
});

test('automatic placement packs beside the title block without shrinking a tall view',()=>{
 for(const [width,height,orientation] of [[94,182,'landscape'],[24,264,'portrait']]){
  const data={bodyCount:1,bounds:[[0,0,0],[width,72,height]],views:{
   front:rect(width,height),top:rect(width,72),iso:{...rect(70,90),viewBox:[0,-90,70,90]},
  }};
  const config={...options,orientation,layout:'compact',sections:[],viewSelection:['front','top'],isoMode:'full',viewScales:{iso:.5}};
  const settings={options:config,isoOnRight:true};
  const compact=optimizeDrawingLayout(data,settings);
  const spaced=optimizeDrawingLayout(data,{...settings,spreadViews:true});
  assert.equal(compact.scale,1);
  assert.equal(spaced.scale,compact.scale);
  const sheet=drawingSheet(data,spaced.scale,true,[],'',{...config,positions:spaced.positions});
  assert.ok(sheet.layout.front.y+sheet.layout.front.height>sheet.titleBlock.y);
  assert.ok(sheet.layout.front.x+sheet.layout.front.width<sheet.titleBlock.x);
  assert.ok(sheet.layout.iso.x>sheet.layout.top.x+sheet.layout.top.width);
  const items={querySelectorAll:()=>Object.keys(sheet.layout).map(view=>({dataset:{view}}))};
  assert.deepEqual(drawingSheetOverflow(items,sheet),[]);

  const pdfOptions={...config,pdfLayout:'manual',pdfPlacement:'auto',pdfPageScales:{1:1},
   pageAssignments:{pageCount:2,views:{front:1,top:2,iso:2},comments:{}}};
  const [page]=drawingPDFPages(data,spaced.scale,true,[],'',pdfOptions,sheet);
  assert.equal(page.layout.front.scale,1);
  assert.ok(page.layout.front.y+page.layout.front.height>page.titleBlock.y);
  assert.deepEqual(drawingSheetOverflow({querySelectorAll:()=>[{dataset:{view:'front'}}]},page),[]);
 }
});

test('the PDF checklist maps a filtered page back to original visible dimension indices',()=>{
 const top={...frontDimension,view:'top'};
 const hidden={...frontDimension,review:true,hidden:true};
 const review={...frontDimension,review:true,at:[30,44]};
 const overlap={...frontDimension,a:[10,0],b:[50,0]};
 const config={...options,pdfLayout:'manual',pageAssignments:{pageCount:2,views:{front:2},comments:{}}};
 const pages=drawingPDFPages(part,1,true,[top,frontDimension,hidden,overlap,review],'',config);
 const issues=drawingPDFIssues(pages);
 assert.deepEqual(issues.filter(issue=>issue.kind==='overlap').map(issue=>[issue.pageIndex,issue.dimension]),[[1,1],[1,3]]);
 assert.deepEqual(issues.filter(issue=>issue.kind==='reference').map(issue=>[issue.pageIndex,issue.dimension]),[[1,4]]);
});

test('captions move clear in tight gaps while overlapping views still produce a page warning',()=>{
 const {front,top,right}=part.views;
 const data={...part,views:{front,top,right}};
 const settings={...options,layout:'compact',projectionLocked:false,sections:[],positions:{top:[40,28],front:[45,74],right:[145,74]}};
 const titleOnly=drawingSheet(data,1,true,[],'',settings);
 assert.deepEqual(drawingViewOverlaps(titleOnly),[]);
 assert.ok(titleOnly.viewTitles.front.y+titleOnly.viewTitles.front.height<=titleOnly.layout.front.y);
 const crowded={...settings,positions:{...settings.positions,top:[40,55]},pdfLayout:'manual',
  pageAssignments:{pageCount:2,views:{top:2,front:2},comments:{}}};
 const editor=drawingSheet(data,1,true,[],'',crowded);
 const pages=drawingPDFPages(data,1,true,[],'',crowded,editor);
 const issues=drawingPDFIssues(pages).filter(issue=>issue.kind==='view-overlap');
 assert.equal(issues.length,1);
 assert.equal(issues[0].pageIndex,1);
 assert.ok(issues[0].regions.length>=1);
 assert.deepEqual(issues[0].views,['top','front']);
 const separated={...crowded,pageAssignments:{pageCount:2,views:{top:2},comments:{}}};
 assert.equal(drawingPDFIssues(drawingPDFPages(data,1,true,[],'',separated)).filter(issue=>issue.kind==='view-overlap').length,0);
 assert.deepEqual(drawingViewOverlaps({layout:{front:{x:0,y:0,width:10,height:10},top:{x:10,y:0,width:10,height:10}}}),[]);
});

test('manufacturing dimensions choose a visible enabled view for each axis',()=>{
 const sheet=drawingSheet(part,1,true,[],'',options);
 const all=autoDrawingDimensions(part,1,[],sheet).dimensions;
 assert.equal(all.filter(d=>d.overall).length,6);
 const unique=autoDrawingDimensions(part,1,[],sheet,{uniqueAxes:true,views:{front:['vertical']}}).dimensions;
 assert.deepEqual(unique.filter(d=>d.overall).map(d=>d.overall),['frontvertical','tophorizontal','topvertical']);
 const pinned={...all.find(d=>d.overall==='tophorizontal'),pinned:true};
 const current=all.map(d=>d.overall===pinned.overall?pinned:d);
 const compact=hideDuplicateOverallDimensions(current,sheet);
 assert.equal(compact.hidden,3);
 assert.ok(compact.dimensions.find(d=>d.overall==='fronthorizontal').hidden);
 assert.strictEqual(compact.dimensions.find(d=>d.overall===pinned.overall),pinned);
 assert.equal(autoDrawingDimensions(part,1,compact.dimensions,sheet,{uniqueAxes:true}).dimensions.length,0);
 assert.equal(current.some(d=>d.hidden),false);
});

test('automatic arrangement keeps crowded overview dimensions outside the views and shortens isometric extensions',()=>{
 const modelBounds=[[0,0,0],[50,50,30]];
 const vertices=[[0,0,0],[50,0,0],[50,50,0],[50,50,30],[0,50,30],[0,0,30],[50,0,30]]
  .map(model=>({model,point:projectDrawingIsometric(model)}));
 const iso={visible:['M '+vertices.slice(0,6).map(({point})=>point.join(' ')).join(' L ')+' Z'],hidden:[],
  viewBox:[0,-110/Math.sqrt(6),100/Math.SQRT2,160/Math.sqrt(6)],dimensionVertices:vertices};
 const data={...part,bounds:modelBounds,views:{front:rect(50,30),top:rect(50,50),right:rect(50,30),iso}};
 const config={...options,sections:[],layout:'compact',projectionLocked:false,isoMode:'full',viewScales:{iso:1.2},
  positions:{top:[14,26],front:[14,124],right:[106,124],iso:[188,28]}};
 const sheet=drawingSheet(data,1.6,true,[],'',config),anchors=drawingIsometricOverallAnchors(data,sheet);
 const generated=autoDrawingDimensions(data,1.6,[],sheet);
 assert.equal(generated.layoutWarnings,0);
 const existing=generated.dimensions.map(d=>{
  // Legacy ISO dimensions can point to the back of the opening even with a dimension line below it.
  if(d.overall==='iso-x'||d.overall==='iso-y'){
   const back=anchors[d.overall].find(draft=>draft.modelA[2]===30);
   return {...d,...back,at:d.at};
  }
  if(d.overall==='tophorizontal')return {...d,at:[d.at[0],d.a[1]+.6]};
  return d;
 });
 const result=arrangeDrawingDimensions(existing,sheet,[],{isoAnchors:anchors});
 assert.deepEqual(result.unresolved,[]);
 assert.deepEqual(result.dimensions.map(dimensionValue),existing.map(dimensionValue));
 assert.deepEqual(drawingDimensionConflicts(result.dimensions,sheet),[]);
 for(const d of result.dimensions){
  const view=sheet.layout[d.view],placement=dimensionPlacement(d,sheet);
  assert.ok([placement.box,...placement.main,...placement.extensions,...placement.arrowBoxes].every(box=>!drawingBoxPlacementIssue(box,sheet)));
  if(d.view==='iso'){
   for(const [a,b] of drawingDimensionGeometry(d,view).extensions)
    assert.ok(Math.hypot(b[0]-a[0],b[1]-a[1])<13,`short exterior extension for ${d.overall}`);
   if(d.overall!=='iso-z')assert.equal(d.modelA[2],0);
  }else{
   const label=placement.box,clear=d.kind==='horizontal'?
    label.y+label.height<view.y-1||label.y>view.y+view.height+1:
    label.x+label.width<view.x-1||label.x>view.x+view.width+1;
   assert.ok(clear,`label clearance for ${d.overall}`);
  }
 }
 const fixed={...existing.find(d=>d.overall==='iso-x'),pinned:true};
 assert.deepEqual(arrangeDrawingDimensions([fixed],sheet,[],{isoAnchors:anchors}).dimensions,[fixed]);
});

test('the shortest parallel dimension uses the first lane and dimensions use the space beside the title block',()=>{
 const drawing=drawingSheet(part,1.6,true,[],'',{...options,sections:[],layout:'compact',viewSelection:['front'],
  isoMode:'hidden',projectionLocked:false,positions:{front:[20,151]}});
 const long={view:'front',kind:'horizontal',a:[0,0],b:[60,0],at:[30,1],overall:'fronthorizontal'};
 const short={...long,b:[24,0],overall:undefined};
 const result=arrangeDrawingDimensions([long,short],drawing);
 assert.deepEqual(result.unresolved,[]);
 const [outer,inner]=result.dimensions.map(d=>drawingDimensionGeometry(d,drawing.layout.front).at[1]);
 assert.equal(inner,drawing.layout.front.y+drawing.layout.front.height+8);
 assert.equal(outer-inner,6);
 assert.ok(outer>drawing.titleBlock.y);
 assert.ok(result.dimensions.every(d=>!drawingBoxPlacementIssue(dimensionPlacement(d,drawing).box,drawing)));
});

test('automatic isometric dimensions use full spans between visible model vertices',()=>{
 const vertices=[[0,0,0],[60,0,0],[60,40,0],[60,40,20],[0,40,20],[0,0,20],[60,0,20]]
  .map(model=>({model,point:projectDrawingIsometric(model)}));
 const visible=['M '+vertices.slice(0,6).map(({point})=>point.join(' ')).join(' L ')+' Z'];
 const iso={visible,hidden:[],viewBox:[0,-80/Math.sqrt(6),100/Math.SQRT2,140/Math.sqrt(6)],dimensionVertices:vertices};
 const data={...part,views:{iso}};
 const isoSheet=drawingSheet(data,.5,true,[],'',{...options,viewSelection:[],isoMode:'full',positions:{iso:[85,75]},sections:[]});
 const dims=autoDrawingDimensions(data,.5,[],isoSheet).dimensions;
 assert.deepEqual(dims.map(dimensionValue),[60,40,20]);
 assert.ok(dims.every(d=>d.view==='iso'&&d.kind==='aligned'&&d.automatic));
 for(const d of dims){
  const [[a,b]]=drawingDimensionGeometry(d,isoSheet.layout.iso).extensions;
  assert.ok(Math.hypot(b[0]-a[0],b[1]-a[1])<12,'extension line stays close to the projected outline');
 }
 const [first]=dims;
 const manual={view:'iso',kind:'aligned',a:first.b,b:first.a,modelA:first.modelB,modelB:first.modelA,at:first.at};
 assert.deepEqual(autoDrawingDimensions(data,.5,[manual],isoSheet).dimensions.map(dimensionValue),[40,20]);
 assert.equal(autoDrawingDimensions(data,.5,dims,isoSheet).dimensions.length,0);
 assert.equal(autoDrawingDimensions(data,.5,[],isoSheet,{views:{iso:[]}}).dimensions.length,0);
 assert.equal(autoDrawingDimensions(data,.5,[],isoSheet,{types:['diameter']}).dimensions.length,0);
 const incomplete={...data,views:{iso:{...iso,dimensionVertices:[vertices[0],vertices[3]]}}};
 assert.equal(autoDrawingDimensions(incomplete,.5,[],isoSheet).dimensions.length,0,'no full span uses unrelated diagonal vertices');
 const combined={...data,views:{...part.views,iso}};
 const multi=drawingSheet(combined,.5,true,[],'',{...options,isoMode:'full'});
 const all=autoDrawingDimensions(combined,.5,[],multi).dimensions;
 assert.equal(all.filter(d=>d.view==='iso').length,3);
 assert.equal(autoDrawingDimensions(combined,.5,[],multi,{uniqueAxes:true}).dimensions.filter(d=>d.view==='iso').length,0);
 assert.ok(hideDuplicateOverallDimensions(all,multi).dimensions.filter(d=>d.view==='iso').every(d=>d.hidden));
 const saved={version:1,signature:'sample',targets:['part'],targetMode:'visible',scale:.5,hidden:true,comment:'',dimensions:dims,
  options:{...options,isoMode:'full',autoDimensionViews:{iso:[]}}};
 assert.deepEqual(readDrawingState(saved),saved);
});

test('PDF placement and compact exterior dimensions round-trip in drawing state',()=>{
 const state={version:1,signature:'sample',targets:['part'],targetMode:'visible',scale:1,hidden:true,comment:'',dimensions:[],
  options:{...options,pdfPlacement:'auto',uniqueOverallDimensions:true,showLayoutLabel:false}};
 assert.deepEqual(readDrawingState(state),state);
 assert.throws(()=>readDrawingState({...state,options:{...state.options,pdfPlacement:'other'}}));
 assert.throws(()=>readDrawingState({...state,options:{...state.options,uniqueOverallDimensions:'true'}}));
 assert.throws(()=>readDrawingState({...state,options:{...state.options,showLayoutLabel:'false'}}));
});

test('custom scale input accepts ratios and decimals within the saved drawing range',()=>{
 for(const input of ['1:2.5','１：２．５','0.4','.4','2 / 5'])assert.equal(parseDrawingScale(input),.4);
 assert.equal(parseDrawingScale('3:2'),1.5);
 for(const input of ['0','-5','1:0','1:4:3','1e1','1001','1:11000','NaN',''])assert.equal(parseDrawingScale(input),null);
});

test('the keyboard and resize handle adjust the drawing scale in tenths',()=>{
 assert.equal(stepDrawingScale(.3,1),.4);
 assert.equal(stepDrawingScale(.3,-1),.2);
 assert.equal(stepDrawingScale(.375,1),.4);
 assert.equal(stepDrawingScale(.375,-1),.3);
 assert.equal(stepDrawingScale(maxDrawingScale,1),maxDrawingScale);
 assert.equal(drawingScaleLabel(stepDrawingScale(.1,-1)),'1:10.1');
 assert.equal(stepDrawingScale(1/10.1,1),.1);
 assert.equal(drawingScaleLabel(stepDrawingScale(.05,-1)),'1:20.1');
 assert.equal(stepDrawingScale(minDrawingScale,-1),minDrawingScale);
 const resize=(start,target)=>snapDrawingResizeScale(start,target,minDrawingScale,maxDrawingScale);
 assert.equal(resize(1,1.04),1);
 assert.equal(resize(1,1.06),1.1);
 assert.equal(resize(1,.94),.9);
 assert.equal(resize(.43,.43),.43);
 assert.equal(resize(.43,.44),.43);
 assert.equal(resize(.43,.46),.5);
 assert.equal(resize(.1,.04),.1);
 assert.equal(drawingScaleLabel(resize(.05,.045)),'1:22.2');
 assert.equal(snapDrawingResizeScale(.4,.67,.1,.65),.6);
});

test('scale captions retain exact tenths even when the reciprocal has long decimals',()=>{
 for(const [scale,label] of [[.3,'0.3:1'],[.6,'0.6:1'],[.7,'0.7:1'],[.8,'0.8:1'],[.9,'0.9:1'],[.4,'1:2.5'],[.5,'1:2'],[.05,'1:20'],[1.2,'1.2:1']]){
  assert.equal(drawingScaleLabel(scale),label);
  assert.equal(parseDrawingScale(label),scale);
 }
 assert.equal(drawingScaleLabel(.899999),'0.9:1');
 const config={...options,viewScales:{front:.9},pdfLayout:'manual',pageAssignments:{pageCount:2,views:{},comments:{}}};
 const editor=drawingSheet(part,1,true,[frontDimension],'',config);
 const [first]=drawingPDFPages(part,1,true,[frontDimension],'',config,editor);
 for(const sheet of [editor,first]){
  assert.match(sheet.svg,/FRONT \/ SCALE 0\.9:1/);
  assert.equal(sheet.layout.front.width,54);
  assert.doesNotMatch(sheet.svg,/1:1\.1111/);
 }
});

test('automatic drawing and PDF layouts choose the largest fitting tenth or small ratio',()=>{
 const input={dimensions:[frontDimension],options};
 const layout=optimizeDrawingLayout(part,input);
 assert(layout.scale>=.1);
 assert.equal(layout.scale*10,Math.round(layout.scale*10));
 const next=(Math.round(layout.scale*10)+1)/10;
 assert.equal(optimizeDrawingLayout(part,{...input,scale:next,fixedScale:true}),null);
 for(const {x,y,width,height} of layout.boxes){
  assert(x>=layout.area.x-1e-8&&y>=layout.area.y-1e-8);
  assert(x+width<=layout.area.x+layout.area.width+1e-8&&y+height<=layout.area.y+layout.area.height+1e-8);
 }
 const [first]=drawingPDFPages(part,1,true,[frontDimension],'',{...options,pdfLayout:'multi',pdfPlacement:'auto'});
 assert.equal(first.pageScale*10,Math.round(first.pageScale*10));
 const wide={bodyCount:1,bounds:[[0,0,0],[12000,60,30]],views:{front:rect(12000,30)}};
 const smallOptions={...options,viewSelection:['front'],sections:[]};
 const small=optimizeDrawingLayout(wide,{options:smallOptions});
 assert(small.scale<.1);
 assert.match(drawingScaleLabel(small.scale),/^1:\d+(?:\.\d)?$/);
});

test('initial layout reserves the right side for ISO and can pack linked projections',()=>{
 const iso={...rect(70,57),viewBox:[0,-57,70,57]};
 const data={...part,views:{...part.views,iso}};
 for(const orientation of ['portrait','landscape'])for(const linkedProjections of [false,true]){
  const settings={...options,orientation,isoMode:'full',linkedProjections,viewPriority:'front'};
  const result=optimizeDrawingLayout(data,{options:settings,isoOnRight:true,dimensions:[frontDimension]});
  const {boxes,area,positions,scale}=result;
  const rightmost=boxes.find(box=>box.key==='iso');
  assert(boxes.every(box=>box===rightmost||box.x+box.width<=rightmost.x-2.99));
  for(const a of boxes){
   assert(a.x>=area.x-1e-8&&a.y>=area.y-1e-8&&a.x+a.width<=area.x+area.width+1e-8&&a.y+a.height<=area.y+area.height+1e-8);
   assert(!boxes.some(b=>a!==b&&a.x<b.x+b.width-1e-8&&b.x<a.x+a.width-1e-8&&a.y<b.y+b.height-1e-8&&b.y<a.y+a.height-1e-8));
  }
  if(linkedProjections){
   const {front,top,right}=drawingSheet(data,scale,true,result.dimensions,'',{...settings,layout:'compact',positions,autoIsoScale:result.autoIsoScale}).layout;
   assert(Math.abs(top.x+top.width/2-front.x-front.width/2)<1e-8);
   assert(Math.abs(right.y+right.height/2-front.y-front.height/2)<1e-8);
   assert(top.y+top.height<front.y&&right.x>front.x+front.width);
   const saved={version:1,signature:'sample',targets:['part'],targetMode:'visible',scale,hidden:true,comment:'',dimensions:result.dimensions,options:{...settings,positions}};
   assert.equal(readDrawingState(saved).options.linkedProjections,true);
   assert.throws(()=>readDrawingState({...saved,options:{...saved.options,linkedProjections:'on'}}));
  }
 }
});

test('automatic placement prefers the projection order at the already fitted scales',()=>{
 const {front,top,right}=part.views;
 const data={...part,views:{front,top,right,iso:{...rect(70.71,57.2),viewBox:[0,-57.2,70.71,57.2]}}};
 for(const orientation of ['landscape','portrait']){
  const settings={...options,orientation,sections:[],isoMode:'full'};
  const input={options:settings,scale:1.5,fixedScale:true,isoOnRight:true,spreadViews:true};
  const compact=optimizeDrawingLayout(data,input);
  const ordered=optimizeDrawingLayout(data,{...input,preferProjectionOrder:true});
  assert.equal(ordered.scale,compact.scale);
  assert.equal(ordered.autoIsoScale,compact.autoIsoScale);
  const sheet=drawingSheet(data,ordered.scale,true,[],'',{...settings,layout:'compact',positions:ordered.positions,
   autoIsoScale:ordered.autoIsoScale});
  const {front:f,top:t,right:r,iso}=sheet.layout;
  assert(t.y+t.height<f.y,'the top view is fitted above the front');
  if(orientation==='landscape')assert(r.x>f.x+f.width,'the right view is fitted to the right of the front');
  assert(iso.x>Math.max(f.x+f.width,t.x+t.width,r.x+r.width));
  assert.deepEqual(drawingViewOverlaps(sheet),[]);
 }
 const settings={...options,orientation:'landscape',sections:[],isoMode:'full'};
 const input={options:settings,isoOnRight:true,spreadViews:true};
 const compact=optimizeDrawingLayout(data,input);
 const ordered=optimizeDrawingLayout(data,{...input,preferProjectionOrder:true});
 assert.equal(ordered.scale,compact.scale);
 assert.ok(ordered.autoIsoScale<compact.autoIsoScale);
 const sheet=drawingSheet(data,ordered.scale,true,[],'',{...settings,layout:'compact',positions:ordered.positions,
  autoIsoScale:ordered.autoIsoScale});
 const {front:f,top:t,right:r,iso}=sheet.layout;
 assert(t.y+t.height<f.y&&r.x>f.x+f.width);
 assert(iso.x>Math.max(f.x+f.width,t.x+t.width,r.x+r.width));
 assert.deepEqual(drawingViewOverlaps(sheet),[]);
 const linked=optimizeDrawingLayout(data,{...input,scale:ordered.scale,
  options:{...settings,linkedProjections:true,autoIsoScale:ordered.autoIsoScale}});
 assert.equal(linked.scale,ordered.scale);
 assert.equal(linked.autoIsoScale,ordered.autoIsoScale);
});

test('right-column sizing reduces only ISO and respects a manually specified scale',()=>{
 const {front,top,right}=part.views;
 const data={...part,views:{front,top,right,iso:{...rect(70.71,57.2),viewBox:[0,-57.2,70.71,57.2]}}};
 const settings={...options,sections:[],isoMode:'full',linkedProjections:true,viewSelection:['front','top','right']};
 const fitted=optimizeDrawingLayout(data,{options:settings,isoOnRight:true});
 assert(fitted.autoIsoScale<fitted.scale);
 const {positions,autoIsoScale,scale}=fitted;
 const placed=drawingSheet(data,scale,true,[],'',{...settings,positions,autoIsoScale,layout:'compact'});
 assert.equal(placed.layout.iso.scale,autoIsoScale);
 assert(['front','top','right'].every(name=>placed.layout[name].scale===scale));
 assert(placed.layout.iso.x>placed.layout.right.x+placed.layout.right.width);
 const spaced=optimizeDrawingLayout(data,{options:settings,isoOnRight:true,spreadViews:true});
 const columnGap=({boxes})=>boxes.find(box=>box.key==='iso').x-
  Math.max(...boxes.filter(box=>box.key!=='iso').map(box=>box.x+box.width));
 assert.equal(spaced.scale,scale);
 assert.equal(spaced.autoIsoScale,autoIsoScale);
 assert(columnGap(spaced)>columnGap(fitted));
 const sameSize={...settings,viewScales:{iso:scale}};
 assert.equal(optimizeDrawingLayout(data,{options:sameSize,isoOnRight:true,scale,fixedScale:true}),null);
 const narrow=optimizeDrawingLayout(data,{options:{...settings,pageSize:[227,210]},isoOnRight:true,scale:1.5,fixedScale:true});
 assert.equal(narrow?.autoIsoScale,.7);
 const pdf={...settings,positions,autoIsoScale,pdfLayout:'manual',pageAssignments:{pageCount:2,views:{iso:2},comments:{}}};
 assert.equal(drawingPDFPages(data,scale,true,[],'',pdf,placed)[1].layout.iso.scale,autoIsoScale);
 assert(drawingPDFPages(data,scale,true,[],'',{...pdf,pdfPlacement:'auto'})[1].layout.iso.scale>autoIsoScale);
 const manual={...settings,viewScales:{iso:.6}};
 const explicit=optimizeDrawingLayout(data,{options:manual,isoOnRight:true});
 assert.equal(explicit.autoIsoScale,undefined);
 assert.equal(drawingSheet(data,explicit.scale,true,[],'',{...manual,positions:explicit.positions,layout:'compact'}).layout.iso.scale,.6);
 const saved={version:1,signature:'sample',targets:['part'],targetMode:'visible',scale,hidden:true,comment:'',dimensions:[],
  options:{...settings,positions,autoIsoScale}};
 assert.equal(readDrawingState(saved).options.autoIsoScale,autoIsoScale);
 assert.throws(()=>readDrawingState({...saved,options:{...saved.options,autoIsoScale:0}}));
});

test('larger spacing uses vertical slack at the same scale when the linked row already fills the width',()=>{
 const {front,top,right}=part.views;
 const data={...part,views:{front,top,right}};
 const settings={...options,sections:[],linkedProjections:true};
 const input={options:settings,scale:1.2,fixedScale:true,dimensions:[frontDimension]};
 const roomy=optimizeDrawingLayout(data,input);
 const left=Math.min(...roomy.boxes.map(box=>box.x));
 const upper=Math.min(...roomy.boxes.map(box=>box.y));
 const width=Math.max(...roomy.boxes.map(box=>box.x+box.width))-left+12;
 const height=Math.max(...roomy.boxes.map(box=>box.y+box.height))-upper+54;
 const narrow={...input,options:{...settings,pageSize:[width,210]}};
 const compact=optimizeDrawingLayout(data,narrow);
 const spaced=optimizeDrawingLayout(data,{...narrow,spreadViews:true});
 const box=(result,view)=>result.boxes.find(box=>box.key===view);
 const rowGap=result=>box(result,'right').x-(box(result,'front').x+box(result,'front').width);
 const columnGap=result=>box(result,'front').y-(box(result,'top').y+box(result,'top').height);
 assert.equal(spaced.scale,compact.scale);
 assert.deepEqual(spaced.dimensions,compact.dimensions);
 assert(Math.abs(rowGap(spaced)-rowGap(compact))<1e-8);
 assert(columnGap(spaced)>columnGap(compact)+5);
 for(const rect of spaced.boxes){
  assert(rect.x>=spaced.area.x-1e-8&&rect.y>=spaced.area.y-1e-8);
  assert(rect.x+rect.width<=spaced.area.x+spaced.area.width+1e-8&&rect.y+rect.height<=spaced.area.y+spaced.area.height+1e-8);
 }
 const full={...input,options:{...settings,pageSize:[width,height]}};
 assert.deepEqual(optimizeDrawingLayout(data,{...full,spreadViews:true}).positions,optimizeDrawingLayout(data,full).positions);
});

test('linked scales share the overview override and only the PDF overrides for the current page',()=>{
 const settings={...options,linkedProjectionScales:true,viewScales:{front:.8,top:.6,right:.5},
  pdfLayout:'manual',pdfViewScales:{top:.7},pageAssignments:{pageCount:2,views:{right:2},comments:{}}};
 const thread={view:'top',kind:'thread',center:[30,-20],radius:5.2,arcPoint:[35.2,-20],at:[45.2,-20],
  automatic:true,nominalDiameter:10,adjustedDiameter:10.4};
 const editor=drawingSheet(part,1,true,[thread],'',settings);
 assert(['front','top','right'].every(name=>editor.layout[name].scale===.8));
 const [first,second]=drawingPDFPages(part,1,true,[thread],'',settings,editor);
 assert.equal(first.layout.front.scale,.7);
 assert.equal(first.layout.top.scale,.7);
 assert.equal(second.layout.right.scale,.8);
 const [resized]=first.dimensions;
 assert.equal(dimensionLabel(resized),'Ø10.4（使用ボルトはM10）');
 assert.deepEqual(resized.arcPoint,thread.arcPoint);
 assert.ok(Math.abs((resized.at[0]-resized.arcPoint[0])*.7-8)<1e-9);
 const saved={version:1,signature:'sample',targets:['part'],targetMode:'visible',scale:1,hidden:true,comment:'',dimensions:[],options:settings};
 assert.equal(readDrawingState(saved).options.linkedProjectionScales,true);
 assert.throws(()=>readDrawingState({...saved,options:{...settings,linkedProjectionScales:'true'}}));
});

test('page scales and resized PDF views are independent of the editor scale',()=>{
 const assigned={pageCount:2,views:{front:2,'section-a':2},comments:{}};
 const config={...options,pdfLayout:'manual',pageAssignments:assigned,pdfPageScales:{1:.5,2:.375},pdfViewScales:{'section-a':.6}};
 const editor=drawingSheet(part,1,true,[frontDimension],'',config);
 for(const placement of ['keep','auto']){
  const [first,second]=drawingPDFPages(part,1,true,[frontDimension],'',{...config,pdfPlacement:placement},editor);
  assert.equal(first.pageScale,.5);
  assert.equal(second.pageScale,.375);
  assert.equal(first.layout.top.width,30);
  assert.equal(second.layout.front.width,22.5);
  assert.equal(second.layout['section-a'].width,24);
  assert.deepEqual(second.dimensions[0].b,frontDimension.b);
  assert.ok(Math.abs(second.dimensions[0].at[1]*.375-frontDimension.at[1])<1e-9);
  assert.equal(header(first),'SCALE 1:2 / mm');
  assert.equal(header(second),'縮尺は各図に記載 / mm');
 }
 assert.equal(editor.layout.top.scale,1);
 assert.equal(editor.layout['section-a'].width,40);
 const state={version:1,signature:'scales',targets:['part'],targetMode:'visible',scale:.37,hidden:true,comment:'',dimensions:[],options:config};
 assert.deepEqual(readDrawingState(state),state);
 assert.throws(()=>readDrawingState({...state,options:{...config,pdfPageScales:{33:1}}}));
 assert.throws(()=>readDrawingState({...state,options:{...config,pdfViewScales:{'section-missing':1}}}));
});

test('a fixed PDF scale stays editable when the shapes overflow',()=>{
 const [first,second]=drawingPDFPages(part,1,true,[],'',{...options,pdfLayout:'manual',pdfPlacement:'auto',pdfPageScales:{1:7,2:.5}});
 assert.equal(first.layout.front.scale,7);
 assert.equal(second.layout['section-a'].scale,.5);
 assert.ok(first.layout.front.x+first.layout.front.width>first.width);
});

test('page order edits remap every item and the corresponding scale settings',()=>{
 const assignments={pageCount:3,views:{front:1,right:1,left:3},comments:{comment:2},holeTable:2};
 const scales={1:.9,2:.5,3:.3};
 const pages=drawingPDFPages(part,1,true,[frontDimension],'工場向け',{...options,pdfLayout:'manual',
  pageAssignments:assignments,pdfPageScales:scales});
 const moved=remapDrawingPDFPages(pages,[1,0,2,null],assignments,scales);
 assert.deepEqual(moved,{assignments:{pageCount:4,views:{front:2,top:2,right:2,'section-a':1,left:3},
  comments:{comment:1},holeTable:1},scales:{1:.5,2:.9,3:.3}});
 const removed=remapDrawingPDFPages(pages,[0,1],assignments,scales);
 assert.equal(removed.assignments.views.left,2);
 assert.deepEqual(removed.scales,{1:.9,2:.5});
});
