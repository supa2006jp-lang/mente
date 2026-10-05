import * as R from 'replicad';
const tuple=v=>{try{return v.toTuple();}finally{v.delete();}};
export function snapLidSides(face){
 const edges=face.edges;let lines;
 try{lines=edges.filter(e=>e.geomType==='LINE').map(e=>{const a=tuple(e.startPoint),b=tuple(e.endPoint),length=Math.hypot(b[0]-a[0],b[1]-a[1]);return {center:[(a[0]+b[0])/2,(a[1]+b[1])/2],length,tangent:[(b[0]-a[0])/length,(b[1]-a[1])/length]};});}finally{edges.forEach(e=>e.delete());}
 if(lines.length!==4||lines.some(e=>!(e.length>0)))throw Error('爪掛け溝は四角い箱の短い側面に作れます。円柱や別の輪郭ではオフにしてください');
 const dot=(a,b)=>a[0]*b[0]+a[1]*b[1];
 if(lines.some(a=>lines.filter(b=>Math.abs(dot(a.tangent,b.tangent))>.999999).length!==2)||lines.some(a=>lines.some(b=>{const d=Math.abs(dot(a.tangent,b.tangent));return d>1e-6&&d<.999999;})))throw Error('爪掛け溝は長方形の側面に作れます');

 const center=lines.reduce((sum,e)=>[sum[0]+e.center[0]/4,sum[1]+e.center[1]/4],[0,0]);
 return lines.map(e=>{let normal=[e.tangent[1],-e.tangent[0],0];if(dot(normal,[e.center[0]-center[0],e.center[1]-center[1]])<0)normal=normal.map(v=>-v);return {...e,normal};});
}
export function snapLidOpeningSettings(face,p,fillet,info){
 if(p.openingGroove!==undefined&&typeof p.openingGroove!=='boolean')throw Error('爪掛け溝の設定を確認してください');
 if(!p.openingGroove)return null;
 for(const key of ['openingWidth','openingHeight','openingDepth'])if(!Number.isFinite(p[key])||p[key]<=0||p[key]>1000)throw Error('爪掛け溝の幅・高さ・深さは0より大きい数値で指定してください');
 const allSides=snapLidSides(face),shortest=allSides.reduce((a,b)=>b.length<a.length-1e-6?b:a),pair=allSides.filter(e=>Math.abs(e.normal[0]*shortest.normal[0]+e.normal[1]*shortest.normal[1])>.999999);
 if(Math.abs(pair[0].length-pair[1].length)>1e-5)throw Error('爪掛け溝は向かい合う同じ幅の側面に作れます');
 const mode=p.openingMode??'both';if(!['both','single','selected'].includes(mode))throw Error('爪掛けを入れる面の指定を確認してください');
 let sides=pair;
 if(mode==='single'){const index=p.openingSide??0;if(![0,1].includes(index))throw Error('爪掛けを入れる片側を選択してください');sides=[pair[index]];}
 if(mode==='selected'){const f=p.openingFace;if(!f||!Array.isArray(f.point)||!Array.isArray(f.normal)||f.point.length!==3||f.normal.length!==3||[...f.point,...f.normal].some(v=>!Number.isFinite(v)))throw Error('蓋の外側の平らな側面をクリックしてください');const length=Math.hypot(...f.normal),selected=allSides.find(e=>length>.99&&Math.abs(f.normal[2])<1e-5&&(e.normal[0]*f.normal[0]+e.normal[1]*f.normal[1])/length>.99999&&Math.abs((f.point[0]-e.center[0])*e.normal[0]+(f.point[1]-e.center[1])*e.normal[1])<.05);if(!selected||f.point[2]<info.seam-1e-5||f.point[2]>info.upperMax+1e-5||Math.abs((f.point[0]-selected.center[0])*selected.normal[1]-(f.point[1]-selected.center[1])*selected.normal[0])>selected.length/2+.05)throw Error('蓋の外側の平らな側面をクリックしてください');sides=[selected];}
 const available=Math.min(...sides.map(e=>e.length));
 const margin=Math.max(1.2,fillet.outerRadius+1.2),width=Math.min(p.openingWidth,available-2*margin);
 // Keep a full two-line lip at the opening edge. The horizontal pulling ledge is the
 // pocket ceiling when assembled and its floor after flipping the lid for printing.
 const lip=1.2,maxHeight=info.lidHeight-p.floor-lip-1.2;
 const height=Math.min(p.openingHeight,maxHeight),depth=Math.min(p.openingDepth,p.lidWall-p.ridge-1.2,height-.6);
 if(width<3||height<.9||depth<.3)throw Error('爪掛け溝を収める余裕がありません。蓋壁厚・蓋高さや箱の幅を増やしてください');
 return {width,height,depth,lip,rampHeight:depth,pullingFace:'horizontal',remainingWall:p.lidWall-p.ridge-depth,count:sides.length,mode,sides:sides.map(({center,normal,length})=>({center,normal,length})),adjusted:width<p.openingWidth-1e-6||height<p.openingHeight-1e-6||depth<p.openingDepth-1e-6};
}
export function cutSnapLidOpenings(lid,seam,q){
 if(!q)return lid.clone();let result=lid.clone();
 try{for(const {center,normal}of q.sides){const tangent=[normal[1],-normal[0],0],origin=[center[0]-tangent[0]*q.width/2,center[1]-tangent[1]*q.width/2,seam];let plane,tool,next;
 try{plane=new R.Plane(origin,normal,tangent);tool=R.draw([0,q.lip]).lineTo([.3,q.lip]).lineTo([.3,q.lip+q.height]).lineTo([-q.depth,q.lip+q.height]).lineTo([-q.depth,q.lip+q.rampHeight]).close().sketchOnPlane(plane).extrude(q.width);next=result.cut(tool);result.delete();result=next;next=null;}finally{next?.delete();tool?.delete();plane?.delete();}}
 return result;
 }catch(error){result.delete();throw error;}
}
