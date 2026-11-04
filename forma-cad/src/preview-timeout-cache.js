// Only automatic previews are suppressed. Exact model operations always run.
export function isAutomaticPreview(spec){return spec?.type==='preview'||spec?.preview===true||['exactExtrusionPreview','extrusionToolPreview','barrierPreparedPreview','meshExtrusionProbe','nativeExtrusionProbe','meshCombinePreview','sketchRegionAnalysis'].includes(spec?.type);}
const ordered=value=>ArrayBuffer.isView(value)?Array.from(value):Array.isArray(value)?value.map(ordered):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>[k,ordered(value[k])])):value;
export function previewTimeoutKey(spec){if(!isAutomaticPreview(spec))return null;const clean=operation=>{const value={...operation};delete value.id;if(value.feature){value.feature={...value.feature};delete value.feature.id;}if(value.features)value.features=value.features.map(({id,...f})=>f);return value;},input=clean(spec);if(input.operation)input.operation=clean(input.operation);return JSON.stringify(ordered(input));}
export class PreviewTimeoutCache{
 constructor(){this.clear();}
 clear(){this.documents=new WeakMap();}
 has(document,key){return !!key&&!!this.documents.get(document)?.has(key);}
 remember(document,key){if(!document||!key)return;let rows=this.documents.get(document);if(!rows){rows=new Map();this.documents.set(document,rows);}rows.delete(key);rows.set(key,true);let bytes=[...rows.keys()].reduce((n,k)=>n+k.length*2,0);while(rows.size>16||bytes>16*1024*1024&&rows.size>1){const first=rows.keys().next().value;bytes-=first.length*2;rows.delete(first);}}
}
export const previewTimeoutCache=new PreviewTimeoutCache();
export function clearPreviewTimeouts(){previewTimeoutCache.clear();}
