import assert from 'node:assert/strict';
import * as THREE from 'three';
import {defaults,validateProject} from '../src/geometry.js';
import {basisFor,worldPoint} from '../src/frames.js';
import {planeCoordinates} from '../src/regions.js';
import {addSketchMotionConstraint,moveConstraintVertex,constraintControlPoints,assertSketchConstraints,sketchConstraints,addSketchConstraint,reconcileSketchConstraints,setSketchConstraintEnabled,setSketchConstraintsEnabled,solveSketchConstraints} from '../src/sketch-constraints.js';
import {encodeProjectDocument,decodeProjectDocument} from '../src/project-codec.js';
const make=(id,points,extra={})=>({...defaults,id,name:id,kind:'sketch',profile:'polyline',points,closed:false,groupId:'s',groupNumber:1,...extra}),ref=(featureId,index=0)=>({featureId,index}),near=(a,b)=>assert(Math.abs(a-b)<1e-6,`${a} != ${b}`),point=(fs,r)=>constraintControlPoints(fs.find(f=>f.id===r.featureId))[r.index];
for(const plane of ['XY','XZ','YZ','CUSTOM']){
 const extra={plane,...(plane==='CUSTOM'?{frame:{u:[Math.SQRT1_2,Math.SQRT1_2,0],v:[0,0,1],n:[Math.SQRT1_2,-Math.SQRT1_2,0]}}:{})};
 let fs=[make('axis',[[0,-40],[0,40]],extra),make('a',[[-20,0],[-30,10]],extra),make('b',[[25,8],[35,15]],extra)],snapshot=JSON.stringify(fs);
 fs=addSketchMotionConstraint(fs,'symmetric',ref('a'),ref('b'),ref('axis'));assert.equal(JSON.stringify(fs[0]),JSON.parse(snapshot).map(JSON.stringify)[0]);near(point(fs,ref('b'))[0],20);near(point(fs,ref('b'))[1],0);assertSketchConstraints(fs);
 for(const [id,uv,targetId,target]of [['a',[-28,13],'b',[28,13]],['b',[19,-7],'a',[-19,-7]]]){fs=moveConstraintVertex(fs,ref(id),uv);point(fs,ref(targetId)).forEach((v,i)=>near(v,target[i]));assertSketchConstraints(fs);assert.deepEqual(fs[0].points,[[0,-40],[0,40]]);}
 const encoded=await encodeProjectDocument({format:'forma-cad',version:1,features:fs},{compress:true}),loaded=validateProject((await decodeProjectDocument(encoded.text)).document);assert.deepEqual(loaded,fs);assertSketchConstraints(moveConstraintVertex(loaded,ref('a'),[-24,14]));
 // Deleting the third reference removes the relation; copied owners cannot keep stale references.
 assert.equal(sketchConstraints(reconcileSketchConstraints(fs.slice(1),fs)).length,0);assert.equal(reconcileSketchConstraints([...fs,{...fs[1],id:'copy'}],fs).at(-1).sketchConstraints.length,0);
 const relation=sketchConstraints(fs)[0],off=setSketchConstraintEnabled(fs,[relation.id],false),free=moveConstraintVertex(off,ref('b'),[29,22]);assert.deepEqual(point(free,ref('a')),point(off,ref('a')));assertSketchConstraints(setSketchConstraintEnabled(free,[relation.id],true));
 fs=[make('rail',[[0,0],[30,40]],extra),make('moving',[[12,25],[20,30]],extra)];fs=addSketchMotionConstraint(fs,'slider',ref('moving'),ref('rail'));assertSketchConstraints(fs);const other=point(fs,ref('moving',1));
 for(const [uv,target]of [[[12,1],[4.8,6.4]],[[60,80],[30,40]],[[-10,-30],[0,0]],[[9,12],[9,12]]]){fs=moveConstraintVertex(fs,ref('moving'),uv);point(fs,ref('moving')).forEach((v,i)=>near(v,target[i]));point(fs,ref('moving',1)).forEach((v,i)=>near(v,other[i]));assert.deepEqual(fs[0].points,[[0,0],[30,40]]);assertSketchConstraints(fs);}
 const center=worldPoint({...extra,offset:0},[12,25]);fs=[fs[0],{...defaults,...extra,id:'circle',name:'circle',kind:'sketch',profile:'circle',groupId:'s',groupNumber:1,x:center.x,y:center.y,z:center.z,diameter:8}];fs=addSketchMotionConstraint(fs,'slider',ref('circle'),ref('rail'));fs=moveConstraintVertex(fs,ref('circle'),[18,24]);point(fs,ref('circle')).forEach((v,i)=>near(v,[18,24][i]));near(fs[1].diameter,8);assertSketchConstraints(fs);validateProject({format:'forma-cad',version:1,features:fs});
 const basis=basisFor(fs[0]),delta=basis.u.clone().multiplyScalar(4).addScaledVector(basis.v,7),moved=structuredClone(fs);moved[0].points=moved[0].points.map(p=>[p[0]+4,p[1]+7]);const solved=solveSketchConstraints(moved,{before:fs});assertSketchConstraints(solved);assert.deepEqual(solved[0].points,moved[0].points);
}
let fs=[make('axis',[[0,-30],[0,30]]),make('shape',[[-10,0],[10,0],[10,15],[-10,15]],{closed:true})];fs=addSketchMotionConstraint(fs,'symmetric',ref('shape'),ref('shape',1),ref('axis'));fs=moveConstraintVertex(fs,ref('shape'),[-16,-4]);near(fs[1].points[1][0],16);near(fs[1].points[1][1],-4);assertSketchConstraints(fs);
let base=[make('rail',[[0,0],[40,0]]),make('p',[[10,10],[15,20]])];const before=JSON.stringify(base),locked=addSketchConstraint(base,'fixed',ref('p'));assert.throws(()=>addSketchMotionConstraint(locked,'slider',ref('p'),ref('rail')),/拘束|固定/);assert.equal(JSON.stringify(base),before);
assert.throws(()=>addSketchMotionConstraint(setSketchConstraintsEnabled(base,false),'slider',ref('p'),ref('rail')),/ON/);
assert.throws(()=>addSketchMotionConstraint(base,'slider',ref('rail'),ref('rail')),/別/);
assert.throws(()=>addSketchMotionConstraint([base[0],{...base[1],groupId:'other'}],'slider',ref('p'),ref('rail')),/同じ/);
const sym=addSketchMotionConstraint([make('rail',[[0,-20],[0,20]]),make('p',[[-10,0],[10,0]])],'symmetric',ref('p'),ref('p',1),ref('rail'));
for(const mutate of [c=>c.axis.index=500,c=>c.axis.featureId='missing',c=>delete c.axis,c=>c.second.index=500]){const bad=structuredClone(sym);mutate(bad[1].sketchConstraints[0]);assert.throws(()=>validateProject({format:'forma-cad',version:1,features:bad}));}
console.log('PASS symmetry from either side, fixed axes, same-shape pairs, finite sliders, native circle centers, four planes, atomic conflicts, ON/OFF, deletion/copy, validation and compressed save');
