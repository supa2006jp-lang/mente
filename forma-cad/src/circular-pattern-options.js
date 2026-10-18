export const cavityPattern=p=>p.type==='circular'&&['新規かつ切り取り','切り取りのみ'].includes(p.operation);
export function circularPositions(p){
 if(!Number.isInteger(p.count)||p.count<1||p.count>20)throw Error('個数は1〜20の整数にしてください');
 if(!Number.isFinite(p.angle))throw Error('角度を指定してください');
 const suppressed=p.suppressedInstances||[];
 if(!Array.isArray(suppressed)||suppressed.some(i=>!Number.isInteger(i)||i<1||i>=p.count)||new Set(suppressed).size!==suppressed.length)throw Error('配置位置の指定が不正です');
 const positions=Array.from({length:p.count-1},(_,i)=>i+1).filter(i=>!suppressed.includes(i));
 if(p.count>1&&!positions.length)throw Error('少なくとも1つの配置位置をオンにしてください');
 return positions;
}
export function circularCutTargets(p,bodies){
 if(p.cutTargets===undefined)return null;
 if(!Array.isArray(p.cutTargets)||!p.cutTargets.length||p.cutTargets.some(id=>typeof id!=='string'||!bodies.has(id))||new Set(p.cutTargets).size!==p.cutTargets.length)throw Error('加工対象のボディを1個以上選択してください');
 return new Set(p.cutTargets);
}
export function selectedCavityEntries(entries,p){
 if(p.cavityKeys===undefined)return entries;
 if(!Array.isArray(p.cavityKeys)||!p.cavityKeys.length||p.cavityKeys.some(key=>typeof key!=='string')||new Set(p.cavityKeys).size!==p.cavityKeys.length)throw Error('穴・くぼみを1個以上選択してください');
 const selected=p.cavityKeys.map(key=>entries.find(entry=>entry.key===key));
 if(selected.some(entry=>!entry))throw Error('選択した穴・くぼみの形状が変わりました。原型から選び直してください');
 return selected;
}
