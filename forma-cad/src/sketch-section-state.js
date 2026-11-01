import {basisFor} from './frames.js';
import {sectionSketchPlane} from './section-sketch-plane.js';

// Derive the section from the sketch's current plane rather than saving a
// second copy of its position. Keep identity stable for the toolbar opt-out.
export function createSketchSectionState(){
 let key=null,face=null;
 return {
  clear(){key=null;face=null;},
  plane(feature,session){
   if(!feature?.sketchSection){this.clear();return null;}
   const basis=basisFor(feature),frame=Object.fromEntries(Object.entries(basis).map(([k,v])=>[k,v.toArray()])),anchor=[feature.x,feature.y,feature.z],offset=anchor.reduce((sum,value,i)=>sum+value*frame.n[i],0),next=JSON.stringify([session,frame]);
   if(next!==key||Math.abs(face.offset-offset)>1e-5){face={...sectionSketchPlane({plane:'CUSTOM',frame,offset,anchor,reverse:true}),workingGrid:true};key=next;}
   return face;
  }
 };
}
