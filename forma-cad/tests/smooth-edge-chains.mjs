import assert from 'node:assert/strict';
import * as THREE from 'three';
import {smoothEdgeChains} from '../src/smooth-edge-chains.js';
import {screenEdgeCandidates,selectionCandidates,edgeCandidateKey} from '../src/selection-candidates.js';
import {edgeFilletReferences} from '../src/edge-references.js';
import {edgeTurnFrame} from '../src/edge-quarter-turn.js';
import {rangeEdgeHits} from '../src/selection-filter.js';

function make(paths){
 const geometry=new THREE.BufferGeometry(),positions=[],arcs=new Map();
 for(const [path,{points,curved=true}] of paths.entries())for(let i=0;i<points.length-1;i++){
  const index=positions.length/3;positions.push(...points[i],...points[i+1]);
  if(curved){const part=Math.floor(i/8),key=path+':'+part;let arc=[...arcs.values()].find(a=>a.key===key);if(!arc)arc={points:points.slice(part*8,Math.min(points.length,part*8+9)),key};arcs.set(index,arc);}
 }
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.userData.arcEdges=arcs;return geometry;
}
const helix=Array.from({length:513},(_,i)=>[5*Math.cos(i*Math.PI/32),5*Math.sin(i*Math.PI/32),i/64]),g=make([{points:helix}]),before=Array.from(g.attributes.position.array),chains=smoothEdgeChains(g),curve=chains.get(0);
assert.equal(new Set(chains.values()).size,1,'64 artificial arc pieces form one continuous helix');
assert.equal(chains.size,512);assert.equal(curve.points.length,513);assert.ok(curve.length>250);assert.equal(curve.closed,false);assert.equal(smoothEdgeChains(g),chains,'grouping is cached, not repeated per click');assert.deepEqual(Array.from(g.attributes.position.array),before,'display/export geometry is unchanged');
const near=helix.map(p=>[p[0],p[1],p[2]+.3]),separate=make([{points:helix},{points:near}]);assert.equal(new Set(smoothEdgeChains(separate).values()).size,2,'nearby parallel helices remain separate');
const end=helix.at(-1),withLine=make([{points:helix},{points:[end,[end[0]+3,end[1],end[2]]],curved:false}]);assert.equal(smoothEdgeChains(withLine).has(1024),false,'a real line touching the curve remains independent');
const sharp=make([{points:helix},{points:Array.from({length:17},(_,i)=>[end[0]+i/10,end[1],end[2]])}]);assert.equal(smoothEdgeChains(sharp).get(0).points.length,513,'sharp joins do not merge curves');
const planar=make([{points:Array.from({length:33},(_,i)=>[5*Math.cos(i*Math.PI/64),5*Math.sin(i*Math.PI/64),0])}]);assert.equal(smoothEdgeChains(planar).size,0,'genuine planar arc boundaries keep their radius and independent selection');
const camera=new THREE.OrthographicCamera(-8,8,8,-8,.1,100);camera.position.set(0,-30,8);camera.lookAt(0,0,4);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
const mesh=new THREE.Mesh(new THREE.BufferGeometry());mesh.userData.bodyId='helix';mesh.add(new THREE.LineSegments(g));const p=new THREE.Vector3(0,-5,4).project(camera),hits=screenEdgeCandidates([mesh],camera,800,800,(p.x+1)*400,(1-p.y)*400,30),options=selectionCandidates([],hits,{mode:'edge'});
assert.ok(hits.length>1,'raw hits remain available for visible-edge picking behind other bodies');assert.equal(options.length,1,'many projected chords offer only one logical curve candidate');assert.match(options[0].label,/曲線 1/);assert.equal(options[0].key,edgeCandidateKey(hits[0]));assert.equal(hits[0].arc,undefined,'a non-planar curve is not mislabelled as a circular arc');
assert.equal(rangeEdgeHits([mesh],camera,800,800,{left:0,right:800,top:0,bottom:800,crossing:false}).length,1,'window selection uses the same complete curve');
assert.equal(rangeEdgeHits([mesh],camera,800,800,{left:0,right:400,top:0,bottom:800,crossing:false}).length,0,'window selection must contain the entire curve');
assert.equal(rangeEdgeHits([mesh],camera,800,800,{left:0,right:400,top:0,bottom:800,crossing:true}).length,1,'crossing selection does not duplicate curve pieces');
const references=edgeFilletReferences([{bodyId:'helix',curve,point:hits[0].point.toArray()}]);assert.equal(references.length,512,'fillet/chamfer references cover the complete selected curve');assert.deepEqual(references[0].a,curve.points[0]);assert.deepEqual(references.at(-1).b,curve.points.at(-1));assert.throws(()=>edgeTurnFrame({curve,a:helix[0],b:end}),/直線/,'a helix cannot become a bogus straight rotation axis');
const branch=make([{points:helix},{points:[helix[256],[8,0,4]],curved:false}]);assert.equal(new Set(smoothEdgeChains(branch).values()).size,2,'an actual branch splits the chain');
for(const geometry of [g,separate,withLine,sharp,planar,branch,mesh.geometry])geometry.dispose();mesh.material.dispose();mesh.children[0].material.dispose();
console.log('PASS one logical helix candidate, full path/reference selection, genuine lines/corners/branches and nearby curves preserved, cache and geometry unchanged');
