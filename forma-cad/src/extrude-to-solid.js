import * as R from 'replicad';

const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const normalize=value=>{
 const length=Math.hypot(...value);
 if(!Number.isFinite(length)||length<1e-9)throw Error('押し出し方向を指定してください');
 return value.map(v=>v/length);
};
function projectedBounds(shape,axes){
 const box=shape.boundingBox;
 try{
  const [lo,hi]=box.bounds;
  return axes.map(axis=>{
   let min=Infinity,max=-Infinity;
   for(const x of [lo[0],hi[0]])for(const y of [lo[1],hi[1]])for(const z of [lo[2],hi[2]]){
    const value=dot([x,y,z],axis);min=Math.min(min,value);max=Math.max(max,value);
   }
   return [min,max];
  });
 }finally{box.delete();}
}
function overlaps(a,b){return a[1]>=b[0]-1e-7&&b[1]>=a[0]-1e-7;}
function positiveSolid(shape){
 const volume=R.measureVolume(shape);
 if(!Number.isFinite(volume))throw Error('接触先の掃引形状を作成できませんでした');
 if(volume<0)shape.wrapped.Reverse();
 return Math.abs(volume)>1e-10;
}
function forwardEndContact(tool,blocker,direction){
 if(R.measureDistanceBetween(tool,blocker)>1e-6)return false;
 // A shallow forward probe crosses an end-on contact but remains disjoint at
 // side-wall tangencies. It lets an exactly reached face count as a hit.
 const probe=tool.clone().translate(direction.map(value=>value*.01));
 let intersection;
 try{intersection=probe.intersect(blocker);return Math.abs(R.measureVolume(intersection))>1e-8;}
 finally{intersection?.delete();probe.delete();}
}
function endCapPlane(shape,direction){
 let plane=-Infinity;
 for(const face of shape.faces){
  try{
   if(face.geomType!=='PLANE')continue;
   const normal=face.normalAt();
   let alignment;
   try{alignment=dot(normal.toTuple(),direction);}finally{normal.delete();}
   if(alignment<.999)continue;
   const center=face.center;
   try{plane=Math.max(plane,dot(center.toTuple(),direction));}finally{center.delete();}
  }finally{face.delete();}
 }
 if(!Number.isFinite(plane))throw Error('押し出しの終端面を確認できませんでした');
 return plane;
}
function trimUncontactedEndCaps(tool,result,blockers,direction){
 // A face left at the search boundary can contain both exact end contacts
 // and rays with no destination. Remove only the latter columns.
 const endPlane=endCapPlane(tool,direction),startPlane=-endCapPlane(tool,direction.map(value=>-value));
 const probeLength=.001,vector=new R.Vector(direction.map(value=>value*probeLength));
 const backward=new R.Vector(direction.map(value=>-value*(endPlane-startPlane+.1)));
 let trimmed=result.clone();
 try{
  for(const face of result.faces){
   let probe,remaining;
   try{
    if(face.geomType!=='PLANE')continue;
    const normal=face.normalAt();
    let alignment;
    try{alignment=dot(normal.toTuple(),direction);}finally{normal.delete();}
    if(alignment<.999)continue;
    const center=face.center;
    let plane;
    try{plane=dot(center.toTuple(),direction);}finally{center.delete();}
    if(Math.abs(plane-endPlane)>1e-5)continue;
    probe=R.basicFaceExtrusion(face,vector);
    if(!positiveSolid(probe))continue;
    remaining=probe.clone();
    for(const blocker of blockers){
     if(!blocker||R.measureDistanceBetween(face,blocker)>1e-5)continue;
     const next=remaining.cut(blocker);
     remaining.delete();remaining=next;
     if(Math.abs(R.measureVolume(remaining))<1e-10)break;
    }
    for(const openFace of remaining.faces){
     let shadow;
     try{
      if(openFace.geomType!=='PLANE')continue;
      const normal=openFace.normalAt();
      let alignment;
      try{alignment=dot(normal.toTuple(),direction);}finally{normal.delete();}
      if(alignment>-.999)continue;
      const center=openFace.center;
      let plane;
      try{plane=dot(center.toTuple(),direction);}finally{center.delete();}
      if(Math.abs(plane-endPlane)>1e-5||R.measureArea(openFace)<1e-7)continue;
      shadow=R.basicFaceExtrusion(openFace,backward);
      if(!positiveSolid(shadow))continue;
      const next=trimmed.cut(shadow);
      trimmed.delete();trimmed=next;
     }finally{shadow?.delete();openFace.delete();}
    }
   }finally{remaining?.delete();probe?.delete();face.delete();}
  }
  const output=trimmed;trimmed=null;return output;
 }finally{trimmed?.delete();backward.delete();vector.delete();}
}
function appendCurvedFaceSweeps(face,vector,direction,parts,tolerance,angularTolerance){
 // Sweep an entirely entry-facing analytic face exactly when OCC can
 // make a valid prism. Faces with mixed directions use front-facing patches.
 const mesh=face.mesh({tolerance,angularTolerance});
 const vertices=mesh.vertices,indices=mesh.triangles;
 if(indices.length>12000)throw Error('接触先の曲面が複雑すぎます。対象を分割するか輪郭を簡略化してください');
 let entering=false,exiting=false;
 for(let i=0;i<indices.length;i+=3){
  const triangle=[0,1,2].map(j=>vertices.slice(indices[i+j]*3,indices[i+j]*3+3));
  const normal=cross(triangle[1].map((value,k)=>value-triangle[0][k]),triangle[2].map((value,k)=>value-triangle[0][k]));
  if(Math.hypot(...normal)<1e-9)continue;
  if(dot(normal,direction)<-1e-8)entering=true;
  if(dot(normal,direction)>1e-8)exiting=true;
 }
 if(!entering)return;
 if(!exiting){
  let exact;
  try{
   exact=R.basicFaceExtrusion(face,vector);
   if(positiveSolid(exact)){
    const check=new (R.getOC().BRepCheck_Analyzer)(exact.wrapped,true,false);
    let valid;
    try{valid=check.IsValid();}finally{check.delete();}
    if(valid){parts.push(exact);exact=null;return;}
   }
  }catch{/* Some periodic or self-intersecting faces need the mesh fallback. */}
  finally{exact?.delete();}
 }
 for(let i=0;i<indices.length;i+=3){
  const triangle=[0,1,2].map(j=>vertices.slice(indices[i+j]*3,indices[i+j]*3+3));
  const normal=cross(triangle[1].map((v,k)=>v-triangle[0][k]),triangle[2].map((v,k)=>v-triangle[0][k]));
  // Periodic seams can produce collapsed tessellation triangles.
  if(Math.hypot(...normal)<1e-9||dot(normal,direction)>=-1e-8)continue;
  const patch=R.makePolygon(triangle);
  try{
   const shadow=R.basicFaceExtrusion(patch,vector);
   try{if(positiveSolid(shadow))parts.push(shadow);else shadow.delete();}
   catch(error){shadow.delete();throw error;}
  }finally{patch.delete();}
 }
}

