import Clipper from 'clipper-lib';
const SCALE=1e7;
const path=ring=>ring.map(([x,y])=>({X:Math.round(x*SCALE),Y:Math.round(y*SCALE)}));
const ring=points=>points.map(p=>[p.X/SCALE,p.Y/SCALE]);
export function polygonRegions(regions,rectangle){
 const subject=[];for(const region of regions){for(const [i,points]of [region.outer,...(region.holes||[])].entries()){const p=path(points);if(Clipper.Clipper.Orientation(p)!==(i===0))p.reverse();subject.push(p);}}
 const clipper=new Clipper.Clipper(),tree=new Clipper.PolyTree();clipper.AddPaths(subject,Clipper.PolyType.ptSubject,true);
 if(rectangle){const [x0,y0,x1,y1]=rectangle;clipper.AddPath(path([[x0,y0],[x1,y0],[x1,y1],[x0,y1]]),Clipper.PolyType.ptClip,true);}
 clipper.Execute(rectangle?Clipper.ClipType.ctIntersection:Clipper.ClipType.ctUnion,tree,Clipper.PolyFillType.pftNonZero,Clipper.PolyFillType.pftNonZero);
 const result=[];function visit(node){if(node.Contour().length&&!node.IsHole())result.push({outer:ring(node.Contour()),holes:node.Childs().filter(c=>c.IsHole()).map(c=>ring(c.Contour()))});for(const child of node.Childs())visit(child);}visit(tree);return result;
}
export function cleanSvgRegions(regions,tolerance=.0005){
 const clean=points=>ring(Clipper.Clipper.CleanPolygon(path(points),tolerance*SCALE));
 const cleaned=regions.map(r=>({outer:clean(r.outer),holes:r.holes.map(clean).filter(h=>h.length>=3)})).filter(r=>r.outer.length>=3);
 return polygonRegions(cleaned,[0,0,1,1]);
}
export function svgRepeatLayout(circumference,tileWidth){
 if(!Number.isFinite(circumference)||circumference<=0||!Number.isFinite(tileWidth)||tileWidth<=0)throw Error('1枚の幅を0より大きい数値で指定してください');
 const count=Math.max(1,Math.round(circumference/tileWidth));
 if(count>24)throw Error('繰り返しは24回までです。1枚の幅を大きくしてください');
 return {count,width:circumference/count};
}
export function periodicSvgRegions(regions,seam='mirror',repeatCount=1,fraction=1){
 if(seam==='repeat'&&(!Number.isInteger(repeatCount)||repeatCount<1||repeatCount>24))throw Error('繰り返し回数は1〜24の整数にしてください');
 if(seam==='fit'&&(!Number.isFinite(fraction)||fraction<=0||fraction>=1))throw Error('模様1個の幅を確認してください');
 const mapped=seam==='fit'?regions.map(r=>({outer:r.outer.map(([x,y])=>[x*fraction,y]),holes:r.holes.map(h=>h.map(([x,y])=>[x*fraction,y]))})):seam==='repeat'?regions.flatMap(r=>Array.from({length:repeatCount},(_,copy)=>({outer:r.outer.map(([x,y])=>[(x+copy)/repeatCount,y]),holes:r.holes.map(h=>h.map(([x,y])=>[(x+copy)/repeatCount,y]))}))):seam==='mirror'?regions.flatMap(r=>[0,1].map(copy=>({outer:r.outer.map(([x,y])=>[copy?(2-x)/2:x/2,y]),holes:r.holes.map(h=>h.map(([x,y])=>[copy?(2-x)/2:x/2,y]))}))):regions;
 return polygonRegions(mapped,[0,0,1,1]);
}
export function svgWrapPieces(pattern,seam='mirror',repeatCount=1,fraction=1){
 const regions=periodicSvgRegions(pattern,seam,repeatCount,fraction),pieces=[];
 for(let i=0;i<4;i++)pieces.push(...polygonRegions(regions,[i/4,0,(i+1)/4,1]));
 if(!pieces.length)throw Error('SVGに加工できる塗りの領域がありません');if(pieces.length>100)throw Error('図案が細かすぎます。輪郭を減らしてください');return pieces;
}
