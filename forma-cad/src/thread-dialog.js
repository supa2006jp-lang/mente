import {rememberedDistance,rememberDistance} from './thread-pull-preference.js';
import {allThreadPullSpec} from './thread-pull-spec.js';
const $=id=>document.getElementById(id);
const pitches=[.25,.35,.4,.5,.7,.75,.8,1,1.25,1.5,1.75,2,2.5,3,3.5,4,5,6];
export function renderThreadDialog(surface){
 const diameter=surface?.radius?Number((surface.radius*2).toFixed(4)):0;
 const pitch=diameter<=4?.7:diameter<=6?1:diameter<=10?1.5:diameter<=16?2:diameter<=24?3:4;
 $('cad-fields').innerHTML='<div class="thread-settings"><label>面<output id="thread-face"></output></label><label>モデル化<output>常に実行</output></label><label>全体の長さ<input id="thread-full" type="checkbox" checked></label><label>オフセット (mm)<input id="thread-offset" type="number" value="0" min="0" step="any" disabled></label><label>長さ (mm)<input id="thread-length" type="number" value="10" min="0.1" step="any" disabled></label><label>ねじのタイプ<select id="thread-type"><option>メートルねじ（60°・簡易形状）</option></select></label><label>サイズ<output id="thread-size"></output></label><label>表示記号<select id="thread-designation"></select></label><label>クラス<output>基本形状 / 公差指定なし</output></label><label>方向<select id="thread-direction"><option value="right">右手</option><option value="left">左手</option></select></label><p>オフセットは、面をクリックした位置に近い端から内側へ測ります。そこから指定した長さのねじを作ります。「全体の長さ」ではオフセットは0です。</p><p>サイズは共通の呼び径です。オネジは指定径の円柱から溝を削り、最大外径を保ちます。メネジは同径の穴の内側に対応する山を作ります。同じ径・ピッチ・方向で組み合わせ、必要な余裕はプルで調整してください。規格公差には未対応です。</p></div>';
 $('thread-face').textContent=surface?'1 選択済み'+(surface.internal?'（穴の内壁）':'（円柱側面）'):'未選択：先に円筒面を選択してください';
 $('thread-size').textContent=diameter?diameter+' mm':surface?'円筒面から自動判定':'面を選択';
 for(const p of pitches.filter(p=>p<Math.max(diameter/2,1)))$('thread-designation').add(new Option((diameter?'M'+diameter:'選択径')+' × '+p,String(p)));
 $('thread-designation').value=String(pitch);
 if($('thread-designation').selectedIndex<0)$('thread-designation').selectedIndex=0;
 $('thread-full').onchange=()=>{for(const id of ['thread-offset','thread-length'])$(id).disabled=$('thread-full').checked;};
 const options=document.createElement('div');options.className='thread-settings';
 options.innerHTML='<label>作成時に自動プル<input id="thread-auto-pull" type="checkbox"></label><label>プル距離 (mm)<input id="thread-pull-distance" type="number" min="-1000" max="1000" step="any" disabled></label><p>チェックすると、ねじの両側面と山頂面をまとめて調整してから作成します。マイナスで山を引っ込め、かみ合わせに余裕を付けます。距離は「プレス／プル」と共通で記憶します。</p>';
 $('thread-direction').closest('label').after(options);
 const checkbox=$('thread-auto-pull'),distance=$('thread-pull-distance');distance.value=rememberedDistance();
 checkbox.onchange=()=>{distance.disabled=!checkbox.checked;distance.required=checkbox.checked;if(checkbox.checked){distance.value=rememberedDistance();distance.focus();distance.select();}};
 distance.addEventListener('input',()=>{if(checkbox.checked)rememberDistance(distance.value);});
}
export function threadDialogSpec(surface){
 if(!surface)throw Error('穴の内壁または円柱の側面を先に選択してください');
 const pitch=Number($('thread-designation').value),fullLength=$('thread-full').checked;
 const length=Number($('thread-length').value),offset=Number($('thread-offset').value);
 if(!(pitch>0)||(!fullLength&&(!(length>0)||offset<0||!Number.isFinite(length+offset))))throw Error('長さとオフセットを確認してください');
 const spec={target:surface.bodyId,surfacePoint:surface.point,pitch,fullLength,length,offset:fullLength?0:offset,leftHand:$('thread-direction').value==='left',modeled:true,profile:'metric60',threadVersion:2,designation:$('thread-designation').selectedOptions[0].textContent};
 if(!$('thread-auto-pull').checked)return spec;
 const distance=Number($('thread-pull-distance').value),adjusted=allThreadPullSpec(spec,distance);rememberDistance(distance);return adjusted;
}
