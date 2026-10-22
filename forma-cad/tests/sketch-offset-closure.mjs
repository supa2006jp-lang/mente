import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {defaults,validateProject,validateFeature,makeGeometry,volume} from '../src/geometry.js';
import {offsetSketch} from '../src/sketch-offset.js';
import {offsetSketchSelection,sketchSegments} from '../src/sketch-selection.js';
import {offsetConnectedSketches} from '../src/sketch-offset-closure.js';
import {findRegions,sketchPoints,planeCoordinates} from '../src/regions.js';
import {basisFor,worldPoint} from '../src/frames.js';
const close=(a,b,t=1e-5)=>assert.ok(Math.abs(a-b)<t,`${a} ≠ ${b}`),base={...defaults,id:'line',name:'線',kind:'sketch',profile:'line',mode:'thin',width:20,groupId:'g',groupNumber:1},opts={closeEnds:true};
function enclosed(copies,expected){assert.ok(copies.every(f=>f.closed));copies.forEach(validateFeature);const rs=findRegions(copies);assert.ok(rs.length);close(rs.reduce((s,r)=>s+r.area,0),expected);for(const r of rs){const g=makeGeometry({...defaults,kind:'extrusion',profile:'region',region:r,plane:r.plane,frame:r.frame,depth:3});try{close(volume(g),r.area*3,.002);}finally{g.dispose();}}return rs;}
const before=structuredClone(base);for(const d of [2,-2]){const copies=offsetSketch(base,d,opts);assert.equal(copies.length,1);assert.equal(copies[0].points.length,4);enclosed(copies,40);assert.deepEqual(copies[0].points.slice(0,2),sketchPoints(base));assert.deepEqual(base,before);}
assert.equal(offsetSketch(base,2)[0].closed,false);assert.equal(offsetSketch(base,2,{closeEnds:false})[0].closed,false);
const l={...base,profile:'polyline',points:[[0,0],[20,0],[20,10]],closed:false};enclosed(offsetSketch(l,2,opts),56);enclosed(offsetSketch(l,-2,opts),64);
const chain=[{...l,id:'a',points:[[0,0],[20,0]]},{...l,id:'b',points:[[20,10],[20,0]]}],selection=new Map(chain.map(f=>[f.id,new Set([0])])),snapshot=structuredClone(chain);
const connected=offsetSketchSelection(chain,selection,2,opts);assert.equal(connected.length,1);assert.equal(connected[0].points.length,6);enclosed(connected,56);assert.deepEqual(chain,snapshot);
const apart=[base,{...base,id:'apart',y:15}],apartOutput=offsetSketchSelection(apart,new Map(apart.map(f=>[f.id,new Set([0])])),2,opts);assert.equal(apartOutput.length,2);enclosed(apartOutput,80);assert.equal(findRegions(apartOutput).length,2);
const rect={...base,id:'rect',profile:'rect',height:10};enclosed(offsetSketchSelection([rect],new Map([['rect',new Set([0])]]),2,opts),40);assert.deepEqual(offsetSketch(rect,2,opts).map(f=>f.points),offsetSketch(rect,2).map(f=>f.points));
const frame={u:[Math.SQRT1_2,0,-Math.SQRT1_2],v:[0,1,0],n:[Math.SQRT1_2,0,Math.SQRT1_2]};
for(const plane of ['XY','XZ','YZ','CUSTOM']){const f={...base,plane,x:101.123456789,y:3,z:7,angle:31,...(plane==='CUSTOM'?{frame}:{})},copies=offsetSketch(f,2,opts);enclosed(copies,40);const b=basisFor(f),o=planeCoordinates(f);for(const p of copies[0].points)close(worldPoint({...f,offset:o.offset},p).dot(b.n),o.offset);}
const reversed={...base,id:'reverse',plane:'CUSTOM',frame:{u:[-1,0,0],v:[0,1,0],n:[0,0,-1]},profile:'polyline',points:[[-20,0],[-30,0]],closed:false},first={...l,id:'first',points:[[0,0],[20,0]]};enclosed(offsetConnectedSketches([first,reversed],2,opts),60);
const otherPlane={...chain[1],id:'above',z:5};assert.equal(offsetConnectedSketches([chain[0],otherPlane],2,opts).length,2);
const branch={...chain[0],id:'branch',points:[[20,0],[30,-10]]};assert.throws(()=>offsetConnectedSketches([...chain,branch],2,opts),/分岐/);
const circle={...base,profile:'circle',diameter:20};assert.equal(offsetSketch(circle,2,opts)[0].diameter,24);
const curve={...base,profile:'spline',points:[[0,0],[10,8],[20,0]],closed:false};const curved=offsetSketch(curve,1,opts);assert.ok(findRegions(curved).length);assert.equal(curved[0].closed,true);
const saved=JSON.parse(JSON.stringify({format:'forma-cad',version:1,features:[base,...offsetSketch(base,2,opts)]}));validateProject(saved);enclosed(saved.features.slice(1),40);assert.equal(sketchSegments(saved.features[1]).length,4);
await fs.mkdir('outputs/sketch-offset-closure',{recursive:true});const proof={straightCaps:true,signedDistances:true,connectedSegments:true,partialEdges:true,disconnectedPaths:true,allPlanesAndRotation:true,reversedFrames:true,sourcePreserved:true,closedProfilesUnchanged:true,curves:true,branchGuard:true,extrusionVolume:true,saveReload:true,optOut:true,errors:[]};await fs.writeFile('outputs/sketch-offset-closure/geometry-proof.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
