import * as THREE from 'three';

let canvas;
function circleCanvas(){
 if(canvas)return canvas;
 canvas=document.createElement('canvas');
 canvas.width=canvas.height=64;
 const context=canvas.getContext('2d');
 context.fillStyle='#fff';
 context.beginPath();
 context.arc(32,32,30,0,Math.PI*2);
 context.fill();
 return canvas;
}

export function roundPointMaterial(options){
 const map=new THREE.CanvasTexture(circleCanvas());
 map.colorSpace=THREE.SRGBColorSpace;
 return new THREE.PointsMaterial({...options,map,transparent:true,alphaTest:.12,depthWrite:false});
}