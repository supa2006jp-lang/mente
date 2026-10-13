import assert from 'node:assert/strict';
import * as THREE from 'three';
import {moveAxisCandidates,nearestMoveAxis} from '../src/move-axis-picker.js';
const camera=new THREE.OrthographicCamera(-50,50,50,-50,.1,500);camera.position.set(0,0,100);camera.lookAt(0,0,0);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
function box(x=0){const mesh=new THREE.Mesh(new THREE.BoxGeometry(20,20,10),new THREE.MeshBasicMaterial());mesh.position.set(x,0,5);const edges=new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry),new THREE.LineBasicMaterial());mesh.add(edges);mesh.updateMatrixWorld(true);return mesh;}
const mesh=box(),options={meshes:[mesh],occluders:[mesh],camera,width:500,height:500};
let candidates=moveAxisCandidates(options);assert.equal(candidates.length,4,'only the four front-facing top edges are visible from above');
for(const c of candidates){assert.equal(c.kind,'line');assert.ok(Math.abs(c.a.z-10)<1e-7&&Math.abs(c.b.z-10)<1e-7,'hidden bottom edges are not offered');const part=c.segments[0],x=(part.a.x+part.b.x)/2,y=(part.a.y+part.b.y)/2;assert.equal(nearestMoveAxis(candidates,x,y),c,'each displayed piece selects its matching axis');}
assert.equal(nearestMoveAxis(candidates,250,250),null,'a solid face interior is not an axis');
const lines=[{a:[25,-10,0],b:[25,10,0],name:'外側のスケッチ線'},{a:[0,-8,0],b:[0,8,0],name:'裏側のスケッチ線'},{a:[-30,0,0],b:[30,0,0],name:'一部隠れたスケッチ線'}],points=[{point:[0,0,0],name:'隠れた点'},{point:[25,0,0],name:'スケッチ点'},{point:[10,0,10],name:'ヒンジ軸中心',a:[10,-10,10],b:[10,10,10]}];
candidates=moveAxisCandidates({...options,lines,points});assert.ok(candidates.some(c=>c.label.includes('外側')));assert.ok(!candidates.some(c=>c.label.includes('裏側')));assert.ok(!candidates.some(c=>c.label.includes('隠れた点')));
const partial=candidates.find(c=>c.label.includes('一部隠れた'));assert.ok(partial.segments.length>1);assert.equal(nearestMoveAxis([partial],250,250),null,'the occluded portion is neither highlighted nor selectable');
const point=candidates.find(c=>c.kind==='point'&&c.ref.name==='スケッチ点');assert.equal(nearestMoveAxis(candidates,point.screen.x,point.screen.y),point,'point markers take priority over nearby lines');
const hinge=candidates.find(c=>c.kind==='point'&&c.ref.name==='ヒンジ軸中心');assert.ok(hinge.ref.a&&hinge.ref.b,'hinge markers retain their actual axis');
const edgeGeometry=mesh.children[0].geometry,p=edgeGeometry.attributes.position;for(let i=0;i<p.count;i+=2)if(p.getZ(i)===5&&p.getZ(i+1)===5){edgeGeometry.userData.arcEdges=new Map([[i,{}]]);break;}
assert.equal(moveAxisCandidates(options).length,3,'curved rim segments are not offered as straight axes');
const left=box(-25),right=box(25);assert.equal(moveAxisCandidates({meshes:[left,right],occluders:[left,right],camera,width:500,height:500}).length,8,'all selected bodies expose their own visible edges');
for(const body of [mesh,left,right]){body.geometry.dispose();body.children[0].geometry.dispose();}
console.log('PASS visible straight edges, hidden-edge/point rejection, partially occluded sketch lines, shared visible hit targets, point priority, hinge axes, curved-rim guards and multi-body candidates');
