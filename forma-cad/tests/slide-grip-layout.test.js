import {test} from 'node:test';import assert from 'node:assert/strict';import {slideGripLayout,clampGripPosition,gripInsideCorners,centerGripPosition} from '../src/slide-grip-layout.js';
const p={lidThickness:3.6,wall:4.2,clearance:.25},info={length:80,width:50},top={capFront:-40,capBack:40,capUpper:30};
test('movement clamps edges and rounded caps while keeping the full group intact',()=>{const q=slideGripLayout({...p,surfaceGripLength:40},info,top,30,{radius:10});for(const [x,y]of [[1000,1000],[-1000,-1000],[1.2,2],[75,-2],[32,2]]){const v=clampGripPosition(q,x,y);assert.ok(v.fromFront>=1.2&&v.fromFront<=q.maxFromFront);assert.ok(Math.abs(v.offsetY)<=q.maxOffsetY);assert.ok(gripInsideCorners(q,v.fromFront,v.offsetY));assert.equal(Number(v.fromFront.toFixed(2)),v.fromFront);}});
test('legacy dimensions remain identical, custom center spacing preserves broad lands',()=>{const q=slideGripLayout(p,info,top,30);assert.equal(q.count,5);assert.equal(q.pitch,2.4);assert.equal(q.positions[0],-36.4);assert.equal(slideGripLayout({...p,surfaceGripCount:9,surfaceGripPitch:4},info,top,30).count,9);assert.throws(()=>slideGripLayout({...p,surfaceGripPitch:2},info,top,30),/1.2 mm/);});

test('center the group for varied counts, automatic spacing, rounded caps and inset lids',()=>{for(const t of [top,null])for(const count of [1,5,9,30])for(const pitch of [0,4]){const q=slideGripLayout({...p,surfaceGripCount:count,surfaceGripPitch:pitch},info,t,30,t?{radius:4}:null),v=centerGripPosition(q);assert.ok(Math.abs(q.front+v.fromFront+q.span/2-(q.front+q.back)/2)<.006);assert.equal(v.offsetY,0);assert.ok(gripInsideCorners(q,v.fromFront,v.offsetY));}});

test('central placement follows count, pitch, lid dimensions and every pattern',()=>{
 for(const pattern of ['transverse','diagonal','grid'])for(const lid of [top,null])for(const [L,W,count,pitch]of [[80,50,5,0],[120,70,9,4],[50,80,30,3]]){
  const q=slideGripLayout({...p,surfaceGripPattern:pattern,surfaceGripCentered:true,surfaceGripCount:count,surfaceGripPitch:pitch,surfaceGripFromFront:999,surfaceGripOffsetY:999},{length:L,width:W},lid?{capFront:-L/2,capBack:L/2,capUpper:30}:null,30);
  assert.ok(Math.abs(q.front+q.fromFront+q.span/2-(q.front+q.back)/2)<1e-8);assert.equal(q.offsetY,0);assert.ok(q.count<=count);assert.ok(q.lineLength>=2);assert.ok(q.pitch-q.opening>=1.2-1e-6);
  for(const line of q.segments)for(const [x,y]of [line.start,line.end]){assert.ok(x>=q.front+q.fromFront-.001&&x<=q.front+q.fromFront+q.span+.001);assert.ok(Math.abs(y)<=q.width/2+.001);}
 }
 assert.throws(()=>slideGripLayout({...p,surfaceGripPattern:'bogus'},info,top,30));assert.throws(()=>slideGripLayout({...p,surfaceGripCentered:'true'},info,top,30));
});
