import test from 'node:test';import assert from 'node:assert/strict';
import {withFailureDiagnostics,invalidResultError} from '../src/cad-failure-diagnostics.js';
import {cadErrorAdvice} from '../src/cad-error-advice.js';
test('identify empty cuts, stale references and non-crossing split planes with relevant advice',()=>{
 for(const [message,type,code]of [['切り取り形状がボディと重なっていません','join','no-material-change'],['参照する面がなくなりました。選び直してください','fillet','reference'],['指定平面がボディを横切っていません','split','split-plane']]){
  const error=withFailureDiagnostics(Error(message),{type:'preview',operation:{type,target:'body',other:'tool'}});assert.equal(error.diagnostics.issues[0].code,code);assert.deepEqual(error.diagnostics.bodyIds,['body','tool']);assert.ok(error.diagnostics.suggestion);
  assert.deepEqual(cadErrorAdvice(error,{type}).diagnostics,error.diagnostics);
 }
});
test('unresolved shell failure does not diagnose thickness as the established cause',()=>{
 const error=withFailureDiagnostics(Error('この壁厚ではシェルを作成できません。壁厚を小さくしてください'),{type:'shell',target:'body'});
 assert.equal(error.diagnostics.certainty,'unknown');assert.match(error.diagnostics.issues[0].message,/断定できません/);assert.doesNotMatch(cadErrorAdvice(error,{type:'shell'}).message,/壁厚を小さく/);
 const invalid=withFailureDiagnostics(Error('壁厚は0より大きくしてください'),{type:'shell'});assert.equal(invalid.diagnostics,undefined,'retain specific invalid-parameter advice');
 const replay=Object.assign(Error('3工程目「中空化」: '+error.message),{featureIndex:2,featureId:'shell',diagnostics:error.diagnostics});assert.match(cadErrorAdvice(replay,{type:'replay'}).message,/3工程目「中空化」: シェル/,'new cause wording must preserve the failing history step');
});
test('native health evidence includes bounds and preserves existing precise edge diagnostics',()=>{
 const report={id:'b',bounds:[[0,0,0],[1,1,1]],findings:[{code:'unexpected-volume'}]},error=invalidResultError(report);assert.equal(error.code,'invalid-result');assert.deepEqual(error.diagnostics.issues[0].bounds,report.bounds);assert.match(error.message,/体積/);
 const precise=Object.assign(Error('検査エラー'),{diagnostics:{issues:[{code:'precise'}],edges:[{point:[1,2,3]}]}});assert.equal(withFailureDiagnostics(precise,{type:'fillet'}),precise);
 assert.equal(withFailureDiagnostics(42,{type:'shell'}),42);
});
