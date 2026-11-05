import {test} from 'node:test';
import assert from 'node:assert/strict';
import {referencePointIndex} from '../src/reference-point-index.js';
test('spatial deduplication agrees with original Euclidean rule across cell boundaries',()=>{
 const epsilon=1e-5,index=referencePointIndex(epsilon),prior=[];
 const points=[[.99999e-5,0,0],[1.00001e-5,0,0],[-.00001e-5,0,0],[-.99999e-5,0,0],[0,0,0],[5,2,3],[5,2+epsilon*.8,3+epsilon*.8]];
 for(let i=0;i<2000;i++)points.push([Math.sin(i)*.00008,Math.cos(i*7)*.00008,Math.sin(i*3)*.00008]);
 for(const point of points){const expected=!prior.some(p=>Math.hypot(...p.map((v,i)=>v-point[i]))<epsilon);assert.equal(index.add(point),expected);if(expected)prior.push(point);}
});
test('a large assembly keeps distinct nearby references and suppresses repeated copies',()=>{
 const index=referencePointIndex();
 for(let i=0;i<20000;i++){const p=[i*.001,(i%73)*.001,(i%19)*.001];assert.ok(index.add(p));assert.equal(index.add(p),false);}
});
