// Refresh GPU resources after an OS overlay or restored WebGL context.
// Keep camera, model, selection and unfinished sketch data intact.
export function installRenderRecovery({renderer,scene,host,cancelInput,refreshGrids,button}){
 let pending=0,lost=false,revision=0;
 const canvas=renderer.domElement;
 function queue(){
  if(lost||pending||document.hidden)return;
  pending=requestAnimationFrame(()=>{
   pending=0;if(lost||document.hidden)return;
   renderer.resetState();renderer.setRenderTarget(null);
   const geometries=new Set(),materials=new Set(),textures=new Set();
   scene.traverse(object=>{
    if(object.geometry)geometries.add(object.geometry);
    for(const material of (Array.isArray(object.material)?object.material:[object.material]))if(material)materials.add(material);
   });
   for(const geometry of geometries){
    for(const attribute of Object.values(geometry.attributes)) (attribute.isInterleavedBufferAttribute?attribute.data:attribute).needsUpdate=true;
    if(geometry.index)geometry.index.needsUpdate=true;
   }
   for(const material of materials){material.needsUpdate=true;for(const value of Object.values(material))if(value?.isTexture&&!value.isRenderTargetTexture)textures.add(value);}
   for(const texture of textures)texture.needsUpdate=true;
   refreshGrids();
   const width=host.clientWidth,height=host.clientHeight;
   if(width&&height){renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.setSize(width,height);renderer.setViewport(0,0,width,height);}
   renderer.setScissorTest(false);renderer.clear(true,true,true);
   host.dataset.renderStatus='ready';host.dataset.renderRecovery=String(++revision);
  });
 }
 window.addEventListener('blur',cancelInput);
 window.addEventListener('focus',queue);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelInput();else queue();});
 window.addEventListener('keydown',event=>{if(event.metaKey&&event.shiftKey&&event.key.toLowerCase()==='s')cancelInput();},{capture:true});
 canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();lost=true;host.dataset.renderStatus='lost';cancelInput();if(button)button.disabled=true;});
 canvas.addEventListener('webglcontextrestored',()=>{lost=false;if(button)button.disabled=false;queue();});
 if(button)button.onclick=()=>{cancelInput();queue();};
 host.dataset.renderStatus='ready';host.dataset.renderRecovery='0';
 return {refresh:queue};
}
