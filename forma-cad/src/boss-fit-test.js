import * as R from 'replicad';
import {fuseSolid} from './solid-fuse.js';
import {bossFitTestSettings} from './boss-fit.js';
const digits={'0':'abcdef','1':'bc','2':'abged','5':'afgcd'};
// Font-independent seven-segment numerals: every stroke is at least 0.8 mm.
function label(shape,text,x,y,z,hold){
 const width=2.8,height=5.6,t=.8,segments={a:[t,height-t,width-t,height],b:[width-t,height/2+t/2,width,height-t],c:[width-t,t,width,height/2-t/2],d:[t,0,width-t,t],e:[0,t,t,height/2-t/2],f:[0,height/2+t/2,t,height-t],g:[t,height/2-t/2,width-t,height/2+t/2]},bars=[];
 let at=x;
 for(const char of text){if(char==='.'){bars.push(hold(R.makeBox([at,y,z-.05],[at+.9,y+.9,z+.6])));at+=1.5;continue;}
  for(const key of digits[char]){const [a,b,c,d]=segments[key];bars.push(hold(R.makeBox([at+a,y+b,z-.05],[at+c,y+d,z+.6])));}at+=3.4;
 }
 const compound=hold(R.makeCompound(bars.map(bar=>bar.clone())).asShape3D());return hold(fuseSolid(shape,compound));
}
export function makeBossFitTest(p,onProgress){
 const s=bossFitTestSettings(p),owned=[],hold=shape=>(owned.push(shape),shape),parts=[],samples=[];
 try{
  for(const [i,clearance]of s.clearances.entries()){
   onProgress?.({stage:'はめ合いテスト '+clearance.toFixed(2)+' mm を作成しています',current:i+1,total:4});
   const x=i*(s.padWidth+s.gap),r=s.diameter/2,holeRadius=r+clearance,outerRadius=holeRadius+s.bossWall,center=[x+s.padWidth/2,8+outerRadius],text=clearance.toFixed(2),labelX=x+(s.padWidth-11.1)/2;
   const pad=hold(R.makeBox([x,0,0],[x+s.padWidth,s.padLength,s.baseThickness])),cylinder=hold(R.makeCylinder(outerRadius,s.bossHeight,[...center,s.baseThickness]));let boss=hold(fuseSolid(pad,cylinder));
   const hole=hold(R.makeCylinder(holeRadius,s.length+clearance+.01,[...center,s.baseThickness+s.bossHeight-s.length-clearance]));boss=hold(boss.cut(hole));boss=label(boss,text,labelX,1.2,s.baseThickness,hold);
   const row=s.padLength+s.gap,pinCenter=[center[0],center[1]+row],pinPad=hold(R.makeBox([x,row,0],[x+s.padWidth,row+s.padLength,s.baseThickness])),lead=Math.min(.4,r*.35,s.length*.2),stem=hold(R.makeCylinder(r,s.length-lead,[...pinCenter,s.baseThickness]));
   const bottom=new R.Plane([...pinCenter,s.baseThickness+s.length-lead],[1,0,0],[0,0,1]),top=new R.Plane([...pinCenter,s.baseThickness+s.length],[1,0,0],[0,0,1]),tip=hold(R.drawCircle(r).sketchOnPlane(bottom).loftWith(R.drawCircle(r-lead).sketchOnPlane(top),{ruled:true}));let pin=hold(fuseSolid(hold(fuseSolid(pinPad,stem)),tip));pin=label(pin,text,labelX,row+1.2,s.baseThickness,hold);
   for(const [role,shape]of [['boss',boss],['pin',pin]]){const check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false),solids=shape.solids;try{if(!check.IsValid()||solids.length!==1)throw Error('テストピースを一体のソリッドにできません');}finally{check.delete();solids.forEach(q=>q.delete());}parts.push({role,clearance,shape:shape.clone()});}
   samples.push({clearance,holeDiameter:holeRadius*2,diameter:s.diameter,bossCenter:center,pinCenter,rootZ:s.baseThickness+s.bossHeight,floor:s.bossHeight-s.length-clearance,label:text});
  }
  return {parts,analysis:{...s,samples,strokeWidth:.8,labelHeight:.6,count:8}};
 }catch(e){parts.forEach(p=>p.shape.delete());throw e;}finally{owned.reverse().forEach(shape=>shape.delete());}
}
