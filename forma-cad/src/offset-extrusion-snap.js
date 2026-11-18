export const offsetDragSnapKey='forma-offset-extrusion-drag-snap-v1';
export function validateOffsetDragStep(value){
 if(typeof value!=='number'||!Number.isFinite(value)||value<.001||value>1000)throw Error('ドラッグの刻みは0.001〜1000 mmで指定してください');return value;
}
export function loadOffsetDragStep(storage=()=>window.localStorage){
 try{const text=storage().getItem(offsetDragSnapKey);if(text&&text.length<200){const data=JSON.parse(text);if(data.version===1)return validateOffsetDragStep(data.step);}}catch{}return .1;
}
export function saveOffsetDragStep(step,storage=()=>window.localStorage){
 validateOffsetDragStep(step);try{storage().setItem(offsetDragSnapKey,JSON.stringify({version:1,step}));}catch{throw Error('ドラッグの刻みをブラウザーに保存できませんでした');}return step;
}
export function snapOffsetDrag(value,step=.1,fine=false){
 validateOffsetDragStep(step);if(!Number.isFinite(value))throw Error('OS距離を確認してください');
 const active=step/(fine?10:1),clamped=Math.max(-10000,Math.min(10000,value));
 const snapped=Math.sign(clamped)*Math.round(Math.abs(clamped)/active+1e-9)*active;
 return Math.max(-10000,Math.min(10000,Number(snapped.toPrecision(12))))||0;
}
