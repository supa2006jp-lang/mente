import {polylineIntersections} from './spline-analysis.js';
import {formSourceContour} from './form-source.js';
import {formGuideBindings,formGuideCoordinate,formGuideHeights,formGuideLimit,mirrorFormKnot,validFormGuide} from './form-guides.js';
import {formBasis,validFormOrientation} from './form-orientation.js';
import {constrainFormTangent,formSeamLimit,formSeams,formSeamsAt,validFormSeam} from './form-seam.js';
import {formSymmetryU,validFormSymmetryPlane} from './form-symmetry.js';

export const formPointCount=8;
export const formPointLimit=24;
export const formSectionLimit=8;
const wrap=(index,count)=>(index+count)%count;
const baseKnots=Array.from({length:formPointCount},(_,i)=>i);
export const formKnots=ring=>ring.knots??baseKnots;
export const formMirrorPoint=(ring,index)=>formKnots(ring).indexOf(mirrorFormKnot(formKnots(ring)[index]));
export const validFormWall=wall=>wall&&Number.isFinite(wall.thickness)&&wall.thickness>=.1&&wall.thickness<=100&&
 ['start','end','both'].includes(wall.opening);
const roundKnot=t=>Math.round(t*1024)/1024;
const mix=(a,b,t)=>a+(b-a)*t;

export function newFormProfile(){
 const rings=[[0,21,15],[12,25,17],[24,22,15],[34,15,11]];
 return {version:1,symmetric:true,rings:rings.map(([z,x,y])=>({
  z,locked:false,points:Array.from({length:formPointCount},(_,i)=>{
   const angle=i*Math.PI/4;
   return [Math.round(x*Math.cos(angle)*100)/100||0,Math.round(y*Math.sin(angle)*100)/100||0];
  })
 }))};
}

export function setFormSymmetry(form,enabled){
 if(enabled)for(const [section,ring] of form.rings.entries()){
  if(ring.locked)continue;
  const knots=formKnots(ring);
  if(knots.length+knots.filter(t=>!knots.includes(mirrorFormKnot(t))).length>formPointLimit)
   throw formError('制御点が多いため対称にできません。',[section]);
 }
 form.symmetric=enabled;
 if(enabled)for(const [section,ring] of form.rings.entries()){
  if(ring.locked)continue;
  const knots=formKnots(ring);
  const missing=knots.map(mirrorFormKnot).filter(t=>!knots.includes(t));
  if(missing.length)addFormKnots(ring,missing);
  for(const [i,t] of formKnots(ring).entries()){
   if(t>2&&t<6)continue;
   const [x,y]=ring.points[i];
   moveFormPoint(form,section,i,x,y,{strength:0});
  }
  if(ring.corners)ring.corners=[...new Set(ring.corners.flatMap(t=>[t,mirrorFormKnot(t)]))];
 }
}

export function setFormSymmetryPlane(form,plane){
 if(!validFormSymmetryPlane(plane))throw formError('対称面の位置は −10000〜10000 mm で指定してください。');
 const distance=plane.u-formSymmetryU(form);
 if(form.symmetric&&distance)for(const ring of form.rings){
  if(!ring.locked)ring.points=ring.points.map(([x,y])=>[x+distance,y]);
 }
 if(!plane.u&&!plane.source)delete form.symmetryPlane;else form.symmetryPlane={...plane};
 setFormSymmetry(form,true);
}

