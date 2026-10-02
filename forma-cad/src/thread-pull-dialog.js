import {threadSource} from './thread-source.js';
import {rememberedDistance,rememberDistance} from './thread-pull-preference.js';
export function renderThreadPullOptions(features,bodyIds,selectedId,preferAll=false,displayName=id=>(features.find(f=>f.id===id)?.name||'ボディ')+'（'+(bodyIds.indexOf(id)+1)+'）'){
 const fields=document.getElementById('cad-fields'),distance=document.getElementById('cad-distance');
 const section=document.createElement('div');section.className='thread-settings';
 section.innerHTML='<label><span>ねじ全体を選択</span><input id="pull-all-thread" type="checkbox"></label><label id="pull-thread-target-row" hidden>対象のねじ<select id="pull-thread-target"></select></label><p id="pull-thread-hint">チェックすると、分割された面も含め、ねじの両側面・山頂面・溝の間の円筒面を全周・全長まとめてプルします。マイナスでねじ山を引っ込めます。距離はこのブラウザーに記憶します。</p>';
 fields.append(section);
 const checkbox=section.querySelector('#pull-all-thread'),target=section.querySelector('#pull-thread-target');
 const candidates=bodyIds.filter(id=>threadSource(features,id));
 target.add(new Option('対象を選択してください',''));
 for(const id of candidates){const source=threadSource(features,id),body=features.find(f=>f.id===id);target.add(new Option(displayName(id)+' / '+(source.spec.type==='copiedThread'?'複製おねじ / ':'')+(source.spec.designation||'ねじ'),id));}
 target.value=candidates.includes(selectedId)?selectedId:candidates.length===1?candidates[0]:'';
 checkbox.disabled=!candidates.length;
 if(!candidates.length)section.querySelector('#pull-thread-hint').textContent='一括プルできるねじがありません。このアプリで作成したねじ、穴から複製したおねじ、またはその移動・プル後のボディが対象です。';
 const row=section.querySelector('#pull-thread-target-row');
 checkbox.onchange=()=>{row.hidden=!checkbox.checked;target.required=checkbox.checked;if(checkbox.checked){distance.value=rememberedDistance();distance.focus();distance.select();}};
 if(!checkbox.disabled){checkbox.checked=true;checkbox.onchange();}
 distance.addEventListener('input',()=>{if(checkbox.checked)rememberDistance(distance.value);});
}
export function threadPullOptions(){
 if(!document.getElementById('pull-all-thread')?.checked)return {};
 const target=document.getElementById('pull-thread-target').value;
 if(!target)throw Error('一括プルするねじを選択してください');
 return {allThreadFaces:true,target};
}
