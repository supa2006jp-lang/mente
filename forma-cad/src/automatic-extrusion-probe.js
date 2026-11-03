import {extrusionProbeBodies} from './extrusion-mesh-probe.js';
const keyFor=(feature,source)=>{const {id,name,operation,target,targetAllBodies,cutAllBodies,...shape}=feature;return JSON.stringify([shape,source]);};
const meshKey=meshes=>JSON.stringify([...meshes].map(([id,m])=>{m.updateWorldMatrix(true,false);return [id,m.visible,m.geometry.uuid,m.matrixWorld.elements];}));
export function createAutomaticExtrusionProbe(client){
 let history=null,bodyKey='',bodies=null,ready=null,pending=null,revision=0;
 function cancel(){revision++;if(pending)client.reset();pending=null;}
 function read(model,feature,source,meshes){const key=keyFor(feature,source);return ready?.model===model&&ready.key===key&&(!meshes||ready.bodyKey===meshKey(meshes))?ready.matches:null;}
 async function run(model,feature,meshes,source){const key=keyFor(feature,source),nextBodyKey=meshKey(meshes),cached=read(model,feature,source,meshes);if(cached)return cached;if(pending?.model===model&&pending.key===key&&bodyKey===nextBodyKey)return pending.promise;cancel();if(history!==model||bodyKey!==nextBodyKey){history=model;bodyKey=nextBodyKey;bodies=extrusionProbeBodies(meshes);}const job=revision;
  const promise=client.run([],{type:'meshExtrusionProbe',feature,bodies,source},{timeout:15000}).then(result=>{if(job!==revision)throw Object.assign(Error('計算をキャンセルしました'),{code:'cancelled'});ready={model,key,bodyKey:nextBodyKey,matches:result.matches};return result.matches;}).finally(()=>{if(job===revision)pending=null;});pending={model,key,promise};return promise;
 }
 return {read,run,cancel,get pending(){return !!pending;}};
}
