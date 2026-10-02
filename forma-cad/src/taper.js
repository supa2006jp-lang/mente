export const taperLimit=80;
export function validateTaperAngle(angle=0){
 if(typeof angle!=='number'||!Number.isFinite(angle)||Math.abs(angle)>taperLimit)throw Error('テーパー角度は−80°〜80°で入力してください');
 return angle;
}
// Offset each profile corner along its two edge normals. The start cap stays fixed.
export function taperGeometry(geometry,shapes,depth,angle=0){
 validateTaperAngle(angle);if(!angle)return geometry;
 const corners=[];
 for(const shape of shapes){const paths=shape.extractPoints(64);for(const [index,path] of [paths.shape,...paths.holes].entries()){
  const ring=path.filter((p,i)=>!i||p.distanceTo(path[i-1])>1e-8);if(ring.length>1&&ring[0].distanceTo(ring.at(-1))<1e-8)ring.pop();
  const area=ring.reduce((sum,p,i)=>sum+p.x*ring[(i+1)%ring.length].y-p.y*ring[(i+1)%ring.length].x,0),sign=(area>0?1:-1)*(index? -1:1);
  for(let i=0;i<ring.length;i++){const p=ring[i],a=ring[(i+ring.length-1)%ring.length],b=ring[(i+1)%ring.length];
   const al=p.distanceTo(a),bl=b.distanceTo(p),ax=sign*(p.y-a.y)/al,ay=-sign*(p.x-a.x)/al,bx=sign*(b.y-p.y)/bl,by=-sign*(b.x-p.x)/bl,den=1+ax*bx+ay*by;
   if(den<1e-8)throw Error('この輪郭ではテーパーを作れません。鋭い角を調整してください');
   corners.push({x:p.x,y:p.y,dx:(ax+bx)/den,dy:(ay+by)/den});
  }
 }}
 const positions=geometry.attributes.position,slope=Math.tan(angle*Math.PI/180);
 for(let i=0;i<positions.count;i++){const z=depth<0?Math.abs(depth)-positions.getZ(i):positions.getZ(i);if(z<1e-8)continue;const x=positions.getX(i),y=positions.getY(i);let match,best=Infinity;for(const p of corners){const distance=(p.x-x)**2+(p.y-y)**2;if(distance<best){best=distance;match=p;}}
  if(!match||best>1e-5)throw Error('テーパーの輪郭を取得できません');const shift=z*slope;positions.setXY(i,x+match.dx*shift,y+match.dy*shift);
 }
 positions.needsUpdate=true;geometry.computeVertexNormals();return geometry;
}
