import * as R from 'replicad';
const volume=s=>Math.abs(R.measureVolume(s));
const tuple=v=>{try{return v.toTuple();}finally{v.delete();}};

function offsetProfile(wire,distance,smaller){
 const original=R.makeFace(wire.clone());let area;try{area=R.measureArea(original);}finally{original.delete();}
 for(const sign of [1,-1]){let shifted,face;try{shifted=wire.clone().offset2D(sign*distance,'intersection');face=R.makeFace(shifted.clone());const next=R.measureArea(face);if(next>1e-6&&(smaller?next<area-1e-6:next>area+1e-6)){const result=face;face=null;return result;}}catch{}finally{face?.delete();shifted?.delete();}}
 throw Error('底面の端の逃げを作れません。逃げの値を小さくするか0にしてください');
}
function extrude(face,height){const vector=new R.Vector([0,0,height]);try{return R.basicFaceExtrusion(face,vector);}finally{vector.delete();}}

// Only the first model-contacting layer is recessed. The carrier above it,
// and any skin directly on the print bed, retain their full outline.
export function bottomContactInsetMask(skin,z,top,distance){
 const faces=skin.faces,parts=[];let allowed=null,layer=null;
 try{
  for(const face of faces){if(face.geomType!=='PLANE'||tuple(face.normalAt())[2]>-.999999||Math.abs(tuple(face.center)[2]-z)>1e-5)continue;
   const outer=face.clone().outerWire();let inner=null;
   try{const profile=offsetProfile(outer,distance,true);try{inner=extrude(profile,top-z);}finally{profile.delete();}
    if(volume(inner)>.0001){parts.push(inner);inner=null;}
   }finally{inner?.delete();outer.delete();}
  }
  if(!parts.length)throw Error('底面の端の逃げが大きすぎて接点が残りません。値を小さくするか0にしてください');
  allowed=R.makeCompound(parts);const box=skin.boundingBox;let b;try{b=box.bounds;}finally{box.delete();}const slab=R.makeBox([b[0][0]-.01,b[0][1]-.01,z],[b[1][0]+.01,b[1][1]+.01,top]);try{layer=skin.intersect(slab);}finally{slab.delete();}
  const mask=layer.cut(allowed);return mask;
 }finally{allowed?.delete();layer?.delete();parts.forEach(s=>s.delete());faces.forEach(s=>s.delete());}
}
