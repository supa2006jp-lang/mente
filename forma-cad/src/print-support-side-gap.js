import * as R from 'replicad';
import {supportHorizontalCap} from './print-support-coverage.js';
import {supportOverlapVolume} from './print-support-boolean.js';

const tolerance=1e-6;
function bounds(shape){
 const box=shape.boundingBox;
 try{return box.bounds;}finally{box.delete();}
}
const intersects=(a,b,margin=0)=>a[0].every((low,i)=>{
 const pad=i<2?margin:0;
 return low-pad<b[1][i]-tolerance&&a[1][i]+pad>b[0][i]+tolerance;
});

export function sideGapFootprint(prism,bodies,top,isTop=true){
 const [low,high]=bounds(prism);
 const from=[low[0]-1,low[1]-1,top-.02],to=[high[0]+1,high[1]+1,top];
 const models=[...bodies.values()].filter(body=>intersects(bounds(body),[from,to]));
 if(!models.length&&isTop)return supportHorizontalCap(prism,top);
 const slab=R.makeBox(from,to);
 let section;
 try{
  section=prism.intersect(slab);
  for(const model of models){
   const free=section.cut(model);section.delete();section=free;
  }
  return supportHorizontalCap(section,top);
 }finally{section?.delete();slab.delete();}
}

function planeGuard(face,box,gap){
 const normal=face.normalAt();
 try{
  const [x,y,z]=normal.toTuple(),horizontal=Math.hypot(x,y);
  if(horizontal<tolerance)return null;
  const displacement=new R.Vector([gap*x/horizontal,gap*y/horizontal,0]);
  try{
   const shape=R.basicFaceExtrusion(face,displacement);
   const axis=Math.abs(y)<tolerance?0:Math.abs(x)<tolerance?1:null;
   if(axis===null||Math.abs(z)>=tolerance)return {shape};
   const sign=Math.sign(axis===0?x:y),wall=(box[0][axis]+box[1][axis])/2;
   return {shape,alignment:{axis,sign,wall,limit:wall+sign*gap}};
  }finally{displacement.delete();}
 }finally{normal.delete();}
}

function cylinderGuard(face,[low,high],gap){
 const owned=[],hold=item=>{owned.push(item);return item;};
 try{
  const surface=hold(face.surface),cylinder=hold(surface.wrapped.Cylinder());
  const position=hold(cylinder.Position()),origin=hold(position.Location()),z=hold(position.Direction());
  if(Math.abs(z.Z())<1-tolerance)return null;
  const radius=cylinder.Radius(),height=high[2]-low[2],outer=radius+gap,inner=Math.max(0,radius-gap);
  const {uMin:from,uMax:to}=face.UVBounds;
  if(to-from>=2*Math.PI-tolerance){
   const outside=R.makeCylinder(outer,height,[origin.X(),origin.Y(),low[2]]);
   if(inner<tolerance)return outside;
   hold(outside);
   return outside.cut(hold(R.makeCylinder(inner,height,[origin.X(),origin.Y(),low[2]])));
  }
  if(to-from<tolerance)return null;
  const x=hold(position.XDirection()),y=hold(position.YDirection());
  const at=(r,u)=>[origin.X()+r*(x.X()*Math.cos(u)+y.X()*Math.sin(u)),
   origin.Y()+r*(x.Y()*Math.cos(u)+y.Y()*Math.sin(u))];
  const arc=(drawing,r,a,b)=>{
   const mid=(a+b)/2;
   drawing.threePointsArcTo(at(r,mid),at(r,(a+mid)/2)).threePointsArcTo(at(r,b),at(r,(mid+b)/2));
  };
  const profile=R.draw(at(outer,from));
  arc(profile,outer,from,to);
  profile.lineTo(at(inner,to));
  if(inner>=tolerance)arc(profile,inner,to,from);
  return profile.close().sketchOnPlane('XY',low[2]).extrude(height);
 }finally{owned.reverse().forEach(item=>item.delete());}
}

