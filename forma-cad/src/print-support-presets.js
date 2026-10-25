import {printSupportDefaults,validatePrintSupport} from './print-support.js';
export const printSupportPresetKey='forma-cad-print-support-presets-v1';
export const printSupportPresetFields=['style','contactLines','topContactLines','bottomContactLines','interfaceLineWidth','interfaceSpacing','bottomInterfaceLineWidth','bottomInterfaceSpacing','bottomContactInset','edgeMargin','bottomSeams','bottomSectionLength','bottomSeamWidth','wallBottomSkin','bottomSkinLayers','edgeRibs','autoReinforce','filamentDiameter','materialDensity','baseMode','lineWidth','fitLineWidth','wallLines','wallDirection','wallRoof','roofLayers','roofTabs','roofTabLength','roofSeams','roofSectionLength','roofSeamWidth','wallWindows','wallTies','tieInterval','wallPitch','wallThickness','layerHeight','spacing','footDiameter','footThickness','postDiameter','tipDiameter','topGap','bottomGap','maxSupports','connectFeet','braces','braceDiameter','lockToModel'];
export function validatePrintSupportPreset(values){
 if(!values||typeof values!=='object'||Array.isArray(values))throw Error('プリセットの設定が不正です');
 const settings=Object.fromEntries(printSupportPresetFields.map(key=>[key,values[key]===undefined?printSupportDefaults[key]:values[key]]));
 settings.autoReinforce=values.autoReinforce??false;settings.roofTabs=false;
 const valid=validatePrintSupport({...settings,type:'printSupport',target:'preset',mode:'auto',faces:[],excludedRibs:[],roofTabPlacements:[],bedZ:0});
 return Object.fromEntries(printSupportPresetFields.map(key=>[key,valid[key]]));
}
function validateRows(rows){
 if(!Array.isArray(rows)||rows.length>50)throw Error('保存できるプリセットは50件までです');
 const names=new Set();return rows.map(row=>{const name=typeof row?.name==='string'?row.name.trim():'';if(!name||name.length>60||names.has(name))throw Error('プリセット名が不正または重複しています');names.add(name);return {name,values:validatePrintSupportPreset(row.values)};});
}
export function createPrintSupportPresetStore({storage=()=>globalThis.localStorage}={}){
 return {load(){const raw=storage().getItem(printSupportPresetKey);if(!raw)return [];let doc;try{doc=JSON.parse(raw);}catch{throw Error('保存済みプリセットを読み込めません');}if(doc?.version!==1)throw Error('未対応のプリセット形式です');return validateRows(doc.presets);},write(rows){const valid=validateRows(rows);storage().setItem(printSupportPresetKey,JSON.stringify({version:1,presets:valid}));return valid;}};
}
export function encodePrintSupportPresets(rows){return JSON.stringify({format:'forma-cad-print-support-presets',version:1,presets:validateRows(rows)},null,2);}
export function decodePrintSupportPresets(text){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>1024*1024)throw Error('プリセットファイルは1 MB以下にしてください');
 let doc;try{doc=JSON.parse(text);}catch{throw Error('プリセットのJSONを読み込めません');}
 if(doc?.format!=='forma-cad-print-support-presets'||doc.version!==1)throw Error('対応するサポートプリセットのファイルではありません');return validateRows(doc.presets);
}
export function mergePrintSupportPresets(current,incoming){
 const rows=validateRows(current),add=validateRows(incoming),names=new Set(rows.map(row=>row.name));let renamed=0;
 for(const row of add){let name=row.name;if(names.has(name)){renamed++;for(let n=2;;n++){const suffix=' ('+n+')';let stem=row.name.slice(0,60-suffix.length);if(/[\uD800-\uDBFF]$/.test(stem))stem=stem.slice(0,-1);name=stem+suffix;if(!names.has(name))break;}}names.add(name);rows.push({...row,name});}
 return {rows:validateRows(rows),renamed,added:add.length,first:rows[current.length]?.name||''};
}
export function installPrintSupportPresets(anchor,{read,apply,download,store=createPrintSupportPresetStore()}){
 const element=document.createElement('details');element.dataset.id='support-presets';element.innerHTML='<summary>サポート設定プリセット</summary><label>保存済み設定<select data-preset="select"></select></label><button type="button" data-preset="apply">呼び出す</button><button type="button" data-preset="delete">削除</button><label>名前（プリンター・材料など）<input type="text" maxlength="60" data-preset="name" placeholder="例：A1 mini・PLA"></label><button type="button" data-preset="save">現在の設定を保存／同名を更新</button><small>線幅・積層ピッチ・間隔・薄皮・分割線などの設定を、このブラウザーに保存します。対象ボディと面は現在の選択を使い、リブ除外は呼び出し後に指定します。</small><small data-preset="status" role="status"></small>';anchor.before(element);
 const transfer=document.createElement('div');transfer.innerHTML='<button type="button" data-preset="export">プリセットを書き出す</button><button type="button" data-preset="import">プリセットを読み込む</button><input type="file" data-preset="file" accept=".json,application/json" hidden><small>同名の設定は「(2)」などの別名で追加します。読み込み後に「呼び出す」で現在のモデルへ適用できます。</small>';element.querySelector('[data-preset="status"]').before(transfer);
 const q=id=>element.querySelector('[data-preset="'+id+'"]');let rows=[],busy=false,importing=false;
 function status(text,error=false){q('status').textContent=text;q('status').style.color=error?'#ba4420':'';}
 function sync(value=busy){busy=value;for(const el of element.querySelectorAll('input,select,button'))el.disabled=busy||importing;q('apply').disabled=q('delete').disabled=busy||importing||!rows.some(row=>row.name===q('select').value);q('export').disabled=busy||importing||!rows.length;}
 function options(selected=q('select').value){q('select').replaceChildren(new Option('設定を選択',''),...rows.map(row=>new Option(row.name,row.name)));q('select').value=selected;sync();}
 function reload(){try{rows=store.load();options();}catch(e){rows=[];options();status('保存済み設定を読み込めませんでした。通常のサポート操作は続けられます。'+e.message,true);}}
 q('select').onchange=()=>{q('name').value=q('select').value;status('');sync();};
 q('save').onclick=()=>{try{const name=q('name').value.trim();if(!name||name.length>60)throw Error('名前を1〜60文字で入力してください');const values=validatePrintSupportPreset(read()),next=rows.filter(row=>row.name!==name);next.push({name,values});rows=store.write(next);options(name);status('「'+name+'」を保存しました');}catch(e){status('保存できませんでした。'+e.message,true);}};
 q('apply').onclick=()=>{try{const row=rows.find(row=>row.name===q('select').value);if(!row)return;apply(validatePrintSupportPreset(row.values));status('「'+row.name+'」を呼び出しました。現在のモデルでプレビューを更新します。');}catch(e){status(e.message,true);}};
 q('delete').onclick=()=>{try{const name=q('select').value;if(!name)return;rows=store.write(rows.filter(row=>row.name!==name));options('');q('name').value='';status('「'+name+'」を削除しました');}catch(e){status('削除できませんでした。'+e.message,true);}};
 q('name').onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing&&e.keyCode!==229){e.preventDefault();e.stopPropagation();q('save').click();}};
 q('export').onclick=()=>{try{download(encodePrintSupportPresets(rows),'forma-support-presets.json','application/json');status(rows.length+'件のプリセットを書き出しました');}catch(e){status('書き出せませんでした。'+e.message,true);}};
 q('import').onclick=()=>q('file').click();q('file').onchange=async()=>{const file=q('file').files?.[0];if(!file)return;importing=true;sync();try{if(file.size>1024*1024)throw Error('プリセットファイルは1 MB以下にしてください');const incoming=decodePrintSupportPresets(await file.text()),merged=mergePrintSupportPresets(rows,incoming);rows=store.write(merged.rows);options(merged.first);q('name').value=merged.first;status(merged.added+'件を読み込みました。'+(merged.renamed?merged.renamed+'件は同名のため別名で追加しました。':'')+'「呼び出す」で設定を適用できます。');}catch(e){status('読み込めませんでした。'+e.message,true);}finally{importing=false;q('file').value='';sync();}};
 reload();return {element,sync,reload};
}
