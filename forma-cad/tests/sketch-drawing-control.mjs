export async function setDrawingControl(page,selector,action,...args){
 const control=page.locator(selector);
 if(!await control.isVisible()){
  const settings=page.getByRole('button',{name:'作図設定',exact:true});
  if(await settings.getAttribute('aria-expanded')==='false')await settings.click();
 }
 return control[action](...args);
}
