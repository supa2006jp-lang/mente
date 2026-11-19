import * as THREE from 'three';
import {basisFor} from './frames.js';

const margin=5,outlineGap=9,strokeGap=6,controlGap=4;

// Use the original picking geometry, which follows the visible sketch strokes.
export function createSketchExtrudeProjection(camera,getObjects=()=>[]){
 let key='',previous=[],cached;
 const point=new THREE.Vector3();
 return (width,height)=>{
  const objects=getObjects().filter(object=>object.visible&&(object.isLine||object.isPoints));
  const nextKey=[width,height,...camera.matrixWorldInverse.elements,...camera.projectionMatrix.elements].join(',');
  if(key===nextKey&&objects.length===previous.length&&objects.every((object,i)=>
   object===previous[i].object&&object.geometry===previous[i].geometry))return cached;
  key=nextKey;previous=objects.map(object=>({object,geometry:object.geometry}));
  const screen=()=>{
   point.project(camera);
   return [(point.x+1)*width/2,(1-point.y)*height/2,point.z];
  };
  const strokes=[];
  for(const object of objects){
   const {index}=object.geometry,positions=object.geometry.getAttribute('position');
   object.updateWorldMatrix(true,false);
   const points=Array.from({length:index?.count??positions.count},(_,i)=>{
    point.fromBufferAttribute(positions,index?index.getX(i):i).applyMatrix4(object.matrixWorld);
    return screen();
   });
   const add=(a,b)=>{
    if(Math.max(a[2],b[2])>=-1&&Math.min(a[2],b[2])<=1)strokes.push([a,b]);
   };
   if(object.isPoints){for(const p of points)add(p,p);continue;}
   const stride=object.isLineSegments?2:1;
   for(let i=1;i<points.length;i+=stride)add(points[i-1],points[i]);
   if(object.isLineLoop&&points.length>1)add(points.at(-1),points[0]);
  }
  const outlines=new WeakMap();
  cached={strokes,outline(region){
   if(!outlines.has(region)){
    const {u,v,n}=basisFor(region);
    outlines.set(region,region.outer.map(([x,y])=>{
     point.copy(u).multiplyScalar(x).addScaledVector(v,y).addScaledVector(n,region.offset);
     return screen();
    }));
   }
   return outlines.get(region);
  }};
  return cached;
 };
}

function edgeExtents(a,b,axis,start,end){
 if(Math.max(a[axis],b[axis])<start||Math.min(a[axis],b[axis])>end)return null;
 const cross=1-axis;
 const delta=b[axis]-a[axis];
 let p=a[cross],q=b[cross];
 if(delta){
  const lo=(start-a[axis])/delta,hi=(end-a[axis])/delta,span=q-p;
  q=p+span*Math.min(1,Math.max(lo,hi));
  p+=span*Math.max(0,Math.min(lo,hi));
 }
 return [Math.min(p,q),Math.max(p,q)];
}

// The entire group must clear the contour across its width or height.
function contourExtents(outlines,axis,start,end){
 let near=Infinity,far=-Infinity;
 for(const outline of outlines){
  for(let i=0,j=outline.length-1;i<outline.length;j=i++){
   const extent=edgeExtents(outline[j],outline[i],axis,start,end);
   if(extent){near=Math.min(near,extent[0]);far=Math.max(far,extent[1]);}
  }
 }
 return [near,far];
}

function clearExteriorPositions({axis,position,size,near,far,strokes,obstacles}){
 const cross=1-axis,edge=position+size[axis],blocked=[];
 for(const [a,b] of strokes){
  const extent=edgeExtents(a,b,axis,position-strokeGap,edge+strokeGap);
  if(extent)blocked.push([extent[0]-size[cross]-strokeGap,extent[1]+strokeGap]);
 }
 for(const rect of obstacles){
  if(edge<=(axis?rect.top:rect.left)-controlGap||position>=(axis?rect.bottom:rect.right)+controlGap)continue;
  blocked.push([(axis?rect.left:rect.top)-size[cross]-controlGap,(axis?rect.right:rect.bottom)+controlGap]);
 }
 blocked.sort((a,b)=>a[0]-b[0]);
 // Slide outward only as far as needed to clear another stroke or control.
 for(const [lo,hi] of blocked)if(far>lo&&far<hi)far=hi;
 for(let i=blocked.length-1;i>=0;i--){const [lo,hi]=blocked[i];if(near>lo&&near<hi)near=lo;}
 return [near,far];
}

export function placeSketchExtrudeShortcut({width,height,panelWidth,panelHeight,anchor,outlines,strokes,obstacles}){
 const size=[panelWidth,panelHeight],last=[width-panelWidth-margin,height-panelHeight-margin];
 if(last.some(edge=>edge<margin))return null;
 const low=[Infinity,Infinity],high=[-Infinity,-Infinity];
 for(const outline of outlines)for(const point of outline)for(let axis=0;axis<2;axis++){
  low[axis]=Math.min(low[axis],point[axis]);high[axis]=Math.max(high[axis],point[axis]);
 }
 if(high[0]<0||high[1]<0||low[0]>width||low[1]>height)return null;

 const origin=[Math.max(0,Math.min(width,anchor.x)),Math.max(0,Math.min(height,anchor.y))];
 let spot=null,bestDistance=Infinity;
 for(const axis of [0,1]){
  const cross=1-axis,positions=new Set();
  const add=value=>positions.add(Math.max(margin,Math.min(last[axis],value)));
  add(origin[axis]-size[axis]/2);add(margin);add(last[axis]);
  const start=Math.max(0,low[axis]),end=Math.min(axis?height:width,high[axis]);
  for(let i=0;i<=8;i++)add(start+(end-start)*i/8-size[axis]/2);
  for(const rect of obstacles){
   add((axis?rect.top:rect.left)-size[axis]-controlGap);
   add((axis?rect.bottom:rect.right)+controlGap);
  }
  for(const position of positions){
   const [near,far]=contourExtents(outlines,axis,position-outlineGap,position+size[axis]+outlineGap);
   const before=Math.min(last[cross],near-size[cross]-outlineGap),after=Math.max(margin,far+outlineGap);
   if(!Number.isFinite(near)||before<margin&&after>last[cross])continue;
   for(const exterior of clearExteriorPositions({axis,position,size,near:before,far:after,strokes,obstacles})){
    if(exterior<margin||exterior>last[cross])continue;
    const [x,y]=axis?[exterior,position]:[position,exterior];
    const distance=Math.hypot(x+panelWidth/2-origin[0],y+panelHeight/2-origin[1]);
    if(distance>=bestDistance)continue;
    bestDistance=distance;spot={x,y};
   }
  }
 }
 return spot;
}
