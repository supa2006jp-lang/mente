import * as THREE from 'three';

let plainCircle,outlinedCircle;
function circleCanvas(outlined){
 const cached=outlined?outlinedCircle:plainCircle;
 if(cached)return cached;
 const canvas=document.createElement('canvas');
 canvas.width=canvas.height=64;
 const context=canvas.getContext('2d');
 context.fillStyle='#fff';
 context.beginPath();
 context.arc(32,32,30,0,Math.PI*2);
 context.fill();
 if(outlined){
  context.fillStyle='#a04dcc';
  context.beginPath();
  context.arc(32,32,22,0,Math.PI*2);
  context.fill();
  outlinedCircle=canvas;
 }else plainCircle=canvas;
 return canvas;
}

export function roundPointMaterial(options,{outlined=false}={}){
 const map=new THREE.CanvasTexture(circleCanvas(outlined));
 map.colorSpace=THREE.SRGBColorSpace;
 if(outlined){
  // A mip level at this scale would blend the narrow white ring into the fill.
  map.generateMipmaps=false;
  map.minFilter=THREE.LinearFilter;
 }
 return new THREE.PointsMaterial({...options,map,transparent:true,alphaTest:.12,depthWrite:false});
}
export const sketchPointSize=11;
export function sketchPointMaterial(){
 return roundPointMaterial({size:sketchPointSize,sizeAttenuation:false,depthTest:false},{outlined:true});
}
