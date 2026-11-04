import {rebuild} from './geometry.js';
import {legacyBodyStates,rebuiltBodyRecord} from './legacy-rebuild.js';
self.onmessage=({data})=>{let bodies;try{
 const features=data.spec.features,records=new Map();let bytes=0;
 bodies=rebuild(features,{onLegacyStep:(index,id,body)=>{const state=legacyBodyStates(features.slice(0,index+1)).get(id);if(!state?.legacy)return;const output=rebuiltBodyRecord(id,body),size=(output.vertices.length+output.triangles.length+(output.normals?.length||0))*8+state.key.length*2;records.set(state.key,{key:state.key,output});bytes+=size;while(bytes>96*1024*1024&&records.size>1){const first=records.keys().next().value,row=records.get(first);bytes-=(row.output.vertices.length+row.output.triangles.length+(row.output.normals?.length||0))*8+first.length*2;records.delete(first);}}});
 for(const [id,state]of legacyBodyStates(features))if(state.legacy){records.delete(state.key);records.set(state.key,{key:state.key,output:rebuiltBodyRecord(id,bodies.get(id))});}
 self.postMessage({id:data.id,result:{records:[...records.values()]}});
}catch(error){self.postMessage({id:data.id,error:error.message||String(error)});}finally{for(const body of bodies?.values()||[])body.geometry.dispose();}};
