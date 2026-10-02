import * as R from 'replicad';
// SVG coordinates of the three standard orthographic views.
export function sectionPlane(s){
 const vertical=s.orientation==='vertical';
 const axis=s.view==='right'?(vertical?1:2):s.view==='front'?(vertical?0:2):(vertical?0:1);
 const coordinate=vertical?s.coordinate:-s.coordinate,keep=(vertical?1:-1)*(s.reverse?-1:1);
 const direction=[0,0,0];direction[axis]=-keep;
 const x=axis===0?[0,-keep,0]:axis===1?[keep,0,0]:[1,0,0];
 return {axis,coordinate,keep,direction,x};
}
export function sectionProjection(compound,bounds,s){
 const {axis,coordinate,keep,direction,x}=sectionPlane(s);
 if(coordinate<=bounds[0][axis]+1e-6||coordinate>=bounds[1][axis]-1e-6)throw Error('切断線をソリッドの内側に置いてください');
 const pad=Math.max(1,...bounds[1].map((v,i)=>v-bounds[0][i]))*2,low=bounds[0].map(v=>v-pad),high=bounds[1].map(v=>v+pad);
 if(keep>0)high[axis]=coordinate;else low[axis]=coordinate;
 const cutter=R.makeBox(low,high),camera=new R.ProjectionCamera([0,0,0],direction,x);let cut;
 try{cut=compound.asShape3D().cut(cutter);if(R.measureVolume(cut)<1e-9)throw Error('この位置には断面がありません');
 const p=R.drawProjection(cut,camera),view={visible:p.visible.toSVGPaths().flat(Infinity),hidden:p.hidden.toSVGPaths().flat(Infinity),viewBox:p.visible.toSVGViewBox(0).trim().split(/\s+/).map(Number),triangles:[]};
 // Project only new planar cap faces. Triangulation respects inner wires (holes).
 cut.mesh({tolerance:.015,angularTolerance:.1});
 const y=[direction[1]*x[2]-direction[2]*x[1],direction[2]*x[0]-direction[0]*x[2],direction[0]*x[1]-direction[1]*x[0]],dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
 for(const face of cut.faces){try{if(face.geomType!=='PLANE')continue;const box=face.boundingBox;let bb;try{bb=box.bounds;}finally{box.delete();}if(bb.some(p=>Math.abs(p[axis]-coordinate)>1e-5))continue;const t=face.triangulation();if(!t)continue;for(let i=0;i<t.trianglesIndexes.length;i+=3){view.triangles.push(t.trianglesIndexes.slice(i,i+3).map(j=>{const v=t.vertices.slice(j*3,j*3+3);return [dot(v,x),-dot(v,y)];}));}}finally{face.delete();}}
 if(!view.triangles.length)throw Error('切断線が材質に交差していません。位置を変更してください');
 return view;
 }finally{cut?.delete();camera.delete();cutter.delete();}
}
