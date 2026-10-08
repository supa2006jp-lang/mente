import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {defaults,rebuild} from '../src/geometry.js';
import {planarFace} from '../src/frames.js';
import {extrusionIntersections,extrusionCutMatches} from '../src/extrusion-auto-cut.js';
import {gridCellOccluders} from '../src/grid-cell-occlusion.js';
import {faceGridCellRegions} from '../src/grid-cell.js';
import {outwardExtrusion} from '../src/extrusion-direction.js';

test('押し出し形状が重なるボディだけ切り取り候補にする',()=>{
 const inside=new THREE.Mesh(new THREE.BoxGeometry(20,20,10));
 inside.position.z=5;inside.updateMatrixWorld(true);
 const far=new THREE.Mesh(new THREE.BoxGeometry(20,20,10));
 far.position.set(40,0,5);far.updateMatrixWorld(true);
 const bodies=new Map([['inside',inside],['far',far]]);
 const feature={...defaults,width:4,height:4,z:10,depth:-6};
 const hit=extrusionIntersections(feature,bodies);
 assert.deepEqual(hit.map(entry=>entry.id),['inside']);
 assert.ok(Math.abs(hit[0].volume-96)<1);
 assert.deepEqual(extrusionIntersections({...feature,depth:6},bodies),[]);
 inside.geometry.dispose();far.geometry.dispose();
});
test('穴付き面から外向きに押し出す場合は通常・薄いとも接触を切り取りとみなさない',()=>{
 const plate={...defaults,id:'plate',width:30,height:30,depth:2};
 const hole={...defaults,id:'hole',profile:'circle',diameter:10,z:2,depth:-2,operation:'cut',target:'plate'};
 const geometry=rebuild([plate,hole]).get('plate').geometry,positions=geometry.attributes.position,index=geometry.index;
 let triangle=-1;
 for(let i=0;i<(index?.count??positions.count);i+=3){
  const ids=[0,1,2].map(j=>index?index.getX(i+j):i+j);
  if(ids.every(j=>Math.abs(positions.getZ(j)-2)<1e-5)){triangle=i/3;break;}
 }
 assert.ok(triangle>=0);
 const face=planarFace(geometry,triangle);
 assert.equal(face.holes.length,1);
 const mesh=new THREE.Mesh(geometry);mesh.updateMatrixWorld(true);
 for(const mode of ['solid','thin']){
  const feature={...defaults,profile:'region',region:face,plane:face.plane,frame:face.frame,mode,depth:2,z:2,operation:'join',target:'plate'};
  assert.deepEqual(extrusionIntersections(feature,new Map([['plate',mesh]])),[]);
 }
 geometry.dispose();
});
test('grid boundary slivers cannot switch outward source contact to cut or reverse its frame',()=>{
 const base={...defaults,id:'base',width:80,height:60,depth:20},slope=.81234,c=-.00001;
 const region={plane:'XY',offset:20,outer:[[-35,-35*slope+c],[35,35*slope+c],[35,35*slope+c+3],[-35,-35*slope+c+3]],holes:[],area:210,sourceIds:[]},ridge={...defaults,id:'ridge',profile:'region',region,depth:5,operation:'join',target:'base'};
 const bodies=rebuild([base,ridge]),face={plane:'XY',offset:20,outer:[[-40,-30],[40,-30],[40,30],[-40,30]],holes:[],bodyId:'base'};
 try{
  const cells=faceGridCellRegions(face,[8,2],10,{occluders:gridCellOccluders(face,[8,2],10,[...bodies.values()])});let reproduced=false;
  for(const cell of cells){const feature={...defaults,profile:'region',plane:cell.plane,region:cell};assert.equal(cell.gridSourceBodyId,'base');assert.equal(cell.bodyId,undefined);assert.equal(cell.cadFace,undefined);const actual=extrusionIntersections(feature,bodies);reproduced ||= actual.some(hit=>hit.volume>1e-5&&hit.volume<.001);assert.deepEqual(extrusionCutMatches(feature,bodies),[]);assert.equal(outwardExtrusion(feature,bodies),feature);assert.ok(extrusionCutMatches({...feature,depth:-2},bodies).some(hit=>hit.id==='base'));
   const other=new THREE.Mesh(new THREE.BoxGeometry(10,10,10));other.position.set(5,5,21);other.updateMatrixWorld(true);try{assert.deepEqual(extrusionCutMatches(feature,new Map([...bodies,['other',other]])).map(hit=>hit.id),['other'],'real collisions with other bodies remain cut candidates');}finally{other.geometry.dispose();other.material.dispose();}
  }
  assert.equal(reproduced,true,'fixture reproduces the original microscopic overlap');
 }finally{for(const body of bodies.values())body.geometry.dispose();}
});
