import Clipper from 'clipper-lib';
// Store outlines in the project so reopening does not depend on the original font.
export function floorLabelPattern(text){
 text=text.trim();if(!text)return null;if([...text].length>12)throw Error('部屋の文字は12文字以内で指定してください');
 const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true}),font='bold 96px sans-serif';ctx.font=font;canvas.width=Math.ceil(ctx.measureText(text).width)+16;canvas.height=144;ctx.font=font;ctx.fillStyle='#000';ctx.fillText(text,8,112);
 const {data}=ctx.getImageData(0,0,canvas.width,canvas.height),paths=[];let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
 for(let y=0;y<canvas.height;y++){let start=-1;for(let x=0;x<=canvas.width;x++){const filled=x<canvas.width&&data[(y*canvas.width+x)*4+3]>=128;if(filled&&start<0)start=x;if(!filled&&start>=0){paths.push([{X:start,Y:y},{X:x,Y:y},{X:x,Y:y+1},{X:start,Y:y+1}]);x0=Math.min(x0,start);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y+1);start=-1;}}}
 if(!paths.length)throw Error('文字の輪郭を作成できません');const clipper=new Clipper.Clipper(),tree=new Clipper.PolyTree();clipper.StrictlySimple=true;clipper.AddPaths(paths,Clipper.PolyType.ptSubject,true);clipper.Execute(Clipper.ClipType.ctUnion,tree,Clipper.PolyFillType.pftNonZero,Clipper.PolyFillType.pftNonZero);
 const normalize=points=>Clipper.Clipper.CleanPolygon(points,.8).map(p=>[(p.X-x0)/(x1-x0),(y1-p.Y)/(y1-y0)]),regions=[];
 function visit(node){if(node.Contour().length&&!node.IsHole())regions.push({outer:normalize(node.Contour()),holes:node.Childs().filter(n=>n.IsHole()).map(n=>normalize(n.Contour())).filter(r=>r.length>=3)});for(const child of node.Childs())visit(child);}visit(tree);
 const cleaned=regions.filter(r=>r.outer.length>=3);if(!cleaned.length||cleaned.length>80||cleaned.reduce((n,r)=>n+[r.outer,...r.holes].reduce((sum,h)=>sum+h.length,0),0)>6000)throw Error('文字の輪郭が細かすぎます。文字数を減らしてください');
 return {text,aspect:(x1-x0)/(y1-y0),regions:cleaned};
}