// Extrude the clearance horizontally so a landing can still touch its floor.
export function createSupportSideGap(bodies,scope,gap){
 const tools=[];
 const dispose=()=>tools.forEach(({shape})=>shape.delete());
 if(!gap)return {cuts:()=>false,trim:shape=>shape,trimRib:shape=>shape,placement:()=>({}),dispose};
 try{
  for(const body of bodies.values()){
   if(!intersects(bounds(body),scope,gap))continue;
   const faces=body.faces;
   try{
    for(const face of faces){
     const box=bounds(face);
     if(!intersects(box,scope,gap))continue;
     const tool=face.geomType==='PLANE'?planeGuard(face,box,gap):
      face.geomType==='CYLINDRE'?{shape:cylinderGuard(face,box,gap)}:null;
     if(tool?.shape)tools.push({...tool,box:bounds(tool.shape)});
    }
   }finally{faces.forEach(face=>face.delete());}
   const edges=body.edges;
   try{
    for(const edge of edges){
     if(edge.geomType!=='LINE')continue;
     const box=bounds(edge);
     const height=box[1][2]-box[0][2];
     if(height<tolerance||box[1][0]-box[0][0]>tolerance||box[1][1]-box[0][1]>tolerance||!intersects(box,scope,gap))continue;
     const [x,y,z]=box[0];
     const shape=R.makeCylinder(gap,height,[x,y,z]);
     tools.push({shape,box:bounds(shape)});
    }
   }finally{edges.forEach(edge=>edge.delete());}
  }
 }catch(error){dispose();throw error;}
 return {
  sectionLevels(prismBounds,top){
   const levels=new Set();
   for(const {box} of tools){
    const [low,high]=box;
    if(high[2]>=top-tolerance||!intersects(box,prismBounds))continue;
    const floor=Math.max(low[2],prismBounds[0][2]);
    if(high[2]-floor<.04)continue;
    levels.add(Math.round((high[2]-.01)*10000)/10000);
   }
   const sorted=[...levels].sort((a,b)=>a-b);
   // Prioritize distinct elevations without repeating the same wall slice.
   return sorted.length<=6?sorted:Array.from({length:6},(_,i)=>sorted[Math.round(i*(sorted.length-1)/5)]);
  },
  placement(prism,prismBounds,axis,thickness){
   const [lo,hi]=prismBounds.map(row=>row[axis]),result={};
   // An edge beside a partial wall still needs a continuous first rib.
   // Use the wall's clearance line where its guard reaches the outer strip.
   for(const tool of tools){
    const wall=tool.alignment;
    if(!wall||wall.axis!==axis||!intersects(tool.box,prismBounds))continue;
    const fromLow=wall.sign>0;
    if(fromLow?(wall.wall>=lo+thickness||wall.limit<=lo):(wall.wall<=hi-thickness||wall.limit>=hi))continue;
    if(Math.abs(supportOverlapVolume(prism,tool.shape))<=tolerance)continue;
    if(fromLow)result.low=Math.max(result.low??lo,wall.limit);
    else result.high=Math.min(result.high??hi,wall.limit);
   }
   return result;
  },
  trim(shape,own){
   const box=bounds(shape);
   let trimmed=shape;
   for(const tool of tools)if(intersects(tool.box,box))trimmed=own(trimmed.cut(tool.shape));
   return trimmed;
  },
  trimRib(shape,axis,own){
   const box=bounds(shape);
   let trimmed=shape;
   for(const tool of tools){
    if(!intersects(tool.box,box))continue;
    const overlap=trimmed.intersect(tool.shape);
    try{
     if(Math.abs(R.measureVolume(overlap))<=tolerance)continue;
     const parts=overlap.solids;
     try{
      for(const part of parts){
       const [low,high]=bounds(part);
       // Remove the entire strip at the obstruction to keep its remaining width.
       low[axis]=box[0][axis]-1;high[axis]=box[1][axis]+1;
       const cutter=R.makeBox(low,high);
       try{trimmed=own(trimmed.cut(cutter));}finally{cutter.delete();}
       if(Math.abs(R.measureVolume(trimmed))<=tolerance)return null;
      }
     }finally{parts.forEach(part=>part.delete());}
    }finally{overlap.delete();}
   }
   return trimmed;
  },
  cuts(shape){
   const box=bounds(shape);
   return tools.some(tool=>intersects(tool.box,box)&&Math.abs(supportOverlapVolume(shape,tool.shape))>tolerance);
  },
  dispose,
 };
}
