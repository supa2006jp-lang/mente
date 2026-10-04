import assert from 'node:assert/strict';
import {surfacePattern,surfacePatternNames} from '../src/surface-pattern.js';
import {svgWrapPieces} from '../src/svg-wrap-pattern.js';
const C=60*Math.PI,H=48;
function profile(regions,x){const ys=[];for(const r of regions)for(const ring of [r.outer,...r.holes])for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];if((a[0]<=x&&b[0]>x)||(b[0]<=x&&a[0]>x))ys.push(a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]));}return ys.sort((a,b)=>a-b);}
for(const kind of Object.keys(surfacePatternNames))for(const stagger of [0,.5]){
 const p=surfacePattern(C,H,{kind,stagger}),pieces=svgWrapPieces(p.regions,'single');assert.equal(p.count,kind==='weave'?10:9);assert.ok(pieces.length<=100);assert.ok(p.regions.length);assert.ok(Math.abs(p.width*p.count-C)<1e-10);
 for(const r of p.regions)for(const ring of [r.outer,...r.holes])for(const point of ring)assert.ok(point.every(v=>Number.isFinite(v)&&v>=0&&v<=1));
 const left=profile(p.regions,1e-8),right=profile(p.regions,1-1e-8);assert.equal(left.length,right.length,kind+' seam intervals');for(let i=0;i<left.length;i++)assert.ok(Math.abs(left[i]-right[i])<1e-5,kind+' joins across the seam');
 assert.deepEqual(p,surfacePattern(C,H,{kind,stagger}),'deterministic save/replay');
}
assert.equal(surfacePattern(C,H,{size:30}).count,6);assert.equal(surfacePattern(C,H,{size:15}).count,13);
assert.notDeepEqual(surfacePattern(C,H,{kind:'stone',seed:1}).regions,surfacePattern(C,H,{kind:'stone',seed:2}).regions);
for(const kind of Object.keys(surfacePatternNames))assert.notDeepEqual(surfacePattern(C,H,{kind,stagger:0}).regions,surfacePattern(C,H,{kind,stagger:.5}).regions);
for(const p of [{kind:'bad'},{kind:'toString'},{version:2},{size:0},{size:.5},{rows:1.5},{rows:0},{rows:9},{rows:8},{lineWidth:0},{lineWidth:9},{stagger:-1},{seed:NaN},{seed:10000}])assert.throws(()=>surfacePattern(C,H,p));
assert.throws(()=>surfacePattern(NaN,H));assert.throws(()=>surfacePattern(C,0));
console.log('PASS ten procedural patterns, deterministic stone variants, size/stagger changes, exact periodic seam profiles, bounded complexity and invalid settings');
