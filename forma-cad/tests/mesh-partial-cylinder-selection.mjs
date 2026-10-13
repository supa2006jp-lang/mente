import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {defaults,rebuild,validateProject} from '../src/geometry.js';
import {findRegions} from '../src/regions.js';
import {cadFaceGroup,cadFaceGeometry,cadFaceKey,isFaceSelected} from '../src/face-selection.js';
import {cylindricalSelection} from '../src/cylindrical-selection.js';
import {selectionCandidates} from '../src/selection-candidates.js';

const sketches=[{...defaults,id:'circle',name:'円',kind:'sketch',profile:'circle',diameter:60},{...defaults,id:'line',name:'斜めの分割線',kind:'sketch',profile:'line',mode:'thin',width:89.81,angle:47.99,x:-2.04,y:3.35}];
const regions=findRegions(sketches),features=[...sketches,...regions.map((region,i)=>({...defaults,id:'part-'+i,kind:'extrusion',name:'部分押し出し',profile:'region',region,depth:i?10:30}))];
assert.equal(regions.length,2);
function check(source){
 for(const [id,mesh] of rebuild(source)){
  mesh.userData.bodyId=id;const geometry=mesh.geometry,p=geometry.attributes.position,index=geometry.index;
  assert.equal(geometry.userData.faceGroups,undefined,'plain sketch extrusion has no CAD face metadata');
  assert.equal(geometry.userData.circularWalls.length,0,'partial circle has no complete-circle recipe');
  const keys=new Set();let sideTriangles=0,flatTriangles=0;
  for(let i=0;i<(index?.count??p.count);i+=3){
   const points=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,index?index.getX(i+j):i+j)),normal=points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])).normalize(),point=points.reduce((sum,v)=>sum.add(v),new THREE.Vector3()).divideScalar(3),radial=new THREE.Vector3(point.x,point.y,0).normalize();
   const curved=Math.abs(normal.z)<.001&&normal.dot(radial)>.98,group=cadFaceGroup(geometry,i/3);
   if(!curved){assert.equal(group,undefined,'flat cut and caps keep their planar selection');flatTriangles++;continue;}
   assert.ok(group?.cylinder,'every chord, including clipped ends, selects the cylinder');
   assert.ok(Math.abs(group.cylinder.radius-30)<.001);assert.equal(group.cylinder.internal,false);
   const key=cadFaceKey(id,group);keys.add(key);sideTriangles++;
   const hit={object:mesh,faceIndex:i/3,point,face:{normal}};
   assert.equal(selectionCandidates([hit],[],{mode:'face',features:source})[0].label.split(' — ')[0],'曲面');
   assert.ok(isFaceSelected([{key,bodyId:id}],hit));
   const selection=cylindricalSelection(source,id,geometry,i/3,point),highlight=cadFaceGeometry(geometry,group);assert.equal(selection.geometry.attributes.position.count,highlight.attributes.position.count);selection.geometry.dispose();highlight.dispose();
  }
  assert.equal(keys.size,1);assert.ok(sideTriangles>100);assert.ok(flatTriangles>2);assert.equal(geometry.userData.faceGroups,undefined,'selection does not invent CAD topology');geometry.dispose();
 }
}
check(features);check(validateProject(JSON.parse(JSON.stringify({format:'forma-cad',version:1,features}))));
// This check can also run directly against a reported saved project.
if(process.argv[2])check(validateProject(JSON.parse(await fs.readFile(process.argv[2],'utf8'))));
for(const n of [6,128]){
 const f={...defaults,id:'guard',kind:'extrusion',profile:'polyline',closed:true,points:Array.from({length:n},(_,i)=>[30*Math.cos(i*2*Math.PI/n)*(n===128?1.5:1),30*Math.sin(i*2*Math.PI/n)]),depth:30},g=rebuild([f]).get('guard').geometry;
 for(let i=0;i<g.attributes.position.count/3;i++)assert.equal(cadFaceGroup(g,i),undefined,'polygon and ellipse remain separate planar patches');g.dispose();
}
await fs.writeFile('outputs/cylinder-selection/mesh-partial-cylinder.forma.json',JSON.stringify({format:'forma-cad',version:1,features}));
console.log('PASS mesh-only partial circles: oblique clipped endpoints, both regions, every side triangle, stable selection/candidates/highlight, save/reload and polygon/ellipse guards');
