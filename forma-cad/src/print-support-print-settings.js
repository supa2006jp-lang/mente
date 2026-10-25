export function supportPrintSettings(p){
 const wallLines=p.wallThickness/p.lineWidth,roofThickness=p.roofLayers*p.layerHeight,warnings=[];
 if(wallLines<1-1e-6)warnings.push('薄壁が指定した線幅より薄いため、スライサーで省略される可能性があります');
 else if(Math.abs(wallLines-Math.round(wallLines))>.03)warnings.push('薄壁の厚みが線幅の整数倍ではありません。スライサーの薄壁処理を確認してください');
 return {lineWidth:p.lineWidth,wallLines,roofLayers:p.roofLayers,roofThickness,tabLayers:p.roofLayers,warnings};
}
export function ribReference(axis,center,ceiling,bounds){
 // Identity only: never round coordinates used for CAD construction or welding.
 return JSON.stringify([axis,ceiling,center,...bounds.flatMap(v=>v.slice(0,2))].map(v=>Number(v.toFixed(6))));
}
