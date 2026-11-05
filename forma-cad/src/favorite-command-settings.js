import {readCommandColors} from './favorite-command-colors.js';
import {readCommandUsage} from './favorite-command-order.js';
const validId=id=>typeof id==='string'&&/^[\w-]{1,80}$/.test(id);
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
export function readFavoriteCommands(value){
 const ids=list=>[...new Set(Array.isArray(list)?list.filter(validId):[])].slice(0,100);
 return {favorites:ids(value?.favorites),hidden:ids(value?.hidden),collapsed:value?.collapsed===true,autoSort:value?.autoSort===true,colors:readCommandColors(value?.colors)};
}
export function exportCommandSettings(settings,usage){
 return {format:'forma-command-toolbar',version:1,settings:readFavoriteCommands(settings),usage:readCommandUsage(usage)};
}
export function importCommandSettings(value){
 if(typeof value==='string'){
  if(value.length>65536)throw Error('設定ファイルは64 KB以内にしてください');
  try{value=JSON.parse(value);}catch{throw Error('設定ファイルのJSONを読み取れません');}
 }
 if(!object(value)||value.format!=='forma-command-toolbar'||value.version!==1||!object(value.settings))throw Error('FormaCADのコマンド設定ファイルを選んでください');
 const s=value.settings;
 if(['favorites','hidden'].some(key=>!Array.isArray(s[key])||s[key].length>100||s[key].some(id=>!validId(id))||new Set(s[key]).size!==s[key].length)||typeof s.collapsed!=='boolean'||typeof s.autoSort!=='boolean'||!object(s.colors)||Object.keys(s.colors).length>100||Object.keys(readCommandColors(s.colors)).length!==Object.keys(s.colors).length)throw Error('コマンド設定の内容が不正です');
 if(value.usage!==undefined&&(!object(value.usage)||Object.keys(value.usage).length>200||Object.keys(readCommandUsage(value.usage)).length!==Object.keys(value.usage).length))throw Error('使用回数の設定が不正です');
 return exportCommandSettings(s,value.usage);
}
export function saveCommandSettings(storage,settingsKey,usageKey,settings,usage){
 const previous=[storage.getItem(settingsKey),storage.getItem(usageKey)];
 try{storage.setItem(usageKey,JSON.stringify(usage));storage.setItem(settingsKey,JSON.stringify(settings));}
 catch(error){
  for(const [index,key]of [settingsKey,usageKey].entries())try{previous[index]===null?storage.removeItem(key):storage.setItem(key,previous[index]);}catch{}
  throw error;
 }
}
