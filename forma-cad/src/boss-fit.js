import {snapBossSettings} from './boss-snap.js';

export const bossFitPresets=Object.freeze([{id:'loose',label:'緩め',clearance:.25},{id:'standard',label:'標準',clearance:.20},{id:'tight',label:'きつめ',clearance:.10}]);
export const bossFitTestClearances=Object.freeze([.10,.15,.20,.25]);
export function bossFitPreset(clearance){return bossFitPresets.find(p=>Math.abs(p.clearance-clearance)<1e-8)?.id||'custom';}
export function bossFitTestSettings(p){
 const s={diameter:p.diameter??6,length:p.length??4,bossWall:p.bossWall??1.6,bossHeight:p.bossHeight??8};
 for(const [key,min,max,label]of [['diameter',1,50,'棒の直径'],['length',1,100,'差し込み長さ'],['bossWall',.8,20,'ボスの肉厚'],['bossHeight',2,200,'ボスの高さ']])if(!Number.isFinite(s[key])||s[key]<min||s[key]>max)throw Error(label+'を'+min+'〜'+max+' mmで指定してください');
 const snap=snapBossSettings({...s,pinStyle:p.pinStyle,clearance:.25}),axialGap=snap?.axialGap??.25;
 const baseThickness=1.6,bossHeight=Math.max(s.bossHeight,s.length+axialGap+1.2),outerDiameter=snap?(snap.pocketRadius+s.bossWall)*2:s.diameter+.5+s.bossWall*2,padWidth=Math.max(16,outerDiameter+2.4),padLength=outerDiameter+9,gap=4,width=padWidth*4+gap*3,depth=padLength*2+gap;
 if(width>180||depth>180)throw Error('4種類のテストピースが180 mmプレートに収まりません。棒の直径かボスの肉厚を小さくしてください');
 return {...s,...(snap?{pinStyle:p.pinStyle}:{}),bossHeight,baseThickness,padWidth,padLength,gap,width,depth,clearances:[...bossFitTestClearances]};
}
