import * as R from 'replicad';
import * as THREE from 'three';
import {defaults} from './geometry.js';
import {threadCylinderInfo} from './thread-cylinder.js';
import {threadClearanceProfile} from './thread-clearance-profile.js';
import {enlargeForClearance} from './cut-clearance.js';
import {fuseSolids} from './solid-fuse.js';
import {cachedBody} from './body-cache.js';
const profileReports=new Map();

function place(shape,origin,normal){const z=new THREE.Vector3(0,0,1),angle=z.angleTo(normal)*180/Math.PI,axis=z.cross(normal);if(angle>1e-6)shape=shape.rotate(angle,[0,0,0],axis.length()<1e-6?[1,0,0]:axis.normalize().toArray());return shape.translate(origin.toArray());}
function move(shape,spec){
 if(spec.rotation){for(let i=0;i<3;i++)if(spec.rotation[i])shape=shape.rotate(spec.rotation[i],spec.pivot||[0,0,0],[[1,0,0],[0,1,0],[0,0,1]][i]);}
 else if(spec.angle)shape=shape.rotate(spec.angle,[0,0,0],{X:[1,0,0],Y:[0,1,0],Z:[0,0,1]}[spec.axis]||[0,0,1]);
 if((spec.copy===true||spec.moveMode==='複製して移動')&&spec.reverseCopy){const normal=new THREE.Vector3(spec.x,spec.y,spec.z).normalize(),u=Math.abs(normal.x)<.9?new THREE.Vector3(1,0,0):new THREE.Vector3(0,1,0);u.addScaledVector(normal,-u.dot(normal)).normalize();shape=shape.mirror(new R.Plane(spec.pivot||[0,0,0],u.toArray(),normal.toArray()));}
 return shape.translate([spec.x||0,spec.y||0,spec.z||0]);
}

// OCCT cannot offset the C0 B-spline surfaces of swept threads. Build the
// complementary female profile instead, then invert it into a clearance tool.
// This retains helical grooves rather than replacing them with a cylinder.
export function threadClearanceShape(solid,distance,source,{bodies,runShape,onProgress,cacheKey,onAssessment}={}){
 const spec=source?.spec;
 if(spec?.type!=='thread'||spec.profile!=='metric60'||spec.threadVersion!==2||spec.threadInternal===true)return null;
 const key='thread-clearance:'+distance+':'+JSON.stringify(spec)+':'+(cacheKey||solid.serialize());
 let report;
 const entry=cachedBody(key,()=>{
  const originals=bodies(source.features),resources=[],hold=shape=>(resources.push(shape),shape);let result;
  try{
   const base=originals.get(spec.target),selected=base&&threadCylinderInfo(base,spec.surfacePoint);
   if(!selected||selected.internal)throw Error('すき間用の元の雄ねじを確認できませんでした');
   const a=selected.normal.toArray(),dominant=a.reduce((best,v,i)=>Math.abs(v)>Math.abs(a[best])?i:best,0);
   if(a[dominant]<0){selected.origin.addScaledVector(selected.normal,selected.height);selected.normal.negate();selected.fromTop=!selected.fromTop;}
   const length=spec.fullLength?selected.height:spec.length,offset=spec.fullLength?0:spec.offset||0;
   selected.origin.addScaledVector(selected.normal,selected.fromTop?selected.height-offset-length:offset);
   const radius=selected.radius,pitch=spec.pitch,root=radius-pitch*.561266+Math.min(0,spec.threadCylinderOffset||0,...(spec.threadFaceOffsets||[]));
   if(!(root>0&&length>0))throw Error('すき間用のねじ寸法が不正です');
   // Correct the planar flank distance for the helical lead angle. The final
   // extrusion is also checked against the actual, unchanged male body.
   const previous=Math.max(...(spec.threadFaceOffsets||[0,0,0]).slice(0,3),spec.threadCylinderOffset||0);
   report=threadClearanceProfile(pitch,root,previous,distance);
   const {clearance}=report,safe=clearance-previous;
   const side=(radius+Math.abs(clearance)+Math.max(2,pitch))*2,id='thread-clearance-support';
   const support=hold(R.makeBox([-side/2,-side/2,0],[side/2,side/2,length]));
   const block={...defaults,id,profile:'rect',width:side,height:side,depth:length};
   const hole={...defaults,id:'thread-clearance-bore',profile:'circle',diameter:radius*2,operation:'cut',target:id,depth:-length,z:length,hole:true};
   let thread={type:'thread',target:id,profile:'metric60',threadVersion:2,pitch,fullLength:true,leftHand:!!spec.leftHand,surfacePoint:[radius,0,length/2]};
   // This complementary female ridge is checked geometrically above. The
   // ordinary manual-pull 40%-of-pitch guard does not apply to this cutter.
   if(Math.abs(clearance)>=.001)thread={...thread,threadFaceOffsets:[-clearance,-clearance,-clearance,0],threadCylinderOffset:-clearance};
   onProgress?.({stage:'ねじ山に沿うすき間形状を作成しています'});
   const female=hold(runShape([block,hole],thread));
   const central=hold(place(support.cut(female),selected.origin,selected.normal));
   const expanded=hold(enlargeForClearance(base,safe)),shaft=hold(R.makeCylinder(radius+safe+.001,length,selected.origin.toArray(),selected.normal.toArray()));
   const outside=hold(expanded.cut(shaft)),parts=[central];if(R.measureVolume(outside)>1e-9)parts.push(outside);
   // Relieve both thread entrances so a flat end cap cannot touch the new body.
   // Overlap the shaft subtraction by 0.004 mm to close the shoulder seam.
   for(const start of [-safe,length-safe])parts.push(hold(R.makeCylinder(radius+safe+Math.max(0,previous)+.005,2*safe,selected.origin.clone().addScaledVector(selected.normal,start).toArray(),selected.normal.toArray())));
   result=fuseSolids(parts,{onProgress});
   for(const transform of source.transforms||[])result=move(result,transform);
   // The caller checks the finished extrusion against the unchanged male body.
   // A second whole-thread containment cut repeats the same safety check and
   // costs more than constructing the cutter on long, closely spaced threads.
   const output=result;result=null;return output;
  }finally{result?.delete();resources.reverse().forEach(shape=>shape.delete());originals.forEach(shape=>shape.delete());}
 });
 report||=profileReports.get(entry.token);
 if(report){profileReports.delete(entry.token);profileReports.set(entry.token,report);while(profileReports.size>48)profileReports.delete(profileReports.keys().next().value);onAssessment?.({...report});}
 return entry.shape;
}
