import test from 'node:test';import assert from 'node:assert/strict';
import {dimensionTraceRing,traceContourKey,validateTraceTopology} from '../src/reference-trace-dimensions.js';
import {traceShapeGeometry} from '../src/reference-trace-shapes.js';import {offsetTraceRings} from '../src/reference-trace-offset.js';
import {referenceTraceSketches} from '../src/reference-trace-sketches.js';import {findRegions} from '../src/regions.js';
import {encodeTraceDraft,decodeTraceDraft} from '../src/reference-trace-draft.js';
const spec={type:'roundedRectangle',center:[80,70],angle:.31,width:90,height:40,radius:8},scale=[.5,.8];
const make=(overrides={},hole=false)=>dimensionTraceRing({hole,dimensions:{...spec,...overrides}}, {},scale);
const bounds=r=>[0,1].map(k=>[Math.min(...r.points.map(p=>p[k]*scale[k])),Math.max(...r.points.map(p=>p[k]*scale[k]))]);
test('individual outer and hole offsets keep independent mm distances and reject crossings',()=>{
 const outer=make({type:'rectangle',angle:0,width:100,height:60}),hole=make({type:'circle',width:12,height:12},true),before=JSON.stringify([outer,hole]),out=offsetTraceRings([outer,hole],[2,-.3],scale);
 assert.deepEqual(bounds(out.find(r=>!r.hole)),[[28,132],[38,102]]);assert.equal(out.find(r=>r.hole).circle.radius,6.3);validateTraceTopology(out);assert.equal(JSON.stringify([outer,hole]),before);
 assert.throws(()=>offsetTraceRings([outer,hole],[-20,-30],scale),/交差|接触|内側/);assert.throws(()=>offsetTraceRings([outer,hole],[1,NaN],scale),/距離/);
});
test('dimensions retain center, rotation, native arcs and exact physical values',()=>{
 for(const type of ['circle','ellipse','rectangle','roundedRectangle','slot','dShape']){const ring=make({type}),before=JSON.stringify(ring),changed=dimensionTraceRing(ring,{width:80,height:32,radius:6},scale),d=changed.dimensions;
  assert.deepEqual(d.center,spec.center);assert.equal(d.angle,spec.angle);assert.equal(d.width,80);assert.equal(d.height,type==='circle'?80:32);assert.equal(JSON.stringify(ring),before);
  const sketches=referenceTraceSketches({name:type,plane:'XY',offset:0,width:200,height:200,center:[0,0],angle:23},{width:400,height:250},[changed],1);assert.equal(findRegions(sketches).length,1);if(['roundedRectangle','slot','dShape'].includes(type))assert.ok(sketches.some(f=>f.arc));
 }
 assert.throws(()=>dimensionTraceRing(make(),{radius:30},scale),/角丸/);assert.throws(()=>dimensionTraceRing(make({type:'slot'}),{width:10},scale),/長穴/);assert.throws(()=>dimensionTraceRing(make(),{height:NaN},scale),/寸法/);
});
test('rounded rectangles, semicircular slots and D shapes retain analytic arcs in both offset directions',()=>{
 for(const type of ['roundedRectangle','slot','dShape'])for(const hole of [false,true])for(const distance of [-1.2,1.2]){
  const ring=make({type},hole),outer=make({type:'rectangle',width:160,height:120}),input=hole?[outer,ring]:[ring],out=offsetTraceRings(input,distance,scale),r=out.find(r=>r.hole===hole);
  assert.ok(r.pieces?.some(p=>p.arc),type+' exact arcs');assert.equal(r.dimensions.width,90+2*distance*(hole?-1:1));
  const sketches=referenceTraceSketches({name:type,plane:'XY',offset:0,width:200,height:200,center:[0,0],angle:0},{width:400,height:250},[r],1);assert.ok(sketches.some(s=>s.arc));assert.equal(findRegions(sketches).length,1);
 }
});
test('organized mixed line/arc loops without regular-shape metadata retain concentric arcs',()=>{
 for(const type of ['roundedRectangle','slot','dShape']){const ring=make({type});delete ring.dimensions;delete ring.regularType;const out=offsetTraceRings([ring],.7,scale);assert.ok(out[0].pieces?.some(p=>p.arc),type);validateTraceTopology(out);}
});
test('large offsets safely fall back when arcs disappear or loops merge',()=>{
 const r=make();const out=offsetTraceRings([r],-10,scale);assert.ok(out.length);validateTraceTopology(out);assert.equal(out[0].dimensions,undefined);
 const a=make({type:'circle',center:[50,70],width:20,height:20}),b=make({type:'circle',center:[75,70],width:20,height:20});assert.equal(offsetTraceRings([a,b],5,scale).length,1);
});
test('contour keys and per-contour settings roundtrip drafts without aliasing or accepting injected keys',()=>{
 const ring={hole:false,points:[[2,2],[18,2],[18,18],[2,18]]},key=traceContourKey(ring),settings={mode:'dark',threshold:150,invert:false,smoothing:1,holes:false,detail:'.25',organize:false,tolerance:'.25',contourEdits:{[key]:{dimensions:{width:'12',height:'5',radius:'1'},offsetDistance:'-.3'}}},state={settings,crop:{x:0,y:0,width:1,height:1},marks:new Uint8Array(400),manual:new Map(),component:0},extras={view:{zoom:1,x:0,y:0},tool:'contour',brush:24,snap:true,lasso:[]},draft=encodeTraceDraft('a'.repeat(64),20,20,state,extras),decoded=decodeTraceDraft(draft,'a'.repeat(64),20,20);
 assert.deepEqual(decoded.state.settings.contourEdits,settings.contourEdits);decoded.state.settings.contourEdits[key].dimensions.width='99';assert.equal(settings.contourEdits[key].dimensions.width,'12');assert.equal(traceContourKey(structuredClone(ring)),key);
 const bad=structuredClone(draft);bad.state.settings.contourEdits={bad:{offsetDistance:'1'}};assert.throws(()=>decodeTraceDraft(bad,'a'.repeat(64),20,20),/不正/);
});
