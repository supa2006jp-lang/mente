const commands = [
 ['hole', '穴あけ', '平面上で穴の中心を指定'],
 ['boss', 'ボス接合', '選んだ面のボディを対象にボス接合を設定'],
 ['align', '面を合わせる', '最初に選んだ面のボディを移動'],
 ['shell', 'シェル', '選んだ面を開口にして中空にする'],
 ['fillet', 'フィレット', '選んだ辺に丸みを付ける'],
 ['chamfer', '面取り', '選んだ辺を面取りする'],
 ['pull', 'プレス／プル', '選んだ円筒面をプレス／プルする'],
 ['join', '結合', '選んだボディ同士を結合する'],
];

export function selectionCommandOptions({available, planarFaces, faceCount, faceBodies, edges, cylinder, bodies, hasOtherBody}){
 const actions=[];
 let hint='';
 if(!available)return {actions,hint};
 if(faceCount===1&&planarFaces===1){
  actions.push('hole','shell','boss','sketch');
  if(hasOtherBody){
   actions.push('align');
   hint='面合わせは、別のボディの平面をもう1つ指定します。';
  }
 }else if(faceCount>1&&planarFaces===faceCount){
  if(faceBodies===1)actions.push('shell');
  if(faceCount===2&&faceBodies===2){
   actions.push('align');
   hint='最初に選んだ面のボディを動かします。';
  }else if(hasOtherBody||faceBodies>1){
   hint='面合わせは、別々のボディから平面を1枚ずつ選びます。';
  }
 }else if(faceCount===1&&cylinder)actions.push('pull');
 else if(edges)actions.push('fillet','chamfer');
 else if(!faceCount&&bodies>1)actions.push('join');
 return {actions,hint};
}

export function createSelectionCommands({container,sketchButton,getState,run}){
 const panel=document.createElement('div');
 panel.id='selection-commands';
 panel.hidden=true;
 const label=document.createElement('strong');
 label.textContent='選択から使える操作';
 const buttons=document.createElement('div');
 buttons.className='selection-command-buttons';
 const hint=document.createElement('span');
 hint.className='selection-command-hint';
 panel.append(label,buttons,hint);
 container.querySelector('#measurement-angle').after(panel);
 const sketchHome=sketchButton.parentElement,sketchLabel=sketchButton.textContent;
 const controls=new Map();
 function add([id,name,title]){
  const button=document.createElement('button');
  button.type='button';
  button.textContent=name;
  button.title=title;
  button.dataset.selectionAction=id;
  button.addEventListener('click',()=>{
   if(selectionCommandOptions(getState()).actions.includes(id))run(id);
  });
  controls.set(id,button);
 }
 commands.forEach(add);
 controls.set('sketch',sketchButton);
 let previous='';
 return {update(){
  const {actions,hint:message}=selectionCommandOptions(getState());
  const key=actions.join(',')+'|'+message;
  if(key===previous)return;
  previous=key;
  if(!actions.includes('sketch')&&sketchButton.parentElement!==sketchHome){
   sketchButton.textContent=sketchLabel;
   sketchHome.append(sketchButton);
  }
  if(actions.includes('sketch'))sketchButton.textContent='この面にスケッチ';
  buttons.replaceChildren(...actions.map(id=>controls.get(id)));
  hint.textContent=message;
  hint.hidden=!message;
  panel.hidden=!actions.length&&!message;
 }};
}
