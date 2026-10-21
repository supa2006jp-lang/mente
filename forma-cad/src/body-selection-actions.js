export function createBodySelectionActions({container,onMove,onCopy,onCut,onDimensions,onFillet,onMirror}){
 container.style.zIndex='2';
 const group=document.createElement('div');group.id='body-selection-actions';group.hidden=true;
 group.style.cssText='display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:7px;pointer-events:auto';
 for(const [id,text,title,action] of [
  ['body-quick-move','移動','選択したボディを移動／回転',onMove],
  ['body-quick-copy','移動（複製）','選択したボディを複製して移動／回転',onCopy],
  ['body-quick-cut','結合（切り取り）','選択したボディを対象に、切り取るためのボディを指定',onCut],
  ...(onMirror?[["body-quick-mirror","ミラー","選択したボディを共通の基準面でミラー",onMirror]]:[]),
  ...(onDimensions?[["body-quick-dimensions","最大寸法","選択したボディのXYZの最大寸法を確認",onDimensions]]:[]),
  ...(onFillet?[["body-quick-fillet","フィレット編集","選択したボディのフィレット工程を一覧から編集",onFillet]]:[])
 ]){
  const button=document.createElement('button');button.id=id;button.type='button';button.textContent=text;button.title=title;
  button.style.cssText='pointer-events:auto;background:#e5f4fa;color:#17475a;border:1px solid #91b6c8;padding:7px 10px;border-radius:4px';
  if(['body-quick-cut','body-quick-dimensions'].includes(id))button.style.gridColumn=id==='body-quick-dimensions'&&onFillet?'auto':'1 / -1';
  button.onclick=action;group.append(button);
 }
 container.append(group);
 return {update(visible){group.hidden=!visible;group.style.display=visible?'grid':'none';}};
}