export function moveFormPoint(form,section,index,x,y,{strength=form.soft??0,from=form.rings}={}){
 const ring=form.rings[section];
 if(!ring||ring.locked||!ring.points[index]||!Number.isFinite(x)||!Number.isFinite(y))return false;
 const knot=formKnots(ring)[index],other=formMirrorPoint(ring,index),center=formSymmetryU(form);
 if(strength>0){
  const [oldX,oldY]=from[section].points[index];
  const dx=form.symmetric&&other===index?0:x-oldX,dy=y-oldY;
  const radius=1+strength/25;
  for(const [s,affected] of form.rings.entries()){
   if(affected.locked)continue;
   const weight=parameter=>{
    const arc=Math.abs(parameter-knot),around=Math.min(arc,formPointCount-arc);
    const distance=Math.hypot(around,Math.abs(s-section)*1.35);
    const t=Math.max(0,1-distance/radius);
    return t*t*(3-2*t);
   };
   const knots=formKnots(affected);
   affected.points=from[s].points.map(([px,py],i)=>{
    const t=knots[i],w=weight(t);
    if(!form.symmetric)return [px+w*dx,py+w*dy];
    const opposite=mirrorFormKnot(t),reflected=weight(opposite);
    return [t===opposite?center:px+(w-reflected)*dx,py+Math.min(1,w+reflected)*dy];
   });
  }
 }
 ring.points[index]=[form.symmetric&&other===index?center:x,y];
 if(form.symmetric&&other>=0&&other!==index)ring.points[other]=[2*center-x||0,y];
 return true;
}

export function formCurves(ring){
 const {points,corners=[]}=ring,knots=formKnots(ring),n=points.length;
 const span=(a,b)=>(knots[b]-knots[a]+formPointCount)%formPointCount;
 const tangent=(i,axis)=>{
  const before=wrap(i-1,n),after=wrap(i+1,n);
  const left=span(before,i),right=span(i,after);
  return (right*(points[i][axis]-points[before][axis])/left+
   left*(points[after][axis]-points[i][axis])/right)/(left+right);
 };
 return points.map((start,i)=>{
  const j=wrap(i+1,n),end=points[j],dt=span(i,j);
  if(ring.seamStarts?.includes(knots[i]))return {start,a:start.map((v,k)=>mix(v,end[k],1/3)),b:start.map((v,k)=>mix(v,end[k],2/3)),end};
  const a=start.map((value,axis)=>corners.includes(knots[i])?mix(value,end[axis],1/3):value+tangent(i,axis)*dt/3);
  const b=end.map((value,axis)=>corners.includes(knots[j])?mix(value,start[axis],1/3):value-tangent(j,axis)*dt/3);
  return {start,a,b,end};
 });
}

function splitCurve(curve,t){
 const blend=(p,q)=>p.map((v,k)=>mix(v,q[k],t));
 const a=blend(curve[0],curve[1]),b=blend(curve[1],curve[2]),c=blend(curve[2],curve[3]);
 const d=blend(a,b),e=blend(b,c),p=blend(d,e);
 return [[curve[0],a,d,p],[p,e,c,curve[3]]];
}

export function formCurvePoles(ring,knots){
 const originals=formKnots(ring);
 return formCurves(ring).flatMap(({start,a,b,end},i)=>{
  const lo=originals[i],hi=originals[i+1]??8,result=[];
  let curve=[start,a,b,end],at=lo;
  for(const t of knots.filter(t=>t>lo&&t<hi)){
   const [first,rest]=splitCurve(curve,(t-at)/(hi-at));
   result.push(first);curve=rest;at=t;
  }
  return [...result,curve];
 });
}

function curvePoint({start,a,b,end},t){
 const s=1-t;
 return start.map((value,axis)=>s**3*value+3*s*s*t*a[axis]+3*s*t*t*b[axis]+t**3*end[axis]);
}

export function formOutline(ring,steps=12){
 return formCurves(ring).flatMap(curve=>Array.from({length:steps},(_,i)=>curvePoint(curve,i/steps)));
}

export function formPointsAt(ring,requested){
 const knots=formKnots(ring),curves=formCurves(ring);
 return requested.map(t=>{
  const next=knots.findIndex(knot=>knot>t),i=next<0?knots.length-1:next-1;
  return t===knots[i]?ring.points[i].slice():curvePoint(curves[i],(t-knots[i])/((knots[i+1]??8)-knots[i]));
 });
}

function addFormKnots(ring,extra,source=ring){
 const original=new Map(formKnots(ring).map((t,i)=>[t,ring.points[i]]));
 const knots=[...formKnots(ring),...extra].sort((a,b)=>a-b);
 ring.points=formPointsAt(source,knots).map((point,i)=>original.get(knots[i])??point);
 ring.knots=knots;
}

