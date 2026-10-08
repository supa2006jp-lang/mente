import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {defaults,makeGeometry,rebuild,volume} from '../src/geometry.js';
import {basisFor,worldPoint,validateFrame} from '../src/frames.js';
import {validateRegion} from '../src/regions.js';
import {extrusionIntersections} from '../src/extrusion-auto-cut.js';
import {outwardExtrusion} from '../src/extrusion-direction.js';

function box(){const mesh=new THREE.Mesh(new THREE.BoxGeometry(30,30,10));mesh.position.z=5;mesh.updateMatrixWorld(true);return new Map([['body',mesh]]);}
function dispose(bodies){for(const mesh of bodies.values())mesh.geometry.dispose();}

test('bottom sketch gets an outward positive frame; top and ambiguous internal planes retain their axes',()=>{
 const bodies=box();try{
  const f={...defaults,width:4,height:4};const result=outwardExtrusion(f,bodies);assert.deepEqual(basisFor(result).n.toArray().map(v=>v||0),[0,0,-1]);assert.equal(result.depth,2);validateFrame(result.frame);assert.deepEqual(extrusionIntersections(result,bodies),[]);assert.ok(extrusionIntersections({...result,depth:-2},bodies).length);assert.equal(f.plane,'XY');
  const top={...f,z:10},inside={...f,z:5};assert.equal(outwardExtrusion(top,bodies),top);assert.equal(outwardExtrusion(inside,bodies),inside);const cut={...f,operation:'cut'};assert.equal(outwardExtrusion(cut,bodies),cut);
  bodies.get('body').visible=false;assert.equal(outwardExtrusion(f,bodies),f);
 }finally{dispose(bodies);}
});

test('front sketch region reverses extrusion but keeps all outer and hole points in place',()=>{
 const bodies=box();try{
  const region={plane:'XZ',offset:-15,outer:[[-4,-2],[4,-2],[4,-8],[-4,-8]],holes:[[[-1,-4],[1,-4],[1,-6],[-1,-6]]],sourceIds:['sketch'],area:44};
  const f={...defaults,profile:'region',plane:'XZ',y:-15,region};const result=outwardExtrusion(f,bodies);assert.deepEqual(basisFor(result).n.toArray().map(v=>v||0),[0,-1,0]);validateRegion(result.region);assert.deepEqual(extrusionIntersections(result,bodies),[]);
  for(const [original,reversed] of [[region.outer,result.region.outer],[region.holes[0],result.region.holes[0]]])for(const point of original)assert.ok(reversed.some(p=>worldPoint(region,point).distanceTo(worldPoint(result.region,p))<1e-9));
  const a=makeGeometry({...f,depth:-2}),b=makeGeometry(result);try{assert.ok(Math.abs(volume(a)-volume(b))<1e-5);assert.ok(new THREE.Box3().setFromBufferAttribute(a.attributes.position).equals(new THREE.Box3().setFromBufferAttribute(b.attributes.position)));}finally{a.dispose();b.dispose();}
 }finally{dispose(bodies);}
});

test('reversing a thin line retains its physical wall side and original footprint',()=>{
 const bodies=box();try{
  for(const side of ['inside','outside','center']){const f={...defaults,profile:'line',mode:'thin',width:10,angle:30,side};const result=outwardExtrusion(f,bodies);assert.deepEqual(basisFor(result).n.toArray().map(v=>v||0),[0,0,-1]);const a=makeGeometry({...f,depth:-2}),b=makeGeometry(result);try{const aa=new THREE.Box3().setFromBufferAttribute(a.attributes.position),bb=new THREE.Box3().setFromBufferAttribute(b.attributes.position);assert.ok(aa.min.distanceTo(bb.min)<1e-6&&aa.max.distanceTo(bb.max)<1e-6);}finally{a.dispose();b.dispose();}}
 }finally{dispose(bodies);}
});

test('empty space in a through hole does not get treated as solid by its bounding box',()=>{
 const plate={...defaults,id:'plate',width:30,height:30,depth:10},hole={...defaults,id:'hole',profile:'circle',diameter:12,z:10,depth:-10,operation:'cut',target:'plate'};
 const bodies=rebuild([plate,hole]),f={...defaults,width:4,height:4};try{assert.equal(outwardExtrusion(f,bodies),f);}finally{dispose(bodies);}
 assert.equal(outwardExtrusion(f,new Map()),f);
});
