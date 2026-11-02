import * as THREE from 'three';
import Clipper from 'clipper-lib';
import {basisFor} from './frames.js';

export const referenceCrop=f=>f.crop||{x:0,y:0,width:1,height:1};
export function validateReferenceCrop(c){
 if(!c||![c.x,c.y,c.width,c.height].every(Number.isFinite)||c.x<0||c.y<0||c.width<=0||c.height<=0||c.x+c.width>1.00000001||c.y+c.height>1.00000001)throw Error('トリミング範囲を写真の内側に指定してください');return c;
}
export function applyReferenceCrop(f,crop){
 validateReferenceCrop(crop);const old=referenceCrop(f),w=f.width/old.width,h=f.height/old.height,dx=(crop.x+crop.width/2-old.x-old.width/2)*w,dy=-(crop.y+crop.height/2-old.y-old.height/2)*h,a=f.angle*Math.PI/180;
 return {...f,crop:{...crop},width:w*crop.width,height:h*crop.height,center:[f.center[0]+dx*Math.cos(a)-dy*Math.sin(a),f.center[1]+dx*Math.sin(a)+dy*Math.cos(a)]};
}
export function faceReferencePlane(face){
 if(!face?.bodyId||!face.outer?.length)throw Error('写真を貼るソリッドの平らな面を選択してください');const b=basisFor(face),xs=face.outer.map(p=>p[0]),ys=face.outer.map(p=>p[1]),min=[Math.min(...xs),Math.min(...ys)],max=[Math.max(...xs),Math.max(...ys)];
 return {plane:'CUSTOM',frame:{u:b.u.toArray(),v:b.v.toArray(),n:b.n.toArray()},offset:face.offset,fitBounds:{center:min.map((v,i)=>(v+max[i])/2),width:max[0]-min[0],height:max[1]-min[1]},surface:{bodyId:face.bodyId,outer:structuredClone(face.outer),holes:structuredClone(face.holes||[])}};
}
export function referencePlacement(plane,ratio){
 const fit=plane.fitBounds,width=fit?Math.min(fit.width,fit.height/ratio)*.95:100;return {plane:plane.plane,frame:structuredClone(plane.frame),offset:plane.offset,width,height:width*ratio,center:fit?[...fit.center]:[0,0],...(plane.surface?{surface:structuredClone(plane.surface)}:{})};
}
// Intersect the photo rectangle with the actual face, preserving its holes.
// Vertices are in normalized photo coordinates; source cropping stays in UVs.
export function referenceSurfaceGeometry(f){
 if(!f.surface)return new THREE.PlaneGeometry(1,1);
 const a=-f.angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a),scale=1e6,path=ring=>ring.map(p=>{const x=p[0]-f.center[0],y=p[1]-f.center[1];return {X:Math.round((x*c-y*s)/f.width*scale),Y:Math.round((x*s+y*c)/f.height*scale)};}),outer=path(f.surface.outer),holes=f.surface.holes.map(path);
 if(!Clipper.Clipper.Orientation(outer))outer.reverse();for(const h of holes)if(Clipper.Clipper.Orientation(h))h.reverse();const clip=new Clipper.Clipper(),tree=new Clipper.PolyTree(),q=scale/2;clip.AddPaths([outer,...holes],Clipper.PolyType.ptSubject,true);clip.AddPath([{X:-q,Y:-q},{X:q,Y:-q},{X:q,Y:q},{X:-q,Y:q}],Clipper.PolyType.ptClip,true);clip.Execute(Clipper.ClipType.ctIntersection,tree,Clipper.PolyFillType.pftNonZero,Clipper.PolyFillType.pftNonZero);
 const shapes=[];for(let node=tree.GetFirst();node;node=node.GetNext()){if(node.IsHole())continue;const points=node.Contour().map(p=>new THREE.Vector2(p.X/scale,p.Y/scale)),shape=new THREE.Shape(points);shape.holes=node.Childs().filter(h=>h.IsHole()).map(h=>new THREE.Path(h.Contour().map(p=>new THREE.Vector2(p.X/scale,p.Y/scale))));shapes.push(shape);}
 const geometry=new THREE.ShapeGeometry(shapes),p=geometry.attributes.position,uv=new Float32Array(p.count*2);for(let i=0;i<p.count;i++){uv[i*2]=p.getX(i)+.5;uv[i*2+1]=p.getY(i)+.5;}geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));return geometry;
}
