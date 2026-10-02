// Focus only when typing starts so pointer-driven previews remain unrestricted.
export function installDirectDimensionInput(getInput){
 window.addEventListener('keydown',event=>{
  if(event.defaultPrevented||event.isComposing||event.ctrlKey||event.metaKey||event.altKey||! /^[0-9.+-]$/.test(event.key))return;
  const active=document.activeElement;
  if(active?.isContentEditable||active?.matches('input,textarea,select'))return;
  const input=getInput();
  if(!input||input.disabled||input.readOnly||!input.getClientRects().length)return;
  input.focus({preventScroll:true});input.select();
  // The native key action inserts the first character into the newly focused input.
 },{capture:true});
}
