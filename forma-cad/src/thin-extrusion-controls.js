// Mirror the existing editor settings in the floating extrusion panel.
export function createThinExtrusionControls({panel,side,wall,hint,sourceFill}){
 const fields=document.createElement('fieldset');fields.id='viewport-thin-fields';fields.hidden=true;
 fields.innerHTML='<legend>薄い押し出し</legend><label class="viewport-operation-row">厚みの方向<select id="viewport-side" aria-label="薄い押し出しの厚みの方向"></select></label><label for="viewport-wall">壁の厚さ</label><div class="extrude-inline"><input id="viewport-wall" type="number" required aria-label="薄い押し出しの壁厚"><span>mm</span></div><small id="viewport-thin-hint"></small>';
 panel.querySelector('.viewport-operation-row').after(fields);
 const direction=fields.querySelector('select'),thickness=fields.querySelector('input'),description=fields.querySelector('small');
 const fillLabel=document.createElement('label');fillLabel.innerHTML='<input id="viewport-thin-source-fill" type="checkbox"> 根元を補完（元厚20 mm以下）';fillLabel.title=sourceFill?.parentElement.title||'';description.before(fillLabel);const fill=fillLabel.querySelector('input');fill.addEventListener('change',()=>{if(sourceFill){sourceFill.checked=fill.checked;sourceFill.dispatchEvent(new Event('change',{bubbles:true}));}});
 for(const name of ['min','max','step'])if(wall.hasAttribute(name))thickness.setAttribute(name,wall.getAttribute(name));
 const style=document.createElement('style');style.textContent='#viewport-thin-fields{margin:8px 0;padding:7px 8px;border:1px solid #9cbccc;border-radius:5px;min-width:0}#viewport-thin-fields legend{font-size:12px;font-weight:700;padding:0 4px}#viewport-thin-fields .viewport-operation-row{margin-top:0;margin-bottom:8px}#viewport-thin-hint{display:block;color:#547185;font-size:11px;line-height:1.5;margin-top:5px}';document.head.append(style);
 direction.addEventListener('change',()=>{side.value=direction.value;side.dispatchEvent(new Event('input',{bubbles:true}));});
 thickness.addEventListener('input',()=>{wall.value=thickness.value;wall.dispatchEvent(new Event('input',{bubbles:true}));});
 return {sync({active,busy}){
  fields.hidden=!active;fields.disabled=!active||busy;
  if(direction.innerHTML!==side.innerHTML)direction.innerHTML=side.innerHTML;
  if(direction.value!==side.value)direction.value=side.value;
  if(document.activeElement!==thickness&&thickness.value!==wall.value)thickness.value=wall.value;
  if(description.textContent!==hint.textContent)description.textContent=hint.textContent;
  fillLabel.hidden=!sourceFill||sourceFill.parentElement.hidden;fill.checked=sourceFill?.checked??false;fill.disabled=!sourceFill||sourceFill.disabled||busy;
 }};
}
