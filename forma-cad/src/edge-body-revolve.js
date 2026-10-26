import {edgeTurnFrame} from './edge-quarter-turn.js';

// Unlike the quarter-turn placement command, always sweep the owner of the
// selected edge. A touching upper body must never replace this source.
export function edgeBodyRevolveOptions(edge){
 if(typeof edge?.bodyId!=='string'||!edge.bodyId)throw Error('ソリッドの直線の辺を1本選択してください');
 const {a,axis}=edgeTurnFrame(edge);
 return {sourceBody:edge.bodyId,bodySweep:true,target:edge.bodyId,operation:'join',angle:360,direction:'片側',origin:a.toArray(),axisVector:axis.toArray()};
}
