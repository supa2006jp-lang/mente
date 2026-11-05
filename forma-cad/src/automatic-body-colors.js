const colors={
 main:'#e3e6df',dark:'#303b43',metal:'#a4b3bc',glass:'#4b7f98',
 red:'#c5463c',amber:'#dd9535',yellow:'#e9c54a',light:'#d9e9ed',
 green:'#427a65',secondary:'#668899',accent:'#c38b53'
};

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

export function automaticBodyColors(bodies){
 const parts=bodies.map(body=>{
  const dimensions=[...body.dimensions].sort((a,b)=>a-b);
  return {...body,dimensions,area:dimensions[1]*dimensions[2]};
 });
 const largestArea=parts.reduce((largest,part)=>Math.max(largest,part.area),0);
 const plan=new Map();
 for(const {id,name,dimensions,area,appearance} of parts){
  if(appearance)continue;
  const role=namedRoles.find(([,pattern])=>pattern.test(name))?.[0]??shapeRole(dimensions,area,largestArea);
  plan.set(id,colors[role]);
 }
 return plan;
}
