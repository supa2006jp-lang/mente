// Position the two dimension fields together, outside the drawing and cursor.
export function dimensionPositions(points,sizes,width,height){
 const gap=12,pad=10,w=Math.max(...sizes.map(s=>s.width)),h=sizes.reduce((n,s)=>n+s.height,0)+gap;
 const xs=points.map(p=>p.x),ys=points.map(p=>p.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),cx=(minX+maxX)/2,cy=(minY+maxY)/2;
 const candidates=[[maxX+40,cy-h/2],[minX-w-40,cy-h/2],[cx-w/2,minY-h-40],[cx-w/2,maxY+40],[maxX+40,minY-h],[minX-w-40,minY-h],[maxX+40,maxY],[minX-w-40,maxY]];
 function crosses(a,b,r){let lo=0,hi=1;for(const [p,q] of [[a.x-b.x,a.x-r.x],[b.x-a.x,r.x+r.w-a.x],[a.y-b.y,a.y-r.y],[b.y-a.y,r.y+r.h-a.y]]){if(Math.abs(p)<1e-9){if(q<0)return false;}else if(p<0)lo=Math.max(lo,q/p);else hi=Math.min(hi,q/p);}return lo<=hi;}
 let best=null;for(const [px,py] of candidates){const x=Math.max(pad,Math.min(width-w-pad,px)),y=Math.max(pad,Math.min(height-h-pad,py)),r={x:x-16,y:y-16,w:w+32,h:h+32};let score=Math.hypot(x-px,y-py);for(let i=1;i<points.length;i++)if(crosses(points[i-1],points[i],r))score+=100000;for(const p of points)if(p.x>=r.x-20&&p.x<=r.x+r.w+20&&p.y>=r.y-20&&p.y<=r.y+r.h+20)score+=100000;if(!best||score<best.score)best={x,y,score};}
 return sizes.map((s,i)=>[best.x+w/2,best.y+sizes.slice(0,i).reduce((n,a)=>n+a.height+gap,0)+s.height/2]);
}
