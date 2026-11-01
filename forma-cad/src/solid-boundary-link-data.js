import {featureReads} from './history-impact.js';
const id=v=>typeof v==='string'&&v.length>0&&v.length<=100,point=v=>Array.isArray(v)&&v.length===3&&v.every(x=>Number.isFinite(x)&&Math.abs(x)<100000);
export function validateSolidBoundaryLink(f){
 const l=f?.solidBoundaryLink;if(l===undefined)return;
 if(f.kind!=='sketch'||!l||l.version!==1||l.ownerId!==f.id||!id(l.bundleId)||typeof l.enabled!=='boolean'||!id(l.bodyId)||!Array.isArray(l.sourceIds)||!l.sourceIds.length||l.sourceIds.length>150||l.sourceIds.some(x=>!id(x))||new Set(l.sourceIds).size!==l.sourceIds.length||!Number.isInteger(l.index)||!Number.isInteger(l.count)||l.count<1||l.count>150||l.index<0||l.index>=l.count||!Array.isArray(l.bounds)||l.bounds.length!==2||!l.bounds.every(point)||l.bounds[0].some((v,i)=>v>l.bounds[1][i])||!point(l.seed)||typeof l.topology!=='string'||l.topology.length>100000)throw Error('ソリッド境界の追従情報が不正です');
}
export function validateSolidBoundaryLinks(features){
 const groups=new Map(),order=new Map(features.map((f,i)=>[f.id,i]));for(const f of features){validateSolidBoundaryLink(f);const l=f.solidBoundaryLink;if(!l)continue;if(!groups.has(l.bundleId))groups.set(l.bundleId,[]);groups.get(l.bundleId).push(f);}
 for(const group of groups.values()){
  const l=group[0].solidBoundaryLink;if(!l.enabled)continue;const first=Math.min(...group.map(f=>order.get(f.id))),sources=l.sourceIds.map(id=>features.find(f=>f.id===id));
  if(group.length!==l.count||new Set(group.map(f=>f.solidBoundaryLink.index)).size!==l.count||group.some(f=>JSON.stringify({...f.solidBoundaryLink,index:0,ownerId:''})!==JSON.stringify({...l,index:0,ownerId:''}))||sources.some(f=>!f||f.kind!=='sketch'||order.get(f.id)>=first||f.solidBoundaryLink||f.offsetLink||f.sketchMirrorLink||f.sketchConstraints?.length))throw Error('追従する境界と元の線の組が変わりました。追従をOFFにして囲み直してください');
  const bodies=new Set();for(const f of features.slice(0,first)){const r=f.cadResult||(f.kind==='cadop'?f:null);if(r){for(const id of r.remove||[])bodies.delete(id);for(const o of r.outputs||[])bodies.add(o.id);}else if(f.kind!=='sketch'&&f.kind!=='plane'&&f.kind!=='referenceImage'&&f.operation==='new')bodies.add(f.id);}if(!bodies.has(l.bodyId))throw Error('追従元のソリッドがありません。追従をOFFにしてください');
  if(features.slice(0,first).some(f=>l.sourceIds.some(id=>order.get(f.id)>order.get(id)&&featureReads(f).has(id))))throw Error('元の線に取り込み前の加工があるため追従できません。追従をOFFにして囲み直してください');
 }
 return groups;
}
const shape=f=>JSON.stringify(['profile','plane','frame','x','y','z','width','height','angle','diameter','points','closed','arc'].map(k=>f?.[k]));
export function guardSolidBoundaryEdits(next,before){
 const old=new Map(before.map(f=>[f.id,f]));for(const [i,f]of next.entries()){
  const previous=old.get(f.id),l=f.solidBoundaryLink;if(!l?.enabled||!previous?.solidBoundaryLink?.enabled||shape(f)===shape(previous)||JSON.stringify(l)!==JSON.stringify(previous.solidBoundaryLink))continue;
  const inputChanged=next.slice(0,i).some(p=>p.kind!=='sketch'&&JSON.stringify(p)!==JSON.stringify(old.get(p.id))||l.sourceIds.includes(p.id)&&shape(p)!==shape(old.get(p.id)));if(!inputChanged)throw Error('追従ONの境界は直接編集できません。元の境界への追従をOFFにしてください');
 }
}
