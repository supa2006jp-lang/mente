import {cadMesh} from './cad-mesh.js';
import {canonicalStlCadVertices} from './stl-cad-vertices.js';
import {solidMeshComplete} from './solid-mesh.js';
import {indexedPrintSupportMesh} from './print-support-3mf-mesh.js';

// Use the same incident-CAD-vertex normalization as STL. 3MF also needs exact
// shared coordinates before assigning shared indices; Float32 closure alone
// cannot establish that. Never weld independent surfaces or bridge a gap.
export function printSupportExportMesh(shape,{meshShape=cadMesh}={}){
 const mesh=meshShape(shape);
 try{indexedPrintSupportMesh(mesh);return mesh;}catch{}
 try{
  const canonical=canonicalStlCadVertices(shape,mesh);
  if(!canonical.adjustedVertices||!solidMeshComplete(shape,canonical.mesh))return mesh;
  indexedPrintSupportMesh(canonical.mesh);
  return canonical.mesh;
 }catch{return mesh;}
 // A genuinely incomplete mesh stays incomplete and is rejected by the
 // existing 3MF export validator. Preview and CAD history remain available.
}
