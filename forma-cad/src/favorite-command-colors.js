export function readCommandColors(value){
 if(!value||typeof value!=='object'||Array.isArray(value))return {};
 return Object.fromEntries(Object.entries(value).filter(([id,color])=>/^[\w-]{1,80}$/.test(id)&&typeof color==='string'&&/^#[\da-f]{6}$/i.test(color)).slice(0,100).map(([id,color])=>[id,color.toLowerCase()]));
}

export function commandColorText(color){
 const rgb=[1,3,5].map(start=>parseInt(color.slice(start,start+2),16)/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4);
 const luminance=rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
 return luminance>.179?'#000000':'#ffffff';
}

export function applyCommandColor(element,color){
 if(color){
  if(element.dataset.commandColor!==color){
   element.dataset.commandColor=color;
   element.style.setProperty('--favorite-bg',color);
   element.style.setProperty('--favorite-fg',commandColorText(color));
  }
 }else if(element.hasAttribute('data-command-color')){
  delete element.dataset.commandColor;
  element.style.removeProperty('--favorite-bg');element.style.removeProperty('--favorite-fg');
 }
}
