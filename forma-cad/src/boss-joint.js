import * as R from 'replicad';
import * as THREE from 'three';
import {basisFor} from './frames.js';
import {fuseSolid} from './solid-fuse.js';
import {bossReinforcementSettings,reinforceBossRoot} from './boss-joint-reinforcement.js';
import {bossShellSettings,shellBossPart} from './boss-joint-shell.js';

const EPS=.001;
const tuple=v=>{try{return v.toTuple();}finally{v.delete();}};
const vector=p=>new THREE.Vector3(...p);
function valid(shape,label){const check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false),solids=shape.solids;try{if(!check.IsValid()||solids.length!==1||!(R.measureVolume(shape)>1e-7))throw Error(label+'を一体のソリッドにできません。接合位置や寸法を変更してください');}finally{check.delete();solids.forEach(s=>s.delete());}}
function limits(shape,basis){const v=shape.mesh({tolerance:.1,angularTolerance:.2}).vertices,min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<v.length;i+=3){const p=new THREE.Vector3(v[i],v[i+1],v[i+2]);for(const [j,key]of ['u','v','n'].entries()){const value=p.dot(basis[key]);min[j]=Math.min(min[j],value);max[j]=Math.max(max[j],value);}}return {min,max};}
function frame(normal){const n=normal.clone().normalize(),u=(Math.abs(n.z)<.9?new THREE.Vector3(0,0,1).cross(n):new THREE.Vector3(1,0,0).addScaledVector(n,-n.x)).normalize();return {u,v:n.clone().cross(u),n};}
function extrude(face,n,height){const v=new R.Vector(n.clone().multiplyScalar(height).toArray());try{return R.basicFaceExtrusion(face,v);}finally{v.delete();}}
function slab(face,n){let wire,filled;try{wire=face.outerWire();filled=R.makeFace(wire);return extrude(filled,n,.1);}finally{wire?.delete();filled?.delete();}}
function matchingPlane(a,b,requested){
 const facesA=a.faces,facesB=b.faces;let best;
 try{
  for(const face of facesA){if(face.geomType!=='PLANE')continue;const n=vector(tuple(face.normalAt())).normalize(),offset=vector(tuple(face.center)).dot(n);if(requested&&(n.dot(requested.n)<.999999||Math.abs(offset-requested.offset)>.02))continue;
   const basis=frame(n),la=limits(a,basis),lb=limits(b,basis);if(Math.abs(la.max[2]-offset)>.02||Math.abs(lb.min[2]-offset)>.02)continue;
   for(const other of facesB){if(other.geomType!=='PLANE'||vector(tuple(other.normalAt())).dot(n)>-.999999||Math.abs(vector(tuple(other.center)).dot(n)-offset)>.02)continue;
    let sa,sb,common;try{sa=slab(face,n);sb=slab(other,n);common=sa.intersect(sb);const area=R.measureVolume(common)/.1;if(area>1e-5&&(!best||area>best.area)){best?.footprint.delete();best={basis,offset,area,footprint:common.clone(),a:la,b:lb};}}finally{sa?.delete();sb?.delete();common?.delete();}
   }
  }
  if(!best)throw Error('平らな分割面で接している2つのパーツを選択してください。印刷用に移動する前の位置で実行してください');
  return best;
 }finally{facesA.forEach(f=>f.delete());facesB.forEach(f=>f.delete());}
}
function number(p,key,min,max){if(!Number.isFinite(p[key])||p[key]<min||p[key]>max)throw Error(({diameter:'棒の直径',length:'差し込み長さ',clearance:'片側のすき間',bossWall:'ボスの肉厚',bossHeight:'ボスの最低高さ',spacing:'接合の間隔',offsetU:'横方向の位置',offsetV:'縦方向の位置'}[key]||key)+'を'+min+'〜'+max+' mmで指定してください');return p[key];}
function checkSettings(p){
 if(!['split','pair'].includes(p.mode))throw Error('作成方法を選択してください');if(!['assembled','print'].includes(p.pose))throw Error('配置を選択してください');if(![1,2,4].includes(p.count))throw Error('接合の数は1・2・4個から選んでください');
 if(p.symmetricPlacement!==undefined&&typeof p.symmetricPlacement!=='boolean')throw Error('対称配置の設定を確認してください');
 if(p.jointPositions!==undefined&&(!Array.isArray(p.jointPositions)||p.jointPositions.length!==p.count||p.jointPositions.some(q=>!Array.isArray(q)||q.length!==2||q.some(v=>!Number.isFinite(v)||Math.abs(v)>10000))))throw Error('接合位置の数と座標を確認してください');
 number(p,'diameter',1,50);number(p,'length',1,100);number(p,'clearance',.05,1);number(p,'bossWall',.8,20);number(p,'bossHeight',2,200);number(p,'spacing',0,1000);number(p,'offsetU',-10000,10000);number(p,'offsetV',-10000,10000);
 if(p.bossHeight<p.length+p.clearance+1.2)throw Error('ボス高さを「差し込み長さ＋すき間＋底厚1.2 mm」以上にしてください');
}
function pointAt(basis,offset,uv){return basis.u.clone().multiplyScalar(uv[0]).addScaledVector(basis.v,uv[1]).addScaledVector(basis.n,offset);}
function candidates(info,p,radius){
 const box=limits(info.footprint,info.basis),min=box.min,max=box.max,center=[(min[0]+max[0])/2+p.offsetU,(min[1]+max[1])/2+p.offsetV],w=max[0]-min[0],h=max[1]-min[1],long=w>=h?0:1;
 const d=p.spacing||Math.max(radius*2+1,(long===0?w:h)*.45),short=p.spacing||Math.max(radius*2+1,(long===0?h:w)*.45);
 const desired=p.jointPositions|| (p.count===1?[center]:p.count===2?[-1,1].map(sign=>center.map((v,i)=>v+(i===long?sign*d/2:0))):[-1,1].flatMap(s=>[-1,1].map(t=>center.map((v,i)=>v+(i===long?s*d:t*short)/2))));
 // Prefer the requested pattern; the grid supplies nearby alternatives for concave outlines.
 const grid=[];for(let x=0;x<9;x++)for(let y=0;y<9;y++)grid.push([min[0]+radius+.2+(w-2*radius-.4)*x/8,min[1]+radius+.2+(h-2*radius-.4)*y/8]);
 return {desired,grid,min,max,center,long};
}
function fitDisk(footprint,basis,offset,uv,radius){const disk=R.makeCylinder(radius+.15,.1,pointAt(basis,offset,uv).toArray(),basis.n.toArray());let common;try{common=disk.intersect(footprint);return Math.abs(R.measureVolume(common)-Math.PI*(radius+.15)**2*.1)<1e-4;}finally{common?.delete();disk.delete();}}
function anchor(shape,info,uv,radius,side){const {basis,offset}=info,range=side<0?info.a:info.b,from=side<0?range.min[2]-.1:offset+EPS,to=side<0?offset-EPS:range.max[2]+.1;if(to<=from)return null;const tool=R.makeCylinder(radius,to-from,pointAt(basis,from,uv).toArray(),basis.n.toArray());let common;try{common=shape.intersect(tool);if(R.measureVolume(common)<1e-5)return null;const l=limits(common,basis);return {near:side<0?l.max[2]:l.min[2],far:side<0?l.min[2]:l.max[2]};}finally{common?.delete();tool.delete();}}
function printParts(shapes,basis){
 const out=[],placements=[];let edge=0;
 try{for(const [index,shape]of shapes.entries()){
  const outward=basis.n.clone().multiplyScalar(index?-1:1),z=new THREE.Vector3(0,0,1),dot=THREE.MathUtils.clamp(outward.dot(z),-1,1),angle=Math.acos(dot)*180/Math.PI,axis=outward.clone().cross(z);if(axis.length()<1e-7)axis.copy(basis.u);axis.normalize();
  let positioned=shape.clone();try{if(angle>1e-7)positioned=positioned.rotate(angle,[0,0,0],axis.toArray());const box=positioned.boundingBox;let bounds;try{bounds=box.bounds;}finally{box.delete();}const translation=[edge-bounds[0][0],-bounds[0][1],-bounds[0][2]];positioned=positioned.translate(translation);edge=bounds[1][0]+translation[0]+10;out.push(positioned);positioned=null;placements.push({angle,axis:axis.toArray(),translation});}finally{positioned?.delete();}
 }return {parts:out,placements};}catch(e){out.forEach(s=>s.delete());throw e;}
}
export function makeBossJoint(source,other,p,onProgress){
 checkSettings(p);const reinforcement=bossReinforcementSettings(p),shell=bossShellSettings(p);if(!source)throw Error('対象のソリッドを選択してください');if(p.mode==='pair'&&(!other||p.target===p.pinTarget))throw Error('ボス側と棒側には別のパーツを選択してください');
 const owned=[],hold=s=>(owned.push(s),s);let a,b,requested;
 try{
  if(p.mode==='split'){
   if(!['XY','XZ','YZ'].includes(p.plane)||!Number.isFinite(p.offset))throw Error('分割平面と位置を指定してください');const basis=basisFor({plane:p.plane}),l=limits(source,basis);if(p.offset<=l.min[2]+.01||p.offset>=l.max[2]-.01)throw Error('分割位置をソリッドの内部にしてください');
   const plane=new R.Plane(basis.n.clone().multiplyScalar(p.offset).toArray(),basis.u.toArray(),basis.n.toArray()),split=source.split(plane,0);a=split.negative&&hold(split.negative);b=split.positive&&hold(split.positive);if(!a||!b)throw Error('この位置ではソリッドを2つに分割できません');requested={n:basis.n,offset:p.offset};
  }else{a=source;b=other;}
  valid(a,'ボス側');valid(b,'棒側');const info=matchingPlane(a,b,requested);hold(info.footprint);if(shell.enabled){onProgress?.({stage:'分割した2パーツを中空にしています'});const receiver=shellBossPart(a,info,1,shell.thickness,'ボス側');a=hold(receiver.shape);const male=shellBossPart(b,info,-1,shell.thickness,'棒側');b=hold(male.shape);shell.parts=[{status:receiver.status,removedVolume:receiver.removedVolume},{status:male.status,removedVolume:male.removedVolume}];valid(a,'中空化したボス側');valid(b,'中空化した棒側');}const {basis,offset}=info,r=p.diameter/2,holeR=r+p.clearance,outerR=holeR+p.bossWall,layout=candidates(info,p,outerR),positions=[];
  onProgress?.({stage:'ボスと棒の接合位置を探しています'});
  for(const desired of layout.desired){
   const options=(p.jointPositions||p.spacing||p.offsetU||p.offsetV?[desired]:[desired,...layout.grid]).sort((x,y)=>Math.hypot(x[0]-desired[0],x[1]-desired[1])-Math.hypot(y[0]-desired[0],y[1]-desired[1]));let accepted;
   for(const uv of options){if(positions.some(q=>Math.hypot(q.uv[0]-uv[0],q.uv[1]-uv[1])<q.envelope+outerR+1)||uv.some((v,i)=>v-outerR<layout.min[i]||v+outerR>layout.max[i]))continue;
    if(!fitDisk(info.footprint,basis,offset,uv,outerR))continue;const receiver=anchor(a,info,uv,outerR,-1),pin=anchor(b,info,uv,r,1);if(!receiver||!pin)continue;
    const root=Math.max(receiver.far+.1,Math.min(offset-p.bossHeight,receiver.near-.3));if(offset-root<p.length+p.clearance+1.2-1e-6)continue;
    const bossAmount=reinforcement.type==='none'?0:Math.max(0,Math.min(reinforcement.size,offset-receiver.near-.3)),pinAmount=reinforcement.type==='none'?0:Math.max(0,Math.min(reinforcement.size,pin.near-offset-.3)),envelope=Math.max(outerR+(bossAmount>=.2?bossAmount:0),r+(pinAmount>=.2?pinAmount:0));
    if(!fitDisk(info.footprint,basis,offset,uv,envelope)||positions.some(q=>Math.hypot(q.uv[0]-uv[0],q.uv[1]-uv[1])<q.envelope+envelope+1))continue;
    accepted={uv,root,pinRoot:pin.near+.3,bossBase:receiver.near,pinBase:pin.near,envelope,point:pointAt(basis,offset,uv).toArray()};break;
   }
   if(!accepted)throw Error('指定した数のボスを置く広さ・厚さがありません。棒の直径、接合数、差し込み長さを小さくするか、分割位置を変更してください');positions.push(accepted);
  }
  let receiver=hold(a.clone()),male=hold(b.clone());const warnings=[];
  for(const [index,position]of positions.entries()){
   onProgress?.({stage:'ボスと棒を作成しています',current:index+1,total:positions.length});const start=pointAt(basis,position.root,position.uv),boss=hold(R.makeCylinder(outerR,offset-position.root,start.toArray(),basis.n.toArray()));receiver=hold(fuseSolid(receiver,boss));
   const hole=hold(R.makeCylinder(holeR,p.length+p.clearance+EPS,pointAt(basis,offset-p.length-p.clearance,position.uv).toArray(),basis.n.toArray()));receiver=hold(receiver.cut(hole));
   const tip=offset-p.length,lead=Math.min(.4,r*.35,p.length*.2),pinBody=hold(R.makeCylinder(r,position.pinRoot-tip-lead,pointAt(basis,tip+lead,position.uv).toArray(),basis.n.toArray()));
   const tipPlane=new R.Plane(pointAt(basis,tip,position.uv).toArray(),basis.u.toArray(),basis.n.toArray()),leadPlane=new R.Plane(pointAt(basis,tip+lead,position.uv).toArray(),basis.u.toArray(),basis.n.toArray());
   const taper=hold(R.drawCircle(r-lead).sketchOnPlane(tipPlane).loftWith(R.drawCircle(r).sketchOnPlane(leadPlane),{ruled:true})),rod=hold(fuseSolid(pinBody,taper));male=hold(fuseSolid(male,rod));
   const receiverRoot=reinforceBossRoot(receiver,{basis,uv:position.uv,z:position.bossBase,side:1,radius:outerR,height:offset-position.bossBase,...reinforcement},hold),maleRoot=reinforceBossRoot(male,{basis,uv:position.uv,z:position.pinBase,side:-1,radius:r,height:position.pinBase-offset,...reinforcement},hold);receiver=receiverRoot.shape;male=maleRoot.shape;position.reinforcement={boss:receiverRoot.amount,pin:maleRoot.amount};
   let nearWall=!fitDisk(info.footprint,basis,offset,position.uv,position.envelope+1);
   for(const [shape,base,end]of [[a,position.bossBase+receiverRoot.amount,offset],[b,offset,position.pinBase-maleRoot.amount]])if(end-base>1){const tool=hold(R.makeCylinder(position.envelope+1,.1,pointAt(basis,(base+end)/2,position.uv).toArray(),basis.n.toArray())),hit=hold(shape.intersect(tool));if(R.measureVolume(hit)>1e-5)nearWall=true;}
   position.nearWall=nearWall;if(nearWall)warnings.push('接合'+(index+1)+'は壁・外周との余裕が1 mm未満です。位置や補強サイズを確認してください');
  }
  valid(receiver,'ボス側');valid(male,'棒側');const common=hold(receiver.intersect(male)),overlap=R.measureVolume(common);if(overlap>1e-5)throw Error('パーツ同士が干渉します。すき間や接合位置を変更してください');
  const analysis={count:p.count,diameter:p.diameter,holeDiameter:p.diameter+p.clearance*2,outerDiameter:outerR*2,length:p.length,clearance:p.clearance,overlap,offset,frame:Object.fromEntries(Object.entries(basis).map(([k,v])=>[k,v.toArray()])),positions:positions.map(q=>({...q,bossHeight:offset-q.root})),area:info.area,shell,reinforcement:{type:reinforcement.type,size:reinforcement.size,applied:positions.filter(q=>q.reinforcement.boss||q.reinforcement.pin).length},warnings,layout:{center:p.jointPositions?positions.reduce((a,q)=>a.map((v,i)=>v+q.uv[i]/positions.length),[0,0]):layout.center,long:layout.long,bounds:[layout.min.slice(0,2),layout.max.slice(0,2)]}};
  if(p.pose==='print'){const result=printParts([receiver,male],basis);return {...result,analysis:{...analysis,placements:result.placements}};}
  return {parts:[receiver.clone(),male.clone()],analysis};
 }finally{owned.reverse().forEach(s=>s.delete());}
}
