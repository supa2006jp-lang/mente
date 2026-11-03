import Clipper from 'clipper-lib';
import {validateTraceTopology} from './reference-trace-dimensions.js';
import {offsetTraceCurves} from './reference-trace-offset-curves.js';
import {polylineDifference} from './spline-analysis.js';
const FACTOR=100000;
function polygonOffset(rings,distance,scale){
 const paths=rings.map(r=>{const path=r.points.map(p=>({X:Math.round(p[0]*scale[0]*FACTOR),Y:Math.round(p[1]*scale[1]*FACTOR)}));if(Clipper.Clipper.Orientation(path)===r.hole)path.reverse();return path;}),offset=new Clipper.ClipperOffset(4,.005*FACTOR),out=[];
 offset.AddPaths(paths,Clipper.JoinType.jtMiter,Clipper.EndType.etClosedPolygon);offset.Execute(out,distance*FACTOR);return out.map(p=>({hole:Clipper.Clipper.Area(p)<0,points:p.map(({X,Y})=>[X/FACTOR/scale[0],Y/FACTOR/scale[1]])}));
}
export function offsetTraceRings(rings,distance,scale=[1,1],size=[1024,1024]){
 const distances=Array.isArray(distance)?distance:rings.map(()=>distance),uniform=distances.every(n=>n===distances[0]);
 if(distances.length!==rings.length||distances.some(n=>!Number.isFinite(n)||Math.abs(n)<.001||Math.abs(n)>100)||!scale.every(n=>Number.isFinite(n)&&n>0))throw Error('オフセット距離は±0.001〜100 mmで指定してください');validateTraceTopology(rings);
 let result;
 if(uniform)result=polygonOffset(rings,distances[0],scale);
 else result=rings.flatMap((r,i)=>{const exterior={hole:false,points:r.hole?[...r.points].reverse():r.points},out=polygonOffset([exterior],distances[i]*(r.hole?-1:1),scale);if(out.length!==1||out[0].hole)throw Error('輪郭 '+(i+1)+' が消滅・分離します。個別の距離を小さくしてください');return [{hole:r.hole,points:r.hole?[...out[0].points].reverse():out[0].points}];});
 if(!result.length)throw Error('オフセットすると輪郭が消えます。距離を小さくしてください');
 // Retain analytic arcs only if loop count, holes and the robust offset agree.
 const curves=rings.map((r,i)=>offsetTraceCurves(r,distances[i],scale)),used=new Set();
 if(result.length===rings.length)for(let i=0;i<curves.length;i++){const candidate=curves[i];if(!candidate)continue;const physical=r=>[...r.points,r.points[0]].map(p=>p.map((n,k)=>n*scale[k]));const index=result.findIndex((r,j)=>!used.has(j)&&r.hole===candidate.hole&&polylineDifference(physical(r),physical(candidate),.025)<=.025);if(index>=0){result[index]=candidate;used.add(index);}}
 validateTraceTopology(result);return result;
}
