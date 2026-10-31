// Classify evidence already reported by the kernel. Do not guess a failing
// edge or promise that a smaller dimension will fix an unknown native error.
const list=value=>Array.isArray(value)?value:[];
export function withFailureDiagnostics(error,spec){
 if(!(error instanceof Error))return error;
 if(error.diagnostics?.issues?.length||error.code==='cancelled')return error;
 const operation=spec?.type==='preview'?spec.operation:spec,type=operation?.type==='extrusionBatch'?'extrusion':operation?.type;
 const raw=error.message||'',bodyIds=[...new Set([operation?.target,...list(operation?.targets),operation?.other,...list(operation?.others),operation?.feature?.target,...list(operation?.features).map(f=>f?.target)].filter(id=>typeof id==='string'&&id))];
 let issue,suggestion,certainty='unknown';
 if(/重なっていません|接していません|削れる体積/.test(raw)){issue={code:'no-material-change',message:'対象から削られる部分、または結合する接触を確認できませんでした'};suggestion='対象ボディ・方向・距離を確認してください。接するだけの面では切り取れません。';certainty='measured';}
 else if(/参照|選び直|見つかりません|なくなりました/.test(raw)){issue={code:'reference',message:'指定した面・辺・ボディを現在の形状から特定できませんでした'};suggestion='後続の加工で面や辺が変わっていないか確認し、対象を画面で選び直してください。';certainty='reported';}
 else if(/横切/.test(raw)){issue={code:'split-plane',message:'分割平面がソリッドの内部を横切っていません'};suggestion='分割位置をボディの内側へ移動してください。';certainty='reported';}
 else if(error.code==='fillet-smooth'){issue={code:'smooth-edge',message:'選択した辺は、滑らかな面の継ぎ目または同一平面の境界です'};suggestion='角度のある実際の稜線を選び直してください。';certainty='reported';}
 else if(type==='shell'&&/内側の空間を作|シェル.*(作成できません|失敗|完了できません)|StdFail|BRep_API/.test(raw)){issue={code:'shell-unresolved',message:'オフセットした面から有効な中空ソリッドを作成できませんでした。壁厚だけが原因とは断定できません'};suggestion='開口面と細い部分・曲面の接続を確認してください。模様やフィレットを付ける前の工程でも試せます。';}
 else if(/正常なソリッド|形状が不正|形状の異常/.test(raw)){issue={code:'invalid-solid',message:'加工後の面の接続・向きなどが、有効なソリッドの検査に通りませんでした'};suggestion='直前の加工と接続部を確認してください。「形状の検査」で元のボディも調べられます。局所的な原因はまだ特定できていません。';certainty='reported';}
 if(!issue)return error;
 error.diagnostics={...error.diagnostics,kind:error.diagnostics?.kind||'operation-failure',certainty:error.diagnostics?.certainty||certainty,bodyIds:[...new Set([...(error.diagnostics?.bodyIds||[]),...bodyIds])],issues:[issue],suggestion};return error;
}
export function invalidResultError(report){
 const volume=report.findings.some(f=>f.code==='unexpected-volume');
 return Object.assign(Error(volume?'移動前後で体積が変わったため中止しました。元のボディは変更していません':'加工結果が有効なソリッドではないため中止しました。元のボディは変更していません'),{code:'invalid-result',diagnostics:{kind:'operation-failure',certainty:'inspection',bodyIds:[report.id],issues:[{code:volume?'unexpected-volume':'invalid-solid',message:volume?'移動によって材料の量が変わっています':'面の接続・向きなどの整合性検査に通りませんでした',bounds:report.bounds}],suggestion:'対象の接続部や直前の加工を確認してください。寸法を変えても再発する場合は「失敗時の記録」を保存してください。'}});
}
