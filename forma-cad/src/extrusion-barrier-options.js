export function validateExtrusionBarrier(f){
 if(f.barrier!==undefined&&typeof f.barrier!=='boolean')throw Error('バリア押し出しの設定が不正です');
 if(f.barrierGap!==undefined&&(!Number.isFinite(f.barrierGap)||f.barrierGap<0||f.barrierGap>1000))throw Error('バリアのすき間は0〜1000 mmで指定してください');
 if(f.barrier&&(f.kind!=='extrusion'||f.operation==='cut'||f.holesOnly||f.untilSolid))throw Error('バリア押し出しは新規ボディ・結合で使用できます。「ソリッドの表面まで」とは同時に使えません');
}
