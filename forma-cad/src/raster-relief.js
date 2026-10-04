export const rasterQualities={draft:{columns:64,rows:24,name:'軽量'},standard:{columns:96,rows:96,name:'標準'},fine:{columns:192,rows:192,name:'細かい'}};
export function validateRaster(raster){
 if(!raster||raster.version!==1||!Number.isInteger(raster.width)||!Number.isInteger(raster.height)||raster.width<2||raster.height<2||raster.width>512||raster.height>512||!Array.isArray(raster.values)||raster.values.length!==raster.width*raster.height||raster.values.some(v=>!Number.isInteger(v)||v<0||v>255)||raster.alpha!==undefined&&(!Array.isArray(raster.alpha)||raster.alpha.length!==raster.values.length||raster.alpha.some(v=>!Number.isInteger(v)||v<0||v>255)))throw Error('画像の明暗データが不正です');
 return raster;
}
export function rgbaRaster(width,height,rgba){
 if(!Number.isInteger(width)||!Number.isInteger(height)||rgba.length!==width*height*4)throw Error('画像を読み込めませんでした');
 const values=[],alpha=[];for(let i=0;i<rgba.length;i+=4){values.push(Math.round(.2126*rgba[i]+.7152*rgba[i+1]+.0722*rgba[i+2]));alpha.push(rgba[i+3]);}
 return validateRaster({version:1,width,height,values,...(alpha.some(a=>a!==255)?{alpha}:{})});
}
export function rasterRelief(raster,settings={}){
 validateRaster(raster);const p={version:1,invert:false,contrast:1,smoothing:1,quality:'standard',...settings};
 if(p.version!==1||typeof p.invert!=='boolean'||!Number.isFinite(p.contrast)||p.contrast<.1||p.contrast>3||!Number.isInteger(p.smoothing)||p.smoothing<0||p.smoothing>4||!Object.hasOwn(rasterQualities,p.quality))throw Error('画像の凹凸設定を確認してください');
 const {width:w,height:h}=raster,clamp=v=>Math.max(0,Math.min(1,v));let values=raster.values.map((v,i)=>clamp(((p.invert?1-v/255:v/255)-.5)*p.contrast+.5));
 // A bounded separable blur avoids sharp pixel ridges, while preserving alpha holes.
 for(let pass=0;pass<p.smoothing;pass++){const next=values.map((v,i)=>{const x=i%w,y=Math.floor(i/w),at=(a,b)=>values[Math.max(0,Math.min(h-1,b))*w+Math.max(0,Math.min(w-1,a))];return (at(x-1,y)+2*v+at(x+1,y)+at(x,y-1)+at(x,y+1))/6;});values=next;}
 values=values.map((v,i)=>v*(raster.alpha?.[i]??255)/255);
 const at=(x,y,wrap)=>values[Math.max(0,Math.min(h-1,y))*w+(wrap?((x%w)+w)%w:Math.max(0,Math.min(w-1,x)))];
 function sample(u,v,seam='single',count=1,fraction=1){let t=((u%1)+1)%1,wrap=true;if(seam==='fit'){if(!Number.isFinite(fraction)||fraction<=0||fraction>=1)throw Error('模様1個の幅を確認してください');if(t>fraction)return 0;t/=fraction;wrap=false;}if(seam==='repeat')t=(t*count)%1;if(seam==='mirror'){t=t*2;t=t<=1?t:2-t;wrap=false;}const x=t*w-.5,y=(1-Math.max(0,Math.min(1,v)))*(h-1),a=Math.floor(x),b=Math.floor(y),fx=x-a,fy=y-b;return clamp((1-fy)*((1-fx)*at(a,b,wrap)+fx*at(a+1,b,wrap))+fy*((1-fx)*at(a,b+1,wrap)+fx*at(a+1,b+1,wrap)));}
 return {sample,settings:p,values,width:w,height:h,...rasterQualities[p.quality]};
}
export async function readRasterFile(file){
 if(!file||file.size>10000000)throw Error('画像は10MB以下のPNGまたはJPEGを選択してください');
 const head=new Uint8Array(await file.slice(0,12).arrayBuffer()),png=[137,80,78,71,13,10,26,10].every((v,i)=>head[i]===v),jpeg=head[0]===255&&head[1]===216&&head[2]===255;if(!png&&!jpeg)throw Error('PNGまたはJPEGの画像を選択してください');
 let bitmap;try{bitmap=await createImageBitmap(file);if(bitmap.width*bitmap.height>50000000)throw Error('画像が大きすぎます。5000万画素以内に縮小してください');const scale=Math.min(1,512/Math.max(bitmap.width,bitmap.height)),w=Math.max(2,Math.round(bitmap.width*scale)),h=Math.max(2,Math.round(bitmap.height*scale)),canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw Error('画像を読み込めませんでした');ctx.drawImage(bitmap,0,0,w,h);const raster=rgbaRaster(w,h,ctx.getImageData(0,0,w,h).data);return {raster,aspect:bitmap.height/bitmap.width};}catch(error){if(/[\u3040-\u9fff]/.test(error.message||''))throw error;throw Error('画像を読み込めませんでした。PNGまたはJPEGを選択してください');}finally{bitmap?.close();}
}

export function rasterImageDefaults(raster){
 validateRaster(raster);let border=0,whiteBorder=0,dark=0,bright=0,opaque=0;for(let y=0;y<raster.height;y++)for(let x=0;x<raster.width;x++){const i=y*raster.width+x;if((raster.alpha?.[i]??255)<200)continue;opaque++;if(raster.values[i]<100)dark++;if(raster.values[i]>240)bright++;if(x===0||y===0||x===raster.width-1||y===raster.height-1){border++;if(raster.values[i]>240)whiteBorder++;}}
 const illustration=border>0&&whiteBorder/border>.9&&bright/opaque>.2&&dark/opaque>.01;
 return {invert:illustration,contrast:illustration?1.5:1,smoothing:illustration?0:1,quality:'standard'};
}
export function rasterResolution(raster,settings,seam='single',repeatCount=1){
 const quality=rasterRelief(raster,settings),count=seam==='repeat'?repeatCount:seam==='mirror'?2:1;
 if(!Number.isInteger(count)||count<1||count>12)throw Error('画像の繰り返しは1〜12回にしてください');
 // Keep samples per image instead of dividing one fixed grid among all repeats.
 const perTile=Math.max(12,Math.min(quality.columns,raster.width));
 return {segments:perTile*count,rows:Math.min(quality.rows,Math.max(12,raster.height-1))};
}
