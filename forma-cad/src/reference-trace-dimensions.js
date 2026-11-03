import {traceShapeGeometry} from './reference-trace-shapes.js';
import {validateTraceEdits} from './reference-trace-edit.js';

// Stable across detection reruns, independent of simplified/edited vertices.
export function traceContourKey(ring){let a=2166136261,b=5381;const text=JSON.stringify([ring.hole,ring.points]);for(let i=0;i<text.length;i++){a=Math.imul(a^text.charCodeAt(i),16777619);b=Math.imul(b,33)^text.charCodeAt(i);}return (a>>>0).toString(16)+'-'+(b>>>0).toString(16);}
export function validateTraceTopology(rings){
 const ps=rings.flatMap(r=>r.points);if(!ps.length)throw Error('輪郭がありません');
 const lo=[0,1].map(k=>Math.min(...ps.map(p=>p[k]))),hi=[0,1].map(k=>Math.max(...ps.map(p=>p[k]))),ratio=Math.min(1,1020/Math.max(hi[0]-lo[0],hi[1]-lo[1],1));
 return validateTraceEdits(rings.map(r=>({hole:r.hole,points:r.points.map(p=>p.map((v,k)=>(v-lo[k])*ratio+1))})),1024,1024);
}
export function dimensionTraceRing(ring,values,scale=[1,1]){
 if(!ring.dimensions)throw Error('規則的な形に整理した輪郭を選んでください');
 const spec={...ring.dimensions,...values,center:[...ring.dimensions.center]},types=['circle','ellipse','rectangle','roundedRectangle','slot','dShape'];
 if(!types.includes(spec.type)||!scale.every(n=>Number.isFinite(n)&&n>0)||![spec.width,spec.height].every(n=>Number.isFinite(n)&&n>=.1&&n<=10000))throw Error('寸法は0.1〜10,000 mmで指定してください');
 if(spec.type==='circle')spec.height=spec.width;
 if(spec.type==='slot'){if(spec.width<spec.height)throw Error('長穴の幅は高さ以上にしてください');spec.radius=spec.height/2;}
 if(spec.type==='dShape'){if(spec.width<=spec.height/2)throw Error('片側半円の幅は高さの半分より大きくしてください');spec.radius=spec.height/2;}
 if(spec.type==='roundedRectangle'&&(!Number.isFinite(spec.radius)||spec.radius<.05||spec.radius>Math.min(spec.width,spec.height)/2))throw Error('角丸半径は0.05 mm以上、幅・高さの半分以下にしてください');
 let points,pieces,circle;
 if(['circle','ellipse'].includes(spec.type)){
  const radius=Math.max(spec.width,spec.height)/2,count=Math.max(128,Math.ceil(Math.PI*2*Math.sqrt(radius/.016)));if(count>1800)throw Error('曲線が細かすぎます。寸法を小さくしてください');
  const c=Math.cos(spec.angle),s=Math.sin(spec.angle);points=Array.from({length:count},(_,i)=>{const a=i*Math.PI*2/count,x=spec.width/2*Math.cos(a),y=spec.height/2*Math.sin(a);return [spec.center[0]+x*c-y*s,spec.center[1]+x*s+y*c];});
  if(spec.type==='circle')circle={center:spec.center.map((n,k)=>n/scale[k]),radius:spec.width/2};
 }else ({points,pieces}=traceShapeGeometry(spec));
 if(ring.hole){points=[...points].reverse();if(pieces)pieces=[...pieces].reverse().map(p=>({...p,points:[...p.points].reverse(),startTangent:p.endTangent?.map(n=>-n),endTangent:p.startTangent?.map(n=>-n)}));}
 const result={hole:ring.hole,regularType:spec.type,dimensions:spec,points:points.map(p=>p.map((v,k)=>v/scale[k])),...(circle?{circle}:{}),...(pieces?{pieces:pieces.map(p=>({...p,points:p.points.map(q=>q.map((v,k)=>v/scale[k]))}))}:{})};
 validateTraceTopology([ {...result,hole:false,points:ring.hole?[...result.points].reverse():result.points} ]);return result;
}
