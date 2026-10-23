import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {channelSketch} from '../src/channel-sketch.js';
import {defaults,validateProject,makeSketchGeometry} from '../src/geometry.js';
import {findRegions,planeCoordinates} from '../src/regions.js';
import {basisFor} from '../src/frames.js';
import {sketchSegments,deleteSketchSelection,offsetSketchSelection} from '../src/sketch-selection.js';
import {connectedSketchSources} from '../src/connected-sketch-mirror.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`),frame={u:[0,1,0],v:[-Math.SQRT1_2,0,Math.SQRT1_2],n:[Math.SQRT1_2,0,Math.SQRT1_2]};
for(const plane of ['XY','XZ','YZ','CUSTOM'])for(const angle of [0,37])for(const opening of ['left','right','up','down']){
 const source={...defaults,id:'u',name:'コの字',kind:'sketch',width:40,height:30,x:10,y:-20,z:30,angle,plane,...(plane==='CUSTOM'?{frame}:{})},snapshot=structuredClone(source),f=channelSketch(source,opening);assert.deepEqual(source,snapshot);assert.equal(f.closed,false);assert.equal(f.profile,'polyline');assert.equal(f.points.length,4);assert.equal(findRegions([f]).length,0);const segments=sketchSegments(f);assert.equal(segments.length,3);for(let i=0;i<2;i++)close(segments[i].b.distanceTo(segments[i+1].a),0);close(segments[0].a.distanceTo(segments.at(-1).b),['left','right'].includes(opening)?30:40);
 const o=planeCoordinates(f),b=basisFor(f),g=makeSketchGeometry(f);try{const p=g.attributes.position;assert.equal(p.count,4);for(let i=0;i<p.count;i++){const a=[p.getX(i),p.getY(i),p.getZ(i)];close(a.reduce((sum,v,k)=>sum+v*b.n.toArray()[k],0),o.offset);}}finally{g.dispose();}
 const loaded=validateProject(JSON.parse(JSON.stringify({format:'forma-cad',version:1,features:[f]})));assert.deepEqual(loaded[0].points,f.points);const end=[f.points.at(-1),f.points[0]],closing={...f,id:'close',name:'閉じる線',points:end};assert.equal(findRegions([f,closing]).length,1);const remaining=deleteSketchSelection([f],new Map([['u',new Set([1])]]));assert.equal(remaining.length,2);assert.ok(remaining.every(f=>!f.closed));
 const linked={...f,id:'next',points:[f.points.at(-1),[f.points.at(-1)[0]+10,f.points.at(-1)[1]+5]]};assert.equal(connectedSketchSources([f,linked],{featureId:'u',index:0}).sources.length,2);
 const offset=offsetSketchSelection([f],new Map([['u',new Set([0,1,2])]]),1,{closeEnds:true});assert.ok(offset.length);assert.ok(findRegions(offset).length);
}
assert.throws(()=>channelSketch({...defaults},'bad'),/開く向き/);
await fs.mkdir('outputs/channel-sketch',{recursive:true});await fs.writeFile('outputs/channel-sketch/geometry-proof.json',JSON.stringify({threeConnectedLines:true,openEnds:true,noFaceOrWall:true,fourOpenings:true,dimensions:true,planesAndRotation:true,saveReload:true,editableSegments:true,connectedSelection:true,offsetClosure:true,sourcePreserved:true,errors:[]},null,2));console.log('PASS channel sketch: 3 open connected segments, directions, dimensions, frames/rotation, save/reload, normal line editing/selection/offset');
