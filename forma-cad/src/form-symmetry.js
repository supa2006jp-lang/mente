import {basisFor} from './frames.js';
import {planeCoordinates,sketchPoints} from './regions.js';
import {formWorld} from './form-orientation.js';

export const formSymmetryU=form=>form.symmetryPlane?.u??0;
export const validFormSymmetryPlane=plane=>plane&&Number.isFinite(plane.u)&&Math.abs(plane.u)<=10000&&
 (plane.source===undefined||typeof plane.source==='string'&&plane.source.length<=100);

export function symmetryFromFace(face,axes){
 const normal=basisFor(face).n,dot=normal.dot(axes.u);
 if(Math.abs(dot)<1-1e-8)throw Error('フォームの左右方向と平行な法線を持つ平面を選んでください。');
 return face.offset*dot;
}

export function symmetryFromSketch(sketch,axes){
 if(sketch.kind!=='sketch'||sketch.closed||!['line','polyline'].includes(sketch.profile)||sketch.points?.length>256)return null;
 const basis=basisFor(sketch),offset=planeCoordinates(sketch).offset;
 const points=sketchPoints(sketch).map(([u,v])=>formWorld(basis,u,v,offset));
 if(points.length<2||points[0].distanceTo(points.at(-1))<.1)return null;
 const first=points[0],last=points.at(-1),direction=last.clone().sub(first).normalize(),u=first.dot(axes.u);
 if(points.some(point=>Math.abs(point.dot(axes.u)-u)>1e-5||
  point.clone().sub(first).cross(direction).length()>1e-5))return null;
 return u;
}
