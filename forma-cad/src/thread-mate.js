import * as R from 'replicad';
import {defaults} from './geometry.js';
import {hexPrism} from './free-screw.js';
import {serializeCadShape} from './cad-serialization.js';
import {threadMateSource} from './thread-source.js';
import {threadCylinderInfo} from './thread-cylinder.js';
import {allThreadPullSpec} from './thread-pull-spec.js';
import {machineThreadMate} from './thread-mate-existing.js';

function hexNutSeed(id,diameter,wall,height,origin){
 const hex=hexPrism(diameter+2*wall,0,height),bore=R.makeCylinder(diameter/2,height+.1,[0,0,-.05]);
 let nut,placed;
 try{
  nut=hex.cut(bore);placed=nut.translate(origin);
  return {kind:'cadop',id,outputs:[{id,brep:serializeCadShape(placed)}],remove:[]};
 }finally{placed?.delete();nut?.delete();bore.delete();hex.delete();}
}

function mateThread(id,{diameter,length,pitch,leftHand,clearance,designation},[x,y,z]){
 const thread={type:'thread',target:id,surfacePoint:[x+diameter/2,y,z+length/2],pitch,fullLength:true,leftHand,
  profile:'metric60',threadVersion:2,modeled:true,designation};
 return clearance?allThreadPullSpec(thread,-clearance):thread;
}

export function makeHexNut({id,diameter,wall,height,pitch,leftHand,clearance,origin,designation='M'+diameter+' × '+pitch},run){
 const seed=hexNutSeed(id,diameter,wall,height,origin);
 return run([seed],mateThread(id,{diameter,length:height,pitch,leftHand,clearance,designation},origin));
}

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
 const q={...info,length:spec.length,wall:spec.destination==='existing'?info.wall:spec.wall,clearance:spec.clearance};
 if(!spec.id||features.some(f=>f.id===spec.id||(f.outputs||f.cadResult?.outputs)?.some(o=>o.id===spec.id)))throw Error('相手ねじの工程IDが重複しています');
 if(![q.length,q.wall,q.clearance].every(Number.isFinite)||q.length<.1||q.length>10000||q.length/q.pitch>100||q.wall<.1||q.wall>1000||q.clearance<0||q.clearance>q.pitch*.4)throw Error('長さ・肉厚・逃がし量を確認してください。逃がし量はピッチの40%以内です');
 if(q.internal&&q.wall-q.clearance<.1)throw Error('逃がし量を引いた後の肉厚を0.1 mm以上残してください');
 if(!q.internal&&q.diameter/2-q.pitch*.561266-q.clearance<=.1)throw Error('この径・ピッチ・逃がし量では雄ねじの芯が細くなりすぎます');
 if(spec.destination==='existing')return machineThreadMate(features,spec,q,{bodies,run});
 if(spec.destination!==undefined&&spec.destination!=='new')throw Error('相手ねじの作成先が不正です');
 if(spec.shape!==undefined&&(!q.internal||!['hex','round'].includes(spec.shape)))throw Error('ナットの形状が不正です');
 const hex=spec.shape==='hex',radius=q.diameter/2,outer=radius+(q.internal?q.wall:0);
 const x=maxX+10+(hex?outer*2/Math.sqrt(3):outer),y=(minY+maxY)/2;
 const primitive={...defaults,kind:'extrusion',id:spec.id,name:q.internal?'相手ねじ ナット':'相手ねじ 円柱',profile:'circle',mode:q.internal?'thin':'solid',side:'outside',diameter:q.diameter,wall:q.wall,depth:q.length,x,y,z:0};
 const position=[x,y,0],result=hex?makeHexNut({...q,id:spec.id,height:q.length,origin:position},run):
  run([primitive],mateThread(spec.id,q,position));
 return {...result,analysis:{...q,position,...(spec.shape?{shape:spec.shape}:{})}};
}
