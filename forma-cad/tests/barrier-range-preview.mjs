import assert from 'node:assert/strict';
import * as THREE from 'three';
import {defaults} from '../src/geometry.js';
import {basisFor} from '../src/frames.js';
import {barrierRangePreview,clearBarrierRangePreview,disposeBarrierRange,barrierPreviewAction} from '../src/barrier-range-preview.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-4,`${a} vs ${b}`);
for(const plane of ['XY','XZ','YZ','CUSTOM'])for(const depth of [3,-17,40])for(const symmetric of [false,true]){
 const f={...defaults,id:'range',kind:'extrusion',profile:'rect',barrier:true,barrierGap:.6,operation:'new',width:20,height:12,depth,plane,symmetric,x:4,y:7,z:9,...(plane==='CUSTOM'?{frame:{u:[0,1,0],v:[-Math.SQRT1_2,0,Math.SQRT1_2],n:[Math.SQRT1_2,0,Math.SQRT1_2]}}:{})},snapshot=JSON.stringify(f),range=barrierRangePreview([f]);
 const mesh=range.children[0],axis=basisFor(f).n,p=mesh.geometry.attributes.position,projections=Array.from({length:p.count},(_,i)=>new THREE.Vector3().fromBufferAttribute(p,i).dot(axis)),origin=new THREE.Vector3(f.x,f.y,f.z).dot(axis);
 close(Math.min(...projections),origin+(symmetric?-Math.abs(depth):Math.min(0,depth)));close(Math.max(...projections),origin+(symmetric?Math.abs(depth):Math.max(0,depth)));
 assert.equal(range.userData.barrierRangePreview,true);assert.ok(mesh.material.transparent&&mesh.material.opacity>0&&mesh.material.opacity<.2);assert.equal(mesh.children[0].material.depthTest,false,'range outline remains visible across an obstacle');assert.equal(JSON.stringify(f),snapshot,'displaying the range never changes the feature or exact result');
 let released=0;range.traverse(o=>{o.geometry?.addEventListener('dispose',()=>released++);o.material?.addEventListener('dispose',()=>released++);});const parent=new THREE.Group(),exact=new THREE.Group();parent.add(range,exact);clearBarrierRangePreview(parent);assert.deepEqual(parent.children,[exact],'only the temporary range is replaced');assert.equal(released,4,'range mesh, outline and both materials are released');
}
const batch=[{...defaults,id:'a',kind:'extrusion',barrier:true,depth:15},{...defaults,id:'b',kind:'extrusion',profile:'circle',barrier:true,x:30,depth:15}],group=barrierRangePreview(batch);assert.equal(group.children.length,2,'all selected regions show a range');disposeBarrierRange(group);
assert.equal(barrierPreviewAction({barrier:false,dragging:true}),'normal');assert.equal(barrierPreviewAction({barrier:true,dragging:true}),'range');assert.equal(barrierPreviewAction({barrier:true,dragging:false}),'calculate');assert.equal(barrierPreviewAction({barrier:true,manual:true,dragging:true}),'manual');assert.equal(barrierPreviewAction({barrier:true,manual:true,force:true}),'calculate');
console.log('PASS immediate signed/symmetric XY/XZ/YZ/custom range bounds, visible outlines, multiple profiles, exact-result replacement/disposal and drag/manual calculation policy');
