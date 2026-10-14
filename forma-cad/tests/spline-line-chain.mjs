import assert from 'node:assert/strict';
import {defaults,validateProject,volume} from '../src/geometry.js';
import {basisFor} from '../src/frames.js';
import {findRegions,regionContains,extrudeRegion} from '../src/regions.js';

for(const plane of ['XY','XZ','YZ']){
 const basis=basisFor({plane}),offset=12,origin=basis.n.clone().multiplyScalar(offset);
 const base={...defaults,name:'スケッチ',kind:'sketch',plane,x:origin.x,y:origin.y,z:origin.z,groupId:'mixed',groupNumber:1,closed:false};
 const curve=(id,points)=>({...base,id,profile:'spline',points});
 const line=(id,a,b)=>{const u=(a[0]+b[0])/2,v=(a[1]+b[1])/2,center=origin.clone().addScaledVector(basis.u,u).addScaledVector(basis.v,v);return {...base,id,profile:'line',mode:'thin',width:Math.hypot(b[0]-a[0],b[1]-a[1]),angle:Math.atan2(b[1]-a[1],b[0]-a[0])*180/Math.PI,x:center.x,y:center.y,z:center.z};};
 const features=[curve('curve1',[[-30,0],[-20,-10],[-10,0]]),line('line1',[-10,0],[10,0]),curve('curve2',[[10,0],[20,-10],[30,0]]),line('line2',[30,0],[40,10]),line('line3',[40,10],[-30,10]),line('line4',[-30,10],[-30,0])];
 const loaded=validateProject(JSON.parse(JSON.stringify({format:'forma-cad',version:1,features}))),regions=findRegions(loaded);
 assert.equal(regions.length,1,'curves and lines form one closed region after saving and reloading');
 assert.equal(new Set(loaded.map(f=>f.groupId)).size,1);assert.equal(regions[0].sourceIds.length,6);
 assert.ok(regionContains(regions[0],[-20,-5]));assert.ok(!regionContains(regions[0],[-20,-11]));
 for(const depth of [4,-4]){const geometry=extrudeRegion(regions[0],depth);assert.ok(Math.abs(volume(geometry)-regions[0].area*4)<.01);geometry.dispose();}
 assert.equal(findRegions(loaded.slice(0,-1)).length,0,'omitting the closing segment leaves an open chain');
 assert.deepEqual(loaded.filter(f=>f.profile==='spline').map(f=>f.points),features.filter(f=>f.profile==='spline').map(f=>f.points),'switching does not flatten the confirmed curves');
}
console.log('PASS mixed curve/line continuity, closed-region selection, saved-data recovery and both extrusion directions on XY/XZ/YZ');
