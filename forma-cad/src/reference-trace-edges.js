// Local shadow/rim barriers for same-colored buttons. The crop boundary is
// deliberately not used as an inferred object edge; callers flag leaks there.
export function referenceEdgeMask({width:w,height:h,data},rect,strength,smoothing=1){
 let gray=new Float32Array(w*h);for(let i=0;i<gray.length;i++)gray[i]=.2126*data[i*4]+.7152*data[i*4+1]+.0722*data[i*4+2];
 const x0=rect.x,y0=rect.y,x1=x0+rect.width,y1=y0+rect.height;
 for(let pass=0;pass<smoothing;pass++){const next=gray.slice();for(let y=y0+1;y<y1-1;y++)for(let x=x0+1;x<x1-1;x++){let sum=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)sum+=gray[(y+dy)*w+x+dx]*(dx===0?2:1)*(dy===0?2:1);next[y*w+x]=sum/16;}gray=next;}
 const edges=new Uint8Array(w*h),dilated=new Uint8Array(w*h),closed=new Uint8Array(w*h);
 for(let y=y0+1;y<y1-1;y++)for(let x=x0+1;x<x1-1;x++){const i=y*w+x,gx=-gray[i-w-1]+gray[i-w+1]-2*gray[i-1]+2*gray[i+1]-gray[i+w-1]+gray[i+w+1],gy=-gray[i-w-1]-2*gray[i-w]-gray[i-w+1]+gray[i+w-1]+2*gray[i+w]+gray[i+w+1];if(Math.hypot(gx,gy)/8>=strength/4)edges[i]=1;}
 for(let y=y0+1;y<y1-1;y++)for(let x=x0+1;x<x1-1;x++){const i=y*w+x;if(!edges[i])continue;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)dilated[i+dy*w+dx]=1;}
 for(let y=y0+2;y<y1-2;y++)for(let x=x0+2;x<x1-2;x++){let all=true;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(!dilated[(y+dy)*w+x+dx])all=false;if(all)closed[y*w+x]=1;}
 const mask=new Uint8Array(w*h);for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const i=y*w+x;mask[i]=!edges[i]&&!closed[i]&&data[i*4+3]>=128?1:0;}return mask;
}
