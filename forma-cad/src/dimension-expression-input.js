import {normalizeDimensionExpression,validateDimensionExpression} from './dimension-expression.js';

export function installDimensionExpressions({document=globalThis.document,window=document.defaultView}={}){
 const panel=document.createElement('section');panel.id='dimension-expression-editor';panel.hidden=true;panel.setAttribute('popover','manual');panel.setAttribute('role','dialog');panel.setAttribute('aria-label','寸法の計算式');
 panel.innerHTML='<label for="dimension-expression-text">寸法の計算式</label><input id="dimension-expression-text" type="text" inputmode="text" autocomplete="off" spellcheck="false" maxlength="256" aria-describedby="dimension-expression-result dimension-expression-hint"><output id="dimension-expression-result" role="status" aria-live="polite"></output><small id="dimension-expression-hint">例：30/2、10+0.2、(20-4)*2<br>Enterで反映 ／ Escで取り消し</small><div><button type="button" data-apply>反映</button><button type="button" data-cancel>取り消し</button></div>';
 const style=document.createElement('style');style.textContent='#dimension-expression-editor{position:fixed;inset:auto;margin:0;z-index:1000;box-sizing:border-box;width:min(300px,calc(100vw - 16px));max-height:calc(100vh - 16px);overflow:auto;padding:12px;border:1px solid #6097af;border-radius:8px;background:#f4fbff;color:#173f53;box-shadow:0 5px 22px #0004;font-size:13px}#dimension-expression-editor[hidden]{display:none}#dimension-expression-editor label{display:block;margin:0 0 6px;color:inherit;font-size:13px}#dimension-expression-editor input{box-sizing:border-box;width:100%;padding:8px;border:1px solid #6398b1;border-radius:4px;color:#173f53;background:white;font-size:16px}#dimension-expression-editor output{display:block;margin:7px 0;overflow-wrap:anywhere}#dimension-expression-editor output[data-error=true]{color:#b23221}#dimension-expression-editor small{display:block;color:#506a7b;font-size:12px;line-height:1.5}#dimension-expression-editor>div{display:flex;gap:8px;margin-top:9px}#dimension-expression-editor button{padding:6px 12px;color:#173f53;background:#e1f2fa;border:1px solid #83aec4;border-radius:4px}';
 document.head.append(style);document.body.append(panel);
 const text=panel.querySelector('input'),result=panel.querySelector('output'),apply=panel.querySelector('[data-apply]'),edited=new WeakSet(),consumedKeys=new Set();let session=null,observer=null;
 const eligible=input=>input?.tagName==='INPUT'&&input.type==='number'&&!input.disabled&&!input.readOnly&&input.isConnected&&input.getClientRects().length>0;
 const current=()=>session&&eligible(session.input)&&session.input.value===session.value;
 function close(focus=false){
  const input=session?.input;session=null;observer?.disconnect();observer=null;
  try{panel.hidePopover?.();}catch{}panel.hidden=true;delete panel.dataset.target;
  if(focus&&eligible(input))input.focus({preventScroll:true});
 }
 function assess(){
  if(!current()){close();return null;}
  try{const value=validateDimensionExpression(session.input,text.value,document);result.textContent='= '+value;result.dataset.error='false';text.removeAttribute('aria-invalid');apply.disabled=false;return value;}
  catch(error){result.textContent=error.message;result.dataset.error='true';text.setAttribute('aria-invalid','true');apply.disabled=true;return null;}
 }
 function commit(focus=true){
  const value=assess();if(value===null)return false;const input=session.input;close(focus);
  input.value=value;input.dispatchEvent(new window.Event('input',{bubbles:true}));input.dispatchEvent(new window.Event('change',{bubbles:true}));return true;
 }
 function place(){
  if(!current()){close();return;}
  const rect=session.input.getBoundingClientRect(),width=panel.offsetWidth,height=panel.offsetHeight;
  panel.style.left=Math.max(8,Math.min(rect.left,window.innerWidth-width-8))+'px';
  panel.style.top=Math.max(8,Math.min(rect.bottom+6+height<=window.innerHeight-8?rect.bottom+6:rect.top-height-6,window.innerHeight-height-8))+'px';
 }
 function open(input,expression,{select=false}={}){
  if(!eligible(input))return false;close();session={input,value:input.value};
  (input.closest('dialog[open]')||document.body).append(panel);panel.dataset.target=input.id||'';text.value=expression;panel.hidden=false;
  try{panel.showPopover?.();}catch{}assess();place();text.focus({preventScroll:true});if(select)text.select();else text.setSelectionRange(text.value.length,text.value.length);
  if(window.MutationObserver){observer=new window.MutationObserver(()=>{if(session&&!current())close();});observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','open','disabled','readonly']});}
  return true;
 }
 text.addEventListener('input',()=>{assess();place();});
 apply.onclick=()=>commit();panel.querySelector('[data-cancel]').onclick=()=>close(true);
 document.addEventListener('focusin',event=>{
  if(!eligible(event.target))return;edited.delete(event.target);
  if(!event.target.title.includes('計算式'))event.target.title+=(event.target.title?' ／ ':'')+'計算式：30/2、10+0.2（= または F2 でも入力）';
 });
 document.addEventListener('input',event=>{if(eligible(event.target)&&event.isTrusted)edited.add(event.target);},true);
 window.addEventListener('keydown',event=>{
  if(session&&panel.contains(event.target)){
   consumedKeys.add(event.code||event.key);
   event.stopImmediatePropagation();
   if(event.isComposing)return;
   if(event.key==='Escape'){event.preventDefault();close(true);}
   else if(event.key==='Enter'||event.key==='Tab'){event.preventDefault();if(!commit())text.focus();}
   return;
  }
  const input=event.target;if(!eligible(input)||event.defaultPrevented||event.isComposing||event.altKey)return;
  if(event.ctrlKey||event.metaKey){if(event.key.toLowerCase()==='a')edited.delete(input);return;}
  const key=event.key;
  if(!['+','*','/','×','÷','(',')','=','F2'].includes(key)&&!(key==='-'&&edited.has(input)&&input.value!==''))return;
  // An unfinished exponent must retain the native number input's sign handling.
  if(key==='+'&&input.validity.badInput&&input.value==='')return;
  event.preventDefault();event.stopImmediatePropagation();
  consumedKeys.add(event.code||event.key);
  open(input,key==='F2'?input.value:key==='='?'':key==='('?'(':(input.value||'')+key,{select:key==='F2'});
 },{capture:true});
 // The parent tools also handle Escape on keyup; consume the entire key pair.
 window.addEventListener('keyup',event=>{if(consumedKeys.delete(event.code||event.key)||session&&panel.contains(event.target)){event.preventDefault();event.stopImmediatePropagation();}},{capture:true});
 window.addEventListener('blur',()=>{consumedKeys.clear();close();});
 document.addEventListener('paste',event=>{
  if(!eligible(event.target)||event.defaultPrevented)return;
  const pasted=event.clipboardData?.getData('text');if(!pasted)return;
  const normalized=normalizeDimensionExpression(pasted).trim();
  if(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(normalized)||!/[+*/()-]/.test(normalized))return;
  event.preventDefault();event.stopImmediatePropagation();open(event.target,pasted);
 },true);
 document.addEventListener('pointerdown',event=>{
  if(!session||panel.contains(event.target))return;
  if(!current()){close();return;}
  if(!commit(false)){event.preventDefault();event.stopImmediatePropagation();text.focus({preventScroll:true});}
 },true);
 document.addEventListener('submit',event=>{
  if(!session)return;if(!current()){close();return;}
  if(!commit(false)){event.preventDefault();event.stopImmediatePropagation();text.focus();}
 },true);
 document.addEventListener('close',event=>{if(session&&event.target.contains(session.input))close();},true);
 window.addEventListener('resize',place);document.addEventListener('scroll',()=>{if(session)place();},true);
 return {open,close,get active(){return !!session;}};
}
