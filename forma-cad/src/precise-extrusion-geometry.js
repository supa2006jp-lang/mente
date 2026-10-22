import {MODEL_PRECISION} from './model-precision.js';
import * as THREE from 'three';
import {retainCadCoordinates} from './cad-coordinates.js';

// Build caps and walls from profile doubles. Recovering Float32 vertices by
// coordinate matching is ambiguous for small features far from the origin.
export function preciseExtrusionGeometry(shapes,options){
 if(options.bevelEnabled!==false||(options.steps??1)!==1)throw Error('精密押し出しの設定が不正です');
 const list=Array.isArray(shapes)?shapes:[shapes],vertices=[],depth=options.depth;
 const triangle=(a,az,b,bz,c,cz)=>vertices.push(a.x,a.y,az,b.x,b.y,bz,c.x,c.y,cz);
 const ring=(points,outer)=>{const p=points.filter((v,i)=>!i||v.distanceToSquared(points[i-1])>MODEL_PRECISION.zero**2);if(p.length>1&&p[0].distanceToSquared(p.at(-1))<=MODEL_PRECISION.zero**2)p.pop();if((THREE.ShapeUtils.area(p)>0)!==outer)p.reverse();return p;};
 for(const shape of list){
  const paths=shape.extractPoints(options.curveSegments??12),contour=ring(paths.shape,true),holes=paths.holes.map(p=>ring(p,false)),points=[contour,...holes].flat(),faces=THREE.ShapeUtils.triangulateShape(contour,holes);
  for(const indices of faces){let [a,b,c]=indices.map(i=>points[i]);if((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x)<0)[b,c]=[c,b];triangle(a,0,c,0,b,0);triangle(a,depth,b,depth,c,depth);}
  for(const path of [contour,...holes])for(let i=0;i<path.length;i++){const a=path[i],b=path[(i+1)%path.length];triangle(a,0,b,0,b,depth);triangle(a,0,b,depth,a,depth);}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float64Array(vertices),3));g.computeVertexNormals();return g;
}
export function renderPreciseGeometry(g){const p=g.attributes.position;if(p.array instanceof Float64Array){retainCadCoordinates(g,p.array);g.setAttribute('position',new THREE.Float32BufferAttribute(p.array,3));g.userData.cadCoordinatePrecision=true;}return g;}
