import * as R from 'replicad';

// A successful boolean can still return the unchanged target. Reject it before
// emitting history or deleting tools, using the same threshold as extrusion.
export function requireMaterialRemoval(before,after){
 const original=R.measureVolume(before),remaining=R.measureVolume(after);
 if(!Number.isFinite(original)||!Number.isFinite(remaining)||original-remaining<=Math.max(1e-7,Math.abs(original)*1e-9))throw Error('切り取り形状がボディと重なっていません。方向・距離・対象を確認してください');
}
