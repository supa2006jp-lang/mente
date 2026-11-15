const instructions={
 line:['始点をクリック','終点をクリック','長さ・角度は画面上で入力できます。Enterで確定または作図終了。'],
 rect:['最初の角をクリック','対角の角をクリック','幅・高さは画面上で入力できます。Enterで確定。'],
 centerRect:['中心をクリック','角をクリック','幅・高さは長方形全体の寸法です。Enterで確定。'],
 channel:['最初の角をクリック','対角の角をクリック','右クリックで開口方向を切り替えます。幅・高さは画面上で入力でき、Enterで確定します。'],
 circle:['中心をクリック','円周上をクリック','直径を入力してEnterで確定できます。'],
 polygon:['中心をクリック','頂点をクリック','半径と辺の数を指定できます。Tabで入力欄を切り替え、Enterで確定します。'],
 spline:['最初のフィット点をクリック','次のフィット点をクリック','Enterで確定、始点をクリックすると閉じます。Backspaceで1点戻します。右クリックで直線に切り替えます。'],
 point:['点の位置をクリック','点の位置をクリック','左ドラッグで範囲を指定すると、その中心に点を配置します。'],
};

export function installSketchDrawingHelp(banner,instruction){
 const toggle=document.createElement('button'),details=document.createElement('small');
 toggle.id='sketch-drawing-help-toggle';
 toggle.type='button';
 toggle.textContent='操作説明';
 details.id='sketch-drawing-help';
 toggle.setAttribute('aria-controls',details.id);
 function expand(expanded){
  details.hidden=!expanded;
  toggle.setAttribute('aria-expanded',String(expanded));
 }
 toggle.onclick=()=>expand(details.hidden);
 banner.append(toggle,details);
 expand(false);
 return {update({tool,started,connected,arc}){
  const [start,end,description]=instructions[tool]||instructions.line;
  const hint=arc?'ドラッグを離して円弧を確定':started?end:start;
  const rightClick=tool==='line'?(connected?' 右クリックで曲線に切り替えます。':' 右クリックで通常線と補助線を切り替えます。'):'';
  const help=description+rightClick+' Escで作図を中断します。';
  if(instruction.textContent!==hint)instruction.textContent=hint;
  if(details.textContent!==help)details.textContent=help;
 }};
}
