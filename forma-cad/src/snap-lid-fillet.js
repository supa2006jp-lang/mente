import * as R from 'replicad';
const tuple=v=>{try{return v.toTuple();}finally{v.delete();}};
export function snapLidFilletSettings(p,info,face){
 for(const key of ['filletInside','filletOutside'])if(p[key]!==undefined&&typeof p[key]!=='boolean')throw Error('自動フィレットの設定を確認してください');
 for(const [enabled,key]of [[p.filletInside,'innerFilletRadius'],[p.filletOutside,'outerFilletRadius']])if(enabled&&(!Number.isFinite(p[key])||p[key]<.05||p[key]>1000))throw Error('フィレット半径は0.05〜1000 mmで指定してください');
 const edges=face.edges,vertices=[];let loss=0;
 try{for(const edge of edges)if(edge.geomType==='LINE'){const a=tuple(edge.startPoint),b=tuple(edge.endPoint);for(const [origin,end]of [[a,b],[b,a]]){let vertex=vertices.find(v=>Math.hypot(v.p[0]-origin[0],v.p[1]-origin[1])<1e-6);if(!vertex){vertex={p:origin,directions:[]};vertices.push(vertex);}vertex.directions.push([end[0]-origin[0],end[1]-origin[1]]);}}
 for(const vertex of vertices)if(vertex.directions.length===2){const [a,b]=vertex.directions,dot=(a[0]*b[0]+a[1]*b[1])/Math.hypot(...a)/Math.hypot(...b),angle=Math.acos(Math.max(-1,Math.min(1,dot)));loss=Math.max(loss,1/Math.sin(angle/2)-1);}
 }finally{edges.forEach(e=>e.delete());}
 const box=face.boundingBox;let width;try{const [a,b]=box.bounds;width=Math.min(b[0]-a[0],b[1]-a[1]);}finally{box.delete();}
 const innerRadius=p.filletInside?Math.min(p.innerFilletRadius,Math.max(0,(width-2*p.bodyWall)/4)):0;
 const innerEndRadius=p.filletInside?Math.min(innerRadius,info.bodyHeight-p.floor):0;
 const outerRadius=p.filletOutside?Math.min(p.outerFilletRadius,p.floor-1.2,loss>1e-9?(p.lidWall-p.ridge-1.2)/loss:Infinity,width/4):0;
 if(p.filletInside&&innerRadius<.05)throw Error('本体内面のフィレットを収める空間がありません。壁厚を小さくしてください');
 if(p.filletOutside&&outerRadius<.05)throw Error('外側を丸める余裕がありません。底・天井の厚さや蓋壁厚を増やしてください');
 return {innerRadius,innerEndRadius:innerEndRadius>=.05?innerEndRadius:0,outerRadius,requestedInnerRadius:p.filletInside?p.innerFilletRadius:0,requestedOuterRadius:p.filletOutside?p.outerFilletRadius:0,innerEdges:0,outerEdges:0};
}
export function roundSnapProfile(face,radius){if(radius<.05)return face.clone();try{return R.drawFaceOutline(face).fillet(radius).sketchOnFace(face,'original').face();}catch{throw Error('内側の角を丸められません。フィレット半径を小さくしてください');}}
export function offsetSnapProfile(face,distance){if(Math.abs(distance)<1e-8)return face.clone();const area=R.measureArea(face);for(const sign of [-1,1]){let wire,next;try{wire=face.clone().outerWire().offset2D(sign*Math.abs(distance),'arc');next=R.makeFace(wire);const a=R.measureArea(next);if(a>1e-6&&(distance>0?a<area:a>area)){wire.delete();return next;}}catch{}wire?.delete();next?.delete();}throw Error('角丸の差し込み部分を作成できません。フィレット半径を小さくしてください');}
export function filletSnapEnd(shape,z,radius){if(radius<.05)return {shape:shape.clone(),edges:0};const edges=shape.edges;try{const chosen=edges.filter(e=>[0,.5,1].every(t=>Math.abs(tuple(e.pointAt(t))[2]-z)<1e-5));if(!chosen.length)throw Error('対象の辺がありません');return {shape:shape.fillet(radius,f=>f.inList(chosen)),edges:chosen.length};}catch{throw Error('本体底の内側を丸められません。フィレット半径を小さくしてください');}finally{edges.forEach(e=>e.delete());}}
export function filletSnapOutside(shape,z,radius){if(radius<.05)return {shape:shape.clone(),edges:0};const faces=shape.faces,edges=shape.edges,adjacency=new Map();try{for(const face of faces){if(face.geomType!=='PLANE')continue;const normal=tuple(face.normalAt());if(Math.abs(normal[2])>1e-6)continue;const faceEdges=face.edges;try{for(const e of faceEdges){const list=adjacency.get(e.hashCode)||[];list.push(normal);adjacency.set(e.hashCode,list);}}finally{faceEdges.forEach(e=>e.delete());}}
 const chosen=edges.filter(e=>{const a=tuple(e.startPoint),b=tuple(e.endPoint);if([0,.5,1].every(t=>Math.abs(tuple(e.pointAt(t))[2]-z)<1e-5))return true;const normals=adjacency.get(e.hashCode);return e.geomType==='LINE'&&Math.hypot(a[0]-b[0],a[1]-b[1])<1e-6&&Math.abs(a[2]-b[2])>1e-5&&normals?.length===2&&Math.abs(normals[0][0]*normals[1][0]+normals[0][1]*normals[1][1])<.999999;});
 if(!chosen.length)throw Error('対象の辺がありません');return {shape:shape.fillet(radius,f=>f.inList(chosen)),edges:chosen.length};
 }catch{throw Error('外側の角を丸められません。フィレット半径を小さくしてください');}finally{faces.forEach(f=>f.delete());edges.forEach(e=>e.delete());}}
