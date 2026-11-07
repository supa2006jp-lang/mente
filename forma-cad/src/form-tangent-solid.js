import * as R from 'replicad';
import {formCurvePoles,formError,formKnots} from './form-profile.js';
import {formWorld} from './form-orientation.js';
import {constrainFormTangent} from './form-seam.js';

export function makeTangentFormSolid(rings,seams,axes,endWires){
 const knots=[...new Set(rings.flatMap(formKnots))].sort((a,b)=>a-b);
 if(knots.length*(rings.length-1)>320)
  throw formError('接線接続の曲面が複雑すぎます。制御点かガイド線を減らしてください。');
 const rows=rings.map(ring=>formCurvePoles(ring,knots));
 const count=knots.length,edgeNormals={start:[],end:[]};
 for(const seam of seams){
  const from=knots.indexOf(seam.from);
  for(let i=from;knots[i]!==seam.to;i=(i+1)%count)edgeNormals[seam.end][i]=seam.normal;
 }
 const derivatives=rows.map((row,s)=>{
  const prev=Math.max(0,s-1),next=Math.min(rows.length-1,s+1),height=rings[next].z-rings[prev].z;
  const normals=s===0?edgeNormals.start:s===rows.length-1?edgeNormals.end:[];
  return row.map((curve,i)=>curve.map((_,j)=>{
   const before=rows[prev][i][j],after=rows[next][i][j];
   const dx=(after[0]-before[0])/height,dy=(after[1]-before[1])/height;
   return constrainFormTangent(dx,dy,[normals[i],j===0?normals[(i+count-1)%count]:j===3?normals[(i+1)%count]:null].filter(Boolean));
  }));
 });
 const oc=R.getOC(),owned=[],faces=[];
 const keep=value=>{owned.push(value);return value;};
 try{
  const params=keep(new oc.NCollection_Array1_double(1,2)),mult=keep(new oc.NCollection_Array1_int(1,2));
  params.SetValue(1,0);params.SetValue(2,1);mult.SetValue(1,4);mult.SetValue(2,4);
  const poles=keep(new oc.NCollection_Array2_gp_Pnt(1,4,1,4));
  const point=keep(new oc.gp_Pnt(0,0,0));
  for(let s=0;s<rows.length-1;s++){
   const a=rings[s].z,b=rings[s+1].z,dt=(b-a)/3;
   for(let i=0;i<count;i++){
    for(let u=0;u<4;u++){
     const [x,y]=rows[s][i][u],[xx,yy]=rows[s+1][i][u];
     const [dx,dy]=derivatives[s][i][u],[ex,ey]=derivatives[s+1][i][u];
     const controls=[[x,y,a],[x+dx*dt,y+dy*dt,a+dt],[xx-ex*dt,yy-ey*dt,b-dt],[xx,yy,b]];
     for(const [v,control] of controls.entries()){
      const world=formWorld(axes,...control);point.SetCoord(world.x,world.y,world.z);
      poles.SetValue(u+1,v+1,point);
     }
    }
    const surface=new oc.Geom_BSplineSurface(poles,params,params,mult,mult,3,3,false,false);
    let maker;
    try{
     maker=new oc.BRepBuilderAPI_MakeFace(surface,1e-7);
     faces.push(new R.Face(maker.Face()));
    }finally{maker?.delete();surface.delete();}
   }
  }
  for(const wire of endWires)faces.push(R.makeFace(wire));
  return R.makeSolid(faces);
 }finally{
  faces.forEach(face=>face.delete());
  owned.reverse().forEach(value=>value.delete());
 }
}
