import {taperDisplayAngle,taperStoredAngle} from './taper-angle-reference.js';
export function createTaperOptionsControls($){
 const fields=(prefix='')=>`<label>テーパー方式<select id="${prefix}taperMode"><option value="all">全周（従来）</option><option value="inner">内側だけ（外側を固定）</option><option value="outer">外側だけ（内側を固定）</option><option value="oneSide">一定方向（横・縦）</option></select></label><div id="${prefix}taper-options" hidden><label>広げる側<select id="${prefix}taperSide"><option value="u+">横 ＋側</option><option value="u-">横 −側</option><option value="v+">縦 ＋側</option><option value="v-">縦 −側</option></select></label><small class="taper-hint">反対側を固定します。横・縦は元のスケッチ平面の方向です。</small></div><small id="${prefix}taper-contour-hint" class="taper-hint" hidden></small>`;
 const reference=(prefix='')=>`<label>角度の基準<select id="${prefix}taperReference"><option value="normal">押し出し方向から（従来）</option><option value="base">底面から</option></select></label>`;
 const main=document.createElement('div');main.innerHTML=reference()+fields();$('taperAngle').closest('label').after(main);
 const viewport=document.createElement('div');viewport.innerHTML=reference('viewport-')+fields('viewport-');$('viewport-taper-angle').closest('.extrude-inline').nextElementSibling.after(viewport);
 let previousReference='normal';
 $('taperReference').addEventListener('input',()=>{try{const native=taperStoredAngle(Number($('taperAngle').value),previousReference);$('taperAngle').value=taperDisplayAngle(native,$('taperReference').value);$('viewport-taper-angle').value=$('taperAngle').value;}catch{}previousReference=$('taperReference').value;});
 for(const key of ['taperReference','taperMode','taperSide'])$('viewport-'+key).addEventListener('input',()=>{$(key).value=$('viewport-'+key).value;$(key).dispatchEvent(new Event('input',{bubbles:true}));});
 return {
  nativeAngle:()=>taperStoredAngle(Number($('taperAngle').value),$('taperReference').value),
  sync(){
   if(document.activeElement!==$('viewport-taper-angle'))$('viewport-taper-angle').value=$('taperAngle').value;
   previousReference=$('taperReference').value;
   for(const key of ['taperReference','taperMode','taperSide'])if(document.activeElement!==$('viewport-'+key))$('viewport-'+key).value=$(key).value;
   const mode=$('taperMode').value,one=mode==='oneSide';$('taper-options').hidden=!one;$('viewport-taper-options').hidden=!one;
   for(const prefix of ['', 'viewport-']){const hint=$(prefix+'taper-contour-hint');hint.hidden=!['inner','outer'].includes(mode);hint.textContent=mode==='inner'?'コの字の外側を固定し、内側の壁だけに傾斜を付けます。＋で空間を狭め、−で広げます。':'コの字の内側を固定し、外側の壁だけに傾斜を付けます。＋で外へ広げ、−で狭めます。';}
   const base=$('taperReference').value==='base',limit=base?90:80;
   for(const input of [$('taperAngle'),$('viewport-taper-angle')]){input.min=-limit;input.max=limit;}
   const reset=base?'90°':'0°';$('viewport-taper-reset').textContent=reset;$('viewport-taper-reset').title='傾斜なしに戻す（'+reset+'）';
   const hint=base?'底面からの角度：10〜90° ／ 90°で傾斜なし ／ ＋で広がる・−で細くなる':'押し出し方向からの角度 ／ 0°で傾斜なし ／ ＋で広がる・−で細くなる';
   $('taperAngle').closest('label').querySelector('.taper-hint').textContent=hint;$('viewport-taper-angle').closest('.extrude-inline').nextElementSibling.textContent=hint;
   $('taper-handle').setAttribute('aria-valuemin',-limit);$('taper-handle').setAttribute('aria-valuemax',limit);
  }
 };
}
