export function createTaperOptionsControls($){
 const fields=(prefix='')=>`<label>テーパー方式<select id="${prefix}taperMode"><option value="all">全周（従来）</option><option value="oneSide">片側だけ</option></select></label><div id="${prefix}taper-options" hidden><label>広げる側<select id="${prefix}taperSide"><option value="u+">横 ＋側</option><option value="u-">横 −側</option><option value="v+">縦 ＋側</option><option value="v-">縦 −側</option></select></label><small class="taper-hint">反対側を固定します。横・縦は元のスケッチ平面の方向です。</small></div>`;
 const main=document.createElement('div');main.innerHTML=fields();$('taperAngle').closest('label').after(main);
 const viewport=document.createElement('div');viewport.innerHTML=fields('viewport-');$('viewport-taper-angle').closest('.extrude-inline').nextElementSibling.after(viewport);
 for(const key of ['taperMode','taperSide'])$('viewport-'+key).addEventListener('input',()=>{$(key).value=$('viewport-'+key).value;$(key).dispatchEvent(new Event('input',{bubbles:true}));});
 return {sync(){for(const key of ['taperMode','taperSide'])if(document.activeElement!==$('viewport-'+key))$('viewport-'+key).value=$(key).value;const one=$('taperMode').value==='oneSide';$('taper-options').hidden=!one;$('viewport-taper-options').hidden=!one;}};
}
