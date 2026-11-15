import {snapBossEngagementPresets} from './boss-snap.js';

const storageKey='forma-cad-boss-fit-results-v1';
const engagementLabel=id=>snapBossEngagementPresets.find(preset=>preset.id===id)?.label;
const isFit=fit=>fit&&Number.isFinite(fit.clearance)&&fit.clearance>=.05&&fit.clearance<=1&&!!engagementLabel(fit.snapEngagement);

function readResults() {
 try{
  const saved=JSON.parse(window.localStorage.getItem(storageKey));
  return {presets:Array.isArray(saved?.presets)?saved.presets.filter(isFit):[],tests:saved?.tests??{}};
 }catch{return {presets:[],tests:{}};}
}

export function installBossFitResults(before,{read,apply}) {
 const panel=document.createElement('fieldset');
 panel.id='boss-fit-results';
 panel.hidden=true;
 panel.innerHTML='<legend>試し刷りの結果</legend>'
  +'<label>出力した試験片<select id="boss-fit-batch"></select></label>'
  +'<div class="boss-fit-samples"></div>'
  +'<div class="boss-dimensions"><label>材料<input id="boss-fit-material" type="text" maxlength="40"></label>'
  +'<label>プリンター<input id="boss-fit-printer" type="text" maxlength="40"></label></div>'
  +'<button id="boss-fit-save" type="button">現在の割りボスの設定を保存</button>'
  +'<label>保存した設定<select id="boss-fit-saved"></select></label>'
  +'<button id="boss-fit-load" type="button">呼び出す</button> <button id="boss-fit-delete" type="button">削除</button>'
  +'<p id="boss-fit-result-status" role="status"></p>';
 before.before(panel);

 const el=id=>panel.querySelector('#boss-fit-'+id);
 const batch=el('batch'),sampleButtons=panel.querySelector('.boss-fit-samples'),saved=el('saved');
 const status=message=>{el('result-status').textContent=message;};
 let testsInSession={},presets=[];

 function applyFit(fit) {
  try{
   apply(fit);
   status(`掛かり ${engagementLabel(fit.snapEngagement)}・片側すき間 ${fit.clearance.toFixed(2)} mm・内側の突起 ${fit.snapRetentionRidge?'あり':'なし'} を適用しました。`);
  }catch(error){status(error.message);}
 }

 function showSamples() {
  const tests={...readResults().tests,...testsInSession};
  sampleButtons.replaceChildren();
  for(const fit of tests[batch.value]?.samples??[]){
   if(!isFit(fit))continue;
   const button=document.createElement('button');
   button.type='button';
   button.textContent=batch.value==='engagement'?`${fit.label}番を適用`:`${fit.clearance.toFixed(2)} mm を適用`;
   button.onclick=()=>applyFit(fit);
   sampleButtons.append(button);
  }
 }

 function refresh(preferredBatch=batch.value,preferredPreset=saved.value) {
  const data=readResults(),tests={...data.tests,...testsInSession};
  presets=data.presets;
  batch.replaceChildren();
  for(const [kind,title] of [['engagement','掛かり比較'],['clearance','すき間比較']]){
   if(tests[kind]?.samples?.length)batch.add(new Option(`${title}（軸径 ${tests[kind].diameter} mm）`,kind));
  }
  if(!batch.options.length)batch.add(new Option('試験片を出力すると選択できます',''));
  if([...batch.options].some(option=>option.value===preferredBatch))batch.value=preferredBatch;
  batch.disabled=!batch.value;
  showSamples();
  saved.replaceChildren(new Option('設定を選ぶ',''));
  for(const fit of presets)saved.add(new Option([fit.material,fit.printer].filter(Boolean).join(' ／ '),fit.id));
  saved.value=preferredPreset;
  if(!saved.value)saved.selectedIndex=0;
  el('load').disabled=el('delete').disabled=!saved.value;
 }

 function savePreset() {
  const material=el('material').value.trim(),printer=el('printer').value.trim();
  if(!material&&!printer){status('材料かプリンターの名前を入力してください。');return;}
  try{
   const fit=read();
   if(!isFit(fit))throw Error('掛かりと片側のすき間を指定してください');
   const data=readResults(),id=JSON.stringify([material,printer]);
   data.presets=data.presets.filter(preset=>preset.id!==id);
   data.presets.push({id,material,printer,...fit});
   window.localStorage.setItem(storageKey,JSON.stringify(data));
   refresh(batch.value,id);
   status('設定をこのブラウザーに保存しました。');
  }catch{status('設定を保存できませんでした。入力値を確認してください。');}
 }

 panel.addEventListener('input',event=>event.stopPropagation());
 panel.addEventListener('keydown',event=>{
  if(event.target.type==='text'&&event.key==='Enter'&&!event.isComposing){event.preventDefault();savePreset();}
 });
 batch.onchange=showSamples;
 saved.onchange=()=>{
  const fit=presets.find(preset=>preset.id===saved.value);
  el('material').value=fit?.material??'';
  el('printer').value=fit?.printer??'';
  el('load').disabled=el('delete').disabled=!fit;
 };
 el('save').onclick=savePreset;
 el('load').onclick=()=>{const fit=presets.find(preset=>preset.id===saved.value);if(fit)applyFit(fit);};
 el('delete').onclick=()=>{
  const data=readResults();
  data.presets=data.presets.filter(preset=>preset.id!==saved.value);
  try{window.localStorage.setItem(storageKey,JSON.stringify(data));refresh();saved.onchange();status('保存した設定を削除しました。');}
  catch{status('保存した設定を削除できませんでした。');}
 };
 return {
  panel,refresh,
  open(){el('material').value=el('printer').value='';status('');refresh('', '');},
  remember({testMode,diameter,samples}){
   if(!samples.every(isFit))return;
   testsInSession[testMode]={diameter,samples:samples.map(({label,clearance,snapEngagement,snapRetentionRidge})=>({label,clearance,snapEngagement,snapRetentionRidge}))};
   try{
    const data=readResults();
    data.tests={...data.tests,...testsInSession};
    window.localStorage.setItem(storageKey,JSON.stringify(data));
    testsInSession={};
   }catch{status('今回の試験片はこの画面から適用できます。ブラウザーへの保存はできませんでした。');}
   refresh(testMode);
  },
 };
}
