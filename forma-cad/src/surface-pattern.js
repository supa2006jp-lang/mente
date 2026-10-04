import {polygonRegions,svgWrapPieces} from './svg-wrap-pattern.js';
export const surfacePatternNames={scales:'うろこ',wave:'波',grid:'網目',stone:'石目'};
export function surfacePattern(circumference,height,settings={}){
 const p={version:1,kind:'scales',size:20,rows:3,lineWidth:.8,stagger:.5,seed:1,...settings};
 if(!Number.isFinite(circumference)||circumference<=0||!Number.isFinite(height)||height<=0)throw Error('円柱と模様の高さを確認してください');
 if(!surfacePatternNames[p.kind]||p.version!==1||!Number.isFinite(p.size)||p.size<.1||!Number.isInteger(p.rows)||p.rows<1||p.rows>8||!Number.isFinite(p.lineWidth)||p.lineWidth<.2||!Number.isFinite(p.stagger)||p.stagger<0||p.stagger>1||!Number.isInteger(p.seed)||p.seed<0||p.seed>9999)throw Error('模様の設定範囲を確認してください');
 const count=Math.max(2,Math.round(circumference/p.size)),width=circumference/count,rowHeight=height/p.rows;
 if(count>24||count*p.rows>48)throw Error('模様が細かすぎます。幅を大きくするか段数を減らしてください（1周24枚・合計48枚まで）');
 if(p.lineWidth>=Math.min(width,rowHeight)*.35)throw Error('線の太さを模様の幅・段の高さの35%未満にしてください');
 const raw=[];const add=outer=>raw.push({outer:outer.map(([x,y])=>[x/circumference,y/height]),holes:[]});
 const ribbon=points=>add([...points.map(([x,y])=>[x,y+p.lineWidth/2]),...points.toReversed().map(([x,y])=>[x,y-p.lineWidth/2])]);
 // Every row repeats in X; copies beyond both boundaries are clipped, so the
 // left/right seam has the same profile even when alternate rows are shifted.
 const jitter=(row,col,n)=>{const v=Math.sin((row+1)*127.1+(col+1)*311.7+(n+1)*74.7+p.seed*19.19)*43758.5453;return v-Math.floor(v);};
 for(let row=0;row<p.rows;row++){
  const shift=(row%2)*p.stagger*width*(p.kind==='grid'?.5:1);
  if(p.kind==='wave'||p.kind==='grid'){
   const points=[];for(let i=-8;i<=count*8+8;i++){const x=i*width/8,phase=(x-shift)/width;const v=p.kind==='wave'?Math.sin(phase*Math.PI*2)*.25:(2*Math.abs(2*(phase-Math.floor(phase)) -1)-1)*.35;points.push([x,(row+.5)*rowHeight+v*rowHeight]);}
   ribbon(points);
   if(p.kind==='grid')ribbon(points.map(([x,y])=>[x,(2*row+1)*rowHeight-y]));
  }else for(let col=-1;col<=count;col++){
   const x=col*width+shift,y=row*rowHeight;
   if(p.kind==='scales'){
    const points=[];for(let i=0;i<=12;i++){const t=i*Math.PI/12;points.push([x+width*(1-Math.cos(t))/2,y+rowHeight*(.82-.64*Math.sin(t))]);}ribbon(points);
   }else{
    const index=((col%count)+count)%count,gap=p.lineWidth/2,a=x+gap,b=x+width-gap,c=y+gap,d=y+rowHeight-gap;
    const cutX=width*(.1+.12*jitter(row,index,0)),cutY=rowHeight*(.1+.12*jitter(row,index,1));
    add([[a+cutX,c],[b-cutX*.8,c],[b,c+cutY],[b,d-cutY*.7],[b-cutX,d],[a+cutX*.7,d],[a,d-cutY],[a,c+cutY*.8]]);
   }
  }
 }
 const regions=polygonRegions(raw,[0,0,1,1]);
 const vertices=regions.reduce((n,r)=>n+[r.outer,...r.holes].reduce((m,a)=>m+a.length,0),0);
 if(!regions.length||regions.length>80||vertices>2500)throw Error('模様が複雑すぎます。幅を大きくするか段数を減らしてください');
 svgWrapPieces(regions,'single');
 return {regions,settings:p,count,width,rowHeight,aspect:height/circumference};
}
