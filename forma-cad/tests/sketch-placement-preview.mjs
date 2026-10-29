import assert from 'node:assert/strict';
import {defaults} from '../src/geometry.js';
import {basisFor,worldPoint} from '../src/frames.js';
import {sketchPlacementGuides,previewSketchPlacement} from '../src/sketch-placement-preview.js';
import {applyDirectSketchConstraint,addSketchConstraint} from '../src/sketch-constraints.js';
const feature=(id,extra={})=>({...defaults,id,kind:'sketch',groupId:'s',groupNumber:1,profile:'rect',width:40,height:20,...extra}),select=(a=0,b=0)=>new Map([['a',new Set([a])],['b',new Set([b])]]),near=(a,b)=>assert(Math.abs(a-b)<1e-5,`${a} != ${b}`);
for(const plane of [{plane:'XY'},{plane:'XZ'},{plane:'YZ'},{plane:'CUSTOM',frame:{u:[Math.SQRT1_2,Math.SQRT1_2,0],v:[0,0,1],n:[Math.SQRT1_2,-Math.SQRT1_2,0]}}]){
 const a=feature('a',{...plane,x:0,y:0,z:0}),basis=basisFor(a),position=worldPoint({...a,offset:0},[0,40]),b=feature('b',{...plane,profile:'circle',diameter:20,x:position.x,y:position.y,z:position.z}),features=[a,b],snapshot=JSON.stringify(features),selection=select();
 for(const type of ['midpoint','center','contact']){const p=previewSketchPlacement(features,selection,type),result=applyDirectSketchConstraint(features,type,selection),after=result[1],delta=[after.x-b.x,after.y-b.y,after.z-b.z];p.target.clone().sub(p.source).toArray().forEach((v,i)=>near(v,delta[i]));near(p.distance,Math.hypot(...delta));assert(p.ghosts.length);assert.equal(p.labels.length,2);assert.equal(JSON.stringify(features),snapshot);}
 const mid=sketchPlacementGuides(features,selection);assert.match(mid.labels[0],/辺の中点/);assert.match(mid.labels[1],/図形の中心/);const centered=sketchPlacementGuides(features,selection,'center');near(centered.points[0].length(),0);near(mid.points[0].dot(basis.v),-10);
}
const line=feature('a',{profile:'polyline',points:[[0,-50],[0,50]],closed:false}),circle=feature('b',{profile:'circle',diameter:20,x:50,y:0,z:0}),fs=[line,circle],contact=previewSketchPlacement(fs,select(),'contact');near(contact.distance,40);assert.deepEqual(contact.source.toArray().map(v=>Math.round(v)||0),[40,0,0]);near(contact.target.length(),0);assert.equal(contact.ghosts.length,1,'fixed reference must not become a ghost');
const locked=addSketchConstraint(fs,'fixed',{featureId:'a',index:0}),placed=applyDirectSketchConstraint(locked,'contact',select()),nothing=previewSketchPlacement(placed,select(),'contact');near(nothing.distance,0);assert.equal(nothing.ghosts.length,0);
const rect=feature('b',{x:60,y:20,z:0,width:20,height:10}),conflict=addSketchConstraint([feature('a'),rect],'fixed',{featureId:'b',index:0}),before=JSON.stringify(conflict);assert.throws(()=>previewSketchPlacement(conflict,select(),'center'));assert.equal(JSON.stringify(conflict),before);
assert.equal(previewSketchPlacement(fs,new Map(),'center'),null);
console.log('PASS preview is immutable, follows actual contact/midpoint/center results on four planes, preserves curve geometry, omits fixed reference ghosts, handles no-op and conflict');
