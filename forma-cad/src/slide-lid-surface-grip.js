import * as R from 'replicad';
export function slideSurfaceGrip(lid,p,info,top,upper,hold){
 if(p.surfaceGrip!==undefined&&typeof p.surfaceGrip!=='boolean')throw Error('滑り止めの設定を確認してください');
 if(!p.surfaceGrip)return {lid,surfaceGrip:null};
 if(p.grip)throw Error('滑り止めと爪掛け溝はどちらか一方を選択してください');
 const requestedDepth=p.surfaceGripDepth??.6;if(!Number.isFinite(requestedDepth)||requestedDepth<.2||requestedDepth>1.2)throw Error('滑り止めの深さは0.2〜1.2 mmで指定してください');
 const depth=Math.min(requestedDepth,p.lidThickness-1.2);if(depth<.2-1e-6)throw Error('滑り止めを入れるには蓋厚1.4 mm以上が必要です。蓋を厚くするか滑り止めをオフにしてください');
 const {length:L,width:W}=info,front=top?top.capFront:-L/2+p.clearance,back=top?top.capBack:L/2-p.wall-p.clearance,zTop=top?top.capUpper:upper-p.clearance,width=Math.min(18,top?W-6:W-2*p.wall-4),pitch=Math.max(2.4,2*depth+1.2),count=Math.min(5,Math.floor((back-front-6-2*depth)/pitch)+1);
 if(count<1||width<2)throw Error('滑り止めを入れる余裕がありません。蓋を広げるか滑り止めをオフにしてください');
 const positions=Array.from({length:count},(_,i)=>front+3+depth+i*pitch);let plane;
 try{plane=new R.Plane([0,width/2,0],[1,0,0],[0,-1,0]);for(const x of positions){const tool=hold(R.draw([x-depth-.02,zTop+.02]).lineTo([x+depth+.02,zTop+.02]).lineTo([x,zTop-depth]).close().sketchOnPlane(plane).extrude(width));lid=hold(lid.cut(tool));}return {lid,surfaceGrip:{type:'transverseV',requestedDepth,depth,width,pitch,count,positions,zTop,remainingThickness:p.lidThickness-depth}};}finally{plane?.delete();}
}
