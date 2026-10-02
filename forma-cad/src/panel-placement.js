import * as THREE from 'three';

// Geometry bounds are cached by Three.js. Project eight corners rather than
// scanning every mesh vertex whenever the camera moves.
export function projectedBounds(object,camera,width,height){
 if(!object?.visible||!object.geometry)return null;
 const geometry=object.geometry;if(!geometry.boundingBox)geometry.computeBoundingBox();
 const box=geometry.boundingBox;if(!box||box.isEmpty())return null;
 object.updateWorldMatrix(true,false);
 let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity,visible=false;
 const p=new THREE.Vector3();
 for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
  p.set(x,y,z).applyMatrix4(object.matrixWorld).project(camera);
  if(p.z>=-1&&p.z<=1)visible=true;
  const px=(p.x+1)*width/2,py=(1-p.y)*height/2;
  left=Math.min(left,px);right=Math.max(right,px);top=Math.min(top,py);bottom=Math.max(bottom,py);
 }
 if(!visible||![left,top,right,bottom].every(Number.isFinite)||right<0||bottom<0||left>width||top>height)return null;
 return {left:Math.max(0,left),top:Math.max(0,top),right:Math.min(width,right),bottom:Math.min(height,bottom)};
}

export function findPanelSpace({width,height,panelWidth,panelHeight,obstacles=[],anchor={x:width/2,y:height/2},previous=null,margin=8,gap=14}){
 const maxX=width-panelWidth-margin,maxY=height-panelHeight-margin;
 if(maxX<margin||maxY<margin)return null;
 const inside=p=>p.x>=margin&&p.x<=maxX&&p.y>=margin&&p.y<=maxY;
 const free=p=>obstacles.every(r=>p.x+panelWidth+gap<=r.left||p.x-gap>=r.right||p.y+panelHeight+gap<=r.top||p.y-gap>=r.bottom);
 // Keep a valid placement so the controls do not chase the cursor or jump
 // while the user changes distances and operations.
 if(previous&&inside(previous)&&free(previous))return previous;
 const xs=new Set([margin,maxX,Math.max(margin,Math.min(maxX,anchor.x+28)),Math.max(margin,Math.min(maxX,anchor.x-panelWidth-28))]);
 const ys=new Set([margin,maxY,Math.max(margin,Math.min(maxY,anchor.y-panelHeight/2))]);
 for(const r of obstacles){for(const x of [r.left-panelWidth-gap,r.right+gap])if(x>=margin&&x<=maxX)xs.add(x);for(const y of [r.top-panelHeight-gap,r.bottom+gap])if(y>=margin&&y<=maxY)ys.add(y);}
 let best=null,score=Infinity;
 for(const x of xs)for(const y of ys){const p={x,y};if(!free(p))continue;const distance=Math.hypot(x+panelWidth/2-anchor.x,y+panelHeight/2-anchor.y);if(distance<score){best=p;score=distance;}}
 return best;
}
