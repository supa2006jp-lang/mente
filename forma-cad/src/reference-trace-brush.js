import {validateTraceEdits} from './reference-trace-edit.js';

export function paintTraceMask(mask,width,height,from,to,radius,value){
 if(!(mask instanceof Uint8Array)||mask.length!==width*height||![width,height].every(n=>Number.isInteger(n)&&n>=2&&n<=1024)||![...from,...to,radius].every(Number.isFinite)||radius<1||radius>128||![0,1,2].includes(value))throw Error('ブラシの設定を確認してください');
 const xmin=Math.max(0,Math.floor(Math.min(from[0],to[0])-radius)),xmax=Math.min(width-1,Math.ceil(Math.max(from[0],to[0])+radius)),ymin=Math.max(0,Math.floor(Math.min(from[1],to[1])-radius)),ymax=Math.min(height-1,Math.ceil(Math.max(from[1],to[1])+radius)),dx=to[0]-from[0],dy=to[1]-from[1],length=dx*dx+dy*dy;let changed=0;
 for(let y=ymin;y<=ymax;y++)for(let x=xmin;x<=xmax;x++){const px=x+.5-from[0],py=y+.5-from[1],t=length?Math.max(0,Math.min(1,(px*dx+py*dy)/length)):0;if((px-t*dx)**2+(py-t*dy)**2>radius*radius)continue;const i=y*width+x;if(mask[i]!==value){mask[i]=value;changed++;}}
 return {changed,x:xmin,y:ymin,width:Math.max(0,xmax-xmin+1),height:Math.max(0,ymax-ymin+1)};
}

export function fillTraceMaskPolygon(mask,width,height,points,value){
 if(!(mask instanceof Uint8Array)||mask.length!==width*height||!Array.isArray(points)||points.length<3||points.length>256||![0,1,2].includes(value))throw Error('囲みは3〜256点で指定してください');
 let polygon=points.map(p=>Array.isArray(p)?[...p]:p);if(polygon.length>3&&Array.isArray(polygon[0])&&Array.isArray(polygon.at(-1))&&Math.hypot(polygon[0][0]-polygon.at(-1)[0],polygon[0][1]-polygon.at(-1)[1])<1e-5)polygon.pop();
 if(polygon.some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)))throw Error('囲みの座標が不正です');const signed=polygon.reduce((v,p,i)=>{const q=polygon[(i+1)%polygon.length];return v+p[0]*q[1]-p[1]*q[0];},0);if(signed<0)polygon.reverse();
 try{validateTraceEdits([{points:polygon,hole:false}],width,height);}catch(error){throw Error(error.message.replaceAll('輪郭','囲み'));}
 const xmin=Math.max(0,Math.floor(Math.min(...polygon.map(p=>p[0])))),xmax=Math.min(width-1,Math.ceil(Math.max(...polygon.map(p=>p[0])))),ymin=Math.max(0,Math.floor(Math.min(...polygon.map(p=>p[1])))),ymax=Math.min(height-1,Math.ceil(Math.max(...polygon.map(p=>p[1]))));let changed=0;
 for(let y=ymin;y<=ymax;y++){const py=y+.5,xs=[];for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length];if((a[1]>py)!==(b[1]>py))xs.push(a[0]+(py-a[1])*(b[0]-a[0])/(b[1]-a[1]));}xs.sort((a,b)=>a-b);for(let i=0;i+1<xs.length;i+=2)for(let x=Math.max(xmin,Math.ceil(xs[i]-.5));x<=Math.min(xmax,Math.floor(xs[i+1]-.5));x++){const j=y*width+x;if(mask[j]!==value){mask[j]=value;changed++;}}}
 return {changed,x:xmin,y:ymin,width:Math.max(0,xmax-xmin+1),height:Math.max(0,ymax-ymin+1)};
}
