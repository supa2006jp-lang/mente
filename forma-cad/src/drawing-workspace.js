export function installDrawingWorkspace(dialog,overlay){
 const get=id=>dialog.querySelector('#drawing-'+id);
 const heading=dialog.querySelector('.drawing-heading'),actions=dialog.querySelector('.drawing-actions');
 const toolbar=dialog.querySelector('.drawing-viewport-controls'),paper=get('preview'),status=get('status');
 const settings=document.createElement('aside'),body=document.createElement('div'),sheet=document.createElement('section');
 settings.id='drawing-settings';settings.setAttribute('aria-label','図面設定');
 body.className='drawing-workspace';sheet.className='drawing-sheet-pane';sheet.setAttribute('aria-label','図面');
 const toggle=document.createElement('button');
 toggle.id='drawing-settings-toggle';toggle.type='button';toggle.textContent='図面設定';
 toggle.setAttribute('aria-controls',settings.id);
 let preferred;
 function show(open){
  settings.hidden=!open;toggle.setAttribute('aria-expanded',String(open));
 }
 toggle.onclick=()=>{preferred=settings.hidden;show(preferred);};

 const appearance=document.createElement('div');
 appearance.className='drawing-controls';
 for(const id of ['preview-background','view-background']){
  appearance.append(get(id).closest('label'),get(id+'-reset'));
 }
 const print=document.createElement('div');
 print.className='drawing-controls';
 print.append(get('print-palette').closest('label'),get('pdf-layout').closest('label'),get('page-assignments'),get('page-scales'),get('pdf-placement-label'));
 const navigationHelp=toolbar.querySelector('small');
 const notices=document.createElement('div');
 notices.className='drawing-notices';
 notices.append(get('overflow-list'),get('review-list'),get('conflicts'));
 const feedback=document.createElement('div');
 feedback.className='drawing-feedback';
 feedback.append(status,notices);
 const history=dialog.querySelector('.drawing-history-controls');
 toolbar.prepend(get('undo'),get('redo'));
 history.remove();
 for(const child of [...dialog.children]){
  if(![heading,actions,toolbar,paper,status].includes(child))settings.append(child);
 }
 settings.append(appearance,print,navigationHelp);
 heading.insertBefore(toggle,get('close'));
 heading.insertBefore(actions,get('close'));
 const frame=document.createElement('div');
 frame.className='drawing-paper-frame';frame.append(paper,overlay);
 sheet.append(toolbar,frame,feedback);
 body.append(settings,sheet);dialog.append(body);
 return {
  open(){
   show(preferred??window.matchMedia('(min-width: 1400px)').matches);
   settings.scrollTop=0;
  },
  reveal(control){
   show(true);
   control.scrollIntoView({block:'nearest'});
  },
 };
}
