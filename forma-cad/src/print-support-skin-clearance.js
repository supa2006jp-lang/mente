function supportShapeBounds(shape){
 const box=shape.boundingBox;
 try{return box.bounds;}finally{box.delete();}
}

export function skinClearanceError(message,role,start,thickness,collision){
 const parts=collision?.solids||[];
 try{
  const regions=parts.map(part=>{
   const bounds=supportShapeBounds(part);
   const available=Math.max(0,role==='upper'?start-bounds[1][2]:bounds[0][2]-start);
   return {bounds,role,available,thickness};
  });
  return Object.assign(Error(message),{code:'support-skin-clearance',regions,role,thickness});
 }finally{parts.forEach(part=>part.delete());}
}
