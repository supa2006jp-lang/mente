import test from 'node:test';
import assert from 'node:assert/strict';
import {exportCommandSettings,importCommandSettings,saveCommandSettings} from '../src/favorite-command-settings.js';
const settings={favorites:['move-tool','solid-tool'],hidden:['direct-chamfer'],collapsed:true,autoSort:true,colors:{'solid-tool':'#00cc88'}};
test('command configuration round-trips ordering, visibility, colors and usage without sharing mutable state',()=>{
 const file=exportCommandSettings(settings,{'solid-tool':5,'move-tool':2});
 const imported=importCommandSettings(JSON.stringify(file));assert.deepEqual(imported,file);
 imported.settings.favorites.reverse();imported.settings.colors['solid-tool']='#000000';assert.deepEqual(file.settings,settings);
 assert.deepEqual(importCommandSettings({...file,usage:undefined}).usage,{});
});
test('invalid configuration files are rejected instead of partially applying their contents',()=>{
 const file=exportCommandSettings(settings,{'solid-tool':5});
 for(const mutate of [v=>v.format='forma-cad',v=>v.version=2,v=>v.settings.favorites.push('move-tool'),v=>v.settings.colors['solid-tool']='red',v=>v.settings.hidden=['<bad>'],v=>v.settings.collapsed='true',v=>v.usage['solid-tool']=-1,v=>v.usage['solid-tool']='5']){
  const bad=structuredClone(file);mutate(bad);assert.throws(()=>importCommandSettings(bad));
 }
 assert.throws(()=>importCommandSettings('x'.repeat(65537)),/64 KB/);assert.throws(()=>importCommandSettings('{'),/JSON/);
});
test('a failed settings save restores both existing settings and usage',()=>{
 const data=new Map([['settings','original'],['usage','old-counts']]);let writes=0;
 const storage={getItem:key=>data.get(key)??null,setItem(key,value){if(++writes===2)throw Error('quota');data.set(key,value);},removeItem:key=>data.delete(key)};
 assert.throws(()=>saveCommandSettings(storage,'settings','usage',settings,{'solid-tool':9}),/quota/);
 assert.equal(data.get('settings'),'original');assert.equal(data.get('usage'),'old-counts');
 saveCommandSettings(storage,'settings','usage',settings,{'solid-tool':9});assert.deepEqual(JSON.parse(data.get('settings')),settings);
});
