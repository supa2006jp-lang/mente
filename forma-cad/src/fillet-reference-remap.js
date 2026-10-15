import * as R from 'replicad';
import {resolveFilletEdges} from './solid-fillet.js';
import {basisFor} from './frames.js';

const tolerance=1e-4;
function at(edge,t){const p=edge.pointAt(t);try{return p.toTuple();}finally{p.delete();}}
function distance(point,edge){const vertex=R.makeVertex(point);try{return R.measureDistanceBetween(vertex,edge);}finally{vertex.delete();}}
function contained(a,b){return [.2,.5,.8].every(t=>distance(at(a,t),b)<=tolerance);}
function missing(){return Object.assign(Error('後続フィレットの元の辺がなくなりました。辺を選び直すか、その後続フィレットを先に解除してください'),{code:'fillet-reference'});}
function bounds(edge){const box=edge.boundingBox;try{return box.bounds;}finally{box.delete();}}
function overlaps(a,b){return a[0].every((v,i)=>v<=b[1][i]+tolerance&&a[1][i]>=b[0][i]-tolerance);}
const span=box=>Math.hypot(...box[0].map((v,i)=>box[1][i]-v));

// A previous blend changes topology even when a later selected edge is intact.
// Match overlapping exact CAD curves, rather than comparing global edge counts
// or choosing a nearby edge that may belong to a different corner.
export function remapFilletEdges(before,after,references){
 const candidates=resolveFilletEdges(after),mapped=[],seen=new Set();
 try{
  const records=candidates.map(edge=>({edge,bounds:bounds(edge)}));
  for(const reference of references){
   const source=resolveFilletEdges(before,{references:[reference]});
   try{
    for(const edge of source){
     const box=bounds(edge),matching=records.filter(candidate=>candidate.edge.geomType===edge.geomType&&overlaps(box,candidate.bounds)).filter(candidate=>contained(edge,candidate.edge)||contained(candidate.edge,edge));
     // A rounded display endpoint can leave a sub-micrometre tail. Do not
     // turn that tail into a new explicit selection while remapping a long
     // edge: it would bypass resolveFilletEdges' main-edge tail filtering.
     // Keep a deliberately selected tiny edge, or the only surviving match.
     const main=matching.filter(candidate=>span(candidate.bounds)>1e-6),tiny=matching.filter(candidate=>span(candidate.bounds)<=1e-6),matches=(span(box)<=1e-6?tiny:main.length?main:matching).map(candidate=>candidate.edge);
     if(!matches.length)throw missing();
     // Coincident edges on distinct shells have no unique geometric identity.
     for(let i=0;i<matches.length;i++)for(let j=i+1;j<matches.length;j++)if(contained(matches[i],matches[j])&&contained(matches[j],matches[i]))throw missing();
     for(const candidate of matches){
      if(seen.has(candidate))continue;seen.add(candidate);
      const {a,b,curved,...rest}=reference;
      mapped.push({...rest,point:at(candidate,.5),a:at(candidate,0),b:at(candidate,1),...(candidate.geomType==='LINE'?{}:{curved:true})});
     }
    }
   }finally{source.forEach(edge=>edge.delete());}
  }
  return mapped;
 }finally{candidates.forEach(edge=>edge.delete());}
}

export function filletPlaneExists(shape,plane){
 const normal=basisFor(plane).n,faces=shape.faces;
 try{return faces.some(face=>{
  if(face.geomType!=='PLANE')return false;
  const center=face.center,n=face.normalAt();
  try{const p=center.toTuple(),v=n.toTuple();return Math.abs(p.reduce((s,x,i)=>s+x*normal.getComponent(i),0)-plane.offset)<=tolerance&&Math.abs(v.reduce((s,x,i)=>s+x*normal.getComponent(i),0))>1-1e-7;}
  finally{center.delete();n.delete();}
 });}finally{faces.forEach(face=>face.delete());}
}
