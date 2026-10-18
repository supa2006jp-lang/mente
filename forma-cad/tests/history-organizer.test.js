import test from 'node:test';
import assert from 'node:assert/strict';
import {assignHistoryGroup,inheritSketchHistoryGroups,historyCatalog,filterHistory,historyBuckets,historyGroupName} from '../src/history-organizer.js';
import {defaults,rebuild,volume,validateProject} from '../src/geometry.js';
import {encodeProjectDocument,decodeProjectDocument} from '../src/project-codec.js';

const history=()=>[
 {id:'s1',name:'蓋の線1',kind:'sketch',groupId:'sketch-a',groupNumber:1},
 {id:'s2',name:'蓋の線2',kind:'sketch',groupId:'sketch-a',groupNumber:1},
 {id:'A',name:'蓋',kind:'extrusion',operation:'new',sourceSketchIds:['s1','s2']},
 {id:'B',name:'本体',kind:'extrusion',operation:'new'},
 {id:'round-a',name:'丸め1',kind:'cadop',spec:{type:'fillet',target:'A'},outputs:[{id:'A'}],remove:[]},
 {id:'round-b',name:'丸め2',kind:'cadop',spec:{type:'fillet',target:'B'},outputs:[{id:'B'}],remove:[]},
 {id:'move',name:'蓋を移動',kind:'cadop',spec:{type:'move',target:'A'},outputs:[{id:'A'}],remove:[]}
];
test('body search follows source sketches and processing history without mixing unrelated solids',()=>{
 const input=history(),snapshot=JSON.stringify(input),catalog=historyCatalog(input,[{id:'A',name:'蓋ボディ'},{id:'B',name:'本体ボディ'}]);
 assert.equal(catalog.entries.length,6);assert.deepEqual(catalog.entries[0].ids,['s1','s2']);
 assert.deepEqual(filterHistory(catalog.entries,{body:'A'}).map(e=>e.id),['s1','A','round-a','move']);
 assert.deepEqual(filterHistory(catalog.entries,{body:'B',type:'fillet'}).map(e=>e.id),['round-b']);
 assert.deepEqual(filterHistory(catalog.entries,{query:'ＦＩＬＬＥＴ 蓋ボディ'}).map(e=>e.id),['round-a']);
 assert.deepEqual(filterHistory(catalog.entries,{query:'蓋の線２'}).map(e=>e.id),['s1']);
 assert.equal(filterHistory(catalog.entries,{query:'存在しない工程'}).length,0);assert.equal(JSON.stringify(input),snapshot);
 const legacy=historyCatalog([{id:'legacy',name:'旧形式の板',operation:'new'},{id:'next',name:'移動',kind:'cadop',spec:{type:'move',target:'legacy'},outputs:[{id:'legacy'}],remove:[]}]);assert.equal(legacy.bodies[0].id,'legacy');assert.deepEqual(filterHistory(legacy.entries,{body:'legacy'}).map(e=>e.id),['legacy','next']);
});
test('combined body histories include consumed parts and their source operations',()=>{
 const input=history();input.push({id:'join',name:'結合',kind:'cadop',spec:{type:'join',target:'A',other:'B'},outputs:[{id:'A'}],remove:['B']});
 assert.deepEqual(filterHistory(historyCatalog(input).entries,{body:'A'}).map(e=>e.id),['s1','A','B','round-a','round-b','move','join']);
});
test('groups keep IDs and calculation order, support rename/remove, and treat a whole sketch as one choice',()=>{
 const input=history(),before=JSON.stringify(input),grouped=assignHistoryGroup(input,['s2','round-a'],'  蓋の加工  ');
 assert.deepEqual(grouped.map(f=>f.id),input.map(f=>f.id));assert.deepEqual(grouped.filter(f=>f.historyGroup).map(f=>f.id),['s1','s2','round-a']);assert.equal(JSON.stringify(input),before);
 const catalog=historyCatalog(grouped);assert.deepEqual(filterHistory(catalog.entries,{group:'蓋の加工'}).map(e=>e.id),['s1','round-a']);
 const buckets=historyBuckets(catalog.entries);assert.equal(buckets[0].group,'蓋の加工');assert.deepEqual(buckets[0].entries.map(e=>e.number),[1,5]);
 const renamed=assignHistoryGroup(grouped,['s1','s2','round-a'],'仕上げ'),removed=assignHistoryGroup(renamed,['round-a'],'');assert.equal(removed[4].historyGroup,undefined);assert.equal(removed[0].historyGroup,'仕上げ');
 assert.equal(assignHistoryGroup(grouped,['round-a'],'蓋の加工')[4],grouped[4]);
 const added=inheritSketchHistoryGroups([...grouped,{id:'s3',name:'追加線',kind:'sketch',groupId:'sketch-a'}]);assert.equal(added.at(-1).historyGroup,'蓋の加工');
 const special=historyCatalog(assignHistoryGroup(input,['A','B'],'__proto__'));assert.equal(historyBuckets(special.entries).filter(b=>b.group==='__proto__').length,1);
 assert.throws(()=>assignHistoryGroup(input,[],'x'),/選択/);assert.throws(()=>assignHistoryGroup(input,['missing'],'x'),/選択/);assert.throws(()=>historyGroupName('a'.repeat(61)),/60/);assert.throws(()=>historyGroupName({}),/60/);
});
test('ordinary and compressed saves preserve groups and geometry, with malformed metadata rejected',async()=>{
 const original=[{...defaults,id:'A',name:'板',kind:'extrusion',width:30,height:20,depth:4},{...defaults,id:'B',name:'柱',kind:'extrusion',width:5,height:5,depth:20,x:50}];
 const grouped=assignHistoryGroup(original,['A'],'本体の加工'),document={format:'forma-cad',version:1,features:grouped};
 for(const compress of [false,true]){const encoded=await encodeProjectDocument(document,{compress}),decoded=await decodeProjectDocument(encoded.text),loaded=validateProject(decoded.document);assert.deepEqual(loaded,grouped);}
 const before=rebuild(original),after=rebuild(grouped);try{for(const [id,body]of before)assert.equal(volume(body.geometry),volume(after.get(id).geometry));}finally{for(const body of [...before.values(),...after.values()])body.geometry.dispose();}
 assert.throws(()=>validateProject({...document,features:[{...original[0],historyGroup:42}]}),/60/);
 assert.throws(()=>validateProject({...document,features:[{...original[0],historyGroup:'x'.repeat(61)}]}),/60/);
 assert.deepEqual(validateProject({format:'forma-cad',version:1,features:original}),original,'legacy documents require no group metadata');
});
