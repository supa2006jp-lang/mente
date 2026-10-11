import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {encloseParts} from '../src/enclose.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const source=R.makeBox([0,0,0],[30,20,20]);
const bounds=[[0,0,0],[30,20,20]];
try{
 for(const thickness of [2,3])for(const [plane,offset,edges] of [['XY',10,['-X','+Y']],['XZ',10,['-X','+Z']],['YZ',15,['-Y','+Z']]])for(const edge of edges)for(const angle of [0,90]){
  const p={boxMode:true,thickness,clearance:.5,enclosureSplit:plane,splitOffset:offset,hinge:true,hingeEdge:edge,hingeRadialGap:.5,hingeAxialGap:.5,hingeAngle:angle,hardwareScale:1.3};
  const parts=encloseParts(source,p),frame=parts.hingeFrame,u=frame.axisIndex,v=frame.sideAxis,padding=thickness+p.clearance;
  try{
   const first=bounds[0][u]-padding,last=bounds[1][u]+padding;
   assert.ok(Math.abs(frame.a[u]-first)<1e-6,'fixed hinge begins at the BOX bottom in print orientation');
   assert.ok(Math.abs(frame.b[u]-last)<1e-6,'opposite hinge end also stays flush');
   const radius=Math.max(1,thickness*.55)*1.3+p.hingeRadialGap+Math.max(.9,thickness*.65)*1.3,direction=[0,0,0];direction[u]=1;
   // Probe both the pin and the outer knuckle just above each BOX end.
   // The previous 1 mm inset left all four probes empty.
   for(const end of [first+.01,last-.11])for(const radialOffset of [0,radius*.8]){
    const point=[...frame.point];point[u]=end;point[v]+=radialOffset;
    const probe=R.makeCylinder(.12,.1,point,direction),common=parts[0].intersect(probe);
    try{assert.ok(Math.abs(R.measureVolume(common)-R.measureVolume(probe))<1e-7,'pin and fixed knuckle reach the bed without a floating end');}
    finally{common.delete();probe.delete();}
   }
   for(const part of parts){const solids=part.solids;try{assert.equal(solids.length,1,'each half remains connected');}finally{solids.forEach(s=>s.delete());}}
   assert.ok(R.measureDistanceBetween(...parts)>.18,'the moving sleeve retains its clearance');
   const common=parts[0].intersect(parts[1]);try{assert.ok(R.measureVolume(common)<1e-5,'lid never intersects the body');}finally{common.delete();}
   assert.equal(frame.rimPositions[2]-frame.rimPositions[1],p.hingeAxialGap);
   assert.equal(frame.rimPositions[4]-frame.rimPositions[3],p.hingeAxialGap);
  }finally{parts.forEach(s=>s.delete());}
 }
}finally{source.delete();}
console.log('PASS fixed hinge and pin flush with BOX bed plane: 2/3 mm walls, all split planes, both hinge sides, closed/open, preserved moving gaps');
