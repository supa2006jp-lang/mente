import {savedBodyMeshes} from './cad-output-mesh.js';
import {measureStlSurface} from './stl-surface-distance.js';

function joinedMesh(meshes) {
 const vertices = [], triangles = [];
 for (const mesh of meshes) {
  const base = vertices.length/3;
  for (const value of mesh.vertices) vertices.push(Math.fround(value));
  for (const index of mesh.triangles) triangles.push(base+index);
 }
 return {vertices,triangles};
}

const longestSide = ([min,max]) => Math.max(...max.map((value,i) => value-min[i]));

export function reviewStlConversion(parts,onProgress) {
 const bodies = parts.flatMap(part => part.outputs.map(({id,brep}) => ({id,brep})));
 const printed = savedBodyMeshes({type:'stlMeshes',bodies,includeComponents:true},onProgress);
 const meshes = new Map(printed.outputs.map(mesh => [mesh.id,mesh]));
 const printRows = new Map(printed.inspection.rows.map(row => [row.id,row]));
 const reviews = [];
 for (const [i,part] of parts.entries()) {
  onProgress?.({stage:'元のSTLと出力用メッシュの表面を比較しています…',current:i+1,total:parts.length});
  const rows = part.outputs.map(body => printRows.get(body.id));
  const details = rows.flatMap(row => (row.components || []).map((component,index) => ({
   ...component,id:row.id,disconnected:index>0
  })));
  const pieces = details.filter(piece => piece.disconnected || (bodies.length>1 && longestSide(piece.bounds)<=2));
  const print = {
   ok:rows.every(row=>row.ok&&row.complete), triangles:rows.reduce((count,row)=>count+row.triangles,0),
   problems:rows.filter(row=>!row.ok||!row.complete).map(row=>({id:row.id,segments:row.segments,issues:row.issues})),
   pieces
  };
  const outputMeshes = part.outputs.map(body => meshes.get(body.id));
  let difference = null;
  if (outputMeshes.every(Boolean)) {
   const mesh = joinedMesh(outputMeshes);
   const before = measureStlSurface(part.source,mesh), after = measureStlSurface(mesh,part.source);
   difference = {mesh,before,after};
  }
  reviews.push({part:part.id,print,difference});
 }
 return reviews;
}
