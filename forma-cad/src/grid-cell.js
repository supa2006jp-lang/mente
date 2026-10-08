import Clipper from 'clipper-lib';
import {faceGridBounds} from './face-grid.js';
const SCALE=100000;
const rectangle=(u,v)=>[[u[0],v[0]],[u[1],v[0]],[u[1],v[1]],[u[0],v[1]]];
function path(ring,outer=true){const p=ring.map(([x,y])=>({X:Math.round(x*SCALE),Y:Math.round(y*SCALE)}));if(Clipper.Clipper.Orientation(p)!==outer)p.reverse();return p;}
export function faceGridCellRegions(face,point,step,{mode='face',patches=[]}={}){
 if(!Number.isFinite(step)||step<=0||!point.every(Number.isFinite))return [];
 const u=[Math.floor(point[0]/step)*step,0],v=[Math.floor(point[1]/step)*step,0];u[1]=u[0]+step;v[1]=v[0]+step;const cell=rectangle(u,v),coverage=[];
 if(mode==='face'&&face.outer){coverage.push(path(face.outer),...face.holes.map(h=>path(h,false)),...patches.map(p=>path(rectangle(p.u,p.v))));}
 else if(mode==='100'||mode==='200'){const bounds=faceGridBounds(face,mode);coverage.push(path(rectangle(bounds.u,bounds.v)));}
 else coverage.push(path(cell));
 const clipper=new Clipper.Clipper(),tree=new Clipper.PolyTree();clipper.AddPaths(coverage,Clipper.PolyType.ptSubject,true);clipper.AddPath(path(cell),Clipper.PolyType.ptClip,true);clipper.Execute(Clipper.ClipType.ctIntersection,tree,Clipper.PolyFillType.pftNonZero,Clipper.PolyFillType.pftNonZero);
 // Keep polygon profiles independent of the source CAD face: referencing it would extrude the whole face.
 const regions=[];for(let node=tree.GetFirst();node;node=node.GetNext()){if(node.IsHole())continue;const holes=node.Childs().filter(n=>n.IsHole()),area=(Math.abs(Clipper.Clipper.Area(node.Contour()))-holes.reduce((s,h)=>s+Math.abs(Clipper.Clipper.Area(h.Contour())),0))/(SCALE*SCALE);if(area<1e-6)continue;regions.push({id:'grid-cell-'+crypto.randomUUID(),plane:face.plane,frame:face.frame?structuredClone(face.frame):undefined,offset:face.offset,outer:node.Contour().map(p=>[p.X/SCALE,p.Y/SCALE]),holes:holes.map(h=>h.Contour().map(p=>[p.X/SCALE,p.Y/SCALE])),area,sourceIds:[]});}
 return regions;
}
