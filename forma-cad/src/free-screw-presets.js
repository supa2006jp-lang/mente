import {freeScrewSettings} from './free-screw-settings.js';

const storageKey='forma-cad-free-screw-presets-v1',nameLimit=60,presetLimit=50;

export function freeScrewPresetValues(spec){
 const {id,origin,nut,...values}=freeScrewSettings({...spec,id:'preset-screw',origin:[0,0,0],
  ...(spec.nut===undefined?{}:{nut:{...spec.nut,id:'preset-nut'}})});
 if(nut){
  const {id,...nutValues}=nut;
  values.nut=nutValues;
 }
 return values;
}

function readPresets(storage){
 try{
  const raw=storage.getItem(storageKey);
  if(raw===null)return [];
  const data=JSON.parse(raw);
  if(data.version!==1||!Array.isArray(data.presets)||data.presets.length>presetLimit)throw Error();
  const names=new Set();
  return data.presets.map(({name,values})=>{
   if(typeof name!=='string'||!name.trim()||name.length>nameLimit||names.has(name))throw Error();
   names.add(name);
   return {name,values:freeScrewPresetValues(values)};
  });
 }catch{
  throw Error('保存済みのねじ設定を読み込めませんでした。');
 }
}

export function installFreeScrewPresets(anchor,{read,apply}){
 const box=document.createElement('details');
 box.id='free-screw-presets';
 box.innerHTML=`<summary>ねじ設定プリセット</summary>
 <fieldset aria-label="ねじ設定プリセット">
 <div class="screw-preset-row">
 <label>保存済みの設定<select id="free-screw-preset-select"></select></label>
 <button type="button" id="free-screw-preset-apply" disabled>呼び出す</button>
 </div>
 <div class="screw-preset-row">
 <label>設定名<input id="free-screw-preset-name" type="text" maxlength="${nameLimit}" placeholder="例 M4 ノブとナット"></label>
 <button type="button" id="free-screw-preset-save">保存</button>
 </div>
 <p id="free-screw-preset-status" role="status" hidden></p></fieldset>`;
 anchor.before(box);
 box.addEventListener('input',event=>event.stopPropagation());
 const select=box.querySelector('select'),name=box.querySelector('input');
 const load=box.querySelector('#free-screw-preset-apply'),save=box.querySelector('#free-screw-preset-save');
 const status=box.querySelector('#free-screw-preset-status');
 function message(text='',error=false){
  status.textContent=text;status.hidden=!text;status.classList.toggle('screw-preset-error',error);
 }
 function syncActions(){
  load.disabled=!select.value;
  save.textContent=Array.from(select.options).some(option=>option.value&&option.value===name.value.trim())?'同名を更新':'保存';
 }
 function refresh(presets,selected=''){
  select.replaceChildren(new Option('設定を選択',''),...presets.map(item=>new Option(item.name,item.name)));
  select.value=selected;syncActions();
 }
 select.onchange=()=>{name.value=select.value;syncActions();message();};
 name.oninput=syncActions;
 name.onkeydown=event=>{
  if(event.key==='Enter'&&!event.isComposing&&event.keyCode!==229){
   event.preventDefault();event.stopPropagation();save.click();
  }
 };
 save.onclick=()=>{
  const title=name.value.trim();
  try{
   if(!title||title.length>nameLimit)throw Error('設定名を1〜'+nameLimit+'文字で入力してください。');
   const values=freeScrewPresetValues(read());
   const storage=window.localStorage,presets=readPresets(storage);
   const index=presets.findIndex(item=>item.name===title);
   if(index<0){
    if(presets.length>=presetLimit)throw Error('保存できるねじ設定は'+presetLimit+'件までです。');
    presets.push({name:title,values});
   }else presets[index]={name:title,values};
   try{storage.setItem(storageKey,JSON.stringify({version:1,presets}));}
   catch{throw Error('このブラウザーにねじ設定を保存できませんでした。');}
   name.value=title;refresh(presets,title);message('「'+title+'」を保存しました。');
  }catch(error){message(error.message,true);}
 };
 load.onclick=()=>{
  try{
   const preset=readPresets(window.localStorage).find(item=>item.name===select.value);
   if(!preset)throw Error('呼び出す設定を選んでください。');
   apply(preset.values);message('「'+preset.name+'」を呼び出しました。');
  }catch(error){message(error.message,true);}
 };
 return {
  open(){
   name.value='';message();refresh([]);
   try{refresh(readPresets(window.localStorage));}
   catch(error){message(error.message,true);}
  }
 };
}
