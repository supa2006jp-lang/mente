import {snapBossClearanceMax,snapBossEngagementPresets,snapBossSettings} from './boss-snap.js';

export const bossFitPresets=Object.freeze([{id:'loose',label:'緩め',clearance:.25},{id:'standard',label:'標準',clearance:.20},{id:'tight',label:'きつめ',clearance:.10}]);
export const bossFitTestClearances=Object.freeze([.10,.15,.20,.25]);
export function bossFitPreset(clearance){return bossFitPresets.find(p=>Math.abs(p.clearance-clearance)<1e-8)?.id||'custom';}
export function bossFitTestSettings(p){
 const s={snapRetentionRidge:p.snapRetentionRidge??false,snapShoulderOffset:p.snapShoulderOffset??0,diameter:p.diameter??6,length:p.length??4,bossWall:p.bossWall??1.6,bossHeight:p.bossHeight??8};
 for(const [key,min,max,label]of [['diameter',1,50,'棒の直径'],['length',1,100,'差し込み長さ'],['bossWall',.8,20,'ボスの肉厚'],['bossHeight',2,200,'ボスの高さ']])if(!Number.isFinite(s[key])||s[key]<min||s[key]>max)throw Error(label+'を'+min+'〜'+max+' mmで指定してください');
 const testMode=p.testMode??'clearance';
 if(testMode!=='clearance'&&testMode!=='engagement')throw Error('試し刷りの種類を選択してください');
 let variants;
 if(testMode==='engagement'){
  if(p.pinStyle!=='snap')throw Error('掛かりの比較には割りボスを選択してください');
  const maxClearance=snapBossClearanceMax(s.diameter,'light');
  if(!Number.isFinite(p.clearance)||p.clearance<.05||p.clearance>maxClearance+1e-8)throw Error('掛かりの3種類を比べるには、片側のすき間を0.05〜'+maxClearance+' mmに設定してください');
  variants=snapBossEngagementPresets.map(({id},i)=>({key:id,clearance:p.clearance,snapEngagement:id,label:String(i+1)}));
 }else{
  variants=bossFitTestClearances.map(clearance=>({key:String(Math.round(clearance*100)),clearance,snapEngagement:p.snapEngagement,label:clearance.toFixed(2)}));
 }
 const fits=variants.map(variant=>snapBossSettings({...s,...variant,pinStyle:p.pinStyle}));
 const axialGap=Math.max(...variants.map(({clearance},i)=>fits[i]?.axialGap??clearance));
 const outerDiameter=2*(s.bossWall+Math.max(...variants.map(({clearance},i)=>fits[i]?.pocketRadius??(s.diameter/2+clearance))));
 const baseThickness=1.6,bossHeight=Math.max(s.bossHeight,s.length+axialGap+1.2);
 const padWidth=Math.max(16,outerDiameter+2.4),padLength=outerDiameter+9,gap=4;
 const width=padWidth*variants.length+gap*(variants.length-1),depth=padLength*2+gap;
 if(width>180||depth>180)throw Error('テストピースが180 mmプレートに収まりません。棒の直径かボスの肉厚を小さくしてください');
 return {...s,pinStyle:p.pinStyle,testMode,bossHeight,baseThickness,padWidth,padLength,gap,width,depth,clearances:variants.map(v=>v.clearance),variants};
}