function furthestAlong(shape,direction){
 let aligned=shape.clone();
 try{
  const axis=cross(direction,[0,0,1]),length=Math.hypot(...axis);
  if(length>1e-9)aligned=aligned.rotate(Math.acos(Math.max(-1,Math.min(1,direction[2])))*180/Math.PI,[0,0,0],axis.map(value=>value/length));
  else if(direction[2]<0)aligned=aligned.rotate(180,[0,0,0],[1,0,0]);
  const box=aligned.boundingBox;
  try{return box.bounds[1][2];}finally{box.delete();}
 }finally{aligned.delete();}
}
export function contactSearchDistance(tool,blockers,direction){
 const d=normalize(direction),guide=Math.abs(d[2])<.9?[0,0,1]:[0,1,0];
 const u=normalize(cross(guide,d)),v=cross(d,u),axes=[d,u,v],bounds=projectedBounds(tool,axes);
 const start=-endCapPlane(tool,d.map(value=>-value));
 let far=-Infinity;
 for(const blocker of blockers){
  const b=projectedBounds(blocker,axes);
  if(!overlaps(bounds[1],b[1])||!overlaps(bounds[2],b[2])||b[0][1]<=start+1e-7)continue;
  far=Math.max(far,b[0][1]-start);
 }
 if(!Number.isFinite(far))throw Error('押し出し方向に接触するソリッドがありません');
 return Math.min(10000,Math.max(.1,far+.1));
}
function cropAtPlane(shape,axes,bounds,start,stop){
 const [d,u,v]=axes,point=(a,b)=>d.map((value,i)=>value*(start-.01)+u[i]*a+v[i]*b);
 const a=bounds[1][0]-.1,b=bounds[1][1]+.1,c=bounds[2][0]-.1,e=bounds[2][1]+.1;
 const face=R.makePolygon([point(a,c),point(b,c),point(b,e),point(a,e)]);
 const vector=new R.Vector(d.map(value=>value*(stop-start+.01)));
 let slab;
 try{slab=R.basicFaceExtrusion(face,vector);return shape.intersect(slab);}
 finally{slab?.delete();vector.delete();face.delete();}
}

