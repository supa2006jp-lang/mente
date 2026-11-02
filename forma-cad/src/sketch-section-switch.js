export function createSketchSectionSwitch({anchor,onChange}){
 const label=document.createElement('label');label.id='sketch-section-setting';label.hidden=true;label.title='このスケッチの再編集時に断面表示を再開します。設定はファイルに保存します。';label.style.cssText='white-space:nowrap;font-size:13px;gap:6px;align-items:center;';
 const input=document.createElement('input');input.type='checkbox';input.id='sketch-section-enabled';input.setAttribute('aria-label','このスケッチの断面連動');input.style.width='auto';label.append(input,document.createTextNode(' 断面連動'));anchor.after(label);
 input.onchange=()=>onChange(input.checked);
 return {sync({visible,enabled}){label.hidden=!visible;label.style.display=visible?'inline-flex':'none';input.checked=enabled;label.dataset.enabled=String(enabled);}};
}
