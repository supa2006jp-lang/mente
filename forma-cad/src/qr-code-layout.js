import QRCode from 'qrcode/lib/core/qrcode.js';
import {validateFrame} from './frames.js';

export function qrCodeLayout(p){
 if(!Number.isFinite(p.size)||p.size<10||p.size>300)throw Error('QRコードの大きさは10〜300 mmで指定してください');
 if(typeof p.text!=='string'||!p.text.trim())throw Error('QRコードに入れる内容を入力してください');
 if(new TextEncoder().encode(p.text).length>512)throw Error('内容が長すぎます。短いIDやURLにしてください');
 let qr;try{qr=QRCode.create(p.text,{errorCorrectionLevel:'M'});}catch{throw Error('この内容でQRコードを作成できません。内容を短くしてください');}
 const count=qr.modules.size;if(count>57)throw Error('3D形状にするには内容が長すぎます。短いIDやURLにしてください');
 const quiet=4,pitch=p.size/(count+quiet*2),gap=Math.min(.01,pitch*.02),matrix=Array.from({length:count},(_,y)=>Array.from({length:count},(_,x)=>!!qr.modules.get(y,x))),runs=[];
 // Merge matching row spans. Tiny separations remove diagonal-only contacts
 // between raised islands, while every island overlaps the common base plate.
 let previous=new Map();for(let y=0;y<count;y++){const next=new Map();for(let x=0;x<count;){if(!matrix[y][x]){x++;continue;}const start=x;while(x<count&&matrix[y][x])x++;const key=start+':'+x,old=previous.get(key);if(old){old.rows++;next.set(key,old);}else{const run={start,end:x,row:y,rows:1};runs.push(run);next.set(key,run);}}previous=next;}
 const rectangles=runs.map(r=>({x:-p.size/2+(quiet+r.start)*pitch+gap/2,y:p.size/2-(quiet+r.row+r.rows)*pitch+gap/2,width:(r.end-r.start)*pitch-gap,height:r.rows*pitch-gap}));
 return {size:p.size,count,quiet,pitch,gap,matrix,rectangles,version:qr.version,maskPattern:qr.maskPattern,baseThickness:1,patternThickness:1};
}

export function validateQrPlacement(p){
 validateFrame(p.frame);if(!Array.isArray(p.point)||p.point.length!==3||p.point.some(v=>!Number.isFinite(v)||Math.abs(v)>10000))throw Error('グリッド上の配置位置が不正です');
 return p;
}
