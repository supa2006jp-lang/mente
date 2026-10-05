export const snapLidPresetKey='forma-cad-snap-lid-presets-v1';
const numbers={bodyWall:[1.2,1000],lidWall:[1.2,1000],floor:[1.2,1000],insertion:[2,1000],clearance:[.05,1],ridge:[.05,1],dividerThickness:[1.2,1000],innerFilletRadius:[.05,1000],outerFilletRadius:[.05,1000],openingWidth:[.05,1000],openingHeight:[.05,1000],openingDepth:[.05,1000]};
const flags=['divider','filletInside','filletOutside','openingGroove'];
const enums={dividerDirection:['short','long'],openingMode:['both','single','selected'],pose:['print','assembled']};
export const snapLidPresetFields=[...Object.keys(numbers),...flags,...Object.keys(enums),'dividerCompartments','dividerOffsets','openingSide'];
export function validateSnapLidPreset(values){
 const out={};
 for(const [key,[min,max]]of Object.entries(numbers)){const v=values?.[key];if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw Error('寸法が範囲外です：'+key);out[key]=v;}
 for(const key of flags){if(typeof values?.[key]!=='boolean')throw Error('チェック設定が不正です');out[key]=values[key];}
 for(const [key,options]of Object.entries(enums)){if(!options.includes(values?.[key]))throw Error('選択設定が不正です');out[key]=values[key];}
 const count=values?.dividerCompartments;if(!Number.isInteger(count)||count<2||count>4)throw Error('収納部分は2〜4分割で指定してください');out.dividerCompartments=count;
 const offsets=values?.dividerOffsets;if(!Array.isArray(offsets)||offsets.length!==count-1||!offsets.every(v=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=1000))throw Error('仕切りの位置が不正です');out.dividerOffsets=[...offsets];
 if(![0,1].includes(values?.openingSide))throw Error('爪掛けの位置が不正です');out.openingSide=values.openingSide;
 return out;
}
export function installSnapLidPresets(parent,{read,apply,storage=()=>window.localStorage}){
 const box=document.createElement('fieldset');box.id='snap-lid-presets';box.innerHTML='<legend>被せ蓋のプリセット</legend><label>保存済みの設定<select id="snap-lid-preset-select"><option value="">設定を選択</option></select></label><div class="snap-lid-preset-actions"><button id="snap-lid-preset-apply" type="button">呼び出す</button><button id="snap-lid-preset-delete" type="button">削除</button></div><label>名前（プリンター・材料など）<input id="snap-lid-preset-name" type="text" maxlength="60" placeholder="例：自宅プリンター・PLA"></label><button id="snap-lid-preset-save" type="button">現在の設定を保存／同名を更新</button><p>寸法・すき間・仕切り・フィレット・爪掛け・配置を、このブラウザーに保存します。対象ボディは現在の選択を使います。クリック指定の爪掛け面は呼び出した後に選び直してください。</p><p id="snap-lid-preset-status" role="status" aria-live="polite"></p>';
 parent.querySelector('#snap-lid-target').closest('label').before(box);box.addEventListener('input',e=>e.stopPropagation());const el=id=>box.querySelector('#'+id),status=(message,error=false)=>{el('snap-lid-preset-status').textContent=message;el('snap-lid-preset-status').classList.toggle('error',error);};let presets=[];
 function refresh(selected=''){el('snap-lid-preset-select').replaceChildren(new Option('設定を選択',''));for(const p of presets)el('snap-lid-preset-select').add(new Option(p.name,p.name));el('snap-lid-preset-select').value=selected;el('snap-lid-preset-apply').disabled=el('snap-lid-preset-delete').disabled=!selected;}
 try{const raw=storage().getItem(snapLidPresetKey);if(raw){const data=JSON.parse(raw);if(data.version!==1||!Array.isArray(data.presets)||data.presets.length>50)throw Error();const names=new Set();presets=data.presets.map(p=>{if(typeof p.name!=='string'||!p.name.trim()||p.name.length>60||names.has(p.name))throw Error();names.add(p.name);return {name:p.name,values:validateSnapLidPreset(p.values)};});}}catch{status('保存済みの設定を読み込めませんでした。被せ蓋は通常どおり使用できます。',true);}refresh();
 function persist(next){storage().setItem(snapLidPresetKey,JSON.stringify({version:1,presets:next}));presets=next;}
 el('snap-lid-preset-select').onchange=()=>{const name=el('snap-lid-preset-select').value;el('snap-lid-preset-name').value=name;refresh(name);status('');};
 el('snap-lid-preset-save').onclick=()=>{try{const name=el('snap-lid-preset-name').value.trim();if(!name||name.length>60)throw Error('名前を1〜60文字で入力してください');const values=validateSnapLidPreset(read()),next=presets.filter(p=>p.name!==name);if(next.length>=50)throw Error('保存できる設定は50件までです');next.push({name,values});try{persist(next);}catch{throw Error('このブラウザーに保存できませんでした。名前と入力値を残しています。');}refresh(name);status('「'+name+'」を保存しました');}catch(e){status(e.message,true);}};
 el('snap-lid-preset-name').onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing&&e.keyCode!==229){e.preventDefault();e.stopPropagation();el('snap-lid-preset-save').click();}};
 el('snap-lid-preset-apply').onclick=()=>{try{const preset=presets.find(p=>p.name===el('snap-lid-preset-select').value);if(!preset)throw Error('設定を選択してください');apply(validateSnapLidPreset(preset.values));status('「'+preset.name+'」を呼び出しました。現在のモデルで再計算します。');}catch(e){status(e.message,true);}};
 el('snap-lid-preset-delete').onclick=()=>{try{const name=el('snap-lid-preset-select').value;if(!name)return;try{persist(presets.filter(p=>p.name!==name));}catch{throw Error('設定を削除できませんでした');}refresh();el('snap-lid-preset-name').value='';status('「'+name+'」を削除しました');}catch(e){status(e.message,true);}};
 return box;
}
