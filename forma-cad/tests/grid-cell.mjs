import assert from 'node:assert/strict';
import {faceGridCellRegions as cells} from '../src/grid-cell.js';
import {regionContains} from '../src/regions.js';
const face={plane:'XY',offset:20,bodyId:'source',cadFace:4,outer:[[-12.5,-12.5],[12.5,-12.5],[12.5,12.5],[-12.5,12.5]],holes:[]};
const area=rs=>rs.reduce((s,r)=>s+r.area,0);
assert.equal(area(cells(face,[5,5],10)),100);
assert.equal(area(cells(face,[11,11],10)),6.25);
assert.equal(area(cells(face,[-11,-11],10)),6.25);
assert.deepEqual(cells(face,[25,25],10),[]);
const holed={...face,outer:[[0,0],[20,0],[20,20],[0,20]],holes:[[[2,2],[8,2],[8,8],[2,8]]]};
let rs=cells(holed,[1,1],10);assert.equal(area(rs),64);assert.equal(rs[0].holes.length,1);assert.ok(!regionContains(rs[0],[5,5]));
rs=cells({...holed,holes:[[[4,-1],[6,-1],[6,11],[4,11]]]},[1,1],10);assert.equal(area(rs),80);assert.equal(rs.length,2,'slot leaves two disconnected pieces');
assert.equal(area(cells(face,[35,35],10,{patches:[{u:[20,40],v:[20,40]}]})),100);
assert.equal(area(cells(face,[49,49],10,{mode:'100'})),100);
assert.equal(area(cells(face,[51,51],10,{mode:'100'})),0);
assert.equal(area(cells(face,[99,99],10,{mode:'200'})),100);
assert.equal(area(cells(face,[500,500],10,{mode:'unlimited'})),100);
for(const r of cells(face,[11,11],10)){assert.equal(r.offset,20);assert.equal(r.bodyId,undefined);assert.equal(r.cadFace,undefined);}
console.log('PASS grid cell clipping, negative coordinates, holes, disconnected pieces, local patches and fixed scopes');

const THREE=await import('three'),{gridCellOccluders}=await import('../src/grid-cell-occlusion.js'),{defaults,makeGeometry}=await import('../src/geometry.js');
const camera=new THREE.OrthographicCamera(-50,50,50,-50,.1,1000);camera.position.set(0,0,100);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
const blocker=new THREE.Mesh(makeGeometry({...defaults,kind:'extrusion',profile:'region',region:{plane:'XY',offset:25,outer:[[0,0],[10,0],[0,10]],holes:[],area:50,sourceIds:[]},depth:8}),new THREE.MeshBasicMaterial());
const visible=()=>cells(face,[8,8],10,{occluders:gridCellOccluders(face,[8,8],10,[blocker],camera)});
assert.equal(area(visible()),50,'diagonal solid shadow is removed from one cell');assert.ok(!regionContains(visible()[0],[2,2]));assert.ok(regionContains(visible()[0],[8,8]));
blocker.visible=false;assert.equal(area(visible()),100);blocker.visible=true;blocker.material.depthWrite=false;assert.equal(area(visible()),100);blocker.material.depthWrite=true;blocker.position.z=-20;assert.equal(area(visible()),100,'behind-plane solid cannot erase visible grid');blocker.position.z=-10;assert.equal(area(visible()),50,'solid crossing the sketch plane clips the same diagonal boundary');blocker.position.z=0;
const support=new THREE.Mesh(makeGeometry({...defaults,kind:'extrusion',width:25,height:25,depth:20}),new THREE.MeshBasicMaterial());assert.equal(area(cells(face,[5,5],10,{occluders:gridCellOccluders(face,[5,5],10,[support],camera)})),100,'supporting source face stays available');camera.position.set(0,0,-100);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);assert.equal(area(cells(face,[5,5],10,{occluders:gridCellOccluders(face,[5,5],10,[support],camera)})),0,'back face hides entire cell');

const frame={u:[Math.SQRT1_2,0,-Math.SQRT1_2],v:[0,1,0],n:[Math.SQRT1_2,0,Math.SQRT1_2]},rotation=new THREE.Matrix4().makeBasis(new THREE.Vector3(...frame.u),new THREE.Vector3(...frame.v),new THREE.Vector3(...frame.n));blocker.geometry.applyMatrix4(rotation);camera.position.fromArray(frame.n).multiplyScalar(100);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);assert.equal(area(cells({...face,plane:'CUSTOM',frame},[8,8],10,{occluders:gridCellOccluders({...face,plane:'CUSTOM',frame},[8,8],10,[blocker],camera)})),50,'tilted grid clips in its own coordinates');
const projectedBox=new THREE.Mesh(makeGeometry({...defaults,kind:'extrusion',width:10,height:10,depth:10,x:20,y:5,z:10}),new THREE.MeshBasicMaterial());camera.position.set(100,0,100);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);const flat={...face,offset:0};assert.equal(area(cells(flat,[8,8],10,{occluders:gridCellOccluders(flat,[8,8],10,[projectedBox],camera)})),0,'oblique camera hides a cell even when the solid does not intersect its plane');projectedBox.geometry.dispose();projectedBox.material.dispose();
for(const mesh of [blocker,support]){mesh.geometry.dispose();mesh.material.dispose();}console.log('PASS diagonal partial solid occlusion, hidden/transparent/rear solids, coplanar support and fully hidden cells');
