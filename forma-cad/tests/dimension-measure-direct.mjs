import assert from 'node:assert/strict';
import * as THREE from 'three';
import {closestMeasurementSegments,measureEdgeLength,measureEdgePair} from '../src/dimension-measure-geometry.js';
import {measurementEdges} from '../src/dimension-measure-edges.js';
import {defaults} from '../src/geometry.js';
const near=(a,b)=>assert(Math.abs(a-b)<1e-7,a+' != '+b),edge=(a,b)=>({straight:true,segments:[{a,b}]}),horizontal=edge([0,0,0],[10,0,0]);
near(measureEdgeLength(edge([0,0,0],[3,4,12])).distance,13);
for(const [second,distance,angle]of [[edge([0,5,0],[10,5,0]),5,0],[edge([20,-10,0],[20,10,0]),10,90],[edge([5,-5,3],[5,5,3]),3,90],[edge([5,-5,0],[5,5,0]),0,90],[edge([10,5,0],[0,5,0]),5,0],[edge([0,0,0],[5,5,0]),0,45]]){const pair=measureEdgePair(horizontal,second);near(pair.distance,distance);near(pair.angle,angle);near(measureEdgePair(second,horizontal).distance,distance);}
near(closestMeasurementSegments({a:[2,3,4],b:[2,3,4]},{a:[0,0,0],b:[10,0,0]}).distance,5);
near(closestMeasurementSegments({a:[2,0,0],b:[2,0,0]},{a:[5,0,0],b:[5,0,0]}).distance,3);
const circle={...defaults,id:'circle',kind:'sketch',profile:'circle',diameter:20},shapes=measurementEdges([circle],[]);assert.equal(shapes.length,1);near(measureEdgeLength(shapes[0]).distance,Math.PI*20);assert.equal(measureEdgePair(shapes[0],horizontal).angle,null);assert(measureEdgePair(shapes[0],horizontal).approximate);
const geometry=new THREE.BufferGeometry().setFromPoints([[0,0,0],[4,0,0],[4,0,0],[10,0,0],[15,0,0],[20,0,0]].map(p=>new THREE.Vector3(...p))),mesh=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial()),lines=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial());mesh.userData.bodyId='body';mesh.add(lines);mesh.position.set(20,30,40);const merged=measurementEdges([], [mesh]);assert.equal(merged.length,2);near(measureEdgeLength(merged[0]).distance,10);assert.deepEqual(merged[0].segments[0].a.toArray(),[20,30,40]);near(measureEdgeLength(merged[1]).distance,5);lines.visible=false;assert.equal(measurementEdges([],[mesh]).length,0);
console.log('PASS finite 3D distance/acute angle, crossing/parallel/reversed/skew/disjoint/degenerate segments, circular length and merged/transformed visible solid edges');
