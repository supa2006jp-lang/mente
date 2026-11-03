export const traceDefaultSettings=()=>({contourEdits:{},autoMaxTolerance:'3',seed:null,edgeAssist:true,regularize:true,shape:'auto',offset:true,offsetDistance:'1',offsetKeep:false,compare:true,organize:false,tolerance:'.51',mode:'edge',threshold:12,invert:false,smoothing:2,detail:'.31',holes:false});
const KEY='forma-cad-reference-trace-presets-v1',fields=['autoMaxTolerance','edgeAssist','regularize','shape','offset','offsetDistance','offsetKeep','compare','organize','tolerance','mode','threshold','invert','smoothing','detail','holes'];
export function tracePresetSettings(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('抽出設定が不正です');
 const s={...traceDefaultSettings(),...input},valid=(n,lo,hi)=>Number.isFinite(n)&&n>=lo&&n<=hi;
 if(!['background','dark','alpha','seed','edge'].includes(s.mode)||!Number.isInteger(s.threshold)||!valid(s.threshold,1,254)||![0,1,2].includes(s.smoothing)||!['auto','circle','ellipse','rectangle','roundedRectangle','slot','dShape'].includes(s.shape)||['edgeAssist','regularize','offset','offsetKeep','compare','organize','invert','holes'].some(k=>typeof s[k]!=='boolean')||s.organize&&s.regularize)throw Error('抽出設定が不正です');
 for(const [key,lo,hi]of [['autoMaxTolerance',.01,10],['detail',.01,10],['tolerance',.01,10],['offsetDistance',-100,100]])if(typeof s[key]!=='string'||s[key].length>30||!s[key].trim()||!valid(Number(s[key]),lo,hi)||key==='offsetDistance'&&Math.abs(Number(s[key]))<.001)throw Error('数値設定を確認してから保存してください');
 return Object.fromEntries(fields.map(k=>[k,s[k]]));
}
export function decodeTracePresets(value){
 if(typeof value==='string'){if(value.length>65536)throw Error('プリセットファイルは64 KB以内にしてください');value=JSON.parse(value);}
 if(!value||value.format!=='forma-trace-presets'||value.version!==1||!Array.isArray(value.presets)||value.presets.length>32)throw Error('輪郭抽出のプリセットファイルを選んでください');
 const ids=new Set(),names=new Set(),presets=value.presets.map(p=>{if(!p||typeof p.id!=='string'||!/^[a-zA-Z0-9-]{1,64}$/.test(p.id)||ids.has(p.id)||typeof p.name!=='string'||!p.name.trim()||p.name.length>40||names.has(p.name.trim()))throw Error('プリセット名・番号が不正です');ids.add(p.id);names.add(p.name.trim());return {id:p.id,name:p.name.trim(),settings:tracePresetSettings(p.settings)};});
 return {format:'forma-trace-presets',version:1,presets,...(value.defaultSettings!==undefined?{defaultSettings:tracePresetSettings(value.defaultSettings)}:{})};
}
export function createTracePresetStore(storage=globalThis.localStorage){
 const empty=()=>({format:'forma-trace-presets',version:1,presets:[]});
 return {read(){const text=storage.getItem(KEY);return text?decodeTracePresets(text):empty();},write(value){const clean=decodeTracePresets(value);storage.setItem(KEY,JSON.stringify(clean));return clean;}};
}
export function installTracePresetControls({dialog,getSettings,applySettings}){
 const panel=document.createElement('details');panel.id='reference-trace-presets';panel.innerHTML='<summary>抽出設定のプリセット</summary><label>保存済み設定<select id="reference-trace-preset-list"></select></label><div class="trace-actions"><button type="button" id="reference-trace-preset-apply">呼び出す</button><button type="button" id="reference-trace-preset-delete">削除</button></div><label>設定の名前<input type="text" id="reference-trace-preset-name" maxlength="40" placeholder="例：リモコンのボタン"></label><button type="button" id="reference-trace-preset-save">設定を保存（同名は更新）</button><div class="trace-actions"><button type="button" id="reference-trace-preset-default">この設定を初期値にする</button><button type="button" id="reference-trace-preset-reset-default">標準の初期値に戻す</button><button type="button" id="reference-trace-preset-export">書き出す</button><button type="button" id="reference-trace-preset-import">読み込む</button><input type="file" id="reference-trace-preset-file" accept=".json,application/json" hidden></div><p id="reference-trace-preset-status" role="status">検出・整理・オフセットの共通設定を保存します。選んだ位置・範囲や輪郭ごとの調整は含めません。</p>';
 dialog.querySelector('.trace-settings').prepend(panel);const $=id=>panel.querySelector('#reference-trace-preset-'+id),status=text=>$('status').textContent=text;let store,data={format:'forma-trace-presets',version:1,presets:[]};
 try{store=createTracePresetStore();data=store.read();}catch(e){status('保存設定を読めませんでした：'+e.message);}
 function sync(selected=$('list').value){$('list').replaceChildren(new Option('保存済み設定を選択',''),...data.presets.map(p=>new Option(p.name,p.id)));$('list').value=selected;$('apply').disabled=$('delete').disabled=!data.presets.some(p=>p.id===selected);}
 function commit(next){if(!store)store=createTracePresetStore();data=store.write(next);sync();}
 function action(run){try{run();}catch(e){status(e.message);}}
 $('list').onchange=()=>{sync();const p=data.presets.find(p=>p.id===$('list').value);if(p)$('name').value=p.name;};
 $('save').onclick=()=>action(()=>{const name=$('name').value.trim();if(!name)throw Error('設定の名前を入力してください');const settings=tracePresetSettings(getSettings()),existing=data.presets.find(p=>p.name===name);if(!existing&&data.presets.length>=32)throw Error('プリセットは32件まで保存できます');const preset={id:existing?.id||crypto.randomUUID(),name,settings},next=structuredClone(data);next.presets=next.presets.filter(p=>p.id!==preset.id);next.presets.push(preset);commit(next);sync(preset.id);status('「'+name+'」を保存しました。');});
 $('apply').onclick=()=>action(()=>{const p=data.presets.find(p=>p.id===$('list').value);if(!p)return;applySettings(structuredClone(p.settings));status('「'+p.name+'」を呼び出しました。対象をクリックして輪郭を確認してください。');});
 $('delete').onclick=()=>action(()=>{const next=structuredClone(data);next.presets=next.presets.filter(p=>p.id!==$('list').value);commit(next);status('プリセットを削除しました。');});
 $('default').onclick=()=>action(()=>{commit({...data,defaultSettings:tracePresetSettings(getSettings())});status('現在の共通設定を、次回からの初期値にしました。');});
 $('reset-default').onclick=()=>action(()=>{const next={...data};delete next.defaultSettings;commit(next);status('次回から標準の初期値を使います。保存済みプリセットは残ります。');});
 $('export').onclick=()=>action(()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='forma-trace-presets.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);status('プリセットと初期値を書き出しました。');});
 $('import').onclick=()=>$('file').click();$('file').onchange=async()=>{const file=$('file').files[0];$('file').value='';if(!file)return;try{if(file.size>65536)throw Error('ファイルは64 KB以内にしてください');const imported=decodeTracePresets(await file.text()),next=structuredClone(data);for(const p of imported.presets){const existing=next.presets.find(v=>v.name===p.name);if(existing)existing.settings=p.settings;else next.presets.push({...p,id:crypto.randomUUID()});}if(imported.defaultSettings)next.defaultSettings=imported.defaultSettings;commit(next);status('プリセットを読み込みました。同名の設定は更新しました。');}catch(e){status('読み込めませんでした：'+e.message);}};
 sync();return {defaults:()=>({...traceDefaultSettings(),...(data.defaultSettings||{}),contourEdits:{},seed:null})};
}
