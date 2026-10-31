import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {defaults,validateFeature} from '../src/geometry.js';
import {barrierRangePreview,clearBarrierRangePreview,barrierPreviewAction} from '../src/barrier-range-preview.js';

// Execute the real app entry points with a kernel scheduler spy, so dragging
// cannot silently regress into blank previews or a native request per move.
const app=await fs.readFile('src/app.js','utf8'),extract=(start,end)=>app.slice(app.indexOf(start),app.indexOf(end,app.indexOf(start)));
const elements=new Map(),$=id=>{if(!elements.has(id))elements.set(id,{textContent:'',dataset:{},checked:id==='barrier',hasPointerCapture:()=>false});return elements.get(id);};
const context=vm.createContext({taperOptionsUI:{nativeAngle(){}},THREE,$,validateFeature,barrierRangePreview,clearBarrierRangePreview,barrierPreviewAction,stage:'extrusion',pendingExtrude:false,selected:null,selectedRegions:[],host:{dataset:{}},scene:new THREE.Group(),preview:null,extrusionDrag:null,barrierPreviewUI:{manual:false},controls:{enabled:false},feature:{...defaults,id:'range',kind:'extrusion',barrier:true,barrierGap:.6,depth:30},scheduled:[],assessment:'idle',confirmed:0,appErrorMessage:e=>e.message});
vm.runInContext(`function current(){return feature;}function setExtrusionAssessment(state){assessment=state;}function scheduleContactPreview(batch){scheduled.push(batch);}function confirmExtrusionArrow(){confirmed++;}function dropPreview(){if(preview){preview.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});preview.removeFromParent();preview=null;}delete host.dataset.barrierRangePreviewCount;}\n`+extract('function updatePreview(', 'function fillForm(')+'\n'+extract('function endExtrusionDrag(',"$('extrude-handle').addEventListener('pointerup'"),context);
const update=force=>context.updatePreview(force),maxZ=()=>new THREE.Box3().setFromObject(context.preview).max.z;
context.extrusionDrag={id:1,dragged:true,enabled:true};update();assert.equal(context.assessment,'range');assert.equal(maxZ(),30);assert.equal(context.scheduled.length,0);assert.equal(context.host.dataset.barrierRangePreviewCount,'1');
context.feature={...context.feature,depth:55};update();assert.equal(maxZ(),55);assert.equal(context.scene.children.length,1,'replace the old guide rather than leaving trails');assert.equal(context.scheduled.length,0);
context.endExtrusionDrag({type:'pointerup',button:0,pointerId:1});assert.equal(context.extrusionDrag,null);assert.equal(context.controls.enabled,true);assert.equal(context.scheduled.length,1,'releasing schedules exactly one prepared preview');assert.equal(context.scheduled[0][0].depth,55);assert.equal(maxZ(),55,'the range stays visible during the scheduled calculation');
context.endExtrusionDrag({type:'lostpointercapture',pointerId:1});assert.equal(context.scheduled.length,1,'pointer capture cleanup must not schedule the same work twice');
context.barrierPreviewUI.manual=true;context.feature={...context.feature,depth:-12};context.extrusionDrag={id:2,dragged:true,enabled:true};update();assert.equal(context.assessment,'manual');assert.equal(new THREE.Box3().setFromObject(context.preview).min.z,-12);assert.equal(context.scheduled.length,1);context.endExtrusionDrag({type:'pointerup',button:0,pointerId:2});assert.equal(context.scheduled.length,1,'manual mode never runs detailed geometry on release');update(true);assert.equal(context.scheduled.length,2,'explicit update still calculates');
assert.equal($('error').textContent,'');assert.equal($('viewport-depth-error').textContent,'');vm.runInContext('dropPreview()',context);
console.log('PASS actual app preview/drag-release flow: visible live range, no per-move kernel requests, one release request, visible while calculating, no duplicate release and manual/forced update behavior');
