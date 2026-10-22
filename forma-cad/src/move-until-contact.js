import {MODEL_PRECISION} from './model-precision.js';
import {forwardContactTranslation} from './move-contact-geometry.js';

export function firstMoveContact(moving,targets,axis,direction){
 let result=null;
 for(const mesh of targets){
  if(!mesh||mesh===moving||mesh.visible===false)continue;
  const distance=forwardContactTranslation(moving,mesh,axis,direction);
  if(distance===null||!Number.isFinite(distance)||distance*direction< -MODEL_PRECISION.topology)continue;
  if(!result||Math.abs(distance)<Math.abs(result.distance))result={mesh,distance:Math.abs(distance)<MODEL_PRECISION.zero?0:distance};
 }
 return result;
}
