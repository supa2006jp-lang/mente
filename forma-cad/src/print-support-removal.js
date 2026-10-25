import * as THREE from 'three';
import {removalContactTranslation} from './move-contact-geometry.js';
import {inspectStlMesh} from './stl-mesh-health.js';
export function inspectSupportRemoval({moving,obstacles,axis,sign},onProgress){
 if(![0,1,2].includes(axis)||![-1,1].includes(sign)||!Array.isArray(obstacles)||!obstacles.length||obstacles.length>100)throw Error('取り外し方向と対象ボディを確認してください');
 let triangles=0,vertices=0;const owned=[],budget={pairs:0};
 function mesh(data){const {vertices:v,triangles:t}=data||{};if(!Array.isArray(v)||v.length%3||!v.length||v.some(n=>!Number.isFinite(n)||Math.abs(n)>100000)||!Array.isArray(t)||!t.length||t.length%3||t.some(i=>!Number.isInteger(i)||i<0||i>=v.length/3))throw Error('取り外し確認のメッシュが不正です');triangles+=t.length/3;vertices+=v.length/3;if(triangles>200000||vertices>600000)throw Error('取り外し確認は合計20万三角形・60万頂点までです');if(!inspectStlMesh(data,{maxTriangles:200000,maxSegments:0}).ok)throw Error('面の接続に問題があるため、取り外しを確認できません');const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(new Float64Array(v),3)).setIndex(t),object=new THREE.Mesh(geometry);owned.push(object);return object;}
 try{
  const source=mesh(moving),targets=obstacles.map(o=>({id:o.id,mesh:mesh(o)}));if(targets.some(o=>typeof o.id!=='string'||!o.id)||new Set(targets.map(o=>o.id)).size!==targets.length)throw Error('取り外し対象の名前が不正です');
  const sourceBox=new THREE.Box3().setFromObject(source),key=['x','y','z'][axis];let travel=5;for(const target of targets){const b=new THREE.Box3().setFromObject(target.mesh);travel=Math.max(travel,(sign>0?b.max[key]-sourceBox.min[key]:sourceBox.max[key]-b.min[key])+5);}
  const contacts=[];for(const [i,target]of targets.entries()){onProgress?.({stage:'取り外し方向の干渉を調べています',current:i+1,total:targets.length});const signed=removalContactTranslation(source,target.mesh,axis,sign,budget),distance=signed===null?null:Math.max(0,sign*signed);if(distance!==null&&distance<=travel)contacts.push({id:target.id,distance});}
  contacts.sort((a,b)=>a.distance-b.distance);return {state:contacts.length?'blocked':'clear',axis,sign,travel,firstContact:contacts[0]?.distance??null,contacts,triangles,pairs:budget.pairs,basis:'triangulated-straight-translation'};
 }finally{for(const object of owned){object.geometry.dispose();object.material.dispose();}}
}
