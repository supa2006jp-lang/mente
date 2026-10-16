import {phaseLabels,summarizeBarrierTimings} from './phase-timings.js';

export function createBarrierPreviewControls({host,onModeChange,onUpdate,onGapChange,storage=globalThis.localStorage,now=()=>performance.now()}){
 let mode='auto',showGap=true,run=null,last=null,stale=false,count=0,state='idle',active=false,enabled=false;
 try{if(storage?.getItem('forma-barrier-preview-mode')==='manual')mode='manual';}catch{}
 try{showGap=storage?.getItem('forma-barrier-show-gap')!=='false';}catch{}
 const views=['','viewport-'].map(prefix=>{
  const options=document.createElement('div');options.id=prefix+'barrier-preview-options';options.hidden=true;
  const label=document.createElement('label');label.textContent='プレビュー';
  const select=document.createElement('select');select.id=prefix+'barrier-preview-mode';select.setAttribute('aria-label','バリア押し出しのプレビュー更新方法');
  select.add(new Option('自動更新','auto'));select.add(new Option('手動更新','manual'));label.append(select);
  const button=document.createElement('button');button.id=prefix+'barrier-preview-update';button.type='button';button.textContent='プレビュー更新';button.style.cssText='width:100%;margin:5px 0';
  const note=document.createElement('small');note.id=prefix+'barrier-preview-note';note.style.cssText='display:block;margin-top:4px;line-height:1.5';
  const details=document.createElement('details');details.id=prefix+'barrier-timings';details.hidden=true;details.style.cssText='margin-top:7px;padding:6px;border:1px solid #9ab6c5;border-radius:4px;font-size:12px;line-height:1.5';
  const summary=document.createElement('summary');summary.style.cursor='pointer';
  const table=document.createElement('table');table.style.width='100%';table.setAttribute('aria-label','バリア押し出しの工程別計算時間');
  const body=document.createElement('tbody');table.append(body);details.append(summary,table);
  const gapLabel=document.createElement('label');gapLabel.style.cssText='display:flex;align-items:center;gap:6px;margin-top:8px';
  const gapToggle=document.createElement('input');gapToggle.type='checkbox';gapToggle.id=prefix+'barrier-show-gap';gapLabel.append(gapToggle,document.createTextNode('すき間を色で表示'));
  const gapNote=document.createElement('small');gapNote.textContent='オフにすると色表示の計算を省略します。すき間の検査は行います。';gapNote.style.cssText='display:block;line-height:1.5';
  options.append(label,button,note,gapLabel,gapNote);const parent=document.getElementById(prefix+'barrier').closest('.extrusion-barrier-controls');parent.append(options,details);
  select.addEventListener('change',()=>{mode=select.value==='manual'?'manual':'auto';try{storage?.setItem('forma-barrier-preview-mode',mode);}catch{}render();onModeChange(mode);});
  button.addEventListener('click',()=>onUpdate());
  gapToggle.addEventListener('change',()=>{showGap=gapToggle.checked;try{storage?.setItem('forma-barrier-show-gap',String(showGap));}catch{}render();onGapChange?.(showGap);});
  return {options,select,button,note,details,summary,body,gapToggle};
 });
 function render(){
  host.dataset.barrierPreviewMode=mode;host.dataset.barrierPreviewState=state;host.dataset.barrierShowGap=String(showGap);
  for(const view of views){
   view.options.hidden=!active;if(view.select.value!==mode)view.select.value=mode;
   view.select.disabled=!enabled;view.button.disabled=!enabled||state==='pending';
   view.gapToggle.checked=showGap;view.gapToggle.disabled=!enabled;
   view.note.textContent=state==='pending'?'プレビューを計算しています。':mode==='manual'?'調整後に「プレビュー更新」を押してください。':'入力した条件で自動更新します。';
   view.details.hidden=!active||!last&&!run;
   const report=run&&!run.done?summarizeBarrierTimings(run.reports,now()-run.started):last;
   if(!report){view.body.replaceChildren();continue;}
   const pending=run&&!run.done;
   view.summary.textContent=(pending?'計算時間：計算中…':stale?'前回の計算：':last?.reused?'結果を再利用：':last?.failed?'計算時間（失敗）：':'計算時間：')+(pending?'':' '+(report.totalMs/1000).toFixed(2)+' 秒');
   view.body.replaceChildren();
   for(const [key,label] of [...Object.entries(phaseLabels),['waiting','待機・転送・描画']]){
    const row=document.createElement('tr'),title=document.createElement('th'),value=document.createElement('td');
    title.scope='row';title.style.cssText='text-align:left;font-weight:normal';title.textContent=label;
    value.style.textAlign='right';value.textContent=((key==='waiting'?report.waitingMs:report.phases[key]||0)/1000).toFixed(2)+' 秒';row.append(title,value);view.body.append(row);
   }
  }
  if(last)host.dataset.barrierTimings=JSON.stringify(last);
 }
 return {
  get manual(){return mode==='manual';},
  get showGap(){return showGap;},
  setState(next,options){state=next;active=options.active;enabled=options.enabled;render();},
  invalidate(){run=null;stale=!!last;render();},
  begin(reused=false){run={started:now(),reports:[],done:false,reused};state='pending';stale=false;host.dataset.barrierPreviewReused=String(reused);if(!reused)host.dataset.barrierPreviewRunCount=String(++count);render();return run;},
  timingOptions(token){return {onTiming:report=>{if(run!==token||!token||token.done)return;token.reports.push(report);render();}};},
  finish(token,failed=false){if(!token||run!==token||token.done)return;token.done=true;last={...summarizeBarrierTimings(token.reports,now()-token.started),failed,reused:token.reused};stale=false;render();}
 };
}
