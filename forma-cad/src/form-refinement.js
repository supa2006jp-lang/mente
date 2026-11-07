import {effectiveFormRing,formCurves,formError,formKnots,formPointsAt,formRingOutline,moveFormPoint,validateFormProfile} from './form-profile.js';
import {formGuideBindings,mirrorFormKnot} from './form-guides.js';
import {formSeamsAt} from './form-seam.js';
import {formSymmetryU} from './form-symmetry.js';

export function formSectionBounds(ring,axes){
 const min=[Infinity,Infinity],max=[-Infinity,-Infinity];
 const include=(axis,v)=>{min[axis]=Math.min(min[axis],v);max[axis]=Math.max(max[axis],v);};
 if(ring.reference){
  for(const p of formRingOutline(ring,axes))p.forEach((v,axis)=>include(axis,v));
 }else{
  for(const {start,a,b,end} of formCurves(ring))for(const axis of [0,1]){
   const p=start[axis],q=a[axis],r=b[axis],s=end[axis];
   include(axis,p);include(axis,s);
   // Extrema of the cubic, including any overshoot past the control polygon.
   const A=s-3*r+3*q-p,B=2*(r-2*q+p),C=q-p,disc=B*B-4*A*C;
   const roots=Math.abs(A)<1e-12?(Math.abs(B)<1e-12?[]:[-C/B]):
    disc<0?[]:[(-B-Math.sqrt(disc))/(2*A),(-B+Math.sqrt(disc))/(2*A)];
   for(const t of roots)if(t>0&&t<1){
    const u=1-t;
    include(axis,u**3*p+3*u*u*t*q+3*u*t*t*r+t**3*s);
   }
  }
 }
 return {min,max,size:max.map((v,axis)=>v-min[axis])};
}

export function formSectionSizeAxes(form,section,bindings=formGuideBindings(form)){
 const ring=form.rings[section],fixed=ring.locked||formSeamsAt(form,section).length>0;
 return [0,1].map(axis=>!fixed&&!bindings.some(binding=>binding.guide.axis===axis));
}

export function resizeFormSection(form,section,dimensions,anchor,axes){
 const ring=form.rings[section],editable=formSectionSizeAxes(form,section);
 const {min,max,size}=formSectionBounds(effectiveFormRing(form,ring),axes);
 const ratios=size.map((old,axis)=>{
  if(!editable[axis])return 1;
  const value=dimensions[axis];
  if(!Number.isFinite(value)||value<.1||value>20000||old<1e-9)
   throw formError('幅と高さは0.1〜20000 mmで指定してください。',[section]);
  return Math.abs(value-old)<.0005?1:value/old;
 });
 if(ratios.every(ratio=>ratio===1))return null;
 const center=[form.symmetric?formSymmetryU(form):(min[0]+max[0])/2,
  anchor==='bottom'?min[1]:anchor==='top'?max[1]:(min[1]+max[1])/2];
 const points=ring.points.map(p=>p.map((v,axis)=>center[axis]+(v-center[axis])*ratios[axis]));
 const draft={...form,rings:form.rings.map((r,i)=>i===section?{...r,points}:r)};
 validateFormProfile(draft);
 return draft;
}

export function formSmoothAxes(form,section,index,bindings=formGuideBindings(form)){
 const ring=form.rings[section],knot=formKnots(ring)[index],mirror=form.symmetric?mirrorFormKnot(knot):knot;
 const fixed=ring.locked||ring.corners?.some(k=>k===knot||k===mirror)||
  formSeamsAt(form,section).some(seam=>seam.from===knot||seam.to===knot);
 return [0,1].map(axis=>!fixed&&!(axis===0&&form.symmetric&&knot===mirror)&&
  !bindings.some(binding=>binding.guide.axis===axis&&(binding.knot===knot||binding.knot===mirror)));
}

export function smoothFormPoint(form,section,index,strength){
 const ring=form.rings[section],knots=formKnots(ring),knot=knots[index];
 const editable=formSmoothAxes(form,section,index);
 if(!editable.some(Boolean)||!Number.isFinite(strength)||strength<=0||strength>1)return null;
 const effective=effectiveFormRing(form,ring),n=knots.length,left=(index+n-1)%n,right=(index+1)%n;
 const t=((knot-knots[left]+8)%8)/((knots[right]-knots[left]+8)%8);
 const alongSection=effective.points[left].map((value,axis)=>value+(effective.points[right][axis]-value)*t);
 let target=alongSection;
 if(section>0&&section<form.rings.length-1){
  const before=effectiveFormRing(form,form.rings[section-1]),after=effectiveFormRing(form,form.rings[section+1]);
  const [a]=formPointsAt(before,[knot]),[b]=formPointsAt(after,[knot]);
  const ratio=(ring.z-before.z)/(after.z-before.z);
  target=a.map((value,axis)=>(alongSection[axis]+value+(b[axis]-value)*ratio)/2);
 }
 const next=ring.points[index].map((v,axis)=>editable[axis]?v+(target[axis]-v)*strength:v);
 if(next.every((v,axis)=>Math.abs(v-ring.points[index][axis])<1e-5))return null;
 const draft=structuredClone(form);
 moveFormPoint(draft,section,index,...next,{strength:0});
 validateFormProfile(draft);
 return draft;
}
