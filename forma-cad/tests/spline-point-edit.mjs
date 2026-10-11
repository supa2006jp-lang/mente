import assert from 'node:assert/strict';
import * as THREE from 'three';
import {splinePointInsertion} from '../src/spline-point-edit.js';
const project=p=>({x:p[0]*10+200,y:200-p[1]*10,z:0});
function hit(feature,t,projection=project){const curve=new THREE.CatmullRomCurve3(feature.points.map(p=>new THREE.Vector3(...p,0)),!!feature.closed,'centripetal'),p=curve.getPoint(t);return splinePointInsertion(feature,projection([p.x,p.y]),projection);}
const line={points:[[0,0],[10,0]],closed:false};
assert.deepEqual(hit(line,.5),{index:1,point:[5,0]});
const open={points:[[0,0],[10,15],[20,-5],[30,0]],closed:false};
for(const [t,index] of [[.15,1],[.5,2],[.85,3]]){const insertion=hit(open,t);assert.ok(insertion);assert.equal(insertion.index,index);const curve=new THREE.CatmullRomCurve3(open.points.map(p=>new THREE.Vector3(...p,0)),false,'centripetal'),expected=curve.getPoint(t);assert.ok(Math.hypot(insertion.point[0]-expected.x,insertion.point[1]-expected.y)<.06);}
const closed={points:[[0,0],[10,0],[10,10],[0,10]],closed:true};
assert.equal(hit(closed,.875).index,4,'closing interval inserts after last point');
assert.equal(hit(closed,.125).index,1);
assert.equal(splinePointInsertion(open,{x:5000,y:5000},project),null);
assert.equal(splinePointInsertion({points:[[1,2]]},{x:0,y:0},project),null);
assert.equal(splinePointInsertion(line,project(line.points[0]),project),null,'no duplicate fit point at the endpoint');
assert.equal(hit(open,.5,p=>({...project(p),z:2})),null,'off-screen depth is ignored');
const tilted=p=>({x:400+p[0]*5+p[1]*3,y:300+p[1]*7-p[0]*2,z:0});
assert.equal(hit(open,.5,tilted).index,2,'oblique screen projection preserves point order');
console.log('PASS spline insertion hit positions, point order, closed seam, oblique projection and misses');
