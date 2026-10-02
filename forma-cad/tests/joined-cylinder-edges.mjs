import assert from 'node:assert/strict';
import {defaults,rebuild,volume} from '../src/geometry.js';
import {bodyEdges} from '../src/body-edges.js';
import {planarFace} from '../src/frames.js';
const base={...defaults,id:'body',profile:'circle',diameter:20,depth:20};
const features=[base];
for(let step=1;step<=2;step++){
 const previous=rebuild(features).get('body').geometry,p=previous.attributes.position,ix=previous.index,at=i=>ix?ix.getX(i):i;
 let top=-1;for(let i=0;i<(ix?.count??p.count);i+=3)if([0,1,2].every(j=>Math.abs(p.getZ(at(i+j))-20*step)<1e-5)){top=i/3;break;}
 assert.ok(top>=0);const region=planarFace(previous,top);
 features.push({...defaults,id:'join'+step,profile:'region',plane:'CUSTOM',frame:region.frame,region,depth:20,operation:'join',target:'body'});
 const g=rebuild(features).get('body').geometry,e=bodyEdges(g).attributes.position;
 assert.ok(e.count>=256,'Both circular rims remain');
 for(let i=0;i<e.count;i+=2){assert.ok(Math.abs(e.getZ(i)-e.getZ(i+1))<1e-4,'No vertical or diagonal facet seams');assert.ok(Math.abs(e.getZ(i))<1e-4||Math.abs(e.getZ(i)-20*(step+1))<1e-4,'No internal join seam');}
 const polygonArea=128/2*100*Math.sin(2*Math.PI/128);
 assert.ok(Math.abs(volume(g)-polygonArea*20*(step+1))<.1,'Solid volume retained');
}
const box=bodyEdges(rebuild([{...defaults,id:'box'}]).get('box').geometry);
assert.equal(box.attributes.position.count,24,'All twelve sharp box edges remain');
console.log('PASS repeated face extrusion: no cylinder seams, rims, sharp edges and volume retained');
