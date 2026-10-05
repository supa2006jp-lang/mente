import assert from 'node:assert/strict';
import {planPrintLayout} from '../src/print-layout.js';
const item=(id,w,h,z=7)=>({id,min:[100,-300,z],max:[100+w,-300+h,z+20]});
export function check(plan){const {placements:ps,margin,gap}=plan;for(const p of ps){assert.ok(p.min[0]>=-90+margin-1e-5&&p.min[1]>=-90+margin-1e-5&&p.max[0]<=90-margin+1e-5&&p.max[1]<=90-margin+1e-5);assert.equal(p.min[2],0);assert.ok([0,90].includes(p.rotation));}for(let i=0;i<ps.length;i++)for(let j=i+1;j<ps.length;j++){const a=ps[i],b=ps[j];assert.ok(a.max[0]+gap<=b.min[0]+1e-5||b.max[0]+gap<=a.min[0]+1e-5||a.max[1]+gap<=b.min[1]+1e-5||b.max[1]+gap<=a.min[1]+1e-5,'footprints separated by requested gap');}}
for(const count of [1,2,8,100]){const plan=planPrintLayout(Array.from({length:count},(_,i)=>item('b'+i,count===100?8:40,count===100?8:30)));check(plan);assert.equal(plan.placements.length,count);}
const rotate=Array.from({length:4},(_,i)=>item('p'+i,100,70));assert.throws(()=>planPrintLayout(rotate,{margin:0,gap:0,allowRotation:false}),/配置方法/);const rotated=planPrintLayout(rotate,{margin:0,gap:0});check(rotated);assert.ok(rotated.placements.some(p=>p.rotation===90));
check(planPrintLayout([item('edge',180,180,-20)],{margin:0,gap:0}));assert.throws(()=>planPrintLayout([item('large',181,50)]),/超えています/);assert.throws(()=>planPrintLayout([item('a',140,140),item('b',140,140)]),/占有面積/);
for(const options of [{margin:NaN},{margin:-1},{margin:21},{gap:31},{gap:-1},{allowRotation:'yes'}])assert.throws(()=>planPrintLayout([item('x',50,50)],options));assert.throws(()=>planPrintLayout([]));assert.throws(()=>planPrintLayout([item('x',40,40),item('x',40,40)]));
for(let seed=1;seed<=25;seed++){const parts=Array.from({length:16},(_,i)=>item('random'+i,10+(seed*11+i*7)%25,10+(seed*3+i*13)%25));check(planPrintLayout(parts));}
console.log('PASS 180mm bounds, spacing, floor, quarter rotation, exact edge fit, dense/random layouts and invalid/full plate failures');
