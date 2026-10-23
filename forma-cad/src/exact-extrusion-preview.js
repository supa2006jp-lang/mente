import * as THREE from 'three';

// Use the commit operation, including successor replay when editing history.
export function prepareExactExtrusion(features,spec,{run,bodies,mesh}){
 const index=spec.editingId?features.findIndex(f=>f.id===spec.editingId):-1;
 if(spec.editingId&&index<0)throw Error('再編集する工程が見つかりません');
 const input=index<0?features:features.slice(0,index),prepared=spec.prepared||run(input,{type:'extrusionBatch',features:spec.features});
 // Newly committed operations already contain complete, verified output meshes.
 // Reuse the last write for each body instead of rebuilding and meshing it again.
 if(index<0){
  const latest=new Map(),removed=new Set();
  for(const feature of prepared.features){const result=feature.cadResult;for(const id of result.remove){latest.delete(id);removed.add(id);}for(const output of result.outputs){latest.set(output.id,output);removed.delete(output.id);}}
  if([...latest.values()].every(output=>output.vertices?.length&&output.triangles?.length))return {...prepared,exact:true,outputs:[...latest.values()].map(({id,vertices,triangles})=>({id,vertices,triangles})),remove:[...removed]};
 }
 let project=index<0?[...features,...prepared.features]:[...features.slice(0,index),...prepared.features,...features.slice(index+1)];
 if(index>=0&&index+1<features.length)project=run(project,{type:'replay',before:features,start:index+1,refreshStart:true}).features;
 const affected=new Set();
 for(const f of index<0?prepared.features:[...features.slice(index),...project.slice(index)]){const result=f.cadResult||(f.kind==='cadop'?f:null);for(const o of result?.outputs||[])affected.add(o.id);for(const id of result?.remove||[])affected.add(id);if(f.kind==='extrusion')affected.add(f.operation==='new'?f.id:f.target);}
 const shapes=bodies(project),outputs=[],remove=[];
 try{for(const id of affected){const shape=shapes.get(id);if(shape)outputs.push({id,...mesh(shape)});else remove.push(id);}}
 finally{for(const shape of shapes.values())shape.delete();}
 return {...prepared,exact:true,outputs,remove,...(index>=0?{projectFeatures:project}:{})};
}

export function createExactExtrusionView({host,getMeshes,getOverlays=()=>[]}){
 let displayed=null,saved=[];
 function clear(){for(const [object,visible] of saved)object.visible=visible;saved=[];if(displayed){displayed.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});displayed.removeFromParent();displayed=null;}delete host.dataset.extrusionExactPreview;}
 function show(result,group){
  clear();displayed=new THREE.Group();displayed.userData.exactExtrusion=true;
  const meshes=getMeshes(),ids=new Set([...result.outputs.map(o=>o.id),...result.remove]);
  for(const id of ids){const original=meshes.get(id);if(!original)continue;for(const object of [...[].concat(original.material),...original.children]){saved.push([object,object.visible]);object.visible=false;}}
  for(const object of [...group.children,...getOverlays()])if(object&&!object.userData.barrierClearance){saved.push([object,object.visible]);object.visible=false;}
  for(const output of result.outputs){
   const original=meshes.get(output.id);if(original&&!original.visible)continue;
   const g=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(output.vertices,3));g.setIndex(output.triangles);g.computeVertexNormals();
   const object=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:0x79b6c8,roughness:.55,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));
   object.add(new THREE.LineSegments(new THREE.EdgesGeometry(g,25),new THREE.LineBasicMaterial({color:0x20647d})));object.userData.bodyId=output.id;displayed.add(object);
  }
  group.add(displayed);host.dataset.extrusionExactPreview=JSON.stringify({outputs:result.outputs.map(o=>({id:o.id,triangles:o.triangles.length/3})),remove:result.remove});
 }
 return {show,clear};
}
