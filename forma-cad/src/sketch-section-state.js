import {basisFor} from './frames.js';
import {sectionSketchPlane} from './section-sketch-plane.js';

export function sketchSectionPreference(feature,features=[]){
 if(typeof feature?.sketchSection==='boolean')return feature.sketchSection;
 if(!feature?.groupId)return undefined;
 return features.find(f=>f.kind==='sketch'&&f.groupId===feature.groupId&&typeof f.sketchSection==='boolean')?.sketchSection;
}

// Only metadata changes: do not rebuild solids or discard a live drawing.
export function withSketchSectionPreference(features,group,enabled){
 if(typeof enabled!=='boolean')throw Error('断面連動の設定が不正です');
 return features.map(f=>f.kind==='sketch'&&(group.groupId?f.groupId===group.groupId:group.groupNumber!==undefined?f.groupNumber===group.groupNumber:f.id===group.id)?{...f,sketchSection:enabled}:f);
}

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
