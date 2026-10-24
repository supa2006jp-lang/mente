import {featureReads,featureWrites} from './history-impact.js';

const names={printSupport:'疑似サポート',assemblyMate:'位置合わせ・固定',assemblyRelease:'固定を解除',sketch:'スケッチ',extrusion:'押し出し',plane:'構築平面',referenceImage:'下絵',cadop:'その他のCAD操作',fillet:'フィレット',chamfer:'面取り',shell:'シェル',pipe:'パイプ',enclose:'囲み形成',circular:'円形状パターン',rectangular:'矩形状パターン',move:'移動／回転',join:'結合・切り取り',split:'分離',mirror:'ミラー',thread:'ねじ',threadMate:'相手ねじ',bossJoint:'ボス接合',simpleBoss:'簡易ボス',ballJoint:'ボール接合',coilJoint:'コイル接合',coil:'コイル',qrCode:'QRコード',offset:'オフセット平面',revolve:'回転',loft:'ロフト',svgWrap:'SVG巻き付け',slideLid:'スライド蓋',snapLid:'被せ蓋',cylinderHinge:'円柱ヒンジ蓋',printLayout:'印刷配置'};
const normalize=value=>String(value||'').normalize('NFKC').toLocaleLowerCase('ja').trim();
export function historyGroupName(value){
 if(typeof value!=='string'||value.trim().length>60)throw Error('グループ名は60文字以内にしてください');
 return value.trim();
}
export function assignHistoryGroup(features,ids,value){
 const group=historyGroupName(value),selected=new Set(ids);
 if(!selected.size||[...selected].some(id=>!features.some(f=>f.id===id)))throw Error('整理する工程を選択してください');
 const sketches=new Set(features.filter(f=>selected.has(f.id)&&f.kind==='sketch'&&f.groupId).map(f=>f.groupId));
 return features.map(feature=>{
  if(!selected.has(feature.id)&&!(feature.kind==='sketch'&&sketches.has(feature.groupId)))return feature;
  if((feature.historyGroup||'')===group)return feature;
  const next={...feature};if(group)next.historyGroup=group;else delete next.historyGroup;return next;
 });
}
export function inheritSketchHistoryGroups(features){
 const groups=new Map();for(const f of features)if(f.kind==='sketch'&&f.groupId&&f.historyGroup&&!groups.has(f.groupId))groups.set(f.groupId,f.historyGroup);
 return features.map(f=>f.kind==='sketch'&&f.groupId&&!f.historyGroup&&groups.has(f.groupId)?{...f,historyGroup:groups.get(f.groupId)}:f);
}
export function historyCatalog(features,currentBodies=[]){
 const producers=new Map(),bodyNames=new Map(),records=[],groupedSketches=new Map();
 features.forEach((feature,index)=>{
  const reads=featureReads(feature),writes=featureWrites(feature),lineage=new Set([feature.id]);
  for(const id of reads)for(const parent of producers.get(id)||[])lineage.add(parent);
  for(const id of writes)producers.set(id,new Set(lineage));
  const outputs=feature.cadResult?.outputs||(feature.kind==='cadop'?feature.outputs:[])||[];
  const born=(!feature.kind||feature.kind==='extrusion')&&feature.operation==='new'?[feature.id]:outputs.map(o=>o.id);
  born.forEach((id,i)=>{if(!bodyNames.has(id))bodyNames.set(id,(feature.name||'ボディ')+(born.length>1?' / '+(i+1):'')+'［工程'+(index+1)+'］');});
  const type=feature.kind==='cadop'?(feature.spec?.type||'cadop'):feature.kind||'extrusion',typeLabel=Object.hasOwn(names,type)?names[type]:type;
  const item={id:feature.id,ids:[feature.id],index,number:index+1,name:feature.kind==='sketch'?'スケッチ'+(feature.groupNumber||''):feature.name||typeLabel,type,typeLabel,group:historyGroupName(feature.historyGroup||''),bodyIds:new Set(),terms:[feature.name,typeLabel,type,feature.historyGroup,index+1]};
  const key=feature.kind==='sketch'?(feature.groupId||feature.id):null;
  if(key&&groupedSketches.has(key)){const first=groupedSketches.get(key);first.ids.push(feature.id);first.terms.push(...item.terms);}
  else{records.push(item);if(key)groupedSketches.set(key,item);}
 });
 for(const body of currentBodies)if(bodyNames.has(body.id))bodyNames.set(body.id,body.name);
 const related=new Map();for(const [id]of bodyNames)for(const featureId of producers.get(id)||[]){const ids=related.get(featureId)||new Set();ids.add(id);related.set(featureId,ids);}
 for(const record of records){for(const id of record.ids)for(const body of related.get(id)||[])record.bodyIds.add(body);record.search=normalize([...record.terms,record.name,...[...record.bodyIds].map(id=>bodyNames.get(id))].join(' '));}
 return {entries:records,bodies:[...bodyNames].map(([id,name])=>({id,name})),types:[...new Set(records.map(r=>r.type))].map(type=>({id:type,name:Object.hasOwn(names,type)?names[type]:type})),groups:[...new Set(records.map(r=>r.group).filter(Boolean))]};
}
export function filterHistory(entries,{query='',body='',type='',group=null}={}){
 const terms=normalize(query).split(/\s+/).filter(Boolean);
 return entries.filter(entry=>(!body||entry.bodyIds.has(body))&&(!type||entry.type===type)&&(group===null||entry.group===group)&&terms.every(term=>entry.search.includes(term)));
}
export function historyBuckets(entries){
 const groups=new Map(),buckets=[];
 for(const entry of entries){if(!entry.group){buckets.push({group:'',entries:[entry]});continue;}if(!groups.has(entry.group)){const bucket={group:entry.group,entries:[]};groups.set(entry.group,bucket);buckets.push(bucket);}groups.get(entry.group).entries.push(entry);}
 return buckets;
}
