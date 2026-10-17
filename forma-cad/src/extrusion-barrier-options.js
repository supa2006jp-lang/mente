export function validateExtrusionBarrier(f){
 if(f.barrier!==undefined&&typeof f.barrier!=='boolean')throw Error('バリア押し出しの設定が不正です');
 if(f.barrierGap!==undefined&&(!Number.isFinite(f.barrierGap)||f.barrierGap<0||f.barrierGap>1000))throw Error('バリアのすき間は0〜1000 mmで指定してください');
 if(f.barrierBodies!==undefined&&(!Array.isArray(f.barrierBodies)||f.barrierBodies.length>100||new Set(f.barrierBodies).size!==f.barrierBodies.length||f.barrierBodies.some(id=>typeof id!=='string'||!id||id.length>100)))throw Error('避けるボディの指定が不正です');
 if(f.barrierSide!==undefined&&!['both','inside','outside'].includes(f.barrierSide))throw Error('バリアの内側・外側の指定が不正です');
 if(f.barrierFragments!==undefined&&(!f.barrierFragments||typeof f.barrierFragments!=='object'||Array.isArray(f.barrierFragments)||Object.entries(f.barrierFragments).length>100||Object.entries(f.barrierFragments).some(([scope,keys])=>!scope||scope.length>1000||!Array.isArray(keys)||!keys.length||keys.length>100||new Set(keys).size!==keys.length||keys.some(key=>typeof key!=='string'||!key||key.length>1000))))throw Error('各領域の残す塊を1個以上選択してください');
 if(f.barrier&&(f.kind!=='extrusion'||f.operation==='cut'||f.holesOnly||f.untilSolid))throw Error('バリア押し出しは新規ボディ・結合で使用できます。「ソリッドの表面まで」とは同時に使えません');
}
