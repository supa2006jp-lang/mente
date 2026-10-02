const operations=[['new','新規','新規ボディ'],['newHoles','穴だけ','新規（穴だけ）'],['join','結合','結合'],['cut','切り取り','切り取り']];
export function createExtrusionWheel(viewport,onChoose){
 const element=document.createElement('div');element.id='extrude-operation-wheel';element.hidden=true;element.setAttribute('role','group');element.setAttribute('aria-label','押し出し操作を切り替え');
 const buttons=new Map();
 for(const [value,label,name] of operations){const button=document.createElement('button');button.type='button';button.dataset.extrudeOperation=value;button.textContent=label;button.setAttribute('aria-label','押し出し操作：'+name);button.title=name;button.onclick=()=>onChoose(value);element.append(button);buttons.set(value,button);}
 const center=document.createElement('span');center.className='extrude-wheel-center';center.textContent='操作';center.setAttribute('aria-hidden','true');element.append(center);viewport.append(element);
 return {element,update(operation,{hasTarget,holesProblem='',busy=false}){for(const [value,,name] of operations){const button=buttons.get(value),disabled=busy||(['join','cut'].includes(value)&&!hasTarget)||(value==='newHoles'&&!!holesProblem);button.disabled=disabled;button.setAttribute('aria-pressed',String(operation===value));button.title=value==='newHoles'&&holesProblem?holesProblem:['join','cut'].includes(value)&&!hasTarget?'先に対象ボディを作成してください':name;}}};
}
