import * as R from 'replicad';
import * as THREE from 'three';
import {fuseSolid} from './solid-fuse.js';
const tuple=v=>{try{return v.toTuple();}finally{v.delete();}};

export function bossAlignmentSettings(p){
 if(p.alignmentEnabled!==undefined&&typeof p.alignmentEnabled!=='boolean')throw Error('位置決めの設定を確認してください');
 const settings={enabled:p.alignmentEnabled??false,height:p.alignmentHeight??1.5,width:p.alignmentWidth??.8,clearance:p.alignmentClearance??.25};
 if(settings.enabled)for(const [key,name,min,max]of [['height','位置決めの深さ',.2,20],['width','位置決めの縁の幅',.4,10],['clearance','位置決めのすき間',.05,1]])if(!Number.isFinite(settings[key])||settings[key]<min||settings[key]>max)throw Error(name+'を'+min+'〜'+max+' mmで指定してください');
 return settings;
}

export function addBossAlignment(receiver,male,info,settings,hold){
 try{
 const {basis,offset}=info,n=basis.n,faces=info.footprint.faces;let face;
 try{const cap=faces.find(f=>f.geomType==='PLANE'&&Math.abs(new THREE.Vector3(...tuple(f.center)).dot(n)-offset)<.001);if(!cap)throw Error('profile');face=hold(R.makeFace(cap.clone().outerWire()));}finally{faces.forEach(f=>f.delete());}
 const area=R.measureArea(face),cache=new Map();
 function inset(distance){
  if(cache.has(distance))return cache.get(distance);
  for(const sign of [-1,1]){let wire,profile;try{wire=face.clone().outerWire().offset2D(sign*distance,'intersection');profile=R.makeFace(wire);const a=R.measureArea(profile);if(a>1e-6&&a<area){const value=hold(profile);profile=null;cache.set(distance,value);return value;}}catch{}finally{wire?.delete();profile?.delete();}}
  throw Error('位置決めの縁を作れません。縁の幅やすき間を小さくしてください');
 }
 function prism(distance,z,height){const v=new R.Vector(n.clone().multiplyScalar(height).toArray());try{return hold(R.basicFaceExtrusion(inset(distance),v).translate(n.clone().multiplyScalar(z-offset).toArray()));}finally{v.delete();}}
 function ring(outer,inner,z,height){return hold(prism(outer,z,height).cut(prism(inner,z-.01,height+.02)));}
 function contains(shape,tool){const hit=hold(shape.intersect(tool)),volume=R.measureVolume(tool);return volume>1e-7&&Math.abs(R.measureVolume(hit)-volume)<Math.max(1e-5,volume*1e-7);}
 const {height,width,clearance}=settings,land=.4,outer=land+clearance,inner=outer+width,grooveInner=inner+clearance,grooveDepth=height+clearance;
 // Reserve material under the lip and around/below the receiving groove.
 const root=ring(outer,inner,offset-.4,.4),support=ring(land-.25,grooveInner+.25,offset,grooveDepth+.4);
 if(!contains(receiver,root)||!contains(male,support))throw Error('位置決めの縁・受け溝を収める壁厚や深さが不足しています。シェルの壁厚を増やすか、縁の幅・深さ・すき間を小さくしてください');
 const lip=ring(outer,inner,offset-.2,height+.2),groove=ring(land,grooveInner,offset-.01,grooveDepth+.01);
 const body=hold(fuseSolid(receiver,lip)),pin=hold(male.cut(groove));
 return {receiver:body,male:pin,analysis:{...settings,inset:outer,grooveDepth,outerLand:land,addedVolume:R.measureVolume(body)-R.measureVolume(receiver),removedVolume:R.measureVolume(male)-R.measureVolume(pin)}};
 }catch(error){if(error.message?.includes('位置決め'))throw error;throw Error('位置決めの縁・受け溝を作れません。輪郭や壁厚を確認し、縁の幅・深さを小さくしてください');}
}
