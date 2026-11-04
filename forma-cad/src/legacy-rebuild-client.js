import {KernelClient} from './kernel-client.js';
import {rebuild} from './geometry.js';
import {LegacyDisplayCache} from './legacy-rebuild.js';
export function createLegacyRebuilder({client,cache=new LegacyDisplayCache()}={}){
 client||=new KernelClient(()=>{const url=new URL('model-rebuild-worker.js',import.meta.url);url.search=new URL(import.meta.url).search;return new Worker(url,{type:'module'});});const pending=new Map();
 function prepare(features){const missing=cache.missing(features);if(!missing.length)return Promise.resolve();const key=JSON.stringify(missing.map(s=>s.key));if(pending.has(key))return pending.get(key);const history=features.filter(f=>!['sketch','plane','referenceImage'].includes(f.kind)),promise=client.run([],{type:'legacyDisplayRebuild',features:history}).then(result=>{cache.store(result.records);if(cache.missing(features).length)throw Error('表示データが大きすぎます。対象を分けて読み込んでください。');}).finally(()=>{if(pending.get(key)===promise)pending.delete(key);});pending.set(key,promise);return promise;}
 return {prepare,build:features=>rebuild(cache.augmented(features)),missing:features=>cache.missing(features).length>0,cancel(){client.reset();pending.clear();}};
}
