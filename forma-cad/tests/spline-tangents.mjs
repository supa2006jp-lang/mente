import assert from 'node:assert/strict';
import * as THREE from 'three';
import {splineCurve,splineSamples} from '../src/spline-curve.js';
import {splinePointInsertion} from '../src/spline-point-edit.js';
import {validateFeature,defaults} from '../src/geometry.js';
import {sketchPoints} from '../src/regions.js';
const points=[[0,0],[12,8],[30,2],[42,10]],old=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p,0)),false,'centripetal');
assert.deepEqual(splineCurve({points}).getPoints(64),old.getPoints(64),'old files retain the exact curve');
for(const ps of [points,points.slice(0,2)])for(const tangents of [{start:90},{end:-45},{start:120,end:30}]){
 const curve=splineCurve({points:ps,tangents}),n=ps.length-1;
 for(let i=0;i<ps.length;i++)assert.ok(curve.getPoint(i/n).distanceTo(new THREE.Vector3(...ps[i],0))<1e-9,'curve passes through every fit point');
 for(const [end,a] of Object.entries(tangents)){
  const t=end==='start'?0:1,e=1e-7,delta=end==='start'?curve.getPoint(e).sub(curve.getPoint(0)):curve.getPoint(1).sub(curve.getPoint(1-e)),r=a*Math.PI/180;
  assert.ok(delta.normalize().distanceTo(new THREE.Vector3(Math.cos(r),Math.sin(r),0))<1e-5,'specified endpoint direction '+end);
 }
 if(ps.length>2)for(const t of [.4,.5,.6])assert.ok(curve.getPoint(t).distanceTo(old.getPoint(t))<1e-9,'middle intervals do not change');
 const project=p=>({x:200+p[0]*9+p[1]*3,y:200-p[1]*6,z:0}),p=curve.getPoint(.13),insert=splinePointInsertion({points:ps,tangents},project([p.x,p.y]),project);
 assert.equal(insert.index,1);assert.ok(Math.hypot(insert.point[0]-p.x,insert.point[1]-p.y)<.1,'picking follows the tangent-adjusted curve');
 assert.deepEqual(sketchPoints({profile:'spline',points:ps,tangents}),splineSamples({points:ps,tangents}),'regions and display use identical samples');
}
const closed={points,closed:true,tangents:{start:90,end:45}};assert.deepEqual(splineSamples(closed),splineSamples({...closed,tangents:undefined}),'closed curves ignore endpoint constraints');
for(const tangents of [null,[],{start:NaN},{end:361},{start:'0'},{other:10}])assert.throws(()=>validateFeature({...defaults,kind:'sketch',profile:'spline',points,tangents}),/接線/);
for(const tangents of [{},{start:0},{end:null},{start:-360,end:360}])validateFeature({...defaults,kind:'sketch',profile:'spline',points,tangents});
console.log('PASS old geometry, endpoint derivatives, fit points, middle continuity, adjusted hit tests, region sampling and validation');
