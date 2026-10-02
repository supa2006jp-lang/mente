export function holesOnlyProblem(feature,regions=[feature.region]){
 if(!feature.holesOnly)return '';
 if(feature.mode!=='solid')return '「新規（穴だけ）」は通常の押し出しで使用してください。';
 if(feature.profile!=='region'||!regions.length||regions.every(r=>!r?.holes?.length))return '選択した領域には穴がありません。「新規ボディ」で押し出してください。';
 if(regions.some(r=>!r?.holes?.length))return '選択した領域に穴のない領域があります。「新規ボディ」を選ぶか、穴のある領域だけを選択してください。';
 return '';
}
