export function compactMovePanel({panel,contactPanel,moveOptions,rotationOptions,rotationStepLabel,rotationHelp,onFit}){
 const header=document.createElement('div'),body=document.createElement('div'),footer=document.createElement('div');
 header.className='move-panel-header';body.className='move-panel-scroll';footer.className='move-panel-footer';
 const actions=panel.querySelector('#move-apply').parentElement,error=panel.querySelector('#move-error');
 const fields=panel.querySelector('.move-fields');
 fields.append(...['x','y','z','rx','ry','rz'].map(id=>panel.querySelector('#move-'+id).parentElement));
 header.append(panel.querySelector('strong'),panel.querySelector('#move-hint'),panel.querySelector('.move-modes'));
 for(const child of [...panel.children])if(child!==actions&&child!==error)body.append(child);
 const group=(id,title,elements)=>{
  const details=document.createElement('details'),summary=document.createElement('summary');
  details.id=id;summary.textContent=title;details.append(summary);elements[0].before(details);details.append(...elements);return details;
 };
 group('move-point-settings','点・自在移動の設定',[moveOptions]);
 group('move-contact-options','ぶつかるまで移動',[contactPanel]);
 const rotation=group('move-rotation-options','回転軸・中心と角度',[rotationOptions]);
 group('move-snap-settings','吸着と操作の説明',[rotationStepLabel,rotationHelp]);
 const fit=document.createElement('button');fit.type='button';fit.id='move-fit-preview';
 fit.textContent='編集中のソリッドを中央へ';
 fit.title='現在の移動・回転を保ったまま、プレビュー全体が見えるように視点を合わせます';fit.onclick=onFit;
 actions.className='move-panel-actions';footer.append(error,fit,actions);panel.append(header,body,footer);
 return {setMode(value){if(value==='rotate')rotation.open=true;},fit};
}
