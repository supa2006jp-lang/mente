import {validateFrame} from './frames.js';
export function validateReferenceImage(f){
 validateFrame(f.frame);if(typeof f.data!=='string'||f.data.length>12000000||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(f.data))throw Error('下絵の画像データが不正です');
 if(![f.width,f.height,f.offset,f.angle,f.opacity,...(f.center||[])].every(Number.isFinite)||f.center?.length!==2||f.width<.01||f.height<.01||f.width>10000||f.height>10000||Math.abs(f.offset)>10000||f.center.some(n=>Math.abs(n)>10000)||Math.abs(f.angle)>36000||f.opacity<0||f.opacity>1)throw Error('下絵の位置・大きさが不正です');return f;
}
export function calibrateReference(f,a,b,distance){
 const measured=Math.hypot((b[0]-a[0])*f.width,(b[1]-a[1])*f.height);if(!Number.isFinite(distance)||distance<=0||measured<1e-6)throw Error('離れた2点と、0より大きい寸法を指定してください');
 const ratio=distance/measured,w=f.width*ratio,h=f.height*ratio,r=f.angle*Math.PI/180,dx=(a[0]-.5)*(f.width-w),dy=(a[1]-.5)*(f.height-h);
 return validateReferenceImage({...f,width:w,height:h,center:[f.center[0]+dx*Math.cos(r)-dy*Math.sin(r),f.center[1]+dx*Math.sin(r)+dy*Math.cos(r)]});
}
