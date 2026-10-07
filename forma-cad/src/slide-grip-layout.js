// Shared dimensions for the solid cuts and the on-screen position handle.
export function gripInsideCorners(q,fromFront,offsetY){
 if(!q.cornerRadius)return true;
 const r=q.cornerRadius;
 for(const x of [q.front+fromFront,q.front+fromFront+q.span])for(const y of [offsetY-q.width/2,offsetY+q.width/2]){
  const dx=Math.max(0,Math.abs(x)-(q.length/2-r)),dy=Math.max(0,Math.abs(y)-(q.lidWidth/2-r));
  if(dx*dx+dy*dy>r*r+1e-6)return false;
 }
 return true;
}
export function slideGripLayout(p,info,top,upper,corners=null){
 const requestedDepth=p.surfaceGripDepth??.6,requestedOpening=p.surfaceGripOpening??0,requestedLength=p.surfaceGripLength??18,fromFront=p.surfaceGripFromFront??3,offsetY=p.surfaceGripOffsetY??0,requestedCount=p.surfaceGripCount??5,requestedPitch=p.surfaceGripPitch??0;
 if(!Number.isFinite(requestedDepth)||requestedDepth<.2||requestedDepth>1.2)throw Error('滑り止めの深さは0.2〜1.2 mmで指定してください');
 if(!Number.isFinite(requestedOpening)||requestedOpening!==0&&(requestedOpening<.4||requestedOpening>2.4))throw Error('溝の開口幅は0（自動）または0.4〜2.4 mmで指定してください');
 if(!Number.isFinite(requestedLength)||requestedLength<2||requestedLength>1000)throw Error('溝1本の長さは2〜1000 mmで指定してください');
 if(!Number.isFinite(fromFront)||fromFront<1.2||fromFront>1000||!Number.isFinite(offsetY)||Math.abs(offsetY)>1000)throw Error('手前からの距離は1.2〜1000 mm、横方向の位置は−1000〜1000 mmで指定してください');
 if(!Number.isInteger(requestedCount)||requestedCount<1||requestedCount>30)throw Error('溝の本数は1〜30本の整数で指定してください');
 if(!Number.isFinite(requestedPitch)||requestedPitch<0||requestedPitch>1000)throw Error('溝の中心間隔は0（自動）〜1000 mmで指定してください');
 const depth=Math.min(requestedOpening?requestedOpening/2:requestedDepth,p.lidThickness-1.2);
 if(depth<.2-1e-6)throw Error('滑り止めを入れるには蓋厚1.4 mm以上が必要です。蓋を厚くするか滑り止めをオフにしてください');
 const {length:L,width:W}=info,front=top?top.capFront:-L/2+p.clearance,back=top?top.capBack:L/2-p.wall-p.clearance,zTop=top?top.capUpper:upper-p.clearance,maxWidth=top?W-6:W-2*p.wall-4,width=Math.min(requestedLength,maxWidth),opening=2*depth,minPitch=opening+1.2,pitch=requestedPitch||Math.max(2.4,minPitch);
 if(requestedCount>1&&pitch<minPitch-1e-6)throw Error('溝どうしの間に1.2 mm残すため、中心間隔を'+minPitch.toFixed(2)+' mm以上にしてください');
 const count=Math.min(requestedCount,Math.floor((back-front-6-opening)/pitch)+1);
 if(count<1||width<2)throw Error('滑り止めを入れる余裕がありません。蓋を広げるか滑り止めをオフにしてください');
 const span=(count-1)*pitch+opening,maxFromFront=back-front-1.2-span,maxOffsetY=(maxWidth-width)/2;
 if(fromFront>maxFromFront+1e-6)throw Error('滑り止めが蓋の奥からはみ出します。手前からの距離を'+maxFromFront.toFixed(2)+' mm以下にしてください');
 if(Math.abs(offsetY)>maxOffsetY+1e-6)throw Error('滑り止めが蓋の横からはみ出します。横方向の位置を±'+maxOffsetY.toFixed(2)+' mm以内にするか、溝を短くしてください');
 const q={type:'transverseV',requestedDepth,depth,requestedOpening,opening,requestedLength,width,fromFront,offsetY,maxFromFront,maxOffsetY,requestedCount,requestedPitch,minPitch,pitch,count,positions:Array.from({length:count},(_,i)=>front+fromFront+opening/2+i*pitch),zTop,remainingThickness:p.lidThickness-depth,front,back,span,length:L,lidWidth:W,cornerRadius:corners?.radius??0};
 if(!gripInsideCorners(q,fromFront,offsetY))throw Error('滑り止めが蓋の角丸に掛かります。内側へ移すか、溝を短くしてください');
 return q;
}
export function clampGripPosition(q,fromFront,offsetY,start={fromFront:q.fromFront,offsetY:q.offsetY}){
 const round=v=>Number(v.toFixed(2)),maxX=Math.floor(q.maxFromFront*100)/100,maxY=Math.floor(q.maxOffsetY*100)/100;
 const goal={fromFront:Math.max(1.2,Math.min(maxX,round(fromFront))),offsetY:Math.max(-maxY,Math.min(maxY,round(offsetY)))};
 if(gripInsideCorners(q,goal.fromFront,goal.offsetY))return goal;
 let lo=0,hi=1,result=start;
 for(let i=0;i<32;i++){const t=(lo+hi)/2,p={fromFront:round(start.fromFront+(goal.fromFront-start.fromFront)*t),offsetY:round(start.offsetY+(goal.offsetY-start.offsetY)*t)};if(gripInsideCorners(q,p.fromFront,p.offsetY)){lo=t;result=p;}else hi=t;}
 return result;
}
