import * as R from 'replicad';
// Match TopoDS.IsSame exactly (including location, ignoring orientation).
// Hash collisions still compare native identities; coincident geometry is never
// merged. Keep explorer order, and release each temporary native wrapper.
export function cadSubshapes(shape,kind,{hash}={}){
 const oc=R.getOC(),type={vertex:oc.TopAbs_ShapeEnum.TopAbs_VERTEX,edge:oc.TopAbs_ShapeEnum.TopAbs_EDGE,wire:oc.TopAbs_ShapeEnum.TopAbs_WIRE,face:oc.TopAbs_ShapeEnum.TopAbs_FACE,solid:oc.TopAbs_ShapeEnum.TopAbs_SOLID}[kind];if(type===undefined)throw Error('不明なCAD形状の種類です');
 const explorer=new oc.TopExp_Explorer(shape.wrapped,type,oc.TopAbs_ShapeEnum.TopAbs_SHAPE),buckets=new Map(),result=[];
 try{for(;explorer.More();explorer.Next()){const item=explorer.Current();try{const key=hash?hash(item):oc.ReplicadShapeHasher.HashCode(item,R.HASH_CODE_MAX),bucket=buckets.get(key)||[];if(bucket.some(saved=>saved.wrapped.IsSame(item)))continue;const wrapped=R.cast(item);result.push(wrapped);bucket.push(wrapped);buckets.set(key,bucket);}finally{item.delete();}}return result;}
 catch(error){result.forEach(part=>part.delete());throw error;}finally{explorer.delete();}
}
