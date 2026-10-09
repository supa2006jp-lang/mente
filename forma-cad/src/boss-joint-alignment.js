import * as R from 'replicad';
import * as THREE from 'three';
import {fuseSolid} from './solid-fuse.js';
const tuple=v=>{try{return v.toTuple();}finally{v.delete();}};

export function bossAlignmentSettings(p){
 if(p.alignmentEnabled!==undefined&&typeof p.alignmentEnabled!=='boolean')throw Error('位置決めの設定を確認してください');
 if(p.alignmentPrintSafe!==undefined&&typeof p.alignmentPrintSafe!=='boolean')throw Error('位置決めの印刷補強の設定を確認してください');
 const settings={printSafe:p.alignmentPrintSafe??false,enabled:p.alignmentEnabled??false,height:p.alignmentHeight??1.5,width:p.alignmentWidth??.8,clearance:p.alignmentClearance??.25};
 if(settings.enabled)for(const [key,name,min,max]of [['height','位置決めの深さ',.2,20],['width','位置決めの縁の幅',.4,10],['clearance','位置決めのすき間',.05,1]])if(!Number.isFinite(settings[key])||settings[key]<min||settings[key]>max)throw Error(name+'を'+min+'〜'+max+' mmで指定してください');
 if(settings.printSafe)settings.width=Math.max(1.2,settings.width);
 return settings;
}

export function addBossAlignment(receiver,male,info,settings,hold){
 try{
 const {basis,offset}=info,n=basis.n,faces=info.footprint.faces;let face;
 try{const cap=faces.find(f=>f.geomType==='PLANE'&&Math.abs(new THREE.Vector3(...tuple(f.center)).dot(n)-offset)<.001);if(!cap)throw Error('profile');face=hold(R.makeFace(cap.clone().outerWire()));}finally{faces.forEach(f=>f.delete());}
 const area=R.measureArea(face),cache=new Map();
 function inset(distance){
  if(cache.has(distance))return cache.get(distance);
  if(distance===0){const value=hold(face.clone());cache.set(0,value);return value;}
  for(const sign of [-1,1]){let wire,profile;try{wire=face.clone().outerWire().offset2D(sign*distance,'intersection');profile=R.makeFace(wire);const a=R.measureArea(profile);if(a>1e-6&&a<area){const value=hold(profile);profile=null;cache.set(distance,value);return value;}}catch{}finally{wire?.delete();profile?.delete();}}
  throw Error('位置決めの縁を作れません。縁の幅やすき間を小さくしてください');
 }
 function prism(distance,z,height){const v=new R.Vector(n.clone().multiplyScalar(height).toArray());try{return hold(R.basicFaceExtrusion(inset(distance),v).translate(n.clone().multiplyScalar(z-offset).toArray()));}finally{v.delete();}}
 function ring(outer,inner,z,height){return hold(prism(outer,z,height).cut(prism(inner,z-.01,height+.02)));}
 function contains(shape,tool){const hit=hold(shape.intersect(tool)),volume=R.measureVolume(tool);return volume>1e-7&&Math.abs(R.measureVolume(hit)-volume)<Math.max(1e-5,volume*1e-7);}
 const {height,width,clearance,printSafe}=settings,land=printSafe?1.2:.4,innerLand=printSafe?1.2:.25,floor=printSafe?1.2:.4,outer=land+clearance,inner=outer+width,grooveInner=inner+clearance,grooveDepth=height+clearance,supportWidth=grooveInner+innerLand;
 const originalReceiver=receiver,originalMale=male;
 // Thicken only the mating rim inward. The inner transition recedes at 45 degrees
 // so the collar can be built with the opening facing up without a horizontal shelf.
 function collar(side,straight,depth){
  if(straight>depth+.00001)throw Error('位置決めの印刷補強を収める深さが不足しています。分割位置を変えるか、位置決めの深さを小さくしてください');
  const extent=Math.min(depth,straight+supportWidth-.1),sections=[[offset-side*.01,supportWidth],[offset+side*straight,supportWidth]];
  if(extent>straight+.00001)sections.push([offset+side*(extent+.01),Math.max(.1,supportWidth-(extent-straight))]);
  else sections[1][0]+=side*.01;
  const wires=sections.map(([z,distance])=>hold(hold(inset(distance).clone().translate(n.clone().multiplyScalar(z-offset).toArray())).outerWire())),cavity=hold(R.loft(wires,{ruled:true}));
  return hold(prism(0,side>0?offset:offset-extent,extent).cut(cavity));
 }
 if(printSafe){receiver=hold(fuseSolid(receiver,collar(-1,floor,offset-info.a.min[2])));male=hold(fuseSolid(male,collar(1,grooveDepth+floor,info.b.max[2]-offset)));}
 // Reserve material under the lip and on both sides and below the receiving groove.
 const root=ring(outer,inner,offset-floor,floor),support=ring(printSafe?0:land-.25,supportWidth,offset,grooveDepth+floor);
 if(!contains(receiver,root)||!contains(male,support))throw Error('位置決めの縁・受け溝を収める壁厚や深さが不足しています。シェルの壁厚を増やすか、縁の幅・深さ・すき間を小さくしてください');
 const lip=ring(outer,inner,offset-.2,height+.2),groove=ring(land,grooveInner,offset-.01,grooveDepth+.01);
 const body=hold(fuseSolid(receiver,lip)),pin=hold(male.cut(groove));
 return {receiver:body,male:pin,analysis:{...settings,inset:outer,grooveDepth,outerLand:land,innerLand,floor,supportWidth,collarAddedVolume:printSafe?R.measureVolume(receiver)+R.measureVolume(male)-R.measureVolume(originalReceiver)-R.measureVolume(originalMale):0,addedVolume:R.measureVolume(body)-R.measureVolume(originalReceiver),removedVolume:R.measureVolume(male)-R.measureVolume(pin)}};
 }catch(error){if(error.message?.includes('位置決め'))throw error;throw Error('位置決めの縁・受け溝を作れません。輪郭や壁厚を確認し、縁の幅・深さを小さくしてください');}
}
