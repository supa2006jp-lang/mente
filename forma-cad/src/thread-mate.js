import {defaults} from './geometry.js';
import {threadMateSource} from './thread-source.js';
import {threadCylinderInfo} from './thread-cylinder.js';
import {allThreadPullSpec} from './thread-pull-spec.js';

export function makeThreadMate(features,spec,{bodies,run}){
 const source=threadMateSource(features,spec.target);
 if(!source)throw Error('このアプリの通常のねじで作成したボディを選択してください');
 const original=bodies(source.features);let cylinder;
 try{const body=original.get(source.spec.target);if(body)cylinder=threadCylinderInfo(body,source.spec.surfacePoint);}finally{original.forEach(b=>b.delete());}
 if(!cylinder)throw Error('元のねじの円筒面が見つかりません');
 const s=source.spec,pitch=s.pitch,length=s.fullLength?cylinder.height:s.length;
 const info={diameter:cylinder.radius*2,pitch,leftHand:!!s.leftHand,sourceInternal:cylinder.internal,internal:!cylinder.internal,length,wall:Math.max(2,pitch*1.5),clearance:Math.min(.2,pitch*.15),designation:s.designation||'M'+Number((cylinder.radius*2).toFixed(4))+' × '+pitch};
 const current=bodies(features);let maxX=-Infinity,minY=Infinity,maxY=-Infinity;
 try{
  if(!current.has(spec.target))throw Error('元のねじボディがありません');
  for(const body of current.values()){const box=body.boundingBox;try{const [lo,hi]=box.bounds;maxX=Math.max(maxX,hi[0]);minY=Math.min(minY,lo[1]);maxY=Math.max(maxY,hi[1]);}finally{box.delete();}}
 }finally{current.forEach(b=>b.delete());}
 if(spec.type==='threadMateInfo')return {analysis:info};
 const q={...info,length:spec.length,wall:spec.wall,clearance:spec.clearance};
 if(!spec.id||features.some(f=>f.id===spec.id||(f.outputs||f.cadResult?.outputs)?.some(o=>o.id===spec.id)))throw Error('相手ねじの工程IDが重複しています');
 if(![q.length,q.wall,q.clearance].every(Number.isFinite)||q.length<.1||q.length>10000||q.length/q.pitch>100||q.wall<.1||q.wall>1000||q.clearance<0||q.clearance>q.pitch*.4)throw Error('長さ・肉厚・逃がし量を確認してください。逃がし量はピッチの40%以内です');
 if(q.internal&&q.wall-q.clearance<.1)throw Error('逃がし量を引いた後の肉厚を0.1 mm以上残してください');
 if(!q.internal&&q.diameter/2-q.pitch*.561266-q.clearance<=.1)throw Error('この径・ピッチ・逃がし量では雄ねじの芯が細くなりすぎます');
 const radius=q.diameter/2,outer=radius+(q.internal?q.wall:0),x=maxX+10+outer,y=(minY+maxY)/2;
 const primitive={...defaults,kind:'extrusion',id:spec.id,name:q.internal?'相手ねじ ナット':'相手ねじ 円柱',profile:'circle',mode:q.internal?'thin':'solid',side:'outside',diameter:q.diameter,wall:q.wall,depth:q.length,x,y,z:0};
 let thread={type:'thread',target:spec.id,surfacePoint:[x+radius,y,q.length/2],pitch:q.pitch,fullLength:true,leftHand:q.leftHand,profile:'metric60',threadVersion:2,modeled:true,designation:q.designation};
 if(q.clearance)thread=allThreadPullSpec(thread,-q.clearance);
 const result=run([primitive],thread);return {...result,analysis:{...q,position:[x,y,0]}};
}
