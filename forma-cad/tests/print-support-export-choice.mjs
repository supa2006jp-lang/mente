import assert from 'node:assert/strict';
import {printSupportExportCandidates} from '../src/print-support-export-choice.js';
const wall=(id,target)=>({kind:'cadop',id,spec:{type:'printSupport',id,target,style:'walls'}});
const a=wall('support-a','body-a'),b=wall('support-b','body-b'),posts={kind:'cadop',id:'posts',spec:{type:'printSupport',style:'posts'}},operation={kind:'cadop',id:'move',spec:{type:'move'}};
assert.deepEqual(printSupportExportCandidates([posts,operation],['posts','move']),[]);
assert.deepEqual(printSupportExportCandidates([a],[]),[],'hidden or replaced supports do not trigger guidance');
assert.deepEqual(printSupportExportCandidates([a],['support-a']),[{feature:a,index:0,later:false}]);
assert.deepEqual(printSupportExportCandidates([a,posts,b,operation],['support-a','support-b','posts']),[{feature:a,index:0,later:true},{feature:b,index:2,later:true}]);
console.log('PASS visible thin-wall export candidates, multiple sources, later-stage warning, hidden/deleted and legacy post exclusion');
