import {extrusionProbePlan} from './extrusion-probe-plan.js';
const keyFor=(feature,source)=>{const {id,name,operation,target,targetAllBodies,cutAllBodies,throughAll,...shape}=feature;return JSON.stringify([shape,source]);};
const meshKey=meshes=>JSON.stringify([...meshes].map(([id,m])=>{m.updateWorldMatrix(true,false);return [id,m.visible,m.geometry.uuid,m.matrixWorld.elements];}));
export function createAutomaticExtrusionProbe(client){
 let ready=null,pending=null,revision=0;
 function cancel(){revision++;if(pending)client.reset();pending=null;}
 function read(model,feature,source,meshes){const key=keyFor(feature,source);return ready?.model===model&&ready.key===key&&(!meshes||ready.bodyKey===meshKey(meshes))?ready.matches:null;}
 async function run(model,feature,meshes,source){const key=keyFor(feature,source),nextBodyKey=meshKey(meshes),cached=read(model,feature,source,meshes);if(cached)return cached;if(pending?.model===model&&pending.key===key&&pending.bodyKey===nextBodyKey)return pending.promise;cancel();const job=revision,plan=extrusionProbePlan(model,meshes,{feature,source});
  const promise=client.run(plan.history,plan.spec,{timeout:15000,document:model}).then(result=>{if(job!==revision)throw Object.assign(Error('計算をキャンセルしました'),{code:'cancelled'});ready={model,key,bodyKey:nextBodyKey,matches:result.matches};return result.matches;}).finally(()=>{if(job===revision)pending=null;});pending={model,key,bodyKey:nextBodyKey,promise};return promise;
 }
 return {read,run,cancel,get pending(){return !!pending;}};
}
