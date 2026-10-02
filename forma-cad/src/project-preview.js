import * as THREE from 'three';

// Use committed geometry and a separate render target: tool previews, hidden bodies,
// selection colors and display clipping must not change the saved model's image.
export function captureProjectPreview({renderer,camera,meshes,sketches}){
 const width=640,height=480,scene=new THREE.Scene(),group=new THREE.Group(),materials=[];
 scene.background=new THREE.Color('#ffffff');scene.add(group);
 const solid=new THREE.MeshStandardMaterial({color:0xa3a197,roughness:.8}),edge=new THREE.LineBasicMaterial({color:0x33332f});materials.push(solid,edge);
 for(const mesh of meshes){const copy=new THREE.Mesh(mesh.geometry,solid);copy.matrixAutoUpdate=false;mesh.updateMatrixWorld(true);copy.matrix.copy(mesh.matrixWorld);group.add(copy);for(const child of mesh.children.filter(c=>c.isLineSegments)){const line=new THREE.LineSegments(child.geometry,edge);line.matrixAutoUpdate=false;child.updateMatrixWorld(true);line.matrix.copy(child.matrixWorld);group.add(line);}}
 // Sketches are useful when no solid has been made; keep finished solids unobscured.
 if(!group.children.length)for(const item of sketches){const material=item.material.clone();material.color?.set(0x416b9c);material.clippingPlanes=null;materials.push(material);const copy=item.clone(false);copy.material=material;copy.visible=true;copy.matrixAutoUpdate=false;item.updateMatrixWorld(true);copy.matrix.copy(item.matrixWorld);group.add(copy);}
 group.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(group);
 if(box.isEmpty()){for(const m of materials)m.dispose();return null;}
 const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3()),radius=Math.max(size.length()/2,1),view=camera.clone(),direction=new THREE.Vector3(0,0,1).applyQuaternion(camera.quaternion).normalize();
 view.position.copy(center).addScaledVector(direction,radius*3+1);view.zoom=1;view.near=.01;view.far=radius*8+10;view.lookAt(center);view.updateMatrixWorld(true);
 let halfX=0,halfY=0;for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){const p=new THREE.Vector3(x,y,z).applyMatrix4(view.matrixWorldInverse);halfX=Math.max(halfX,Math.abs(p.x));halfY=Math.max(halfY,Math.abs(p.y));}
 const half=Math.max(halfY,halfX/(width/height),.5)*1.15;view.left=-half*width/height;view.right=half*width/height;view.top=half;view.bottom=-half;view.updateProjectionMatrix();
 scene.add(new THREE.HemisphereLight(0xffffff,0x77756e,1.2));const key=new THREE.DirectionalLight(0xffffff,2);key.position.set(-100,-180,240);scene.add(key);const fill=new THREE.DirectionalLight(0xffffff,.3);fill.position.set(-100,40,60);scene.add(fill);
 const target=new THREE.WebGLRenderTarget(width,height,{depthBuffer:true});target.texture.colorSpace=THREE.SRGBColorSpace;
 const previous=renderer.getRenderTarget(),viewport=renderer.getViewport(new THREE.Vector4()),scissor=renderer.getScissor(new THREE.Vector4()),scissorTest=renderer.getScissorTest();
 try{renderer.setRenderTarget(target);renderer.setScissorTest(false);renderer.render(scene,view);const pixels=new Uint8Array(width*height*4);renderer.readRenderTargetPixels(target,0,0,width,height,pixels);const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');if(!ctx)throw Error('画像を作成できません');const image=ctx.createImageData(width,height);for(let y=0;y<height;y++)image.data.set(pixels.subarray((height-1-y)*width*4,(height-y)*width*4),y*width*4);ctx.putImageData(image,0,0);return {version:1,dataUrl:canvas.toDataURL('image/jpeg',.85),width,height};}
 finally{renderer.setRenderTarget(previous);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);target.dispose();for(const m of materials)m.dispose();}
}

export function previewImageSource(preview){
 if(!preview||preview.version!==1||typeof preview.dataUrl!=='string'||preview.dataUrl.length>2_000_000)return null;
 if(!Number.isInteger(preview.width)||!Number.isInteger(preview.height)||preview.width<1||preview.height<1||preview.width>2048||preview.height>2048)return null;
 return /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(preview.dataUrl)?preview.dataUrl:null;
}

export function createProjectLoadPreview({onOpen,onChoose}){
 const dialog=document.createElement('dialog');dialog.id='project-load-preview';dialog.setAttribute('aria-labelledby','project-preview-title');
 dialog.innerHTML='<div class="dialog-heading"><h2 id="project-preview-title">ファイルを確認</h2><button type="button" id="project-preview-close" aria-label="キャンセル">×</button></div><p id="project-preview-name"></p><div class="project-preview-image"><img id="project-preview-image" alt="保存したモデルのプレビュー" hidden><p id="project-preview-empty">このファイルにはプレビュー画像がありません。新しい版で保存すると画像が付きます。</p></div><p id="project-preview-details"></p><p id="project-preview-warning" hidden>現在の未保存の変更は、ファイルを開くと置き換わります。</p><div class="project-preview-actions"><button type="button" id="project-preview-choose">別のファイルを選ぶ</button><button type="button" id="project-preview-cancel">キャンセル</button><button type="button" id="project-preview-open" class="primary">このファイルを開く</button></div>';
 document.body.append(dialog);const q=id=>dialog.querySelector('#'+id),image=q('project-preview-image'),empty=q('project-preview-empty');let pending=null;
 function clear(){pending=null;image.hidden=true;image.removeAttribute('src');image.onerror=null;}
 dialog.addEventListener('close',()=>{if(!dialog.open)clear();});q('project-preview-close').onclick=q('project-preview-cancel').onclick=()=>{clear();dialog.close();};q('project-preview-choose').onclick=()=>{clear();dialog.close();onChoose();};q('project-preview-open').onclick=()=>{const item=pending;if(!item)return;clear();dialog.close();onOpen(item);};
 return {show(item){clear();pending=item;q('project-preview-name').textContent=item.file.name;q('project-preview-details').textContent='工程 '+item.next.length+' 件 · '+(item.file.size/1024/1024<1?Math.ceil(item.file.size/1024)+' KB':(item.file.size/1024/1024).toFixed(1)+' MB');q('project-preview-warning').hidden=!item.modified;empty.textContent='このファイルにはプレビュー画像がありません。新しい版で保存すると画像が付きます。';const src=previewImageSource(item.preview);empty.hidden=!!src;if(src){image.onerror=()=>{if(pending!==item)return;image.hidden=true;empty.hidden=false;empty.textContent='プレビュー画像を表示できません。作業データは読み込めます。';};image.src=src;image.hidden=false;}if(!dialog.open)dialog.showModal();},cancel(){clear();if(dialog.open)dialog.close();}};
}
