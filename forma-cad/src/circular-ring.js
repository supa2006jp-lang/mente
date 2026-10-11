// Recover complete sampled circles, never partial arcs or intersected outlines.
export function circularRing(points){
 const ring=points.length>2&&Math.hypot(points[0][0]-points.at(-1)[0],points[0][1]-points.at(-1)[1])<1e-7?points.slice(0,-1):points;
 if(ring.length<32)return null;
 const center=ring.reduce((s,p)=>[s[0]+p[0]/ring.length,s[1]+p[1]/ring.length],[0,0]);
 const radius=Math.hypot(ring[0][0]-center[0],ring[0][1]-center[1]);
 if(radius<.001||!ring.every(p=>Math.abs(Math.hypot(p[0]-center[0],p[1]-center[1])-radius)<1e-4))return null;
 let turn=0,sign=0;
 for(let i=0;i<ring.length;i++){
  const a=ring[i],b=ring[(i+1)%ring.length],ax=a[0]-center[0],ay=a[1]-center[1],bx=b[0]-center[0],by=b[1]-center[1];
  const angle=Math.atan2(ax*by-ay*bx,ax*bx+ay*by);
  if(Math.abs(angle)<1e-8||Math.abs(angle)>Math.PI/8||sign&&Math.sign(angle)!==sign)return null;
  sign=Math.sign(angle);turn+=angle;
 }
 return Math.abs(Math.abs(turn)-Math.PI*2)<1e-6?{center,radius,sign}:null;
}
