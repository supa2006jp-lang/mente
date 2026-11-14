import * as R from 'replicad';

const pocketClearance=.15;
const minimumWall=1.2;
export const slideClickMinimum=.1;

export function slideClickLimit(wall,depth){
 if(!Number.isFinite(wall)||!Number.isFinite(depth)||wall<=0||depth<=0)return null;
 return Math.max(0,Math.floor((wall-depth-pocketClearance-minimumWall+1e-9)*100)/100);
}

export function slideClickRamp(side,amount){
 return Math.max(1.4,side+amount,1.4+2*Math.max(0,amount-.4));
}

export function slideClickSettings(spec){
 if(spec.clickFit===undefined||spec.clickFit===false)return null;
 if(spec.clickFit!==true||spec.lidStyle==='top'||spec.lock)throw Error('カチッと固定は1枚板のスライド蓋で使えます');
 const amount=spec.clickFitAmount??.2;
 const limit=slideClickLimit(spec.wall,spec.railDepth);
 if(limit===null||limit<slideClickMinimum)throw Error('固定用のくぼみを作る壁厚が足りません。壁を厚くするか溝を浅くしてください');
 if(!Number.isFinite(amount)||amount<slideClickMinimum||amount>limit+1e-9)throw Error('現在の壁厚と溝深さでは、固定の掛かりは片側0.10〜'+limit.toFixed(2)+' mmです。');
 return amount;
}

export function applySlideClickFit(body,lid,{start,throat,back,halfWidth,depth,upper,fit,wall,endClearance,amount},hold){
 const clearance=pocketClearance,throatLength=1.2;
 const railEdge=halfWidth+depth,lidEdge=railEdge-fit.side;
 const shoulder=railEdge+amount;
 const rampLength=slideClickRamp(fit.side,amount);
 const pocketStart=throat+throatLength;
 const peakStart=pocketStart+rampLength+clearance;
 const peakEnd=peakStart+.8;
 const bumpEnd=peakEnd+rampLength;
 const pocketEnd=bumpEnd+endClearance+clearance;
 const grooveTipHeight=upper-fit.lower-2*depth;
 const height=Math.min(1.2,fit.tipHeight-.15,grooveTipHeight-.35);
 if(height<.8||bumpEnd+.2>back)throw Error('蓋の端に固定の掛かりを作る余裕がありません。蓋を厚くするか、箱を長くしてください');
 const mid=(fit.lower+upper)/2,z=mid-height/2;
 const recessTop=z+height+.1,recessBottom=z-.1;
 for(const sign of [-1,1]){
  const points=[[peakStart-rampLength,lidEdge-.15],[peakStart,shoulder],[peakEnd,shoulder],[bumpEnd,lidEdge-.15]];
  let drawing=R.draw([points[0][0],sign*points[0][1]]);
  for(const [x,y] of points.slice(1))drawing=drawing.lineTo([x,sign*y]);
  const bump=hold(drawing.close().sketchOnPlane('XY',z).extrude(height));
  lid=hold(lid.fuse(bump));
  for(const [a,b] of [[start-.1,throat],[pocketStart,pocketEnd]]){
   const inner=railEdge-.1,outer=shoulder+clearance;
   const cut=hold(R.makeBox([a,sign===1?inner:-outer,recessBottom],[b,sign===1?outer:-inner,recessTop]));
   body=hold(body.cut(cut));
  }
 }
 return {body,lid,analysis:{amount,position:(peakStart+peakEnd)/2,remainingWall:wall-depth-amount-clearance}};
}
