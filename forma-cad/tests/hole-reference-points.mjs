import assert from 'node:assert/strict';
import {defaults,rebuild} from '../src/geometry.js';
import {bodyEdges} from '../src/body-edges.js';
import {solidReferencePoints} from '../src/reference-points.js';
for(const depth of [-5,-20]){
 const g=rebuild([{...defaults,id:'b',width:60,height:40,depth:20},{...defaults,id:'h',profile:'circle',diameter:10,x:10,z:20,depth,operation:'cut',target:'b'}]).get('b').geometry;
 const refs=solidReferencePoints(g,bodyEdges(g));
 const midpoint=refs.filter(r=>r.kind==='midpoint');assert.ok(midpoint.length>=12);
 for(const r of midpoint){const [x,y,z]=r.point;const boundary=[Math.abs(Math.abs(x)-30)<1e-3,Math.abs(Math.abs(y)-20)<1e-3,Math.abs(z)<1e-3||Math.abs(z-20)<1e-3];assert.ok(boundary.filter(Boolean).length>=2,'Midpoint on curved wall or rim: '+r.point);}
 assert.ok(refs.filter(r=>r.kind==='center').length<=7,'Facet centers remain');
 console.log('PASS no curved wall or rim midpoints',depth,refs.length);
}