export function addFormPoint(form,section,index){
 const ring=form.rings[section],knots=formKnots(ring);
 const t=roundKnot((knots[index]+(knots[index+1]??8))/2);
 const next=knots[index+1]??8,extra=[...new Set(form.symmetric?[t,mirrorFormKnot(t)]:[t])].filter(k=>!knots.includes(k));
 if(ring.locked||formSeamsAt(form,section).some(seam=>knots[index]===seam.from)||
  t<=knots[index]||t>=next||knots.length+extra.length>formPointLimit)
  throw formError('この間に制御点を追加できません。',[section]);
 addFormKnots(ring,extra,effectiveFormRing(form,ring));
 return ring.knots.indexOf(t);
}

export function canRemoveFormPoint(form,section,index){
 const ring=form.rings[section],knot=formKnots(ring)[index];
 return !ring.locked&&Number.isFinite(knot)&&!Number.isInteger(knot)&&
  !formSeamsAt(form,section).some(seam=>[seam.from,seam.to].some(t=>t===knot||form.symmetric&&t===mirrorFormKnot(knot)));
}

export function removeFormPoint(form,section,index){
 if(!canRemoveFormPoint(form,section,index))return index;
 const ring=form.rings[section],knots=formKnots(ring),knot=knots[index];
 const removed=new Set(form.symmetric?[knot,mirrorFormKnot(knot)]:[knot]);
 ring.points=ring.points.filter((_,i)=>!removed.has(knots[i]));
 ring.knots=knots.filter(t=>!removed.has(t));
 if(ring.corners)ring.corners=ring.corners.filter(t=>!removed.has(t));
 return ring.knots.findLastIndex(t=>t<knot);
}

export function setFormCorner(form,section,index,sharp){
 const ring=form.rings[section];
 if(ring.locked)return;
 const t=formKnots(ring)[index],corners=new Set(ring.corners??[]);
 for(const knot of form.symmetric?[t,mirrorFormKnot(t)]:[t])if(sharp)corners.add(knot);else corners.delete(knot);
 ring.corners=[...corners];
}

export function formRingOutline(ring,axes){
 return (ring.reference&&formSourceContour(ring.reference,axes)?.outline)||formOutline(ring);
}

export function interpolateFormRing(a,b,t=.5){
 const extra=[...new Set([...formKnots(a),...formKnots(b)])].filter(k=>!baseKnots.includes(k));
 const knots=(extra.length+formPointCount<=formPointLimit?[...baseKnots,...extra]:baseKnots).slice().sort((x,y)=>x-y);
 const aa=formPointsAt(a,knots),bb=formPointsAt(b,knots);
 const corners=knots.filter(k=>a.corners?.includes(k)&&b.corners?.includes(k));
 return {z:mix(a.z,b.z,t),locked:false,points:aa.map((p,j)=>p.map((v,k)=>mix(v,bb[j][k],t))),
  ...(knots.length>formPointCount?{knots}:{}),...(corners.length?{corners}:{})};
}

export function guidedFormRing(form,ring,bindings=formGuideBindings(form)){
 if(ring.locked||!bindings.length)return ring;
 const points=ring.points.map(p=>p.slice()),knots=formKnots(ring);
 for(const binding of bindings)points[knots.indexOf(binding.knot)][binding.guide.axis]=formGuideCoordinate(binding,ring.z);
 return {...ring,points};
}

export function effectiveFormRing(form,ring,bindings=formGuideBindings(form)){
 const guided=guidedFormRing(form,ring,bindings),seams=formSeamsAt(form,form.rings.indexOf(ring));
 if(!seams.length)return guided;
 const points=guided.points.slice(),knots=formKnots(ring);
 for(const seam of seams){
  points[knots.indexOf(seam.from)]=seam.a;
  points[knots.indexOf(seam.to)]=seam.b;
 }
 return {...guided,points,seamStarts:seams.map(seam=>seam.from)};
}

