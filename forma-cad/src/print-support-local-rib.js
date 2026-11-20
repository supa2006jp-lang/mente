import * as R from 'replicad';
import {ribPiecesReachingCeiling} from './print-support-exterior.js';

export const supportRibBounds=shape=>{const box=shape.boundingBox;try{return box.bounds;}finally{box.delete();}};

function volume(shape){return Math.abs(R.measureVolume(shape));}
function overlap(a,b){
 const common=a.intersect(b);
 try{return volume(common);}finally{common.delete();}
}

function retainLandedRibs(shape,settings,bodies,bases){
 const pieces=shape.solids;
 try{
  const landed=pieces.filter(piece=>{
   if(Math.abs(supportRibBounds(piece)[0][2]-settings.bedZ)<1e-5)return true;
   if(settings.baseMode==='bed')return false;
   const lower=piece.clone().translate([0,0,-.002]);
   try{
    const contacts=[...bodies].filter(([,body])=>overlap(lower,body)>1e-5);
    for(const [id] of contacts)if(!bases.includes(id))bases.push(id);
    return contacts.length>0;
   }
   finally{lower.delete();}
  });
  if(!landed.length)return null;
  if(landed.length===pieces.length)return shape;
  return landed.length===1?landed[0].clone():R.makeCompound(landed).asShape3D();
 }finally{pieces.forEach(piece=>piece.delete());}
}

// Regenerate just the specified slot from the same inset ceiling and keepouts.
export function makeSupportLocalRib({prism,bodies,sideGap,settings,axis,center,span,width,top,vertical,hold,requireTop}){
 const other=1-axis,low=[0,0,vertical?.[0]??settings.bedZ],high=[0,0,vertical?.[1]??top];
 low[axis]=center-width/2;high[axis]=center+width/2;
 [low[other],high[other]]=span;
 if(high[2]-low[2]<1e-5||span[1]-span[0]<1e-5)return null;
 const slot=hold(R.makeBox(low,high));
 let rib=hold(prism.intersect(slot));
 if(volume(rib)<.001)return null;
 if(sideGap){
  rib=sideGap.trimRib(rib,axis,hold);
  if(!rib||volume(rib)<.001)return null;
 }
 const bases=[];
 for(const [id,body] of bodies){
  if(overlap(rib,body)<=.0001)continue;
  if(settings.baseMode==='bed')return null;
  bases.push(id);rib=hold(rib.cut(body));
 }
 if(volume(rib)<.001)return null;
 if(requireTop){
  const reaching=ribPiecesReachingCeiling(rib,top);
  if(!reaching.shape)return null;
  if(reaching.shape!==rib)rib=hold(reaching.shape);
  const landed=retainLandedRibs(rib,settings,bodies,bases);
  if(!landed)return null;
  if(landed!==rib)rib=hold(landed);
 }
 const bounds=supportRibBounds(rib);
 if(bounds[1][axis]-bounds[0][axis]<width-1e-5)return null;
 return {shape:rib,bounds,bases,slot};
}

export function widerSupportRib({piece,originalSlot,stripes,stripe,thickness,width,axis,...context}){
 if(width<=thickness)return null;
 const other=1-axis,span=[piece.bounds[0][other],piece.bounds[1][other]],extra=(width-thickness)/2;
 const neighbors=stripes.filter(neighbor=>neighbor!==stripe&&(!neighbor.span||neighbor.span[0]<span[1]-1e-6&&neighbor.span[1]>span[0]+1e-6));
 const original=context.hold(piece.shape.intersect(originalSlot));
 const previousVolume=volume(original);
 if(previousVolume<.001)return null;
 const vertical=piece.bounds.map(point=>point[2]);
 const hasFoot=volume(piece.shape)>previousVolume+.0001;
 // An outer rib can keep the face-side boundary and grow toward the inside.
 for(const offset of [0,extra,-extra]){
  const center=stripe.center+offset;
  if(neighbors.some(neighbor=>Math.abs(neighbor.center-center)<(width+thickness)/2))continue;
  const wider=makeSupportLocalRib({...context,axis,center,span,width,vertical});
  if(!wider||overlap(original,wider.shape)<previousVolume-Math.max(.0001,previousVolume*1e-6)||
   volume(wider.shape)<previousVolume*width/thickness-Math.max(.0001,previousVolume*.003))continue;
  if(!hasFoot)return wider;
  const shape=context.hold(wider.shape.fuse(piece.shape));
  return {...wider,shape,bounds:supportRibBounds(shape)};
 }
 return null;
}
