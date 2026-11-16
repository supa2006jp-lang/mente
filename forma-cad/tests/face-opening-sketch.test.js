import assert from 'node:assert/strict';
import test from 'node:test';
import {createFaceOpeningSketch,createFaceOpeningSketches,openingSketchSource,planFaceOpeningSketch,planOpeningSketchEdit} from '../src/face-opening-sketch.js';
import {validateProject} from '../src/geometry.js';
import {findRegions,planeCoordinates,sketchPoints} from '../src/regions.js';
import {refreshRegion} from '../src/history-replay.js';
import {reverseExtrusionFrame} from '../src/extrusion-direction.js';

const frame={u:[0,1,0],v:[0,0,1],n:[1,0,0]};
const face={plane:'CUSTOM',frame,offset:12};
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8);

test('copies the second opening as a circle in the original face plane',()=>{
 const ring=Array.from({length:64},(_,i)=>[8+6*Math.cos(i*Math.PI/32),-2+6*Math.sin(i*Math.PI/32)]);
 const sketch=createFaceOpeningSketch({...face,holes:[[[0,0],[2,0],[0,2]],ring]},1,7);
 assert.equal(sketch.profile,'circle');
 assert.equal(sketch.groupNumber,7);
 assert.deepEqual(sketch.frame,frame);
 near(sketch.diameter,12);
 near(sketch.x,12);
 near(sketch.y,8);
 near(sketch.z,-2);
});

test('highlights thin tips and bridges that disappear after an inward offset',()=>{
 const tip=[[0,0],[10,0],[10,4],[14,4],[14,4.4],[10,4.4],[10,10],[0,10]];
 const bridge=[[0,0],[6,0],[6,2.8],[10,2.8],[10,0],[16,0],[16,6],[10,6],[10,3.2],[6,3.2],[6,6],[0,6]];
 const source={...face,holes:[tip,bridge]};
 const plan=planFaceOpeningSketch(source,0,1,{clearance:.3});
 assert.equal(plan.sketch.profile,'polyline');
 assert.ok(plan.lost.some(ring=>ring.some(([x])=>x>13)));
 assert.throws(()=>planFaceOpeningSketch(source,1,1,{clearance:.3}),error=>
  /輪郭が分かれます/.test(error.message)&&error.openingContours.some(ring=>{
   const xs=ring.map(([x])=>x);
   return Math.min(...xs)===6&&Math.max(...xs)===10;
  }));
});

test('edits saved clearance from the original contour without changing identity',()=>{
 const outline=[[0,0],[12,0],[12,8],[0,8]],source={...face,holes:[outline]};
 const feature=createFaceOpeningSketch(source,0,1,{clearance:.2});
 const loaded=validateProject(JSON.parse(JSON.stringify({format:'forma-cad',version:1,features:[feature]})))[0];
 const saved=openingSketchSource(loaded);
 const plan=planFaceOpeningSketch(saved.face,saved.index,loaded.groupNumber,{contour:saved.outline,clearance:.45});
 const edit=planOpeningSketchEdit([loaded],[{id:loaded.id,plan}]);
 assert.equal(edit.start,0);
 assert.equal(edit.features[0].id,loaded.id);
 assert.equal(edit.features[0].groupId,loaded.groupId);
 near(edit.features[0].width,11.1);
 near(loaded.width,11.6);
 assert.throws(()=>openingSketchSource({...loaded,width:20}),/編集済み/);
 const region=findRegions([loaded])[0],reversed=reverseExtrusionFrame({...loaded,region}).region;
 const refreshed=refreshRegion(reversed,[loaded],edit.features);
 assert.deepEqual(refreshed.frame.n,[-1,0,0]);
 near(refreshed.offset,-12);
 near(refreshed.area,11.1*7.1);
});

test('creates one sketch group with inward clearance for distinct openings',()=>{
 const circle=Array.from({length:64},(_,i)=>[8+6*Math.cos(i*Math.PI/32),-2+6*Math.sin(i*Math.PI/32)]);
 const rect=[[20,0],[30,0],[30,8],[20,8]];
 const triangle=[[35,0],[45,0],[35,10]];
 const input={...face,holes:[circle,rect,triangle]};
 const [a,b,c]=createFaceOpeningSketches(input,[0,1,2],9,.2);
 assert.equal(new Set([a.groupId,b.groupId,c.groupId]).size,1);
 assert.equal(new Set([a.id,b.id,c.id]).size,3);
 assert.ok([a,b,c].every(sketch=>sketch.groupNumber===9));
 near(a.diameter,11.6);
 near(a.y,8);
 near(a.z,-2);
 near(b.width,9.6);
 near(b.height,7.6);
 near(b.y,25);
 near(b.z,4);
 near(Math.min(...c.points.map(p=>p[0])),35.2);
 near(Math.min(...c.points.map(p=>p[1])),.2);
 near(planeCoordinates(c).offset,12);
 assert.throws(()=>createFaceOpeningSketches(input,[0,1],9,4),/開口 2/);
 assert.throws(()=>createFaceOpeningSketches(input,[2],9,4),/開口 3/);
});

test('retains a rotated rectangular outline and copies irregular openings as closed polylines',()=>{
 const angle=.41,c=Math.cos(angle),s=Math.sin(angle);
 const rectangle=[[0,0],[20,0],[20,10],[0,10]].map(([x,y])=>[x*c-y*s+2,x*s+y*c-7]);
 const triangle=[[4,5],[6,9],[9,5]];
 const source={...face,holes:[rectangle,triangle]};
 const rect=createFaceOpeningSketch(source,0,1);
 assert.equal(rect.profile,'rect');
 near(planeCoordinates(rect).offset,face.offset);
 for(const corner of rectangle)assert.ok(sketchPoints(rect).some(p=>Math.hypot(p[0]-corner[0],p[1]-corner[1])<1e-8));
 const polyline=createFaceOpeningSketch(source,1,2);
 assert.equal(polyline.profile,'polyline');
 assert.equal(polyline.closed,true);
 assert.deepEqual(sketchPoints(polyline),[...triangle,triangle[0]]);
 assert.throws(()=>createFaceOpeningSketch(source,2,3),/開口の輪郭/);
});
