import {CLEAR_COLOR,colorChoiceRgb} from './color-choice.js';

const natural={
 main:'#e3e6df',dark:'#303b43',metal:'#a4b3bc',glass:'#4b7f98',
 red:'#c5463c',amber:'#dd9535',yellow:'#e9c54a',light:'#d9e9ed',
 green:'#427a65',secondary:'#668899',accent:'#c38b53'
};
export const bodyColorThemes={natural:'実物風',muted:'落ち着いた配色',contrast:'部品を見分けやすい配色'};
const palettes={
 natural,
 muted:{main:'#d6d1c5',dark:'#3c4348',metal:'#a5adae',glass:'#617d8b',red:'#ad695e',
  amber:'#be9469',yellow:'#d8ba78',light:'#e1ddd2',green:'#6e8873',secondary:'#879aa1',accent:'#a87e64'},
 contrast:{main:'#e9edf0',dark:'#293548',metal:'#9176d5',glass:'#2968d8',red:'#d74451',
  amber:'#eb7b20',yellow:'#e7c12d',light:'#51bdc9',green:'#24926b',secondary:'#18a2b5',accent:'#c24c9d'}
};
const contrastRoles=['glass','amber','green','red','metal','light','accent','yellow','secondary','dark','main'];

// Check specific parts before their parent assembly. For example, a
// headlight bezel and a headlight lens have different appearances.
const namedRoles=[
 ['dark',/黒い奥|ベゼル|ケース|ゴム|タイヤ|トレッド|泥除け|シート|ヘッドレスト|ダッシュボード|ハンドル|ステアリング|ワイパー|樹脂カバー|rubber|tyre|tire|seat|wiper/iu],
 ['amber',/ウインカー|ウィンカー|方向指示|indicator|turn signal/iu],
 ['red',/テールライト|ブレーキランプ|赤レンズ|tail light|brake light/iu],
 ['light',/ヘッドライト|バックランプ|headlight|reverse light/iu],
 ['yellow',/ナンバープレート|黄色プレート|license plate/iu],
 ['glass',/ガラス|ウィンドシールド|窓ガラス|glass|windshield|windscreen/iu],
 ['green',/基板|回路板|\bpcb\b/iu],
 ['metal',/ホイール(?!アーチ)|ハブ|ナット|ボルト|ねじ|シャフト|ばね|バネ|反射面|排気|金属|\bwheel(?![ -]?arch)|hub|bolt|screw|shaft/iu],
 ['dark',/フレーム|シャシー|シャーシ|アクスル|支持金具|frame|chassis|axle|housing/iu],
 ['main',/キャビン|荷台|あおり|車体|外装|本体|屋根|ルーフ|バンパー|cab(?:in)?\b|roof|bumper/iu]
];

function shapeRole([short,medium,long],area,largestArea){
 if(area>=largestArea*.72)return 'main';
 if(medium>0&&long/medium>=3&&short/medium>=.55)return 'metal';
 if(medium>0&&short/medium<=.18)return 'secondary';
 if(area>=largestArea*.2)return 'secondary';
 return 'accent';
}

function candidateColors(bodies,theme){
 const parts=bodies.map(body=>{
  const dimensions=[...body.dimensions].sort((a,b)=>a-b);
  return {...body,dimensions,area:dimensions[1]*dimensions[2]};
 });
 const largestArea=parts.reduce((largest,part)=>Math.max(largest,part.area),0);
 const palette=palettes[theme]??natural;
 let unnamed=0;
 return parts.map(part=>{
  const named=namedRoles.find(([,pattern])=>pattern.test(part.name))?.[0];
  const role=named??(theme==='contrast'?contrastRoles[unnamed++%contrastRoles.length]:shapeRole(part.dimensions,part.area,largestArea));
  return {...part,role,preferred:palette[role]};
 });
}

export function automaticBodyColors(bodies){
 return new Map(candidateColors(bodies,'natural').filter(body=>!body.appearance).map(({id,preferred})=>[id,preferred]));
}

function colorDistance(a,b){
 const channels=color=>[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));
 const first=channels(colorChoiceRgb(a)),second=channels(colorChoiceRgb(b));
 return first.reduce((sum,value,i)=>sum+[.3,.59,.11][i]*(value-second[i])**2,0);
}

export function automaticColorPlan(bodies,{theme='natural',limit=4,replace=true,filaments=null}={}){
 const parts=candidateColors(bodies,theme),fixed=new Set(),eligible=[];
 for(const part of parts){
  for(const color of part.surfaceColors??[])fixed.add(color);
  if(part.hasBase===false)continue;
  if(part.appearance&&(!part.appearance.automatic||!replace))fixed.add(part.baseColor??part.appearance.color);
  else eligible.push(part);
 }
 const changes=new Map(),used=new Set(fixed);
 if(!Number.isInteger(limit)||limit<1||fixed.size>limit)return {changes,used,fixed,blocked:true};
 const available=filaments===null?null:[...new Set(filaments)];
 const outside=available?[...fixed].filter(color=>!available.includes(color)):[];
 if(available&&(!available.length||outside.length))return {changes,used,fixed,outside,blocked:true};
 const closest=(color,palette)=>palette.reduce((best,candidate)=>
  colorDistance(candidate,color)<colorDistance(best,color)?candidate:best);
 if(available){
  const solid=available.filter(color=>color!==CLEAR_COLOR);
  for(const part of eligible)part.preferred=part.role==='glass'&&available.includes(CLEAR_COLOR)?
   CLEAR_COLOR:closest(part.preferred,solid.length?solid:available);
 }
 const weights=new Map();
 for(const {preferred,area} of eligible)weights.set(preferred,(weights.get(preferred)??0)+Math.max(1,area));
 const ranked=[...weights.keys()].sort((a,b)=>weights.get(b)-weights.get(a));
 for(const color of ranked)if(used.size<limit)used.add(color);
 for(const {id,preferred,appearance} of eligible){
  const chosen=used.has(preferred)?preferred:closest(preferred,[...used]);
  if(chosen!==appearance?.color)changes.set(id,chosen);
 }
 return {changes,used,fixed,blocked:false};
}
