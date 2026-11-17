import Clipper from 'clipper-lib';
import {Vector3} from 'three';

// Union projected solid faces so overlapping bodies stay filled and through
// holes show the paper wherever no solid lies behind them.
export function drawingSilhouette(mesh,normal,horizontal){
 const right=new Vector3(...horizontal).normalize();
 const down=right.clone().cross(new Vector3(...normal)).normalize();
 const scale=10000;
 const points=[];
 for(let i=0;i<mesh.vertices.length;i+=3){
  const x=mesh.vertices[i],y=mesh.vertices[i+1],z=mesh.vertices[i+2];
  points.push({
   X:Math.round(scale*(x*right.x+y*right.y+z*right.z)),
   Y:Math.round(scale*(x*down.x+y*down.y+z*down.z)),
  });
 }
 const clipper=new Clipper.Clipper();
 const {triangles}=mesh;
 for(let i=0;i<triangles.length;i+=3){
  const a=points[triangles[i]],b=points[triangles[i+1]],c=points[triangles[i+2]];
  const area=(b.X-a.X)*(c.Y-a.Y)-(b.Y-a.Y)*(c.X-a.X);
  if(area)clipper.AddPath(area>0?[a,b,c]:[c,b,a],Clipper.PolyType.ptSubject,true);
 }
 const rings=[];
 const fill=Clipper.PolyFillType.pftNonZero;
 clipper.Execute(Clipper.ClipType.ctUnion,rings,fill,fill);
 return rings.map(ring=>'M '+ring.map(({X,Y})=>X/scale+' '+Y/scale).join(' L ')+' Z').join(' ');
}
