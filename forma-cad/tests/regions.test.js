import test from 'node:test';import assert from 'node:assert/strict';import {findRegions,regionContains,extrudeRegion,thinShapes} from '../src/regions.js';import {defaults,makeGeometry,volume,validateProject} from '../src/geometry.js';
let id=0;const line=(a,b,plane='XY')=>{const dx=b[0]-a[0],dy=b[1]-a[1],u=(a[0]+b[0])/2,v=(a[1]+b[1])/2;return {...defaults,kind:'sketch',id:String(++id),name:'line',profile:'line',mode:'thin',plane,width:Math.hypot(dx,dy),angle:Math.atan2(dy,dx)*180/Math.PI,x:plane==='YZ'?0:u,y:plane==='XZ'?0:v,z:plane==='XY'?0:plane==='XZ'?-v:-u};};
const loop=(points,plane='XY')=>points.map((a,i)=>line(a,points[(i+1)%points.length],plane));
const rect=(w,h,x=0)=>({...defaults,kind:'sketch',id:String(++id),name:'rect',width:w,height:h,x});
const near=(a,b,t=.001)=>assert.ok(Math.abs(a-b)<Math.max(.0001,b*t),`${a} != ${b}`);
for(const plane of ['XY','XZ','YZ'])test('four separate lines '+plane,()=>{const r=findRegions(loop([[0,0],[80,0],[80,40],[0,40]],plane));assert.equal(r.length,1);near(r[0].area,3200);near(volume(extrudeRegion(r[0],10)),32000);near(volume(extrudeRegion(r[0],-10)),32000);});
test('open chain is not a profile',()=>assert.equal(findRegions([line([0,0],[10,0]),line([10,0],[10,10])]).length,0));
test('concave closed chain',()=>{const r=findRegions(loop([[0,0],[40,0],[40,10],[10,10],[10,40],[0,40]]));assert.equal(r.length,1);near(r[0].area,700);near(volume(extrudeRegion(r[0],5)),3500);});
test('intersecting divider creates separate profiles',()=>{const r=findRegions([...loop([[0,0],[80,0],[80,40],[0,40]]),line([40,-10],[40,50])]);assert.equal(r.length,2);for(const p of r)near(p.area,1600);});
test('nested profiles with holes',()=>{const r=findRegions([rect(80,60),rect(20,10)]);assert.equal(r.length,2);const outer=r.find(x=>x.holes.length);near(outer.area,4600);assert.equal(regionContains(outer,[0,0]),false);near(volume(extrudeRegion(outer,4)),18400);});
test('overlapping rectangles partition into three profiles',()=>{const r=findRegions([rect(40,20),rect(40,20,20)]);assert.equal(r.length,3);near(r.reduce((a,b)=>a+b.area,0),1200);});
test('circle and crossing line',()=>{const r=findRegions([{...defaults,kind:'sketch',id:String(++id),profile:'circle',diameter:40},line([-30,0],[30,0])]);assert.equal(r.length,2);for(const p of r)near(p.area,Math.PI*200,.002);});
test('duplicate edges and dangling branches',()=>{const r=findRegions([...loop([[0,0],[80,0],[80,40],[0,40]]),line([0,0],[80,0]),line([0,0],[-10,-10])]);assert.equal(r.length,1);near(r[0].area,3200);});
test('thin extrusion inside outside center',()=>{const [r]=findRegions([rect(80,60)]);for(const side of ['inside','outside','center']){const out=side==='outside'?2:side==='center'?1:0,inn=2-out;near(volume(extrudeRegion(r,10,'thin',2,side)),((80+out*2)*(60+out*2)-(80-inn*2)*(60-inn*2))*10);}});
test('region format roundtrip',()=>{const [region]=findRegions([rect(80,60)]);const f={...defaults,id:'region',name:'profile',profile:'region',region};assert.equal(validateProject(JSON.parse(JSON.stringify({format:'forma-cad',version:1,features:[f]})))[0].region.area,4800);});
test('thin preview has no miter spikes around a tessellated circular hole',()=>{
 const center=[15,15],hole=[];
 for(let i=0;i<128;i++){
  const angle=i*Math.PI*2/128,x=center[0]+5*Math.cos(angle),y=center[1]+5*Math.sin(angle);
  hole.push([x,y]);
  if(i%32===0)hole.push([x+0.0001,y+0.0001]);
 }
 const region={plane:'XY',offset:2,outer:[[30,30],[0,30],[0,0],[30,0]],holes:[hole]};
 const shapes=thinShapes(region,2,'inside');
 assert.equal(shapes.length,2);
 const circularWall=shapes.find(shape=>shape.getPoints().length>32);
 assert.ok(circularWall);
 const radii=circularWall.getPoints().map(point=>Math.hypot(point.x-center[0],point.y-center[1]));
 assert.ok(Math.max(...radii)<7.02,`preview circle has a spike at radius ${Math.max(...radii)}mm`);
 assert.ok(Math.min(...radii)>6.95);
});
test('thin region can omit the walls around enclosed holes',()=>{
 const region=findRegions([rect(80,60),rect(20,10)]).find(r=>r.holes.length);
 const normal=extrudeRegion(region,10,'thin',2,'inside');
 const outsideOnly=extrudeRegion(region,10,'thin',2,'inside',true);
 try{
  near(volume(normal),6800);
  near(volume(outsideOnly),5440);
  assert.equal(thinShapes(region,2,'inside').length,2);
  assert.equal(thinShapes(region,2,'inside',true).length,1);
  const feature={...defaults,id:'outer-only',name:'outer-only',profile:'region',region,depth:10,mode:'thin',wall:2,skipHoleWalls:true};
  const preview=makeGeometry(feature);
  try{near(volume(preview),5440);}finally{preview.dispose();}
  const saved=JSON.parse(JSON.stringify({format:'forma-cad',version:1,features:[feature]}));
  assert.equal(validateProject(saved)[0].skipHoleWalls,true);
  assert.throws(()=>validateProject({...saved,features:[{...feature,skipHoleWalls:'true'}]}),/穴側/);
  const solid=extrudeRegion(region,10,'solid',2,'inside',true);
  try{near(volume(solid),46000);}finally{solid.dispose();}
 }finally{normal.dispose();outsideOnly.dispose();}
});
