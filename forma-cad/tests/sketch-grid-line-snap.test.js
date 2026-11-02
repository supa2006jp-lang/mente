import test from 'node:test';import assert from 'node:assert/strict';import {snapSketchLineToGrid as snap} from '../src/sketch-grid-line-snap.js';
const project=([x,y])=>({x:x*10,y:y*10}),segments=[];for(let i=-50;i<=50;i+=10){segments.push({a:[-60,i],b:[60,i]},{a:[i,-60],b:[i,60]});}const near=(a,b)=>assert(Math.abs(a-b)<1e-9,`${a} != ${b}`);
test('cardinal lines meet grid lines at non-grid start coordinates in all directions',()=>{
 for(const [origin,point,angle,target]of [[[23.4,35],[23.5,20.15],-90,[23.4,20]],[[23.4,-35],[23.3,-20.15],90,[23.4,-20]],[[35,17.3],[20.15,17.4],180,[20,17.3]],[[-35,17.3],[-20.15,17.2],0,[-20,17.3]]]){
  const before=structuredClone([origin,point,segments]),r=snap(point,origin,segments,{angle,project});assert(r.snapped);r.point.forEach((v,i)=>near(v,target[i]));assert.deepEqual([origin,point,segments],before);
 }
});
test('fixed oblique angles retain their ray and grid intersections remain exact',()=>{
 const r=snap([13.45,10.1],[3.4,0],segments,{angle:45,project});assert(r.snapped);near(r.point[0],13.4);near(r.point[1],10);
 const intersection=snap([20.1,20.1],[5,5],segments,{angle:45,project});assert(intersection.snapped);near(intersection.point[0],20);near(intersection.point[1],20);
});
test('finite grid lines only, no distant snap, no opposite ray or parallel-line projection',()=>{
 assert(!snap([23.4,20.1],[23.4,35],[{a:[-10,20],b:[10,20]}],{angle:-90,project}).snapped);
 assert(!snap([23.4,22],[23.4,35],segments,{angle:-90,project}).snapped);
 assert(!snap([23.4,20.1],[23.4,35],segments,{angle:90,project}).snapped);
 assert(!snap([23.4,20.1],[23.4,35],[{a:[23.4,-60],b:[23.4,60]}],{angle:-90,project}).snapped);
 assert(!snap([23.4,35.01],[23.4,35],segments,{angle:90,project}).snapped);
 assert(!snap([NaN,20],[23.4,35],segments,{angle:90,project}).snapped);
 assert(!snap([23.4,20.1],[23.4,35],segments,{angle:-90,project:()=>({x:NaN,y:0})}).snapped);
});
test('screen tolerance follows zoom and coincident grid intersections never bend the ray',()=>{
 const point=[20.1,10.15],origin=[20,35];assert(snap(point,origin,segments,{angle:-90,project}).snapped);assert(!snap(point,origin,segments,{angle:-90,project:([x,y])=>({x:x*100,y:y*100})}).snapped);
 const r=snap(point,origin,segments,{angle:-90,project});near(r.point[0],20);near(r.point[1],10);
});
