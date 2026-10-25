import {printSupportDefaults,validatePrintSupport} from './print-support.js';
export const printSupportPresetKey='forma-cad-print-support-presets-v1';
export const printSupportPresetFields=['style','baseMode','lineWidth','fitLineWidth','wallLines','wallDirection','wallRoof','roofLayers','roofTabs','roofTabLength','roofSeams','roofSectionLength','roofSeamWidth','wallWindows','wallTies','tieInterval','wallPitch','wallThickness','layerHeight','spacing','footDiameter','footThickness','postDiameter','tipDiameter','topGap','bottomGap','maxSupports','connectFeet','braces','braceDiameter','lockToModel'];
export function validatePrintSupportPreset(values){
 if(!values||typeof values!=='object'||Array.isArray(values))throw Error('プリセットの設定が不正です');
 const settings=Object.fromEntries(printSupportPresetFields.map(key=>[key,values[key]===undefined?printSupportDefaults[key]:values[key]]));
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
export function installPrintSupportPresets(anchor,{read,apply,store=createPrintSupportPresetStore()}){
 const element=document.createElement('details');element.dataset.id='support-presets';element.innerHTML='<summary>サポート設定プリセット</summary><label>保存済み設定<select data-preset="select"></select></label><button type="button" data-preset="apply">呼び出す</button><button type="button" data-preset="delete">削除</button><label>名前（プリンター・材料など）<input type="text" maxlength="60" data-preset="name" placeholder="例：A1 mini・PLA"></label><button type="button" data-preset="save">現在の設定を保存／同名を更新</button><small>線幅・積層ピッチ・間隔・薄皮・タブなどの設定を、このブラウザーに保存します。対象ボディと面は現在の選択を使い、リブ除外と手動タブ位置は呼び出し後に指定します。</small><small data-preset="status" role="status"></small>';anchor.before(element);
 const q=id=>element.querySelector('[data-preset="'+id+'"]');let rows=[],busy=false;
 function status(text,error=false){q('status').textContent=text;q('status').style.color=error?'#ba4420':'';}
 function sync(value=busy){busy=value;for(const el of element.querySelectorAll('input,select,button'))el.disabled=busy;q('apply').disabled=q('delete').disabled=busy||!rows.some(row=>row.name===q('select').value);}
 function options(selected=q('select').value){q('select').replaceChildren(new Option('設定を選択',''),...rows.map(row=>new Option(row.name,row.name)));q('select').value=selected;sync();}
 function reload(){try{rows=store.load();options();}catch(e){rows=[];options();status('保存済み設定を読み込めませんでした。通常のサポート操作は続けられます。'+e.message,true);}}
 q('select').onchange=()=>{q('name').value=q('select').value;status('');sync();};
 q('save').onclick=()=>{try{const name=q('name').value.trim();if(!name||name.length>60)throw Error('名前を1〜60文字で入力してください');const values=validatePrintSupportPreset(read()),next=rows.filter(row=>row.name!==name);next.push({name,values});rows=store.write(next);options(name);status('「'+name+'」を保存しました');}catch(e){status('保存できませんでした。'+e.message,true);}};
 q('apply').onclick=()=>{try{const row=rows.find(row=>row.name===q('select').value);if(!row)return;apply(validatePrintSupportPreset(row.values));status('「'+row.name+'」を呼び出しました。現在のモデルでプレビューを更新します。');}catch(e){status(e.message,true);}};
 q('delete').onclick=()=>{try{const name=q('select').value;if(!name)return;rows=store.write(rows.filter(row=>row.name!==name));options('');q('name').value='';status('「'+name+'」を削除しました');}catch(e){status('削除できませんでした。'+e.message,true);}};
 q('name').onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing&&e.keyCode!==229){e.preventDefault();e.stopPropagation();q('save').click();}};
 reload();return {element,sync,reload};
}
