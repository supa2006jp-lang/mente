import {KernelClient} from './kernel-client.js';
import {sketchAnalysisBodies} from './sketch-region-analysis.js';
export function createSketchRegionClient(){
 const client=new KernelClient(()=>{const url=new URL('sketch-analysis-worker.js',import.meta.url);url.search=new URL(import.meta.url).search;return new Worker(url,{type:'module'});});let cached=null,pending=null,revision=0;
 const signature=(features,meshes)=>JSON.stringify([features.filter(f=>f.kind==='sketch'),[...meshes].filter(([,m])=>m.visible).map(([id,m])=>{m.updateWorldMatrix(true,false);return [id,m.geometry.uuid,m.matrixWorld.elements];})]);
 function cancel(){revision++;client.reset();pending=null;}
 function read(features,meshes){const key=signature(features,meshes);return cached?.key===key?cached.result:null;}
 function run(features,meshes,document=features){const key=signature(features,meshes);if(cached?.key===key)return Promise.resolve(cached.result);if(pending?.key===key)return pending.promise;cancel();const token=revision,spec={type:'sketchRegionAnalysis',features:features.filter(f=>f.kind==='sketch'),bodies:sketchAnalysisBodies(meshes)},promise=client.run([] ,spec,{document}).then(result=>{if(token!==revision)throw Object.assign(Error('計算をキャンセルしました'),{code:'cancelled'});cached={key,result};return result;}).finally(()=>{if(token===revision)pending=null;});pending={key,promise};return promise;}
 return {read,run,cancel};
}
