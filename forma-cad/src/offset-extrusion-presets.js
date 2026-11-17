export const offsetPresetKey='forma-offset-extrusion-presets-v1';
const valid=value=>typeof value==='number'&&Number.isFinite(value)&&Math.abs(value)<=10000;
export function normalizeOffsetPresets(data){
 if(data?.version!==1||!Array.isArray(data.values)||data.values.length>12||data.values.some(value=>!valid(value)))throw Error('OS距離の登録内容が不正です');
 return {version:1,values:[...new Set(data.values.map(value=>Object.is(value,-0)?0:value))]};
}
export function loadOffsetPresets(storage=()=>window.localStorage){
 try{const text=storage().getItem(offsetPresetKey);if(text&&text.length<2000)return normalizeOffsetPresets(JSON.parse(text));}catch{}
 return {version:1,values:[]};
}
export function addOffsetPreset(data,value){
 if(!valid(value))throw Error('−10000〜10000 mmで指定してください');
 const next=normalizeOffsetPresets(data);if(next.values.includes(value))return next;
 if(next.values.length>=12)throw Error('距離は12件まで登録できます。不要な距離を削除してください');
 next.values.push(Object.is(value,-0)?0:value);return next;
}
export function saveOffsetPresets(data,storage=()=>window.localStorage){
 const normalized=normalizeOffsetPresets(data);try{storage().setItem(offsetPresetKey,JSON.stringify(normalized));}catch{throw Error('OS距離をブラウザーに保存できませんでした');}return normalized;
}
