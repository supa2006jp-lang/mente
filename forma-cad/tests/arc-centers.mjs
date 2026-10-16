import assert from 'node:assert/strict';
import * as THREE from 'three';
import {defaults,rebuild} from '../src/geometry.js';
import {bodyEdges} from '../src/body-edges.js';
import {arcCenters} from '../src/arc-centers.js';
import {solidReferencePoints} from '../src/reference-points.js';

const centerDistance=(ref,point)=>new THREE.Vector3(...ref.point).distanceTo(new THREE.Vector3(...point));
const base={...defaults,id:'body',profile:'circle',diameter:30,depth:20,x:10};
const tab={...defaults,id:'tab',operation:'join',target:'body',width:10,height:30,depth:20,x:10,y:20};
const joined=rebuild([base,tab]).get('body').geometry;
const joinedCenters=arcCenters(bodyEdges(joined));
for(const z of [0,20])assert.ok(joinedCenters.some(ref=>centerDistance(ref,[10,0,z])<.02),`joined circle and rectangular tab must recover the circular center at z=${z}: ${JSON.stringify(joinedCenters)}`);
assert.ok(joinedCenters.every(ref=>ref.kind==='center'&&ref.name==='円・円弧'));
const refs=solidReferencePoints(joined,bodyEdges(joined));
const topFace=refs.find(ref=>ref.name==='ソリッド面'&&Math.abs(ref.point[2]-20)<.01);
assert.ok(topFace,'the combined body still has a planar top face');
assert.ok(centerDistance(topFace,[10,0,20])>1,'area centroid must differ from the original circle center');
for(const z of [0,20])assert.ok(refs.some(ref=>ref.name==='円・円弧'&&centerDistance(ref,[10,0,z])<.02),`solid reference points must expose the analytic circle center at z=${z}`);

const box=bodyEdges(new THREE.BoxGeometry(20,20,8));
assert.equal(arcCenters(box).length,0,'straight box corners must not create false circular centers');
const oval=bodyEdges(new THREE.CylinderGeometry(10,10,8,128).scale(2,1,1));
assert.equal(arcCenters(oval).length,0,'an elliptic rim must not create circular center markers');

function sampledEdges(point,count=256){const values=[];for(let i=0;i<count;i++)values.push(...point(i/count),...point((i+1)/count));return new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(values,3));}
const helix=sampledEdges(t=>{const a=t*Math.PI*8;return [5*Math.cos(a),5*Math.sin(a),t*6];},1024);
assert.equal(arcCenters(helix).length,0,'thread helices must not expose hundreds of false local circle centers');
const spiral=sampledEdges(t=>{const a=t*Math.PI*2,r=4+t*.8;return [r*Math.cos(a),r*Math.sin(a),0];});
assert.equal(arcCenters(spiral).length,0,'a planar thread end spiral must not be mistaken for circular arcs');
const actualArc=sampledEdges(t=>{const a=t*Math.PI*1.3;return [7+5*Math.cos(a),3,9+5*Math.sin(a)];});
const actualCenters=arcCenters(actualArc);
assert.equal(actualCenters.length,1,'a genuine arc still has one center');
assert.ok(centerDistance(actualCenters[0],[7,3,9])<.001);

console.log('PASS joined and tilted circle/arc centers; no box, ellipse, helix or spiral false positives');
