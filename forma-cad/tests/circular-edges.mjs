import assert from 'node:assert/strict';
import * as THREE from 'three';
import {defaults,rebuild} from '../src/geometry.js';
import {bodyEdges} from '../src/body-edges.js';
import {featureCircularEdges} from '../src/circular-edges.js';
const box={...defaults,id:'box',name:'box',width:30,height:30,depth:10};
const hole={...defaults,id:'hole',name:'hole',profile:'circle',diameter:10,depth:-10,z:10,hole:true,operation:'cut',target:'box'};
const cylinder={...defaults,id:'c',name:'cylinder',profile:'circle',diameter:10,depth:20};
for(const features of [[cylinder],[box,hole]]){
 const [id,body]=[...rebuild(features)][0],edges=bodyEdges(body.geometry),circles=[...new Set(featureCircularEdges(features,id,edges).values())];
 assert.equal(circles.length,2,'Both circular rims must be recognized');
 for(const circle of circles){assert.ok(Math.abs(circle.length-10*Math.PI)<.001);assert.ok(Math.abs(circle.radius-5)<.0001);assert.deepEqual(circle.points[0],circle.points.at(-1));}
 console.log('PASS circular rims',features.length===1?'cylinder':'hole',circles.map(c=>c.length));
}
const rectangle=bodyEdges(new THREE.BoxGeometry(30,30,10));assert.equal(rectangle.userData.circularEdges.size,0,'Straight edges remain separate');
const oval=bodyEdges(new THREE.CylinderGeometry(5,5,10,64).scale(2,1,1));assert.equal(oval.userData.circularEdges.size,0,'Ellipses must not be reported as circles');
console.log('PASS straight edges and ellipses are not circular rims');
