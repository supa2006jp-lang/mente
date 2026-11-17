import {basisFor} from './frames.js';
import {circularRing} from './circular-ring.js';

const number=value=>String(Number(value.toFixed(3)));
export function offsetExtrusionSize(source,shifted,distance){
 const circle=circularRing(source.outer,{nonUniform:true});
 if(circle){const diameter=2*(circle.radius+distance);return {diameter,text:'⌀'+number(diameter)+' mm'};}
 const u=shifted.outer.map(p=>p[0]),v=shifted.outer.map(p=>p[1]),width=Math.max(...u)-Math.min(...u),depth=Math.max(...v)-Math.min(...v);
 return {width,depth,text:number(width)+' × '+number(depth)+' mm'};
}

// A contour may be clockwise or counterclockwise and may live on any plane.
// Use its own winding to make outward drags increase the material offset.
export function offsetDragNormal(guide,segment){
 const points=guide.points,a=points[segment],b=points[(segment+1)%points.length],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
 if(length<1e-9)return null;
 const area=points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p[0]*q[1]-q[0]*p[1];},0),sign=(area>=0?1:-1)*(guide.hole?-1:1),basis=basisFor(guide.region);
 return basis.u.multiplyScalar(sign*dy/length).addScaledVector(basis.v,-sign*dx/length);
}

export function offsetDragValue(value,delta,fine=false){return Math.max(-10000,Math.min(10000,value+delta*(fine?.1:1)));}
