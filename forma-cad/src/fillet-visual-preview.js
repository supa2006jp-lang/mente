import * as THREE from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {rebuild} from './geometry.js';
import {bodyEdges} from './body-edges.js';
import {moveMatrix} from './fillet-grid-reference.js';
import {filletBodyTargets,isFilletBodySuppressed} from './fillet-state.js';
import {worldPoint} from './frames.js';

function targetEdges(geometry,spec,bodyId){
 const references=(spec.edges||[]).filter(edge=>edge.bodyId===bodyId),positions=[];
 if(!references.length&&spec.face?.outer){for(const ring of [spec.face.outer,...(spec.face.holes||[])])ring.forEach((point,i)=>positions.push(worldPoint(spec.face,point),worldPoint(spec.face,ring[(i+1)%ring.length])));return new THREE.BufferGeometry().setFromPoints(positions);}
 let outline;
 try{
  for(const edge of references){
   if(edge.a&&edge.b){positions.push(new THREE.Vector3(...edge.a),new THREE.Vector3(...edge.b));continue;}
   if(!edge.point)continue;
   outline??=bodyEdges(geometry,28);const p=outline.attributes.position,point=new THREE.Vector3(...edge.point),nearest=new THREE.Vector3();let best=null,distance=Infinity;
   for(let i=0;i<p.count;i+=2){const a=new THREE.Vector3().fromBufferAttribute(p,i),b=new THREE.Vector3().fromBufferAttribute(p,i+1),line=new THREE.Line3(a,b),d=line.closestPointToPoint(point,true,nearest).distanceToSquared(point);if(d<distance){distance=d;best=[a,b];}}
   if(best)positions.push(...best);
  }
  return references.length?new THREE.BufferGeometry().setFromPoints(positions):bodyEdges(geometry,28);
 }finally{outline?.dispose();}
}

// Compare surfaces, not triangle IDs: tessellation changes when a radius changes.
export function filletChangedSurface(before,after,radius){
 const tree=new MeshBVH(before,{indirect:true}),p=after.attributes.position,ix=after.index,positions=[],center=new THREE.Vector3(),hit={},points=[new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()],tolerance=Math.max(1e-5,Math.min(.01,radius*.001));
 for(let i=0;i<(ix?.count??p.count);i+=3){
  points.forEach((v,j)=>v.fromBufferAttribute(p,ix?ix.getX(i+j):i+j));center.copy(points[0]).add(points[1]).add(points[2]).multiplyScalar(1/3);
  if(tree.closestPointToPoint(center,hit)?.distance>tolerance)for(const v of points)positions.push(...v.toArray());
 }
 const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();return geometry;
}

export function filletHighlightGeometry(features,id,bodyId){
 const index=features.findIndex(f=>f.id===id),feature=features[index];if(index<0||!filletBodyTargets(feature.spec).includes(bodyId))return null;
 const before=rebuild(features.slice(0,index)),after=rebuild(features.slice(0,index+1));let geometry,lines=false,historical=false;
 try{
  const a=before.get(bodyId)?.geometry,b=after.get(bodyId)?.geometry;if(!a||!b)return null;
  if(!isFilletBodySuppressed(feature.spec,bodyId))geometry=filletChangedSurface(a,b,feature.spec.radius);
  if(!geometry?.attributes.position.count){
   geometry?.dispose();lines=true;geometry=targetEdges(a,feature.spec,bodyId);
  }
  for(const later of features.slice(index+1)){
   const result=later.cadResult||(later.kind==='cadop'?later:null);if(!result)continue;
   if(!result.outputs?.some(o=>o.id===bodyId)&&!result.remove?.includes(bodyId))continue;
   if(later.spec?.type==='move'&&!later.spec.copy&&later.spec.moveMode!=='複製して移動')geometry.applyMatrix4(moveMatrix(later.spec));
   else if(later.spec?.type!=='fillet')historical=true;
  }
  return {geometry,lines,historical};
 }catch(error){geometry?.dispose();throw error;}
 finally{for(const body of [...before.values(),...after.values()])body.geometry.dispose();}
}

export function createFilletVisualPreview({scene,meshes,host,getFeatures,getOverlays=()=>[]}){
 let highlight=null,preview=null,saved=[];
 const dispose=object=>{object?.traverse(node=>{node.geometry?.dispose();node.material?.dispose();});object?.removeFromParent();};
 function clearHighlight(){dispose(highlight);highlight=null;delete host.dataset.filletHighlight;delete host.dataset.filletHighlightTriangles;delete host.dataset.filletHighlightHistorical;}
 function clearPreview(){dispose(preview);preview=null;for(const [object,visible] of saved)object.visible=visible;saved=[];delete host.dataset.filletPreviewRadius;delete host.dataset.filletPreviewBodies;}
 return {
  clearPreview,clearHighlight,
  highlight(id,bodyId){
   clearHighlight();if(!id||preview)return;
   try{
    const result=filletHighlightGeometry(getFeatures(),id,bodyId);if(!result)return;
    const material=result.lines?new THREE.LineBasicMaterial({color:0xffa000,depthTest:false}):new THREE.MeshBasicMaterial({color:0xffa000,side:THREE.DoubleSide,transparent:true,opacity:.8,depthTest:false,depthWrite:false});
    highlight=result.lines?new THREE.LineSegments(result.geometry,material):new THREE.Mesh(result.geometry,material);highlight.renderOrder=40;scene.add(highlight);host.dataset.filletHighlight=id;host.dataset.filletHighlightTriangles=String(result.lines?0:result.geometry.attributes.position.count/3);host.dataset.filletHighlightHistorical=String(result.historical);
   }catch{clearHighlight();}
  },
  show(features,radius){
   clearHighlight();clearPreview();const bodies=rebuild(features),group=new THREE.Group();
   try{
    for(const [id,body] of bodies){const original=meshes.get(id);if(original&&!original.visible){body.geometry.dispose();continue;}const mesh=new THREE.Mesh(body.geometry,new THREE.MeshStandardMaterial({color:0x64aec5,roughness:.8,side:THREE.DoubleSide}));group.add(mesh);}
    for(const object of [...meshes.values(),...getOverlays()].filter(Boolean)){saved.push([object,object.visible]);object.visible=false;}
    preview=group;scene.add(group);host.dataset.filletPreviewRadius=String(radius);host.dataset.filletPreviewBodies=String(group.children.length);
   }catch(error){dispose(group);for(const body of bodies.values())body.geometry.dispose();clearPreview();throw error;}
  }
 };
}
