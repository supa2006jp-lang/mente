import * as R from 'replicad';
const tuple=v=>{try{return v.toTuple();}finally{v.delete();}};
export function snapLidOpeningSettings(face,p,fillet){
 if(p.openingGroove!==undefined&&typeof p.openingGroove!=='boolean')throw Error('爪掛け溝の設定を確認してください');
 if(!p.openingGroove)return null;
 for(const key of ['openingWidth','openingHeight','openingDepth'])if(!Number.isFinite(p[key])||p[key]<=0||p[key]>1000)throw Error('爪掛け溝の幅・高さ・深さは0より大きい数値で指定してください');
 const edges=face.edges;let lines;
 try{lines=edges.filter(e=>e.geomType==='LINE').map(e=>{const a=tuple(e.startPoint),b=tuple(e.endPoint),length=Math.hypot(b[0]-a[0],b[1]-a[1]);return {center:[(a[0]+b[0])/2,(a[1]+b[1])/2],length,tangent:[(b[0]-a[0])/length,(b[1]-a[1])/length]};});}finally{edges.forEach(e=>e.delete());}
 if(lines.length!==4||lines.some(e=>!(e.length>0)))throw Error('爪掛け溝は四角い箱の短い側面に作れます。円柱や別の輪郭ではオフにしてください');
 const dot=(a,b)=>a[0]*b[0]+a[1]*b[1];
 if(lines.some(a=>lines.filter(b=>Math.abs(dot(a.tangent,b.tangent))>.999999).length!==2)||lines.some(a=>lines.some(b=>{const d=Math.abs(dot(a.tangent,b.tangent));return d>1e-6&&d<.999999;})))throw Error('爪掛け溝は長方形の側面に作れます');
 // The shorter boundary edges belong to the narrower end faces. A square uses one opposite pair.
 const shortest=lines.reduce((a,b)=>b.length<a.length-1e-6?b:a),pair=lines.filter(e=>Math.abs(dot(e.tangent,shortest.tangent))>.999999);
 if(Math.abs(pair[0].length-pair[1].length)>1e-5)throw Error('爪掛け溝は向かい合う同じ幅の側面に作れます');
 const margin=Math.max(1.2,fillet.outerRadius+1.2),width=Math.min(p.openingWidth,shortest.length-2*margin);
 const maxHeight=p.insertion/2-(p.ridge+.15+p.clearance)-.15;
 const height=Math.min(p.openingHeight,maxHeight),depth=Math.min(p.openingDepth,p.lidWall-1.2,height);
 if(width<3||height<.6||depth<.3)throw Error('爪掛け溝を収める余裕がありません。蓋壁厚・差し込み高さや箱の幅を増やしてください');
 const center=pair.map(e=>e.center).reduce((a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2]);
 const sides=pair.map(e=>{let normal=[e.tangent[1],-e.tangent[0],0];if(dot(normal,[e.center[0]-center[0],e.center[1]-center[1]])<0)normal=normal.map(v=>-v);return {center:e.center,normal};});
 return {width,height,depth,remainingWall:p.lidWall-depth,count:2,sides,adjusted:width<p.openingWidth-1e-6||height<p.openingHeight-1e-6||depth<p.openingDepth-1e-6};
}
export function cutSnapLidOpenings(lid,seam,q){
 if(!q)return lid.clone();let result=lid.clone();
 try{for(const {center,normal}of q.sides){const tangent=[normal[1],-normal[0],0],origin=[center[0]-tangent[0]*q.width/2,center[1]-tangent[1]*q.width/2,seam];let plane,tool,next;
 try{plane=new R.Plane(origin,normal,tangent);tool=R.draw([-q.depth,-.05]).lineTo([.3,-.05]).lineTo([.3,q.height]).lineTo([0,q.height]).lineTo([-q.depth,0]).close().sketchOnPlane(plane).extrude(q.width);next=result.cut(tool);result.delete();result=next;next=null;}finally{next?.delete();tool?.delete();plane?.delete();}}
 return result;
 }catch(error){result.delete();throw error;}
}