export function formGeometryRings(form){
 const bindings=formGuideBindings(form);
 const rings=form.rings.map(ring=>effectiveFormRing(form,ring,bindings));
 if(!bindings.length)return rings;
 const heights=formGuideHeights(form);
 return rings.flatMap((ring,i)=>{
  if(!i)return [ring];
  const a=rings[i-1];
  return [...heights[i-1].map(z=>guidedFormRing(form,interpolateFormRing(a,ring,(z-a.z)/(ring.z-a.z)),bindings)),ring];
 });
}

export function formError(message,sections=[],points=[]){
 return Object.assign(Error(message),{code:'invalid-form',diagnostics:{formSections:sections,formPoints:points}});
}

function inspectOutline(outline,sections,z){
 const crossing=polylineIntersections([...outline,outline[0]],{closed:true,maxResults:6});
 if(crossing.length)throw formError('断面の輪郭が交差しています。赤い断面の制御点を動かしてください。',sections,
  crossing.map(({point})=>[...point,z]));
 const area=outline.reduce((sum,[x,y],i)=>{
  const [a,b]=outline[(i+1)%outline.length];return sum+x*b-y*a;
 },0)/2;
 if(area<.01)
  throw formError('断面がつぶれています。赤い断面の制御点を離してください。',sections);
}

