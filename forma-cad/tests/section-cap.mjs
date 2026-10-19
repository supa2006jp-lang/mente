import assert from 'node:assert/strict';
import * as THREE from 'three';
import {sectionCap,sectionSegments} from '../src/section-view.js';

const plane=new THREE.Plane(new THREE.Vector3(0,0,1),0);
const rectangle=(x,y,width,height)=>[[x,y,0],[x+width,y,0],[x+width,y+height,0],[x,y+height,0]];
const segments=loops=>loops.flatMap(loop=>loop.flatMap((p,i)=>[...p,...loop[(i+1)%loop.length]]));
function area(g){const p=g.attributes.position,a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();let total=0;for(let i=0;i<p.count;i+=3){a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1);c.fromBufferAttribute(p,i+2);total+=b.sub(a).cross(c.sub(a)).length()/2;}return total;}
function contains(g,x,y){const mesh=new THREE.Mesh(g,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));mesh.updateMatrixWorld();const hit=new THREE.Raycaster(new THREE.Vector3(x,y,10),new THREE.Vector3(0,0,-1)).intersectObject(mesh).length>0;mesh.material.dispose();return hit;}
function check(s,expected,points=[]){const g=sectionCap(s,plane,{precision:true});assert.ok(Math.abs(area(g)-expected)<1e-4,area(g)+' != '+expected);for(const [x,y,filled]of points)assert.equal(contains(g,x,y),filled,JSON.stringify({x,y,filled}));g.dispose();}
check(segments([rectangle(0,0,10,10),rectangle(10,0,10,10)]),200,[[3,5,true],[17,5,true]]);
check(segments([rectangle(0,0,20,20),rectangle(5,5,10,10),rectangle(8,8,4,4),rectangle(30,0,3,3)]),325,[[1,1,true],[6,6,false],[10,10,true],[31,1,true],[25,1,false]]);
const rounded=segments([rectangle(0,0,10,10)]);rounded[6]=10.0000049;rounded[3]=10.0000051;check(rounded,100);
check([...segments([rectangle(0,0,10,10)]),10,10,0,15,15,0],100);
check([0,0,0,10,0,0,10,0,0,10,10,0],0);
// A near-coplanar mesh vertex must be classified once, without a second
// spurious intersection that turns the triangle into a three-point section.
const box=new THREE.BoxGeometry(20,20,20);box.rotateZ(Math.PI/2);const cut=new THREE.Plane(new THREE.Vector3(0,1,0),0),cap=sectionCap(sectionSegments(box,cut),cut);assert.ok(Math.abs(area(cap)-400)<1e-4);cap.dispose();box.dispose();
console.log('PASS shared thread seams, neighbour-cell welding, real holes/nested islands, disconnected material, open fragments and near-coplanar mesh cuts');
