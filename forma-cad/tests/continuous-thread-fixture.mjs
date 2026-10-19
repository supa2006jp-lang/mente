import * as R from 'replicad';
import {cadMesh} from '../src/cad-mesh.js';
export function headedThreadSeed(){
 const points=Array.from({length:6},(_,i)=>[10*Math.cos(i*Math.PI/3),10*Math.sin(i*Math.PI/3)]);let drawing=R.draw(points[0]);for(const point of points.slice(1))drawing=drawing.lineTo(point);
 const head=drawing.close().sketchOnPlane('XY').extrude(10),stem=R.makeCylinder(5,40,[0,0,10]);let body;
 try{body=head.fuse(stem);const faces=body.faces;try{return {kind:'cadop',id:'source',name:'六角頭付きM10',remove:[],outputs:[{id:'bolt',...cadMesh(body),brep:body.serialize(),cadCoordinatePrecision:true,planarFaces:faces.filter(f=>f.geomType==='PLANE').map(f=>f.hashCode)}]};}finally{faces.forEach(f=>f.delete());}}
 finally{body?.delete();head.delete();stem.delete();}
}
