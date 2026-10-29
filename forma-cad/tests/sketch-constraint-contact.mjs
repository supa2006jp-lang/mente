import assert from 'node:assert/strict';
import {defaults,validateProject} from '../src/geometry.js';
import {applyDirectSketchConstraint,addSketchConstraint,assertSketchConstraints,moveConstraintVertex,sketchConstraints,setSketchConstraintEnabled,setSketchConstraintsEnabled,constraintVertices} from '../src/sketch-constraints.js';
import {encodeProjectDocument,decodeProjectDocument} from '../src/project-codec.js';
const feature=(id,points,extra={})=>({...defaults,id,name:id,kind:'sketch',profile:'polyline',points,closed:false,groupId:'s',groupNumber:1,...extra}),ref=(featureId,index=0)=>({featureId,index}),pick=new Map([['a',new Set([0])],['b',new Set([0])]]),near=(a,b,tol=1e-7)=>assert(Math.abs(a-b)<tol,a+' != '+b),contact=features=>applyDirectSketchConstraint(features,'contact',pick);
const cases=[
 {a:[[0,0],[20,0]],b:[[5,8],[15,12]],shift:-8},
 {a:[[0,0],[20,0]],b:[[5,8],[15,8]],shift:-8},
 {a:[[0,0],[20,0]],b:[[-5,3],[5,13]],shift:-8},
 {a:[[0,0],[20,0]],b:[[5,-12],[15,-8]],shift:8},
 {a:[[0,0],[20,0]],b:[[10,4],[10,9]],shift:-4},
 {a:[[0,0],[20,0]],b:[[5,-5],[15,5]],shift:0},
 {a:[[20,0],[0,0]],b:[[5,8],[15,12]],shift:-8}
];
for(const plane of ['XY','XZ','YZ','CUSTOM'])for(const angle of [0,.73])for(const test of cases){
 const extra={plane,...(plane==='CUSTOM'?{frame:{u:[1,0,0],v:[0,Math.SQRT1_2,Math.SQRT1_2],n:[0,-Math.SQRT1_2,Math.SQRT1_2]}}:{})},rotate=([x,y])=>[x*Math.cos(angle)-y*Math.sin(angle)+7,x*Math.sin(angle)+y*Math.cos(angle)-11],features=[feature('a',test.a.map(rotate),extra),feature('b',test.b.map(rotate),extra)],snapshot=JSON.stringify(features),next=contact(features),a=constraintVertices(next[0]),b=constraintVertices(next[1]),record=sketchConstraints(next).find(c=>c.type==='contact');
 assertSketchConstraints(next);assert(record);assert.deepEqual(a,features[0].points);for(let i=0;i<2;i++){near(b[i][0]-features[1].points[i][0],-Math.sin(angle)*test.shift);near(b[i][1]-features[1].points[i][1],Math.cos(angle)*test.shift);}for(let i=0;i<2;i++){near(b[1][i]-b[0][i],features[1].points[1][i]-features[1].points[0][i]);near(a[0][i]+(a[1][i]-a[0][i])*record.firstParameter,b[0][i]+(b[1][i]-b[0][i])*record.secondParameter);}assert.equal(JSON.stringify(features),snapshot);assert.equal(contact(next),next);
 const reverse=new Map([['b',new Set([0])],['a',new Set([0])]]);assert.equal(applyDirectSketchConstraint(next,'contact',reverse),next);const encoded=await encodeProjectDocument({format:'forma-cad',version:1,features:next},{compress:true}),loaded=(await decodeProjectDocument(encoded.text)).document;assert.deepEqual(validateProject(loaded),JSON.parse(JSON.stringify(next)));
}
let features=[feature('a',[[0,0],[20,0]]),feature('b',[[5,8],[15,12]])],next=addSketchConstraint(features,'contact',ref('a'),ref('b')),record=sketchConstraints(next).find(c=>c.type==='contact');near(record.firstParameter,.25);near(record.secondParameter,0);assert.equal(sketchConstraints(next).length,1);
const moved=moveConstraintVertex(next,ref('a',1),[24,2]);assertSketchConstraints(moved);const a=moved[0].points,b=moved[1].points;for(let i=0;i<2;i++)near(a[0][i]+(a[1][i]-a[0][i])*record.firstParameter,b[0][i]);
let off=setSketchConstraintEnabled(next,[record.id],false),resumed=contact(off);assert.equal(sketchConstraints(resumed).length,1);assert.equal(sketchConstraints(resumed)[0].id,record.id);assert.notEqual(sketchConstraints(resumed)[0].enabled,false);assertSketchConstraints(resumed);
const locked=addSketchConstraint(features,'fixed',ref('b')),snapshot=JSON.stringify(locked);assert.throws(()=>contact(locked),/固定|拘束/);assert.equal(JSON.stringify(locked),snapshot);
for(const b of [[[21,3],[30,10]],[[-10,3],[-1,8]],[[30,0],[30,10]]]){const input=[features[0],feature('b',b)],saved=JSON.stringify(input);assert.throws(()=>contact(input),/接触しません/);assert.equal(JSON.stringify(input),saved);}
assert.throws(()=>contact([features[0],{...features[1],groupId:'different'}]),/同じ/);assert.throws(()=>contact([features[0],{...features[1],z:3}]),/同じ/);assert.throws(()=>contact(setSketchConstraintsEnabled(features,false)),/ON/);assert.throws(()=>applyDirectSketchConstraint(features,'contact',new Map([['a',new Set([0])]])),/2/);
for(const field of ['firstParameter','secondParameter'])for(const value of [-1,1.1,'0.5',NaN,Infinity,undefined]){const bad=structuredClone(next);bad[0].sketchConstraints[0][field]=value;assert.throws(()=>validateProject({format:'forma-cad',version:1,features:bad}),/接触/);}
const bad=structuredClone(next);bad[0].sketchConstraints[0].second.index=20;assert.throws(()=>validateProject({format:'forma-cad',version:1,features:bad}),/対象/);
// A contact between adjacent edges of the same rectangle is already satisfied.
const rect={...defaults,id:'r',kind:'sketch',profile:'rect',groupId:'s',width:20,height:10},same=applyDirectSketchConstraint([rect],'contact',new Map([['r',new Set([0,1])]]));assertSketchConstraints(same);assert.deepEqual(constraintVertices(same[0]),constraintVertices(rect));
console.log('PASS contact: shortest normal-only finite-segment translation, fixed reference and retained second direction/length, overlap clipping, parallel/perpendicular/already touching, four planes and rotated references, saved persistent joints, reactivation, atomic conflicts and validation');
