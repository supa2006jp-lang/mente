import Clipper from 'clipper-lib';
import {validateTraceEdits} from './reference-trace-edit.js';
export function offsetTraceRings(rings,distance,scale=[1,1],size=[1024,1024]){
 if(!Number.isFinite(distance)||Math.abs(distance)<.001||Math.abs(distance)>100||!scale.every(n=>Number.isFinite(n)&&n>0))throw Error('オフセット距離は±0.001〜100 mmで指定してください');validateTraceEdits(rings,...size);
 if(rings.length===1&&rings[0].circle){const source=rings[0],radius=source.circle.radius+distance*(source.hole?-1:1);if(radius<.05)throw Error('オフセットすると輪郭が消えます。距離を小さくしてください');const center=source.circle.center,count=Math.max(128,Math.ceil(Math.PI*2*Math.sqrt(radius/.04)));if(count>1800)throw Error('オフセット線が細かすぎます。輪郭や距離を調整してください');const points=Array.from({length:count},(_,i)=>{const a=i*Math.PI*2/count*(source.hole?-1:1);return [center[0]+radius*Math.cos(a)/scale[0],center[1]+radius*Math.sin(a)/scale[1]];});return [{hole:source.hole,points,circle:{center:[...center],radius}}];}
 const factor=100000,paths=rings.map(r=>{const path=r.points.map(p=>({X:Math.round(p[0]*scale[0]*factor),Y:Math.round(p[1]*scale[1]*factor)}));if(Clipper.Clipper.Orientation(path)===r.hole)path.reverse();return path;}),offset=new Clipper.ClipperOffset(4,.005*factor),out=[];offset.AddPaths(paths,Clipper.JoinType.jtMiter,Clipper.EndType.etClosedPolygon);offset.Execute(out,distance*factor);if(!out.length)throw Error('オフセットすると輪郭が消えます。距離を小さくしてください');const result=out.map(p=>({hole:Clipper.Clipper.Area(p)<0,points:p.map(({X,Y})=>[X/factor/scale[0],Y/factor/scale[1]])}));
 if(result.length>64||result.reduce((n,r)=>n+r.points.length,0)>2000)throw Error('オフセット線が細かすぎます。輪郭や距離を調整してください');
 // Offsets may extend beyond the photograph; topology validation uses a
 // translated temporary box rather than clipping the new geometry to it.
 const all=result.flatMap(r=>r.points),min=[0,1].map(k=>Math.min(0,...all.map(p=>p[k]))),max=[0,1].map(k=>Math.max(size[k],...all.map(p=>p[k]))),ratio=Math.min(1,1020/Math.max(max[0]-min[0],max[1]-min[1]));validateTraceEdits(result.map(r=>({hole:r.hole,points:r.points.map(p=>p.map((v,k)=>(v-min[k])*ratio+1))})),1024,1024);return result;
}
