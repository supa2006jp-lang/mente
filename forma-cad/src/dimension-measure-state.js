import {measurePointComponent,measurePoints,measureCircle} from './dimension-measure-geometry.js';

// Measurement annotations are document metadata, separate from CAD features.
// Bound imported data and whitelist fields before creating any DOM elements.
export function readMeasurementState(value){
 if(value==null)return null;const fail=()=>{throw Error('寸法の保存データが不正です');},number=(n,max=1e12)=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=max,point=p=>{if(!Array.isArray(p)||p.length!==3||!p.every(n=>number(n,1e9)))fail();return [...p];};
 if(value.version!==1||!Array.isArray(value.records)||value.records.length>20)fail();let segmentCount=0;
 const records=value.records.map(source=>{
  if(!source||typeof source!=='object'||!number(source.distance)||source.distance<0)fail();const a=point(source.a),b=point(source.b),type=source.type||'point';if(!['point','component','edge-length','edge-pair','circle'].includes(type))fail();
  let record={a,b,distance:source.distance,type};
  if(source.label!==undefined){if(typeof source.label!=='string'||source.label.length>160)fail();record.label=source.label;}
  if(source.offset!==undefined){if(!source.offset||!number(source.offset.x,1e6)||!number(source.offset.y,1e6))fail();record.offset={x:source.offset.x,y:source.offset.y};}
  if(source.labelPoint!==undefined)record.labelPoint=point(source.labelPoint);
  for(const key of ['curved','approximate'])if(source[key]!==undefined){if(typeof source[key]!=='boolean')fail();record[key]=source[key];}
  if(source.edges!==undefined){if(!Array.isArray(source.edges)||source.edges.length>2)fail();record.edges=source.edges.map(group=>{if(!Array.isArray(group)||!group.length||group.length>10000||(segmentCount+=group.length)>20000)fail();return group.map(s=>{if(!s)fail();return {a:point(s.a),b:point(s.b)};});});}
  if(type==='point'||type==='component'){if(type==='component'&&!['x','y','z'].includes(source.component))fail();record={...record,...measurePointComponent(a,b,type==='component'?source.component:'direct')};}
  if(type==='edge-pair'){record.distance=measurePoints(a,b).distance;if(source.angle!==undefined&&source.angle!==null){if(!number(source.angle)||source.angle<0||source.angle>90)fail();record.angle=source.angle;}else record.angle=null;}
  if(type==='edge-length'&&(!record.edges?.[0]?.length||!record.distance))fail();
  if(type==='circle'){const c=source.circle;if(!c||!number(c.radius,1e9)||c.radius<=0||!['circumference','diameter','radius'].includes(source.circleKind))fail();const circle={center:point(c.center),normal:point(c.normal),radius:c.radius},labelPoint=record.labelPoint||b;try{const measured=measureCircle({circle,segments:record.edges?.[0]},source.circleKind,labelPoint);record={...record,...measured};}catch{fail();}}
  return record;
 });return {version:1,records};
}
