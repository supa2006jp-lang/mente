import assert from 'node:assert/strict';import * as THREE from 'three';import {defaults} from '../src/geometry.js';import {trimSketch} from '../src/trim-sketch.js';import {findRegions,sketchPoints} from '../src/regions.js';
const circle={...defaults,kind:'sketch',id:'c',groupId:'g',profile:'circle',diameter:20},rect={...defaults,kind:'sketch',id:'r',groupId:'g',profile:'rect',width:10,height:10,y:10};let features=[circle,rect];
function trim(id,p){const f=features.find(f=>f.id===id);features=features.flatMap(x=>x===f?trimSketch(f,features,new THREE.Vector3(...p)):[x]);}
trim('c',[0,10,0]);assert.equal(features.length,2);assert.ok(sketchPoints(features[0]).length>90);assert.ok(sketchPoints(features[0]).every(p=>p[1]<9));assert.equal(features[0].groupId,'g');
trim('r',[0,5,0]);trim('r',[-5,6,0]);trim('r',[5,6,0]);assert.equal(findRegions(features).length,1,'trimmed circle and rectangle form one closed extrudable region');
const line={...defaults,kind:'sketch',id:'l',profile:'line',width:40};const parts=trimSketch(line,[line,circle],new THREE.Vector3(0,0,0));assert.equal(parts.length,2);assert.ok(Math.abs(parts[0].points.at(-1)[0]+10)<1e-6);assert.ok(Math.abs(parts[1].points[0][0]-10)<1e-6);
assert.equal(trimSketch(circle,[circle,{...line,z:5}],new THREE.Vector3(0,10,0)).length,0,'other planes do not split a circle');assert.equal(trimSketch(circle,[circle,{...line,groupHidden:true}],new THREE.Vector3(0,10,0)).length,0);
console.log('PASS circle arc trim, repeated rectangle trim, closed region, split straight line, group metadata and plane/visibility isolation');
