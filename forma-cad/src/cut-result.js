import * as R from 'replicad';

// A successful boolean can still return the unchanged target. Reject it before
// emitting history or deleting tools, using the same threshold as extrusion.
export function requireMaterialRemoval(before,after,{tools=[],bodyId}={}){
 const original=R.measureVolume(before),remaining=R.measureVolume(after);
 if(!Number.isFinite(original)||!Number.isFinite(remaining)||original-remaining<=Math.max(1e-7,Math.abs(original)*1e-9)){
  let distance=null;try{if(tools.length&&tools.length<=16)distance=Math.min(...tools.map(tool=>R.measureDistanceBetween(before,tool)));}catch(error){if(error instanceof WebAssembly.RuntimeError||/indirect call to null|null function|memory access out of bounds|unreachable|aborted|RuntimeError/i.test(error?.message||''))throw error;} // optional diagnostics must preserve ordinary failures; a broken engine must restart
  const box=before.boundingBox;let bounds;try{bounds=box.bounds.map(p=>[...p]);}finally{box.delete();}
  const separated=Number.isFinite(distance)&&distance>1e-6;
  throw Object.assign(Error('切り取り形状がボディと重なっていません。方向・距離・対象を確認してください'),{code:'no-material-removal',diagnostics:{kind:'operation-failure',certainty:'measured',bodyIds:bodyId?[bodyId]:[],issues:[{code:separated?'separated-tool':'no-material-change',message:separated?'切り取り形状と対象の間に隙間があります':'切り取りによる体積の減少を確認できません。境界に接するだけでは削れません',...(Number.isFinite(distance)?{distance}:{}),bounds}],suggestion:'対象ボディ・方向・距離を確認し、切り取り形状が対象の内側まで届くようにしてください。'}});
 }
}
