import {polygonRegions,svgWrapPieces} from './svg-wrap-pattern.js';
export const surfacePatternNames={scales:'うろこ',wave:'波',grid:'網目',stone:'石目',zigzag:'ジグザグ',dots:'水玉',diamonds:'ひし形',honeycomb:'ハニカム',bricks:'レンガ',weave:'かご編み'};
export function surfacePattern(circumference,height,settings={}){
 const p={version:1,kind:'scales',size:20,rows:3,lineWidth:.8,stagger:.5,seed:1,...settings};
 if(!Number.isFinite(circumference)||circumference<=0||!Number.isFinite(height)||height<=0)throw Error('円柱と模様の高さを確認してください');
 if(!Object.hasOwn(surfacePatternNames,p.kind)||p.version!==1||!Number.isFinite(p.size)||p.size<.1||!Number.isInteger(p.rows)||p.rows<1||p.rows>8||!Number.isFinite(p.lineWidth)||p.lineWidth<.2||!Number.isFinite(p.stagger)||p.stagger<0||p.stagger>1||!Number.isInteger(p.seed)||p.seed<0||p.seed>9999)throw Error('模様の設定範囲を確認してください');
 const requested=Math.max(2,Math.round(circumference/p.size)),count=p.kind==='weave'?Math.max(2,Math.round(requested/2)*2):requested,width=circumference/count,rowHeight=height/p.rows;
 if(count>24||count*p.rows>48)throw Error('模様が細かすぎます。幅を大きくするか段数を減らしてください（1周24枚・合計48枚まで）');
 if(p.lineWidth>=Math.min(width,rowHeight)*.35)throw Error('線の太さを模様の幅・段の高さの35%未満にしてください');
 const raw=[];const normalized=ring=>ring.map(([x,y])=>[x/circumference,y/height]);const add=(outer,holes=[])=>raw.push({outer:normalized(outer),holes:holes.map(normalized)});
 const rectangle=(a,b,c,d)=>add([[a,c],[b,c],[b,d],[a,d]]);
 const circle=(cx,cy,r)=>add(Array.from({length:20},(_,i)=>[cx+r*Math.cos(i*Math.PI/10),cy+r*Math.sin(i*Math.PI/10)]));
 const ribbon=points=>add([...points.map(([x,y])=>[x,y+p.lineWidth/2]),...points.toReversed().map(([x,y])=>[x,y-p.lineWidth/2])]);
 // Every row repeats in X; copies beyond both boundaries are clipped, so the
 // left/right seam has the same profile even when alternate rows are shifted.
 const jitter=(row,col,n)=>{const v=Math.sin((row+1)*127.1+(col+1)*311.7+(n+1)*74.7+p.seed*19.19)*43758.5453;return v-Math.floor(v);};
 for(let row=0;row<p.rows;row++){
  const shift=(row%2)*p.stagger*width*(p.kind==='grid'?.5:1);
  if(['wave','grid','zigzag'].includes(p.kind)){
   const points=[];for(let i=-8;i<=count*8+8;i++){const x=i*width/8,phase=(x-shift)/width;const v=p.kind==='wave'?Math.sin(phase*Math.PI*2)*.25:(2*Math.abs(2*(phase-Math.floor(phase)) -1)-1)*.35;points.push([x,(row+.5)*rowHeight+v*rowHeight]);}
   ribbon(points);
   if(p.kind==='grid')ribbon(points.map(([x,y])=>[x,(2*row+1)*rowHeight-y]));
  }else for(let col=-1;col<=count;col++){
   const x=col*width+shift,y=row*rowHeight;
   if(p.kind==='scales'){
    const points=[];for(let i=0;i<=12;i++){const t=i*Math.PI/12;points.push([x+width*(1-Math.cos(t))/2,y+rowHeight*(.82-.64*Math.sin(t))]);}ribbon(points);
   }else if(p.kind==='dots'){
    circle(x+width/2,y+rowHeight/2,(Math.min(width,rowHeight)-p.lineWidth)/2);
   }else if(p.kind==='diamonds'){
    const cx=x+width/2,cy=y+rowHeight/2,hx=(width-p.lineWidth)/2,hy=(rowHeight-p.lineWidth)/2,bevel=.12;
    add([[cx-hx,cy-hy*bevel],[cx-hx*bevel,cy-hy],[cx+hx*bevel,cy-hy],[cx+hx,cy-hy*bevel],[cx+hx,cy+hy*bevel],[cx+hx*bevel,cy+hy],[cx-hx*bevel,cy+hy],[cx-hx,cy+hy*bevel]]);
   }else if(p.kind==='honeycomb'){
    const hy=height/(1.5*p.rows+.5),hx=width/2,cx=x+hx,cy=hy*(1+1.5*row);
    const hex=(a,b)=>[[cx,cy-b],[cx+a,cy-b/2],[cx+a,cy+b/2],[cx,cy+b],[cx-a,cy+b/2],[cx-a,cy-b/2]];
    add(hex(hx,hy),[hex(hx-p.lineWidth,hy-p.lineWidth)]);
   }else if(p.kind==='bricks'){
    const gap=p.lineWidth/2;rectangle(x+gap,x+width-gap,y+gap,y+rowHeight-gap);
   }else if(p.kind==='weave'){
    // An even column count keeps the over/under rhythm consistent at 360 degrees.
    const index=((col%count)+count)%count,cx=x+width/2,cy=y+rowHeight/2,gap=p.lineWidth/2;
    for(const side of [-1,1])if((row+index)%2===0){const at=cy+side*rowHeight*.2;rectangle(x+gap,x+width-gap,at-gap,at+gap);}else{const at=cx+side*width*.2;rectangle(at-gap,at+gap,y+gap,y+rowHeight-gap);}
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
