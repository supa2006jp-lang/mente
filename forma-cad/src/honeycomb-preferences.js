import {honeycombSettings} from './honeycomb-layout.js';

export const honeycombPreferenceKey='forma-honeycomb-settings-v1';
const fields=['cell','rib','thickness','border','topBorder','bottomBorder','hollow','scope','heightAxis','layout','columns','rows','topOpen','bottomOpen'];
function values(input){const checked=honeycombSettings(input);return Object.fromEntries(fields.map(key=>[key,checked[key]]));}

// Keep model IDs and face references out of browser preferences.
export function saveHoneycombPreferences(input,previewMode,storage=()=>window.localStorage){
 if(!['manual','auto'].includes(previewMode))throw Error('プレビュー方式を確認してください');
 const record={version:1,settings:values(input),previewMode};
 try{storage().setItem(honeycombPreferenceKey,JSON.stringify(record));}
 catch{throw Error('このブラウザーに設定を保存できませんでした。入力した値はそのまま残しています。');}
 return record;
}
export function loadHoneycombPreferences(storage=()=>window.localStorage){
 try{const raw=storage().getItem(honeycombPreferenceKey);if(!raw||raw.length>10000)return null;const data=JSON.parse(raw);if(data?.version!==1||!['manual','auto'].includes(data.previewMode)||!data.settings||typeof data.settings!=='object'||Array.isArray(data.settings))return null;return {version:1,settings:values(data.settings),previewMode:data.previewMode};}
 catch{return null;}
}
