import {supportLayerHasPath,supportSliceCadPoint,supportSlicePoint} from './print-support-slice-geometry.js';

const round=value=>Number(value.toFixed(5));
const uniquePoint=point=>point.map(round).join(',');
const storageKey='forma-print-support-slice-comparison-v1';

function geometryKey(mesh){
 const seen=new Set();
 let xor=0,sum=0;
 for(let i=0;i<mesh.vertices.length;i+=3){
  const xyz=mesh.vertices.slice(i,i+3).map(value=>Math.round(value*10000));
  const key=xyz.join(',');
  if(seen.has(key))continue;
  seen.add(key);
  let hash=2166136261;
  for(const coordinate of xyz)hash=Math.imul(hash^coordinate,16777619);
  xor^=hash;
  sum=(sum+hash)|0;
 }
 return [seen.size,mesh.triangles.length,sum,xor];
}

export function supportSliceComparisonScope(sources,models){
 return JSON.stringify([...new Set(sources.map(source=>source.target))].sort().map(id=>{
  const mesh=models.find(candidate=>candidate.id===id);
  return mesh?[id,geometryKey(mesh)]:[id];
 }));
}

export function captureSupportSliceReport(rows){
 const targets=new Map();
 for(const row of rows){
  if(!targets.has(row.target))targets.set(row.target,{missing:new Map(),contacts:new Map()});
  const {missing,contacts}=targets.get(row.target);
  for(const point of row.missingPoints||[]){
   if(missing.size>=4500)break;
   missing.set(uniquePoint(point),point.map(round));
  }
  for(const contact of row.contacts||[]){
   if(contacts.size>=6500)break;
   if(!Number.isFinite(contact.surface))continue;
   const [x,y]=contact.point,surface=round(contact.surface);
   const key=contact.role+':'+uniquePoint([x,y,surface]);
   contacts.set(key,{role:contact.role,surface,point:contact.point.map(round),gap:round(contact.gap),layers:contact.layers});
  }
 }
 return [...targets].map(([id,values])=>({id,missing:[...values.missing.values()],contacts:[...values.contacts.values()]}));
}

export function createSupportSliceHistory(getStorage=()=>globalThis.sessionStorage){
 const history=new Map();
 try{
  const entries=JSON.parse(getStorage()?.getItem(storageKey)??'[]');
  if(Array.isArray(entries))for(const [key,entry] of entries.slice(-4)){
   if(typeof key==='string'&&typeof entry?.name==='string'&&Array.isArray(entry?.report))history.set(key,entry);
  }
 }catch{}
 return {
  previous(scope){return history.get(scope)??null;},
  remember(scope,entry){
   history.delete(scope);history.set(scope,entry);
   while(history.size>4)history.delete(history.keys().next().value);
   try{getStorage()?.setItem(storageKey,JSON.stringify([...history]));}catch{}
  },
 };
}

function layerAt(layers,height){
 let lo=0,hi=layers.length;
 while(lo<hi){
  const middle=(lo+hi)>>1;
  if(layers[middle].z<height-1e-5)lo=middle+1;else hi=middle;
 }
 return lo;
}

function currentPathAt(point,source,layers,matrix){
 if(!source.solid.contains(...point))return 'moved';
 const [x,y,z]=supportSlicePoint(matrix,point),index=layerAt(layers,z);
 for(let i=Math.max(0,index-1);i<Math.min(layers.length,index+2);i++){
  const layer=layers[i];
  if(z<layer.z-layer.height-1e-5||z>layer.z+1e-5)continue;
  if(supportLayerHasPath(layer,x,y,(path,px,py)=>path.normal&&
   source.solid.contains(...supportSliceCadPoint(matrix,[px,py,layer.mid]))))return 'restored';
 }
 return 'remaining';
}

const contactGrid=.05;
function contactKey(role,x,y,z){return role+':'+x+','+y+','+z;}
function makeContactIndex(contacts){
 const cells=new Map();
 for(const contact of contacts){
  const [x,y,z]=[...contact.point.slice(0,2),contact.surface].map(value=>Math.floor(value/contactGrid));
  const key=contactKey(contact.role,x,y,z);
  if(!cells.has(key))cells.set(key,[]);
  cells.get(key).push(contact);
 }
 return cells;
}

function nearestContact(contact,index,used){
 const [px,py]=contact.point,pz=contact.surface;
 const [x,y,z]=[px,py,pz].map(value=>Math.floor(value/contactGrid));
 let nearest=null,distance=.05;
 for(let ix=x-1;ix<=x+1;ix++)for(let iy=y-1;iy<=y+1;iy++)for(let iz=z-1;iz<=z+1;iz++){
  for(const other of index.get(contactKey(contact.role,ix,iy,iz))||[]){
   if(used.has(other))continue;
   const delta=Math.hypot(other.point[0]-px,other.point[1]-py,other.surface-pz);
   if(delta<distance){nearest=other;distance=delta;}
  }
 }
 if(nearest)used.add(nearest);
 return nearest;
}

export function compareSupportSlices(previous,rows,{sources,layers,matrix}){
 if(!Array.isArray(previous)||!previous.length)return null;
 const current=new Map(captureSupportSliceReport(rows).map(report=>[report.id,report]));
 const targets=[];
 for(const before of previous){
  if(!Array.isArray(before?.missing)||!Array.isArray(before?.contacts))continue;
  const source=sources.find(source=>source.target===before.id),now=current.get(before.id);
  if(!source||!now)continue;
  const status={restored:{count:0,points:[]},remaining:{count:0,points:[]},moved:{count:0,points:[]}};
  for(const point of before.missing){
   if(!Array.isArray(point)||point.length!==3||!point.every(Number.isFinite))continue;
   const item=status[currentPathAt(point,source,layers,matrix)];
   item.count++;
   if(item.points.length<600)item.points.push(point);
  }
  const index=makeContactIndex(now.contacts),used=new Set(),changes=[];
  let compared=0;
  for(const contact of before.contacts){
   if(!Array.isArray(contact?.point)||!Number.isFinite(contact.surface)||!Number.isFinite(contact.gap))continue;
   const match=nearestContact(contact,index,used);
   if(!match)continue;
   compared++;
   if(contact.layers!==match.layers||Math.abs(contact.gap-match.gap)>.015)
    changes.push({role:match.role,point:match.point,before:{gap:contact.gap,layers:contact.layers},after:{gap:match.gap,layers:match.layers}});
  }
  changes.sort((a,b)=>Math.abs(b.after.gap-b.before.gap)-Math.abs(a.after.gap-a.before.gap));
  targets.push({target:before.id,...status,vertical:{compared,count:changes.length,changes:changes.slice(0,600)}});
 }
 return targets.length?targets:null;
}