/**
 * Stop each portion of an extrusion at its first contact with any blocker.
 * The tool is the already-created finite extrusion at maxDistance; direction
 * points from its profile toward its end. The caller owns the inputs and output.
 * Do not include the extrusion's source body when the profile starts on it.
 *
 * Each entry-facing blocker surface is swept toward the tool's far end.
 * Subtracting these shadows removes everything after the first hit on each
 * ray. Unmatched rays stop at the farthest genuine first contact. A shorter
 * manual depth crops at that limit. contactOnly omits unmatched rays.
 */
export function clipExtrusionAtSolids(tool,blockers,direction,maxDistance,{curveTolerance=.08,curveAngularTolerance=.25,maxDepth=maxDistance,contactInfo,contactOnly=false}={}){
 if(!tool||!blockers||!Number.isFinite(maxDistance)||maxDistance<.1||maxDistance>10000)throw Error('接触までの押し出し距離を 0.1〜10000 mm で指定してください');
 const d=normalize(Array.isArray(direction)?direction:direction.toArray());
 const guide=Math.abs(d[2])<.9?[0,0,1]:[0,1,0],u=normalize(cross(guide,d)),v=cross(d,u),axes=[d,u,v];
 const toolBounds=projectedBounds(tool,axes);
 const startPlane=-endCapPlane(tool,d.map(value=>-value)),endPlane=endCapPlane(tool,d);
 let result=tool.clone(),matched=false,previewContacted;
 try{
  for(const blocker of blockers){
   if(!blocker)continue;
   const blockerBounds=projectedBounds(blocker,axes);
   if(blockerBounds[0][0]>toolBounds[0][1]+1e-7||blockerBounds[0][1]<=toolBounds[0][0]+1e-7||!overlaps(toolBounds[1],blockerBounds[1])||!overlaps(toolBounds[2],blockerBounds[2]))continue;
   // Keep only the blocker in front of the sketch. A rear cavity wall must
   // not cast a shadow across the starting plane.
   const sweepLength=toolBounds[0][1]-blockerBounds[0][0]+.1;
   if(sweepLength<=0)continue;
   const vector=new R.Vector(d.map(x=>x*sweepLength)),parts=[],groups=[];
   let contactBody,forwardHalf,base,halfVector;
   try{
    // Only sweep the destination inside the extrusion's transverse footprint.
    // A full periodic cone can mix entry and exit patches; sweeping its
    // overlapping tessellation as a compound may erase the valid bridge.
    // Cropping first separates these patches and retains the analytic surface.
    const uMin=Math.max(blockerBounds[1][0],toolBounds[1][0])-.2,uMax=Math.min(blockerBounds[1][1],toolBounds[1][1])+.2;
    const vMin=Math.max(blockerBounds[2][0],toolBounds[2][0])-.2,vMax=Math.min(blockerBounds[2][1],toolBounds[2][1])+.2;
    const point=(a,b)=>d.map((value,i)=>value*startPlane+u[i]*a+v[i]*b);
    base=R.makePolygon([point(uMin,vMin),point(uMax,vMin),point(uMax,vMax),point(uMin,vMax)]);
    halfVector=new R.Vector(d.map(value=>value*(endPlane-startPlane+.1)));
    forwardHalf=R.basicFaceExtrusion(base,halfVector);
    contactBody=blocker.intersect(forwardHalf);
    for(const face of contactBody.faces){
     try{
      if(face.geomType==='PLANE'){
       const normal=face.normalAt();
       let entering;
       try{entering=dot(normal.toTuple(),d)<-1e-7;}finally{normal.delete();}
       if(!entering)continue;
       const swept=R.basicFaceExtrusion(face,vector);
       try{if(positiveSolid(swept)){parts.push(swept);groups.push([swept]);}else swept.delete();}
       catch(error){swept.delete();throw error;}
      }else{const start=parts.length;appendCurvedFaceSweeps(face,vector,d,parts,curveTolerance,curveAngularTolerance);if(parts.length>start)groups.push(parts.slice(start));}
     }finally{face.delete();}
    }
    for(const group of groups){
     let shadow;
     try{
      // Overlapping planar face prisms must be cut one at a time. OCC can
      // leave an overlapping compound unchanged even when each prism cuts.
      shadow=group.length===1?group[0].clone():R.makeCompound(group).asShape3D();
      const previousVolume=Math.abs(R.measureVolume(result));
      const next=result.cut(shadow);
      const nextVolume=Math.abs(R.measureVolume(next));
      if(previousVolume-nextVolume>Math.max(1e-7,previousVolume*1e-9))matched=true;
      result.delete();result=next;
     }finally{shadow?.delete();}
    }
    if(!matched&&forwardEndContact(result,blocker,d))matched=true;
   }finally{contactBody?.delete();forwardHalf?.delete();base?.delete();halfVector?.delete();for(const part of parts)part.delete();vector.delete();}
  }
  // A curved entry face is tessellated for its forward shadow. The facets
  // may start slightly inside the analytic surface, so remove any remaining
  // true blocker intersection before accepting the contacted tool.
  for(const blocker of blockers){
   if(!blocker)continue;
   let intersection;
   try{
    intersection=result.intersect(blocker);
    if(Math.abs(R.measureVolume(intersection))>1e-8){
     const trimmed=result.cut(blocker);
     result.delete();result=trimmed;
    }
   }finally{intersection?.delete();}
  }
  if(!matched)throw Error('押し出し方向に接触するソリッドがありません');
  if(Math.abs(R.measureVolume(result))<1e-9)throw Error('押し出し領域が接触先で完全に塞がれています');
  let contacted=trimUncontactedEndCaps(tool,result,blockers,d);
  let lastContact;
  try{
   if(Math.abs(R.measureVolume(contacted))<1e-9)throw Error('押し出し方向に接触するソリッドがありません');
   lastContact=furthestAlong(contacted,d);
   if(contactInfo&&!contactOnly){previewContacted=contacted;contacted=null;}
   if(contactOnly){result.delete();result=contacted;contacted=null;}
  }finally{contacted?.delete();}
  const contactDepth=Math.max(0,lastContact-startPlane),distance=Math.min(maxDepth,contactDepth);
  if(!Number.isFinite(distance)||distance<=1e-7)throw Error('接触までの押し出し距離を確認してください');
  if(contactInfo){contactInfo.contactDepth=contactDepth;contactInfo.depth=distance;}
  if(startPlane+distance<endPlane-1e-7){
   const limited=cropAtPlane(result,axes,toolBounds,startPlane,startPlane+distance);
   result.delete();result=limited;
  }
  const check=new (R.getOC().BRepCheck_Analyzer)(result.wrapped,true,false);
  try{if(!check.IsValid())throw Error('接触までの押し出し形状を作成できませんでした');}
  finally{check.delete();}
  if(contactInfo){
   let contactPart,uncontacted;
   try{
    contactPart=contactOnly?result.clone():cropAtPlane(previewContacted,axes,toolBounds,startPlane,startPlane+distance);
    const parts=[];
    if(Math.abs(R.measureVolume(contactPart))>1e-9)parts.push({role:'contacted',...contactPart.mesh({tolerance:.08,angularTolerance:.15})});
    if(!contactOnly){
     uncontacted=result.cut(contactPart);
     if(Math.abs(R.measureVolume(uncontacted))>1e-9)parts.push({role:'uncontacted',...uncontacted.mesh({tolerance:.08,angularTolerance:.15})});
    }
    if(parts.length)contactInfo.previewParts=parts;
   }catch{/* Retain the valid full preview if its colour partition cannot be generated. */}
   finally{uncontacted?.delete();contactPart?.delete();}
  }
  const output=result;result=null;return output;
 }finally{previewContacted?.delete();result?.delete();}
}

