const storageKey='forma-sketch-drawing-pins';

export function installSketchDrawingSettings(banner,options){
 const pins=document.createElement('div'),panel=document.createElement('div'),toggle=document.createElement('button');
 pins.id='sketch-pinned-settings';
 panel.id='sketch-drawing-settings';
 toggle.id='sketch-settings-toggle';
 toggle.type='button';
 toggle.textContent='作図設定';
 toggle.setAttribute('aria-controls',panel.id);
 let pinned;
 try{pinned=new Set(JSON.parse(localStorage.getItem(storageKey)));}catch{pinned=new Set();}
 const rows=options.map(([label,name])=>{
  const key=label.querySelector('input,select').id;
  const row=document.createElement('div'),pin=document.createElement('button');
  row.className='sketch-drawing-option';
  pin.type='button';
  pin.title=name+'をピン留め';
  pin.setAttribute('aria-label',pin.title);
  pin.onclick=()=>{
   if(pinned.has(key))pinned.delete(key);else pinned.add(key);
   try{localStorage.setItem(storageKey,JSON.stringify([...pinned]));}catch{}
   render();
   if(panel.hidden)toggle.focus();else pin.focus();
  };
  row.append(label,pin);
  return {key,row,pin};
 });
 function render(){
  for(const {key,row,pin} of rows){
   const active=pinned.has(key);
   pin.textContent=active?'★':'☆';
   pin.setAttribute('aria-pressed',String(active));
   (active?pins:panel).append(row);
  }
 }
 function setExpanded(expanded){
  toggle.setAttribute('aria-expanded',String(expanded));
  panel.hidden=!expanded;
 }
 toggle.onclick=()=>setExpanded(panel.hidden);
 banner.append(toggle,pins,panel);
 setExpanded(false);
 render();
}
