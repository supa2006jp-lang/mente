import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';
import {sectionSketchPlane} from '../src/section-sketch-plane.js';
import {basisFor,worldPoint,validateFrame} from '../src/frames.js';
import {defaults,makeSketchGeometry,validateProject} from '../src/geometry.js';

const near=(a,b,tolerance=1e-8)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`),rotation=new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(.35,.6,-.2));
const frame=Object.fromEntries(['u','v','n'].map((key,i)=>[key,new THREE.Vector3().setComponent(i,1).transformDirection(rotation).toArray()]));
for(const name of ['XY','XZ','YZ','CUSTOM'])for(const reverse of [false,true])for(const offset of [-17.125,0,28.75]){
 const source={plane:name,frame:name==='CUSTOM'?frame:undefined,offset,reverse,anchor:[130,-80,42]},snapshot=structuredClone(source),face=sectionSketchPlane(source),base=basisFor(source),b=basisFor(face);
 validateFrame(face.frame);near(face.offset,(reverse?1:-1)*offset);near(new THREE.Vector3(...face.anchor).dot(base.n),offset);near(b.n.dot(base.n),reverse?1:-1);assert.ok(b.u.distanceTo(base.u)<1e-8);near(b.u.clone().cross(b.v).dot(b.n),1);
 const clip=new THREE.Plane(base.n.clone().multiplyScalar(reverse?-1:1),(reverse?1:-1)*offset),camera=new THREE.Vector3(...face.anchor).addScaledVector(b.n,180);assert.ok(clip.distanceToPoint(camera)<0,'sketch view faces the removed half so the interior stays visible');
 for(const point of face.outer)near(worldPoint(face,point).dot(base.n),offset);assert.deepEqual(source,snapshot,'source section settings remain independent');
 const origin=b.n.clone().multiplyScalar(face.offset),feature={...defaults,id:'section-sketch',kind:'sketch',profile:'rect',name:'断面スケッチ',plane:face.plane,frame:face.frame,x:origin.x,y:origin.y,z:origin.z,width:20,height:12};
 const g=makeSketchGeometry(feature);for(let i=0;i<g.attributes.position.count;i++)near(new THREE.Vector3().fromBufferAttribute(g.attributes.position,i).dot(base.n),offset,1e-5);g.dispose();
 const restored=validateProject(JSON.parse(JSON.stringify({format:'forma-cad',version:1,features:[feature]})))[0];assert.equal(JSON.stringify(restored.frame),JSON.stringify(feature.frame));near(new THREE.Vector3(restored.x,restored.y,restored.z).dot(base.n),offset);
}
for(const patch of [{offset:''},{offset:'not a number'},{offset:Infinity},{offset:10001},{anchor:[0,NaN,0]},{plane:'wrong'},{plane:'CUSTOM',frame:null}])assert.throws(()=>sectionSketchPlane({plane:'XY',offset:0,...patch}));

// Exercise the real app's plane selection/startFeature bridge without altering
// model history. The draw button stands for starting the interactive tool.
const app=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8'),start=app.slice(app.indexOf('function startFeature('),app.indexOf('function refreshDrawingCoordinates(')),choose=app.match(/^function chooseConstructionPlane\(f\).+$/m)[0],callback=app.match(/onSketch:(face=>\{[\s\S]*?\n\}),onFaceView/)[1];
const fields=new Map(),get=id=>{if(!fields.has(id))fields.set(id,{value:'',hidden:true,textContent:'',scrollIntoView(){}});return fields.get(id);};
let context;const history=[{id:'untouched',kind:'sketch'}],events=[];
context=vm.createContext({THREE,defaults,crypto:{randomUUID:()=> 'plane'},features:history,stage:'model',sketch:false,selectedFace:{name:'old selection'},selected:null,selectedSurface:{old:true},chosenRegion:{old:true},pendingExtrude:false,gridPlane:'XY',activeSketchGroup:'old',editingSketchGroup:'old',editingSectionSplitId:null,centerRectangle:false,$:get,basisFor,planeCoordinates:f=>({offset:new THREE.Vector3(f.x,f.y,f.z).dot(basisFor(f).n)}),current:()=>({...defaults}),bodyDisplay:{stopExploded(){}},selectionPicker:{close(){events.push('picker');}},pointDistance:{reset(){events.push('point');}},clearBodySelection(){events.push('bodies');},clearFaceSelection(){context.selectedFace=null;events.push('faces');},clearEdgeSelection(){},dropPreview(){},syncFields(){},renderTree(){},finishSketch(){context.sketch=false;},fillForm(f){context.draft=structuredClone(f);},notify(){},notifySketchEntered(){},sketchEntryNumber(){return 1;}});
get('draw').click=()=>{assert.equal(context.stage,'sketch');assert.ok(context.pendingDrawingFace.sectionSketch);context.sketch=true;};
vm.runInContext(start+'\n'+choose+'\nvar beginSectionSketch='+callback+';',context);
const face=sectionSketchPlane({plane:'CUSTOM',frame,offset:23.125,reverse:false,anchor:[80,60,40]});assert.equal(context.beginSectionSketch(face),true);assert.equal(context.features,history);assert.equal(history.length,1,'entering a section sketch adds no split or construction-plane history');assert.equal(context.selectedSurface,null);assert.equal(context.patternCenter,null);assert.equal(context.draft.plane,'CUSTOM');assert.deepEqual(context.draft.frame,face.frame);near(new THREE.Vector3(context.draft.x,context.draft.y,context.draft.z).dot(basisFor({frame}).n),23.125);assert.deepEqual(events,['picker','point','bodies','faces']);
console.log('PASS section sketch XYZ/custom/reversed planes, signed offsets, camera-visible side, translated anchors, actual sketch geometry, save/reload and real app selection/start bridge without model changes');
