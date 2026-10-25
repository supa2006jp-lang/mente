// Geometric screening, not a material strength calculation. The user's manual
// interval is an upper bound: auto only tightens the spacing; manual mode keeps its exact old layout.
export function supportTieInterval(height,p){
 if(!p.autoReinforce)return p.tieInterval;
 const cap=(height>120?8:height>80?12:height>40?16:20)*Math.sqrt(p.wallThickness/.8);
 return Math.min(p.tieInterval,Math.max(8,Math.floor(cap/p.layerHeight)*p.layerHeight));
}
export function supportRibRisk({height,thickness,levels=[],bottom=0,top=bottom+height}){
 const anchors=[bottom,...levels.filter(z=>z>bottom&&z<top),top].sort((a,b)=>a-b),span=Math.max(0,...anchors.slice(1).map((z,i)=>z-anchors[i])),ratio=span/thickness;
 const severity=ratio>60?'high':ratio>30?'caution':'low';
 return {height,unsupportedSpan:span,ratio,severity,message:severity==='high'?'補強のない高さが壁厚に対して大きい':severity==='caution'?'補強間隔と印刷時の揺れを確認':'形状の目安では補強間隔が短い'};
}
