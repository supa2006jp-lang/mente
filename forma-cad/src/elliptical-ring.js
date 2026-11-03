// Recover a complete, uniformly sampled ellipse, as circularRing does for
// circles. Strict point/turn tests exclude clipped arcs and edited outlines.
export function ellipticalRing(points){
 const ps=points.length>2&&Math.hypot(points[0][0]-points.at(-1)[0],points[0][1]-points.at(-1)[1])<1e-7?points.slice(0,-1):points;
 if(ps.length<64)return null;const center=[0,1].map(k=>ps.reduce((s,p)=>s+p[k],0)/ps.length);let xx=0,yy=0,xy=0;
 for(const p of ps){const x=p[0]-center[0],y=p[1]-center[1];xx+=x*x/ps.length;yy+=y*y/ps.length;xy+=x*y/ps.length;}
 const delta=Math.hypot(xx-yy,2*xy),major=Math.sqrt(xx+yy+delta),minor=Math.sqrt(xx+yy-delta),angle=.5*Math.atan2(2*xy,xx-yy),c=Math.cos(angle),s=Math.sin(angle);
 if(!Number.isFinite(major)||!Number.isFinite(minor)||minor<.01||major>25000||major/minor>100)return null;
 const unit=ps.map(p=>{const x=p[0]-center[0],y=p[1]-center[1];return [(x*c+y*s)/major,(-x*s+y*c)/minor];});if(unit.some(p=>Math.abs(Math.hypot(...p)-1)*major>1e-5))return null;
 let turn=0,sign=0;const expected=2*Math.PI/ps.length;
 for(let i=0;i<unit.length;i++){const a=unit[i],b=unit[(i+1)%unit.length],step=Math.atan2(a[0]*b[1]-a[1]*b[0],a[0]*b[0]+a[1]*b[1]);if(Math.abs(Math.abs(step)-expected)>1e-5||sign&&Math.sign(step)!==sign)return null;sign=Math.sign(step);turn+=step;}
 return Math.abs(Math.abs(turn)-2*Math.PI)<1e-6?{center,major,minor,angle,sign}:null;
}
