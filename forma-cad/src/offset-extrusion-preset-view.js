import {findPanelSpace} from './panel-placement.js';
import {addOffsetPreset,loadOffsetPresets,saveOffsetPresets} from './offset-extrusion-presets.js';

export function createOffsetExtrusionPresetView({dialog,canvas,getValue,onSelect,notify}){
 let state=loadOffsetPresets(),spot=null,valid=true;
 const label=dialog.querySelector('label'),heading=document.createElement('div');heading.style.cssText='display:flex;align-items:center;justify-content:space-between';label.before(heading);heading.append(label);
 const button=document.createElement('button');button.id='offset-extrusion-presets-toggle';button.type='button';button.textContent='▼';button.title='登録したOS距離を選ぶ';button.setAttribute('aria-label','登録したOS距離');button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls','offset-extrusion-presets');
 button.style.cssText='width:20px;height:14px;min-height:14px;padding:0;font-size:10px;line-height:12px';heading.append(button);
 const menu=document.createElement('div');menu.id='offset-extrusion-presets';menu.hidden=true;menu.setAttribute('role','group');menu.setAttribute('aria-label','OS距離の登録');menu.style.cssText='position:fixed;z-index:4;width:215px;box-sizing:border-box;padding:8px;max-height:240px;overflow:auto;background:#142232;color:#e2edf5;border:1px solid #69879c;border-radius:6px;box-shadow:0 3px 10px #0004';
 const title=document.createElement('div');title.textContent='登録した距離';title.style.cssText='font-size:11px;margin-bottom:5px';
 const list=document.createElement('div'),add=document.createElement('button'),message=document.createElement('div');list.id='offset-extrusion-presets-list';add.id='offset-extrusion-preset-add';add.type='button';add.textContent='現在の値を登録';add.style.cssText='width:100%;margin-top:5px';message.setAttribute('role','status');message.style.cssText='font-size:11px;line-height:1.4;margin-top:4px';menu.append(title,list,add,message);dialog.append(menu);
 function layout(){if(menu.hidden)return;const rect=canvas.getBoundingClientRect(),box=dialog.getBoundingClientRect(),width=menu.offsetWidth,height=menu.offsetHeight;
  spot=findPanelSpace({width:rect.width,height:rect.height,panelWidth:width,panelHeight:height,anchor:{x:box.right-rect.left,y:box.bottom-rect.top+8},previous:spot,obstacles:[{left:box.left-rect.left,right:box.right-rect.left,top:box.top-rect.top,bottom:box.bottom-rect.top}],margin:6,gap:6})||{x:Math.max(6,Math.min(rect.width-width-6,box.left-rect.left)),y:Math.max(6,Math.min(rect.height-height-6,box.bottom-rect.top+6))};
  menu.style.left=rect.left+spot.x+'px';menu.style.top=rect.top+spot.y+'px';
 }
 function close(){menu.hidden=true;button.setAttribute('aria-expanded','false');spot=null;}
 function escape(){if(menu.hidden)return false;close();button.focus();return true;}
 function persist(next){state=next;try{saveOffsetPresets(state);}catch(error){notify(error.message);}render();}
 function render(){
  list.replaceChildren();
  if(!state.values.length){const empty=document.createElement('small');empty.textContent='登録なし';list.append(empty);}
  for(const value of state.values){
   const row=document.createElement('div');row.style.cssText='display:flex;gap:5px;margin:3px 0';const pick=document.createElement('button'),remove=document.createElement('button');pick.type=remove.type='button';pick.textContent=String(value)+' mm';pick.dataset.offsetPreset=String(value);pick.style.cssText='flex:1;text-align:left;overflow:hidden;text-overflow:ellipsis';pick.title=String(value)+' mmを使用';pick.onclick=()=>{onSelect(value);close();};
   remove.textContent='×';remove.setAttribute('aria-label',String(value)+' mmの登録を解除');remove.onclick=()=>{persist({...state,values:state.values.filter(v=>v!==value)});message.textContent='登録を解除しました';layout();};row.append(pick,remove);list.append(row);
  }
  add.disabled=!valid;layout();
 }
 button.onclick=()=>{if(!menu.hidden){close();return;}message.textContent='';menu.hidden=false;button.setAttribute('aria-expanded','true');render();};
 add.onclick=()=>{try{persist(addOffsetPreset(state,getValue()));message.textContent='登録しました';layout();}catch(error){message.textContent=error.message;layout();}};
 dialog.addEventListener('pointerdown',event=>{if(!menu.hidden&&!menu.contains(event.target)&&!button.contains(event.target))close();});
 dialog.addEventListener('keydown',event=>{if(event.key==='Escape'&&escape()){event.preventDefault();event.stopPropagation();}});
 return {close,escape,update:layout,setValid(value){valid=value;add.disabled=!valid;}};
}
