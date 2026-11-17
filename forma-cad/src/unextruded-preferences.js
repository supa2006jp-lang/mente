export const unextrudedPreferenceKey='forma-unextruded-preferences-v1';
const validLast=value=>value&&Number.isFinite(value.depth)&&Math.abs(value.depth)>=.001&&Math.abs(value.depth)<=10000&&
 typeof value.symmetric==='boolean'&&['new','join'].includes(value.operation);
export function normalizeUnextrudedPreferences(value){
 if(value?.version!==1||typeof value.enabled!=='boolean'||value.last!==null&&!validLast(value.last))throw Error('押し出しの引き継ぎ設定が不正です');
 return {version:1,enabled:value.enabled,last:value.last?{depth:value.last.symmetric?Math.abs(value.last.depth):value.last.depth,symmetric:value.last.symmetric,operation:value.last.operation}:null};
}
export function loadUnextrudedPreferences(storage=()=>window.localStorage){
 try{const text=storage().getItem(unextrudedPreferenceKey);if(text&&text.length<=2000)return normalizeUnextrudedPreferences(JSON.parse(text));}catch{}
 return {version:1,enabled:true,last:null};
}
export function saveUnextrudedPreferences(value,storage=()=>window.localStorage){
 const data=normalizeUnextrudedPreferences(value);
 try{storage().setItem(unextrudedPreferenceKey,JSON.stringify(data));}catch{throw Error('このブラウザーに押し出し設定を保存できませんでした');}
 return data;
}