export function validateFormProfile(form){
 const validNumber=value=>Number.isFinite(value)&&Math.abs(value)<=10000;
 if(form?.version!==1||typeof form.symmetric!=='boolean'||!Array.isArray(form.rings)
  ||form.rings.length<2||form.rings.length>formSectionLimit)
  throw formError('フォームの断面を2〜'+formSectionLimit+'枚にしてください。');
 if(form.orientation!==undefined&&!validFormOrientation(form.orientation))throw formError('フォームの断面方向を確認してください。');
 if(form.symmetryPlane!==undefined&&!validFormSymmetryPlane(form.symmetryPlane))throw formError('フォームの対称面を確認してください。');
 if(form.wall!==undefined&&!validFormWall(form.wall))throw formError('壁厚は0.1〜100 mmで指定し、開口する端を選んでください。');
 const axes=formBasis(form.orientation);
 if(form.soft!==undefined&&(!Number.isFinite(form.soft)||form.soft<0||form.soft>100))
  throw formError('ソフト編集の範囲を確認してください。');
 if(form.guides!==undefined&&(!Array.isArray(form.guides)||form.guides.length>formGuideLimit||!form.guides.every(validFormGuide)))
  throw formError('フォームのガイド線を確認してください。');
 if(form.references!==undefined&&(!form.references||typeof form.references!=='object'||Array.isArray(form.references)||
  Object.entries(form.references).some(([view,id])=>!['front','right','top'].includes(view)||typeof id!=='string'||id.length>100)))
  throw formError('フォームの下絵の指定を確認してください。');
 const bindings=formGuideBindings(form);
 if(form.seam!==undefined&&!validFormSeam(form.seam)||form.seams!==undefined&&
  (!Array.isArray(form.seams)||form.seams.length>formSeamLimit||!form.seams.every(validFormSeam)||form.seam!==undefined))
  throw formError('フォームの接線接続を確認してください。');
 const seams=formSeams(form);
 if(seams.length){
  if(form.symmetric||form.rings.some(r=>r?.reference))throw formError('接線接続には左右対称を解除し、取り込んだ断面の固定を外してください。');
  if(new Set(seams.map(seam=>seam.end+':'+seam.from)).size!==seams.length)
   throw formError('同じ区間に複数の接線接続があります。');
  if(bindings.some(binding=>seams.some(seam=>binding.knot===seam.from||binding.knot===seam.to)))
   throw formError('接続する2点にはガイド線を割り当てられません。');
 }
 const bindingKeys=bindings.map(({guide,knot})=>guide.axis+':'+knot);
 if(new Set(bindingKeys).size!==bindings.length)throw formError('同じ制御点・方向に複数のガイド線があります。');
 if(form.symmetric&&bindings.some(({guide,knot})=>guide.axis===0&&knot===mirrorFormKnot(knot)))
  throw formError('対称軸上の制御点には、正面のガイド線を設定できません。');
 for(const [i,ring] of form.rings.entries()){
  if(!ring||typeof ring.locked!=='boolean'||!validNumber(ring.z)||!Array.isArray(ring.points)
   ||ring.points.length<formPointCount||ring.points.length>formPointLimit||
   ring.points.some(p=>!Array.isArray(p)||p.length!==2||!p.every(validNumber)))
   throw formError('断面 '+(i+1)+' の座標を確認してください。',[i]);
  const knots=formKnots(ring);
  if(!Array.isArray(knots)||knots.length!==ring.points.length||!baseKnots.every(t=>knots.includes(t))||
   knots.some((t,j)=>!Number.isFinite(t)||t<0||t>=8||t!==roundKnot(t)||j>0&&t<=knots[j-1])||
   form.symmetric&&!ring.locked&&knots.some(t=>!knots.includes(mirrorFormKnot(t)))||
   ring.corners!==undefined&&(!Array.isArray(ring.corners)||ring.corners.length>knots.length||ring.corners.some(t=>!knots.includes(t))))
   throw formError('断面 '+(i+1)+' の制御点の並びを確認してください。',[i]);
  if(i&&ring.z-form.rings[i-1].z<.1-1e-9)
   throw formError('断面の高さを下から順に、0.1 mm以上離してください。',[i-1,i]);
  const seamPoints=new Map();
  for(const seam of formSeamsAt(form,i)){
   const k=knots.indexOf(seam.from);
   if(k<0||knots[(k+1)%knots.length]!==seam.to||Math.abs(seam.z-ring.z)>1e-6)
    throw formError('接線接続の端の断面を確認してください。',[i]);
   for(const [knot,p] of [[seam.from,seam.a],[seam.to,seam.b]]){
    const prior=seamPoints.get(knot);
    if(prior){
     if(Math.hypot(prior.p[0]-p[0],prior.p[1]-p[1])>1e-6)
      throw formError('隣り合う接続の端が離れています。',[i]);
     try{constrainFormTangent(0,0,[prior.normal,seam.normal]);}
     catch(error){throw formError(error.message,[i]);}
    }
    seamPoints.set(knot,{p,normal:seam.normal});
   }
  }
  for(const binding of bindings){
   const {guide,knot}=binding;
   if(ring.z<guide.points[0][0]-1e-6||ring.z>guide.points.at(-1)[0]+1e-6)
    throw formError('ガイド線は、一番下から一番上の断面まで届くように描いてください。',[i]);
   if(ring.locked&&Math.abs(ring.points[knots.indexOf(knot)][guide.axis]-formGuideCoordinate(binding,ring.z))>.05)
    throw formError('ガイド線が固定断面の制御点を通っていません。線の位置か制御点を選び直してください。',[i]);
  }
  if(ring.reference){
   const contour=formSourceContour(ring.reference,axes);
   if(!ring.locked||!contour||Math.abs(contour.z-ring.z)>1e-6)
    throw formError('固定した元の断面を読み込めません。',[i]);
   inspectOutline(contour.outline,[i],ring.z);
  }else{
   const effective=effectiveFormRing(form,ring,bindings);
   if(effective.points.some(([x,y],j)=>Math.hypot(x-effective.points[wrap(j+1,knots.length)][0],y-effective.points[wrap(j+1,knots.length)][1])<.002))
    throw formError('断面がつぶれています。赤い断面の制御点を離してください。',[i]);
   inspectOutline(formOutline(effective),[i],ring.z);
  }
 }
 for(let i=1;i<form.rings.length;i++){
  const a=effectiveFormRing(form,form.rings[i-1],bindings),b=effectiveFormRing(form,form.rings[i],bindings);
  for(const t of [.25,.5,.75]){
   const ring=guidedFormRing(form,interpolateFormRing(a,b,t),bindings);
   inspectOutline(formOutline(ring),[i-1,i],ring.z);
  }
 }
 return form;
}
