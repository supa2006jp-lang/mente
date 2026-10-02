import assert from 'node:assert/strict';
import * as THREE from 'three';
import {defaults,rebuild} from '../src/geometry.js';
import {bodyEdges} from '../src/body-edges.js';
import {arcEdges} from '../src/arc-edges.js';
import {rangeEdgeHits} from '../src/selection-filter.js';
import {edgeFilletReferences} from '../src/edge-references.js';
const cylinder={...defaults,id:'c',profile:'circle',diameter:20,depth:10};
const cut={...defaults,id:'cut',width:20,height:30,depth:10,x:10,operation:'cut',target:'c'};
const edges=bodyEdges(rebuild([cylinder,cut]).get('c').geometry),arcs=[...new Set(edges.userData.arcEdges.values())];
assert.equal(arcs.length,2);assert.equal(edges.userData.circularEdges.size,0);
for(const arc of arcs){assert.ok(Math.abs(arc.radius-10)<.001);assert.ok(Math.abs(arc.length-10*Math.PI)<.001);assert.equal(arc.points.length,65);assert.ok(Math.abs(arc.points[0][0])<1e-4);assert.ok(Math.abs(arc.points.at(-1)[0])<1e-4);}
const attr=edges.attributes.position;
for(let i=0;i<attr.count;i+=2)if(Math.abs(attr.getX(i))<1e-4&&Math.abs(attr.getX(i+1))<1e-4)assert.equal(edges.userData.arcEdges.has(i),false,'cut plane and vertical edges stay separate');
for(const offset of [-3,3,7]){const g=bodyEdges(rebuild([cylinder,{...cut,x:10+offset}]).get('c').geometry),values=[...new Set(g.userData.arcEdges.values())];assert.equal(values.length,2,'off-center cut keeps both arcs');for(const a of values){assert.ok(Math.abs(a.points[0][0]-offset)<1e-4);assert.ok(Math.abs(a.points.at(-1)[0]-offset)<1e-4);assert.ok(Math.abs(a.radius-10)<.001);assert.ok(Math.abs(a.length-10*(2*Math.PI-2*Math.acos(offset/10)))<.01);}}
const outline=(from,to,n=64,ellipse=false)=>Array.from({length:n},(_,i)=>{const a=from+(to-from)*i/n,b=from+(to-from)*(i+1)/n;return [10*Math.cos(a)*(ellipse?2:1),10*Math.sin(a),0,10*Math.cos(b)*(ellipse?2:1),10*Math.sin(b),0];}).flat();
const geometry=positions=>new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
const separated=arcEdges(geometry([...outline(0,Math.PI/2,32),...outline(Math.PI,Math.PI*1.5,32)]));assert.equal(new Set(separated.values()).size,2,'disconnected arcs on one circle are distinct');
assert.equal(arcEdges(geometry(outline(0,Math.PI,64,true))).size,0,'ellipse cannot be reported as a circular arc');
assert.equal(bodyEdges(new THREE.BoxGeometry(30,30,10)).userData.arcEdges.size,0);
assert.equal(bodyEdges(rebuild([cylinder]).get('c').geometry).userData.arcEdges.size,0,'full circles keep existing circular selection');
const mesh=new THREE.Mesh();mesh.userData.bodyId='c';mesh.add(new THREE.LineSegments(edges));const camera=new THREE.OrthographicCamera(-20,20,20,-20,.1,100);camera.position.set(0,0,50);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
const hits=rangeEdgeHits([mesh],camera,400,400,{left:50,right:210,top:90,bottom:310,crossing:false});assert.equal(hits.filter(h=>h.arc).length,2,'range selection returns each complete arc once');
const partial=rangeEdgeHits([mesh],camera,400,400,{left:95,right:105,top:195,bottom:205,crossing:false});assert.equal(partial.filter(h=>h.arc).length,0,'enclosing only one chord must not select a whole arc');
const crossing=rangeEdgeHits([mesh],camera,400,400,{left:95,right:105,top:195,bottom:205,crossing:true});assert.equal(crossing.filter(h=>h.arc).length,2,'crossing selection selects the touched whole arc');
const refs=edgeFilletReferences([{bodyId:'c',point:[-10,0,10],arc:arcs[1]}]);assert.equal(refs.length,64);assert.ok(refs.every(e=>e.bodyId==='c'));assert.ok(refs.every(e=>e.point[0]<=0));
console.log('PASS half-circle whole rims, straight cut edges, separate arcs, ellipse rejection, range selection and full arc fillet references');
