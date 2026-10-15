import * as THREE from 'three';

// GPU positions stay Float32. Drawing references retain the kernel's doubles;
// reading the rendered buffer back would turn a shared boundary into a sliver.
const positions=new WeakMap();
export function cadPosition(geometry){
 if(!geometry)return undefined;const values=geometry.userData.cadCoordinates;
 if(!values||values.length!==geometry.attributes.position?.count*3)return geometry.attributes.position;
 let entry=positions.get(geometry);if(!entry||entry.values!==values){entry={values,attribute:new THREE.BufferAttribute(new Float64Array(values),3)};positions.set(geometry,entry);}return entry.attribute;
}
export function retainCadCoordinates(geometry,vertices){
 geometry.userData.cadCoordinates=Array.from(vertices);return geometry;
}
export function preciseGeometry(geometry){
 const copy=geometry.clone(),position=cadPosition(geometry);
 copy.setAttribute('position',position.clone());delete copy.userData.cadCoordinates;return copy;
}
export function copyCadCoordinates(source,target){
 const position=cadPosition(source);if(!source.userData.cadCoordinates)return target;
 const values=[],index=source.index;for(let i=0;i<target.attributes.position.count;i++){const j=index&&target.index===null?index.getX(i):i;values.push(position.getX(j),position.getY(j),position.getZ(j));}
 return retainCadCoordinates(target,values);
}
export function restoreMeshCoordinates(displayed,native){
 const points=new Map(),key=p=>p.map(Math.fround).join(',');
 for(let i=0;i<native.length;i+=3){const p=native.slice(i,i+3),id=key(p);if(!points.has(id))points.set(id,p);}
 const coordinates=[];for(let i=0;i<displayed.length;i+=3){const p=displayed.slice(i,i+3);coordinates.push(...(points.get(key(p))||p));}return coordinates;
}

// Polygon unions use an integer grid only to determine topology. Recover their
// contour from the original segments instead of using quantized CAD coordinates.
export function restoreContourPoint(point,segments,tolerance=Math.SQRT2*5e-6+1e-9){
 let vertex=null,vertexDistance=tolerance,nearest=point,distance=tolerance;
 for(const [a,b] of segments){
  for(const end of [a,b]){const d=Math.hypot(end[0]-point[0],end[1]-point[1]);if(d<vertexDistance){vertex=end;vertexDistance=d;}}
  const dx=b[0]-a[0],dy=b[1]-a[1],length2=dx*dx+dy*dy;if(length2<1e-24)continue;
  const t=Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/length2)),q=[a[0]+t*dx,a[1]+t*dy],d=Math.hypot(q[0]-point[0],q[1]-point[1]);
  if(d<distance){nearest=q;distance=d;}
 }
 return vertex?[...vertex]:nearest;
}

// EdgesGeometry writes Float32 even when its input retains native positions.
// Match its endpoints back to the corresponding original tessellation vertex.
export function retainEdgeCoordinates(edges,source){
 const native=cadPosition(source);if(!source.userData.cadCoordinates)return edges;
 const key=(x,y,z)=>[Math.fround(x),Math.fround(y),Math.fround(z)].join(','),points=new Map();
 for(let i=0;i<native.count;i++){const point=[native.getX(i),native.getY(i),native.getZ(i)],id=key(...point);if(!points.has(id))points.set(id,point);}
 const p=edges.attributes.position,positions=[];
 for(let i=0;i<p.count;i++){const point=[p.getX(i),p.getY(i),p.getZ(i)];positions.push(...(points.get(key(...point))||point));}
 return retainCadCoordinates(edges,positions);
}
