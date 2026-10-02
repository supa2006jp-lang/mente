export function allThreadPullSpec(spec,distance){
 if(!Number.isFinite(distance)||Math.abs(distance)<.001)throw Error('プル距離は0.001 mm以上の絶対値で指定してください');
 if(spec.type==='copiedThread'){const copyDistance=(spec.copyDistance||0)+distance;if(Math.abs(copyDistance)>spec.pitch*.4)throw Error('ねじの調整距離が大きすぎます');return {...spec,copyDistance};}
 const offsets=[...(spec.threadFaceOffsets||[0,0,0,0])];
 // Offset both flanks and the crest over the entire helix; keep its embedded root fixed.
 for(const i of [0,1,2])offsets[i]+=distance;
 if(offsets.some(x=>Math.abs(x)>spec.pitch*.4))throw Error('ねじ山の調整距離が大きすぎます。ピッチの40%以内で指定してください');
 const threadCylinderOffset=(spec.threadCylinderOffset||0)+distance;
 if(Math.abs(threadCylinderOffset)>spec.pitch*.4)throw Error('ねじの調整距離が大きすぎます');
 return {...spec,threadFaceOffsets:offsets,threadCylinderOffset};
}
