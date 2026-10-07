import * as R from 'replicad';
export function slideSurfaceGrip(lid,p,info,top,upper,hold,corners=null){
 if(p.surfaceGrip!==undefined&&typeof p.surfaceGrip!=='boolean')throw Error('滑り止めの設定を確認してください');
 if(!p.surfaceGrip)return {lid,surfaceGrip:null};
 if(p.grip)throw Error('滑り止めと爪掛け溝はどちらか一方を選択してください');
 const requestedDepth=p.surfaceGripDepth??.6,requestedOpening=p.surfaceGripOpening??0,requestedLength=p.surfaceGripLength??18,fromFront=p.surfaceGripFromFront??3,offsetY=p.surfaceGripOffsetY??0;
 if(!Number.isFinite(requestedDepth)||requestedDepth<.2||requestedDepth>1.2)throw Error('滑り止めの深さは0.2〜1.2 mmで指定してください');
 if(!Number.isFinite(requestedOpening)||requestedOpening!==0&&(requestedOpening<.4||requestedOpening>2.4))throw Error('溝の開口幅は0（自動）または0.4〜2.4 mmで指定してください');
 if(!Number.isFinite(requestedLength)||requestedLength<2||requestedLength>1000)throw Error('溝1本の長さは2〜1000 mmで指定してください');
 if(!Number.isFinite(fromFront)||fromFront<1.2||fromFront>1000||!Number.isFinite(offsetY)||Math.abs(offsetY)>1000)throw Error('手前からの距離は1.2〜1000 mm、横方向の位置は−1000〜1000 mmで指定してください');
 const depth=Math.min(requestedOpening?requestedOpening/2:requestedDepth,p.lidThickness-1.2);if(depth<.2-1e-6)throw Error('滑り止めを入れるには蓋厚1.4 mm以上が必要です。蓋を厚くするか滑り止めをオフにしてください');
 const {length:L,width:W}=info,front=top?top.capFront:-L/2+p.clearance,back=top?top.capBack:L/2-p.wall-p.clearance,zTop=top?top.capUpper:upper-p.clearance,maxWidth=top?W-6:W-2*p.wall-4,width=Math.min(requestedLength,maxWidth),opening=2*depth,pitch=Math.max(2.4,opening+1.2),count=Math.min(5,Math.floor((back-front-6-opening)/pitch)+1);
 if(count<1||width<2)throw Error('滑り止めを入れる余裕がありません。蓋を広げるか滑り止めをオフにしてください');
 const span=(count-1)*pitch+opening,maxFromFront=back-front-1.2-span,maxOffsetY=(maxWidth-width)/2;
 if(fromFront>maxFromFront+1e-6)throw Error('滑り止めが蓋の奥からはみ出します。手前からの距離を'+maxFromFront.toFixed(2)+' mm以下にしてください');
 if(Math.abs(offsetY)>maxOffsetY+1e-6)throw Error('滑り止めが蓋の横からはみ出します。横方向の位置を±'+maxOffsetY.toFixed(2)+' mm以内にするか、溝を短くしてください');
 const positions=Array.from({length:count},(_,i)=>front+fromFront+opening/2+i*pitch);
 if(corners){const r=corners.radius;for(const x of [front+fromFront,front+fromFront+span])for(const y of [offsetY-width/2,offsetY+width/2]){const dx=Math.max(0,Math.abs(x)-(L/2-r)),dy=Math.max(0,Math.abs(y)-(W/2-r));if(dx*dx+dy*dy>r*r+1e-6)throw Error('滑り止めが蓋の角丸に掛かります。内側へ移すか、溝を短くしてください');}}
 let plane;try{plane=new R.Plane([0,offsetY+width/2,0],[1,0,0],[0,-1,0]);const lip=opening/2*(1+.02/depth);for(const x of positions){const tool=hold(R.draw([x-lip,zTop+.02]).lineTo([x+lip,zTop+.02]).lineTo([x,zTop-depth]).close().sketchOnPlane(plane).extrude(width));lid=hold(lid.cut(tool));}return {lid,surfaceGrip:{type:'transverseV',requestedDepth,depth,requestedOpening,opening,requestedLength,width,fromFront,offsetY,maxFromFront,maxOffsetY,pitch,count,positions,zTop,remainingThickness:p.lidThickness-depth}};}finally{plane?.delete();}
}
