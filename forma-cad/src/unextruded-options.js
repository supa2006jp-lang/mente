import {formatUnextrudedDimensions} from './unextruded-dimensions.js';

export function createUnextrudedOptions({getElement,onModeChange,onTargetChange,onRememberChange}){
 const panels=[];
 const style=document.createElement('style');style.textContent='.unextruded-options{font-size:12px;margin:5px 0}.unextruded-options fieldset{max-height:140px;overflow:auto;padding:6px}.unextruded-dimensions{display:block;white-space:pre-line;font-size:12px;line-height:1.5;margin:7px 0}.unextruded-options[hidden],.unextruded-dimensions[hidden]{display:none}';document.head.append(style);
 for(const prefix of ['', 'viewport-']){
  const panel=document.createElement('div');panel.className='unextruded-options';panel.id=prefix+'unextruded-options';panel.hidden=true;
  const modeLabel=document.createElement('label'),mode=document.createElement('select');mode.id=prefix+'unextruded-target-mode';mode.add(new Option('全ボディ','all'));mode.add(new Option('指定したボディ','selected'));
  modeLabel.append('重なり判定 ',mode);
  const box=document.createElement('fieldset'),legend=document.createElement('legend'),list=document.createElement('div');box.id=prefix+'unextruded-target-bodies';box.className='extrusion-target-bodies';legend.textContent='判定するボディ';box.append(legend,list);
  const rememberLabel=document.createElement('label'),remember=document.createElement('input');remember.type='checkbox';remember.id=prefix+'unextruded-remember';rememberLabel.title='次に「未押出のみ」を開始するとき、最後に確定した距離・方向・新規／結合を使います';rememberLabel.append(remember,' 前回の設定を引き継ぐ');
  panel.append(modeLabel,box,rememberLabel);getElement(prefix+'unextruded-only').closest('label').after(panel);
  const dimensions=document.createElement('output');dimensions.className='unextruded-dimensions';dimensions.id=prefix+'unextruded-dimensions';dimensions.hidden=true;dimensions.setAttribute('aria-live','polite');
  getElement(prefix?'extrusion-tip-size':'region-selection').after(dimensions);
  mode.onchange=()=>onModeChange(mode.value);remember.onchange=()=>onRememberChange(remember.checked);
  list.onchange=event=>{if(event.target.type==='checkbox')onTargetChange(event.target.value,event.target.checked);};
  panels.push({panel,mode,box,list,remember,dimensions});
 }
 return {
  sync({active,busy,mode,ids,targets,remember}){
   for(const controls of panels){
    controls.panel.hidden=!active;controls.mode.value=mode;controls.mode.disabled=busy;
    controls.remember.checked=remember;controls.remember.disabled=busy;controls.box.hidden=mode!=='selected';
    const signature=JSON.stringify(targets.map(target=>[target.id,target.name]));
    if(controls.list.dataset.signature!==signature){controls.list.replaceChildren();controls.list.dataset.signature=signature;
     for(const target of targets){const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.value=target.id;check.setAttribute('aria-label',target.name+'を重なり判定に使う');label.append(check,target.name);controls.list.append(label);}
    }
    for(const check of controls.list.querySelectorAll('input')){check.checked=ids.includes(check.value);check.disabled=busy;}
   }
  },
  dimensions(rows,checking=false){
   for(const controls of panels){controls.dimensions.hidden=!rows;
    controls.dimensions.textContent=rows?(formatUnextrudedDimensions(rows)+(checking?'（確認中）':'')):'';
    if(rows){controls.dimensions.dataset.dimensions=JSON.stringify(rows);controls.dimensions.dataset.state=checking?'pending':'exact';}
    else{delete controls.dimensions.dataset.dimensions;delete controls.dimensions.dataset.state;}
   }
  }
 };
}
