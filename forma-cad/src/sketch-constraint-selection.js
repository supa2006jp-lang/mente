import {selectedConstraintEntities} from './sketch-constraints.js';
export const reverseConstraintSelection=selection=>new Map([...selection].reverse().map(([id,indices])=>[id,new Set([...indices].reverse())]));
// Selection order is a UI preference, not a modelling operation or an undo step.
export function createConstraintSelectionOrder({getFeatures,getSelection}){
 let features=null,signature='',reversed=false;
 function read(){const next=getFeatures(),selection=getSelection(),key=JSON.stringify([...selection].map(([id,indices])=>[id,[...indices]]));if(features!==next||signature!==key){features=next;signature=key;reversed=false;}return reversed?reverseConstraintSelection(selection):selection;}
 return {read,swap(){const selection=read();if(selectedConstraintEntities(getFeatures(),selection).length!==2)return false;reversed=!reversed;return true;}};
}
