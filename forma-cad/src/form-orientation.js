import {Vector3} from 'three';
import {basisFor} from './frames.js';

export const defaultFormOrientation={plane:'XY',tiltU:0,tiltV:0};

export function validFormOrientation(value){
 return value&&['XY','XZ','YZ'].includes(value.plane)&&[value.tiltU,value.tiltV]
  .every(angle=>Number.isFinite(angle)&&Math.abs(angle)<=180);
}

export function formBasis(orientation=defaultFormOrientation){
 const {u,v,n}=basisFor(orientation),a=orientation.tiltU*Math.PI/180,b=orientation.tiltV*Math.PI/180;
 v.applyAxisAngle(u,a);n.applyAxisAngle(u,a);
 u.applyAxisAngle(v,b);n.applyAxisAngle(v,b);
 return {u,v,n};
}

export function formWorld(basis,x,y,z){
 return new Vector3().addScaledVector(basis.u,x).addScaledVector(basis.v,y).addScaledVector(basis.n,z);
}

export function formLocal(basis,point){
 return [point.dot(basis.u),point.dot(basis.v),point.dot(basis.n)];
}
